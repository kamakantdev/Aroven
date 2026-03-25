package com.example.swastik.data.repository

import com.example.swastik.data.local.TokenManager
import com.example.swastik.data.local.db.SwastikDatabase
import com.example.swastik.data.remote.ApiService
import com.example.swastik.data.remote.SocketManager
import com.example.swastik.data.remote.dto.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Auth Repository - handles authentication with the backend API.
 * Uses email/password login with email verification flow.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val apiService: ApiService,
    private val tokenManager: TokenManager,
    private val socketManager: SocketManager,
    private val database: SwastikDatabase,
    private val chatbotRepository: ChatbotRepository
) {

    /**
     * Login with email and password.
     * Backend returns JWT tokens on success.
     */
    fun loginWithEmail(email: String, password: String): Flow<Result<Boolean>> = flow {
        emit(Result.Loading)
        try {
            val response = apiService.login(LoginRequest(email = email, password = password, role = "patient"))
            if (response.isSuccessful) {
                val body = response.body()
                val token = body?.resolvedAccessToken()
                if (body?.success == true && token != null) {
                    // Save tokens
                    tokenManager.saveTokens(
                        accessToken = token,
                        refreshToken = body.resolvedRefreshToken() ?: "",
                        expiresInSeconds = body.resolvedExpiresIn()
                    )
                    // Save user info
                    body.resolvedUser()?.let { user ->
                        tokenManager.saveUserInfo(
                            userId = user.id,
                            role = user.role,
                            name = user.name ?: "",
                            phone = user.phone
                        )
                    }
                    // Connect socket after login
                    socketManager.connect()
                    emit(Result.Success(true))
                } else {
                    emit(Result.Error(body?.message ?: "Login failed"))
                }
            } else {
                val errorBody = response.errorBody()?.string()
                emit(Result.Error(parseErrorMessage(errorBody) ?: "Login failed"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.message ?: "Network error"))
        }
    }

    /**
     * Register a new patient account.
     * Backend no longer returns tokens — requires email verification first.
     */
    fun register(name: String, phone: String, email: String, password: String = ""): Flow<Result<Boolean>> = flow {
        emit(Result.Loading)
        try {
            val request = RegisterRequest(
                name = name,
                phone = phone,
                email = email,
                password = password,
                role = "patient"
            )
            val response = apiService.register(request)
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true) {
                    // Registration successful — user needs to verify email before logging in
                    emit(Result.Success(true))
                } else {
                    emit(Result.Error(body?.message ?: "Registration failed"))
                }
            } else {
                val errorBody = response.errorBody()?.string()
                emit(Result.Error(parseErrorMessage(errorBody) ?: "Registration failed"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.message ?: "Network error"))
        }
    }

    /**
     * Resend email verification link.
     */
    suspend fun resendVerification(email: String): Result<Boolean> {
        return try {
            val response = apiService.resendVerification(ResendVerificationRequest(email = email))
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(true)
            } else {
                Result.Error(response.body()?.message ?: "Failed to resend verification email")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Logout - clear tokens and disconnect socket.
     */
    suspend fun logout() {
        try {
            val refreshToken = tokenManager.refreshToken ?: ""
            apiService.logout(LogoutRequest(refreshToken = refreshToken))
        } catch (_: Exception) {
            // Best effort
        } finally {
            tokenManager.clearAll()
            socketManager.disconnect()
            chatbotRepository.clearSession()
            // Clear all Room DB caches
            try {
                database.doctorDao().clearAll()
                database.appointmentDao().clearAll()
                database.notificationDao().clearAll()
                database.prescriptionDao().clearAll()
                database.medicineDao().clearAll()
                database.hospitalDao().clearAll()
            } catch (_: Exception) {}
        }
    }

    /**
     * Forgot password.
     */
    suspend fun forgotPassword(email: String): Result<Boolean> {
        return try {
            val response = apiService.forgotPassword(ForgotPasswordRequest(email = email))
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(true)
            } else {
                Result.Error(response.body()?.message ?: "Failed to send reset email")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Check if user is currently logged in.
     */
    fun isLoggedIn(): Boolean = tokenManager.isAuthenticated()

    /**
     * Get current user role.
     */
    fun getUserRole(): String? = tokenManager.userRole

    /**
     * Get current user name.
     */
    fun getUserName(): String? = tokenManager.userName

    /**
     * Get current authenticated user from the server.
     * GET /api/auth/me
     */
    suspend fun getCurrentUser(): Result<com.example.swastik.data.remote.dto.UserDto> {
        return try {
            val response = apiService.getCurrentUser()
            if (response.isSuccessful && response.body()?.success == true) {
                val user = response.body()?.data
                if (user != null) {
                    // Update cached user info
                    tokenManager.saveUserInfo(
                        userId = user.id,
                        role = user.role,
                        name = user.name ?: "",
                        phone = user.phone
                    )
                    Result.Success(user)
                } else {
                    Result.Error("User data not found")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to fetch user")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Reset password with token from email link.
     * POST /api/auth/reset-password
     */
    suspend fun resetPassword(token: String, newPassword: String): Result<Boolean> {
        return try {
            val response = apiService.resetPassword(
                com.example.swastik.data.remote.dto.ResetPasswordRequest(token = token, newPassword = newPassword)
            )
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(true)
            } else {
                Result.Error(response.body()?.message ?: "Failed to reset password")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    private fun parseErrorMessage(errorBody: String?): String? {
        if (errorBody == null) return null
        return try {
            val json = org.json.JSONObject(errorBody)
            when {
                json.has("message") && !json.isNull("message") -> json.optString("message")
                json.has("error") && !json.isNull("error") -> json.optString("error")
                else -> null
            }
        } catch (_: Exception) {
            errorBody
        }
    }
}
