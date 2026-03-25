package com.example.swastik.ui.screens.patient.dashboard

/**
 * Dashboard-specific UI models for patient screens.
 */

data class QuickAction(
    val id: String,
    val title: String,
    val icon: String,
    val route: String
)

data class HealthStat(
    val label: String,
    val value: String,
    val unit: String = "",
    val trend: String? = null
)

data class DashboardSection(
    val title: String,
    val type: SectionType,
    val items: List<Any> = emptyList()
)

enum class SectionType {
    APPOINTMENTS,
    REMINDERS,
    QUICK_ACTIONS,
    HEALTH_STATS,
    RECENT_CONSULTATIONS
}
