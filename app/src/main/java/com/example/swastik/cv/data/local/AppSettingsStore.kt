package com.example.swastik.data.local

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ThemePreference {
    LIGHT,
    DARK,
    SYSTEM
}

data class NotificationPreferences(
    val appointments: Boolean = true,
    val medicines: Boolean = true,
    val reports: Boolean = true,
    val promotions: Boolean = false,
    val sound: Boolean = true
)

data class AppSettings(
    val language: String = "English",
    val themePreference: ThemePreference = ThemePreference.SYSTEM,
    val notificationPreferences: NotificationPreferences = NotificationPreferences()
)

object AppSettingsStore {
    private const val PREFS_NAME = "swastik_app_settings"
    private const val KEY_LANGUAGE = "language"
    private const val KEY_THEME = "theme"
    private const val KEY_NOTIF_APPOINTMENTS = "notif_appointments"
    private const val KEY_NOTIF_MEDICINES = "notif_medicines"
    private const val KEY_NOTIF_REPORTS = "notif_reports"
    private const val KEY_NOTIF_PROMOTIONS = "notif_promotions"
    private const val KEY_NOTIF_SOUND = "notif_sound"

    private lateinit var preferences: SharedPreferences
    private val _settings = MutableStateFlow(AppSettings())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    fun init(context: Context) {
        if (::preferences.isInitialized) return
        preferences = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        _settings.value = readSettings()
    }

    fun updateLanguage(language: String) {
        ensureInitialized()
        preferences.edit().putString(KEY_LANGUAGE, language).apply()
        _settings.value = _settings.value.copy(language = language)
    }

    fun updateTheme(themePreference: ThemePreference) {
        ensureInitialized()
        preferences.edit().putString(KEY_THEME, themePreference.name).apply()
        _settings.value = _settings.value.copy(themePreference = themePreference)
    }

    fun updateNotificationPreferences(notificationPreferences: NotificationPreferences) {
        ensureInitialized()
        preferences.edit()
            .putBoolean(KEY_NOTIF_APPOINTMENTS, notificationPreferences.appointments)
            .putBoolean(KEY_NOTIF_MEDICINES, notificationPreferences.medicines)
            .putBoolean(KEY_NOTIF_REPORTS, notificationPreferences.reports)
            .putBoolean(KEY_NOTIF_PROMOTIONS, notificationPreferences.promotions)
            .putBoolean(KEY_NOTIF_SOUND, notificationPreferences.sound)
            .apply()
        _settings.value = _settings.value.copy(notificationPreferences = notificationPreferences)
    }

    private fun readSettings(): AppSettings {
        val storedTheme = preferences.getString(KEY_THEME, ThemePreference.SYSTEM.name)
        return AppSettings(
            language = preferences.getString(KEY_LANGUAGE, "English") ?: "English",
            themePreference = runCatching { ThemePreference.valueOf(storedTheme ?: ThemePreference.SYSTEM.name) }
                .getOrDefault(ThemePreference.SYSTEM),
            notificationPreferences = NotificationPreferences(
                appointments = preferences.getBoolean(KEY_NOTIF_APPOINTMENTS, true),
                medicines = preferences.getBoolean(KEY_NOTIF_MEDICINES, true),
                reports = preferences.getBoolean(KEY_NOTIF_REPORTS, true),
                promotions = preferences.getBoolean(KEY_NOTIF_PROMOTIONS, false),
                sound = preferences.getBoolean(KEY_NOTIF_SOUND, true)
            )
        )
    }

    private fun ensureInitialized() {
        check(::preferences.isInitialized) {
            "AppSettingsStore.init(context) must be called before use"
        }
    }
}
