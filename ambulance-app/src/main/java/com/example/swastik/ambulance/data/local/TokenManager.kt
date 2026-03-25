package com.example.swastik.ambulance.data.local

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext context: Context
) {
    private val prefs: SharedPreferences = createPrefs(context)

    private fun createPrefs(context: Context): SharedPreferences {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                "ambulance_auth_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // Fallback for devices without hardware-backed keystore / broken keystore
            Log.w("TokenManager", "EncryptedSharedPreferences failed, using fallback", e)
            context.getSharedPreferences("ambulance_auth_prefs_fallback", Context.MODE_PRIVATE)
        }
    }

    fun saveTokens(accessToken: String, refreshToken: String, expiresInSeconds: Long = 604800L) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_TOKEN_EXPIRY, System.currentTimeMillis() + (expiresInSeconds * 1000))
            .apply()
    }

    fun getAccessToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)
    fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    fun isTokenExpired(): Boolean {
        val expiry = prefs.getLong(KEY_TOKEN_EXPIRY, 0L)
        if (expiry == 0L) return true
        return System.currentTimeMillis() >= expiry
    }

    fun saveUserId(userId: String) {
        prefs.edit().putString(KEY_USER_ID, userId).apply()
    }

    fun getUserId(): String? = prefs.getString(KEY_USER_ID, null)

    fun saveUserName(name: String) {
        prefs.edit().putString(KEY_USER_NAME, name).apply()
    }

    fun getUserName(): String? = prefs.getString(KEY_USER_NAME, null)

    fun clearAll() {
        prefs.edit().clear().apply()
    }

    fun isLoggedIn(): Boolean = getAccessToken() != null

    /**
     * Check if user is authenticated.
     * Returns true even if the access token is expired, as long as a refresh token
     * exists — the AuthInterceptor will transparently refresh it on the next API call.
     */
    fun isAuthenticated(): Boolean = isLoggedIn() && (!isTokenExpired() || !getRefreshToken().isNullOrEmpty())

    // ── Vehicle selection persistence ─────────────────────
    fun saveSelectedVehicleId(vehicleId: String) {
        prefs.edit().putString(KEY_SELECTED_VEHICLE, vehicleId).apply()
    }

    fun getSelectedVehicleId(): String? = prefs.getString(KEY_SELECTED_VEHICLE, null)

    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_TOKEN_EXPIRY = "token_expiry"
        private const val KEY_SELECTED_VEHICLE = "selected_vehicle_id"
    }
}
