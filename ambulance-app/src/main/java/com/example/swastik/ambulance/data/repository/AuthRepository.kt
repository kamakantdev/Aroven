package com.example.swastik.ambulance.data.repository

import android.util.Log
import com.example.swastik.ambulance.data.local.TokenManager
import com.example.swastik.ambulance.data.remote.ApiErrorParser
import com.example.swastik.ambulance.data.remote.ApiService
import com.example.swastik.ambulance.data.remote.SocketManager
import com.example.swastik.ambulance.data.remote.dto.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val apiService: ApiService,
    private val tokenManager: TokenManager,
    private val socketManager: SocketManager
) {
    suspend fun registerOperator(
        name: String,
        email: String,
        phone: String,
        password: String,
        companyName: String?
    ): Result<String> {
        return try {
            val response = apiService.register(
                RegisterRequest(
                    email = email.trim(),
                    phone = phone.trim(),
                    password = password,
                    name = name.trim(),
                    companyName = companyName?.trim()?.takeIf { it.isNotBlank() }
                )
            )

            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(
                    response.body()?.data?.message
                        ?: "Registration submitted. Verify your email, then wait for admin approval."
                )
            } else {
                val errorMsg = ApiErrorParser.from(response, response.body()?.message ?: "Registration failed")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Log.e("AuthRepo", "Register error", e)
            Result.failure(e)
        }
    }

    suspend fun login(email: String, password: String): Result<UserDto> {
        return try {
            val response = run {
                val operatorAttempt = apiService.login(LoginRequest(email, password, role = "ambulance_operator"))
                if (operatorAttempt.isSuccessful || operatorAttempt.code() != 403) {
                    operatorAttempt
                } else {
                    apiService.login(LoginRequest(email, password, role = "ambulance_driver"))
                }
            }
            if (response.isSuccessful) {
                val body = response.body()
                val accessToken = body?.resolvedAccessToken()
                val refreshToken = body?.resolvedRefreshToken()
                val user = body?.resolvedUser()

                if (accessToken != null && refreshToken != null && user != null) {
                    if (user.role !in listOf("ambulance_operator", "ambulance_driver")) {
                        return Result.failure(Exception("This app is for ambulance operators and drivers only"))
                    }
                    val expiresIn = body.resolvedExpiresIn()
                    tokenManager.saveTokens(accessToken, refreshToken, expiresIn)
                    tokenManager.saveUserId(user.id)
                    tokenManager.saveUserName(user.name ?: user.email)

                    // Connect socket for real-time updates
                    socketManager.connect(accessToken, user.id)

                    Result.success(user)
                } else {
                    Result.failure(Exception(body?.message ?: "Login failed"))
                }
            } else {
                val errorMsg = ApiErrorParser.from(response, "Login failed")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Log.e("AuthRepo", "Login error", e)
            Result.failure(e)
        }
    }

    suspend fun logout() {
        try {
            val refreshToken = tokenManager.getRefreshToken()
            if (refreshToken != null) {
                apiService.logout(LogoutRequest(refreshToken))
            }
        } catch (e: Exception) {
            Log.e("AuthRepo", "Logout API error", e)
        }
        socketManager.disconnect()
        tokenManager.clearAll()
    }

    suspend fun refreshToken(): Boolean {
        return try {
            val refreshToken = tokenManager.getRefreshToken() ?: return false
            val response = apiService.refreshToken(RefreshTokenRequest(refreshToken))
            if (response.isSuccessful) {
                val refreshBody = response.body()
                val newAccess = refreshBody?.resolvedAccessToken()
                val newRefresh = refreshBody?.resolvedRefreshToken() ?: refreshToken
                if (newAccess != null) {
                    val expiresIn = refreshBody.resolvedExpiresIn()
                    tokenManager.saveTokens(newAccess, newRefresh, expiresIn)
                    if (socketManager.isConnected) {
                        socketManager.reconnect(newAccess)
                    }
                    return true
                }
            }
            false
        } catch (e: Exception) {
            Log.e("AuthRepo", "Refresh token error", e)
            false
        }
    }

    fun isLoggedIn(): Boolean = tokenManager.isLoggedIn()
    fun isAuthenticated(): Boolean = tokenManager.isAuthenticated()

    fun getUserId(): String? = tokenManager.getUserId()
    fun getUserName(): String? = tokenManager.getUserName()
    fun getAccessToken(): String? = tokenManager.getAccessToken()
}
