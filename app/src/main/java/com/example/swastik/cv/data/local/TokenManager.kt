package com.example.swastik.data.local

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Secure token manager using EncryptedSharedPreferences
 * Falls back to regular SharedPreferences if encryption is not supported (e.g., on some emulators)
 */
@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val sharedPreferences: SharedPreferences = createSharedPreferences(context)

    /**
     * Emits Unit whenever the user's session is forcibly expired
     * (i.e. refresh token is invalid / missing and clearAll() was called by the interceptor).
     * ViewModels / Activities can collect this to navigate to the login screen.
     */
    private val _sessionExpired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val sessionExpired: SharedFlow<Unit> = _sessionExpired.asSharedFlow()

    private fun createSharedPreferences(context: Context): SharedPreferences {
        return try {
            createEncryptedPrefs(context)
        } catch (e: Exception) {
            // If encrypted prefs are corrupted, clear and retry once
            Log.w("TokenManager", "EncryptedSharedPreferences failed, clearing and retrying", e)
            try {
                // Delete the corrupted prefs file and try again
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
                createEncryptedPrefs(context)
            } catch (e2: Exception) {
                // Absolute last resort — still use encrypted prefs with fresh keystore
                // NEVER fall back to plaintext for PHI security
                Log.e("TokenManager", "EncryptedSharedPreferences retry failed. Tokens will not persist.", e2)
                throw IllegalStateException("Cannot create secure storage for tokens", e2)
            }
        }
    }

    private fun createEncryptedPrefs(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        return EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    companion object {
        private const val PREFS_NAME = "swastik_secure_prefs"
        private const val PREFS_NAME_FALLBACK = "swastik_prefs_fallback"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_PHONE = "user_phone"
        private const val KEY_IS_LOGGED_IN = "is_logged_in"
        private const val KEY_TOKEN_EXPIRY = "token_expiry"
    }

    // Access Token
    var accessToken: String?
        get() = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
        set(value) = sharedPreferences.edit().putString(KEY_ACCESS_TOKEN, value).apply()

    // Refresh Token
    var refreshToken: String?
        get() = sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
        set(value) = sharedPreferences.edit().putString(KEY_REFRESH_TOKEN, value).apply()

    // User ID
    var userId: String?
        get() = sharedPreferences.getString(KEY_USER_ID, null)
        set(value) = sharedPreferences.edit().putString(KEY_USER_ID, value).apply()

    // User Role
    var userRole: String?
        get() = sharedPreferences.getString(KEY_USER_ROLE, null)
        set(value) = sharedPreferences.edit().putString(KEY_USER_ROLE, value).apply()

    // User Name
    var userName: String?
        get() = sharedPreferences.getString(KEY_USER_NAME, null)
        set(value) = sharedPreferences.edit().putString(KEY_USER_NAME, value).apply()

    // User Phone
    var userPhone: String?
        get() = sharedPreferences.getString(KEY_USER_PHONE, null)
        set(value) = sharedPreferences.edit().putString(KEY_USER_PHONE, value).apply()

    // Login status
    var isLoggedIn: Boolean
        get() = sharedPreferences.getBoolean(KEY_IS_LOGGED_IN, false)
        set(value) = sharedPreferences.edit().putBoolean(KEY_IS_LOGGED_IN, value).apply()

    // Token expiry timestamp
    var tokenExpiry: Long
        get() = sharedPreferences.getLong(KEY_TOKEN_EXPIRY, 0)
        set(value) = sharedPreferences.edit().putLong(KEY_TOKEN_EXPIRY, value).apply()

    /**
     * Check if token is expired
     */
    fun isTokenExpired(): Boolean {
        val expiry = tokenExpiry
        if (expiry == 0L) return true
        return System.currentTimeMillis() >= expiry
    }

    /**
     * Save tokens after successful login.
     * Validates that accessToken is non-empty. If refreshToken is blank,
     * keeps the existing one (a refresh response may omit it).
     */
    fun saveTokens(
        accessToken: String,
        refreshToken: String,
        expiresInSeconds: Long = 604800 // Default 7 days (matches server JWT config)
    ) {
        if (accessToken.isBlank()) return // never save an empty access token
        this.accessToken = accessToken
        if (refreshToken.isNotBlank()) {
            this.refreshToken = refreshToken
        }
        this.tokenExpiry = System.currentTimeMillis() + (expiresInSeconds * 1000)
        this.isLoggedIn = true
    }

    /**
     * Save user info after successful login
     */
    fun saveUserInfo(
        userId: String,
        role: String,
        name: String,
        phone: String
    ) {
        this.userId = userId
        this.userRole = role
        this.userName = name
        this.userPhone = phone
    }

    /**
     * Clear all stored data (logout).
     * @param emitSessionExpired If true, emits on [sessionExpired] flow so the
     *        UI can react (e.g. navigate to login). Set to false when the user
     *        explicitly logs out (the UI already navigates).
     */
    fun clearAll(emitSessionExpired: Boolean = false) {
        sharedPreferences.edit().clear().apply()
        if (emitSessionExpired) {
            _sessionExpired.tryEmit(Unit)
        }
    }

    /**
     * Check if user is authenticated.
     * Returns true even if the access token is expired, as long as a refresh token
     * exists — the AuthInterceptor will transparently refresh it on the next API call.
     */
    fun isAuthenticated(): Boolean {
        return isLoggedIn && !accessToken.isNullOrEmpty() && (!isTokenExpired() || !refreshToken.isNullOrEmpty())
    }

    /**
     * Get access token synchronously (for interceptor)
     */
    fun getAccessTokenSync(): String? {
        return accessToken
    }
}
