package com.example.swastik.ambulance.data.remote

import com.example.swastik.ambulance.data.local.TokenManager
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import java.util.concurrent.locks.ReentrantLock
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.concurrent.withLock

/**
 * OkHttp interceptor that attaches JWT Bearer token and handles
 * transparent token refresh on 401 responses.
 *
 * Thread-safety: a [ReentrantLock] ensures only one thread refreshes
 * at a time; concurrent 401s re-read the already-refreshed token.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager,
    private val socketManager: SocketManager
) : Interceptor {

    private val refreshLock = ReentrantLock()

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val path = originalRequest.url.encodedPath

        // Skip auth for public endpoints
        if (path.contains("auth/login") || path.contains("auth/register") || path.contains("auth/forgot-password") || path.contains("auth/resend-verification") || path.contains("auth/verify-email")) {
            return chain.proceed(originalRequest)
        }

        val token = tokenManager.getAccessToken()

        val request = if (!token.isNullOrEmpty()) {
            originalRequest.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            originalRequest
        }

        val response = chain.proceed(request)

        // Handle 401 — attempt token refresh (thread-safe)
        if (response.code == 401 && !path.contains("auth/refresh-token")) {
            response.close()

            val newToken = refreshLock.withLock {
                // Re-read — another thread may have already refreshed
                val currentToken = tokenManager.getAccessToken()
                if (currentToken != null && currentToken != token) {
                    currentToken // already refreshed by another thread
                } else {
                    performTokenRefresh(chain, originalRequest)
                }
            }

            if (!newToken.isNullOrEmpty()) {
                val retryRequest = originalRequest.newBuilder()
                    .header("Authorization", "Bearer $newToken")
                    .build()
                return chain.proceed(retryRequest)
            }

            // Refresh failed — synthetic 401
            return Response.Builder()
                .request(originalRequest)
                .protocol(okhttp3.Protocol.HTTP_1_1)
                .code(401)
                .message("Session expired")
                .body("""{"success":false,"message":"Session expired"}""".toResponseBody("application/json".toMediaTypeOrNull()))
                .build()
        }

        return response
    }

    /** Synchronous token refresh. MUST be called inside [refreshLock]. */
    private fun performTokenRefresh(chain: Interceptor.Chain, originalRequest: okhttp3.Request): String? {
        val refreshToken = tokenManager.getRefreshToken()
        if (refreshToken.isNullOrEmpty()) {
            tokenManager.clearAll()
            return null
        }

        return try {
            val refreshBody = org.json.JSONObject().apply {
                put("refreshToken", refreshToken)
            }.toString()

            val refreshRequest = originalRequest.newBuilder()
                .url(originalRequest.url.newBuilder()
                    .encodedPath("/api/auth/refresh-token")
                    .build())
                .post(
                    refreshBody.toRequestBody("application/json".toMediaTypeOrNull())
                )
                .removeHeader("Authorization")
                .build()

            val refreshResponse = chain.proceed(refreshRequest)
            if (refreshResponse.isSuccessful) {
                val body = refreshResponse.body?.string()
                refreshResponse.close()

                val json = org.json.JSONObject(body ?: "{}")
                // Backend nests tokens inside "data": { accessToken, refreshToken }
                val dataObj = json.optJSONObject("data") ?: json
                val newAccessToken = dataObj.optString("access_token", dataObj.optString("accessToken", ""))
                val newRefreshToken = dataObj.optString("refresh_token", dataObj.optString("refreshToken", refreshToken))

                if (newAccessToken.isNotEmpty()) {
                    val expiresIn = dataObj.optLong("expires_in", dataObj.optLong("expiresIn", 604800L))
                    tokenManager.saveTokens(newAccessToken, newRefreshToken, expiresIn)
                    if (socketManager.isConnected) {
                        socketManager.reconnect(newAccessToken)
                    }
                    newAccessToken
                } else {
                    tokenManager.clearAll()
                    null
                }
            } else {
                refreshResponse.close()
                tokenManager.clearAll()
                null
            }
        } catch (_: Exception) {
            tokenManager.clearAll()
            null
        }
    }
}
