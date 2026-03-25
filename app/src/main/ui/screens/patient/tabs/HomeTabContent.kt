package com.example.swastik.ui.screens.patient.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.swastik.ui.screens.patient.components.*
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.data.model.PatientProfile
import com.example.swastik.data.model.Reminder
import com.example.swastik.data.model.Doctor

/**
 * Home Tab Content
 * Contains the main dashboard view
 */
@Composable
fun HomeTabContent(
    profile: PatientProfile?,
    unreadNotificationsCount: Int,
    reminders: List<Reminder> = emptyList(),
    doctors: List<Doctor> = emptyList(),
    paddingValues: PaddingValues,
    onNotificationClick: () -> Unit,
    onProfileClick: () -> Unit,
    onStartVideoConsultation: () -> Unit,
    onNavigateToAppointments: () -> Unit,
    onNavigateToReports: () -> Unit,
    onNavigateToHospitals: () -> Unit,
    onNavigateToClinics: () -> Unit,
    onNavigateToPharmacies: () -> Unit,
    onNavigateToEmergency: () -> Unit = {},
    onNavigateToChatbot: () -> Unit,
    onNavigateToDiagnostic: () -> Unit = {},
    onNavigateToVitals: () -> Unit = {},
    onNavigateToOrderHistory: () -> Unit = {},
    onNavigateToBookingHistory: () -> Unit = {},
    onNavigateToPrescriptions: () -> Unit = {},
    onNavigateToBooking: (String?) -> Unit = {},
    onNavigateToMedicineDetail: (String) -> Unit = {},
    onSearchClick: () -> Unit = {}
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        SwastikPurple.copy(alpha = 0.04f),
                        Color(0xFFF8F9FA),
                        Color.White
                    )
                )
            )
            .padding(paddingValues)
            .verticalScroll(rememberScrollState())
    ) {
        // Header
        DashboardHeader(
            profile = profile,
            unreadNotificationsCount = unreadNotificationsCount,
            onNotificationClick = onNotificationClick,
            onProfileClick = onProfileClick
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Search Bar
        SearchBar(onSearchClick = onSearchClick)

        Spacer(modifier = Modifier.height(20.dp))

        // Main Cards Section
        MainCardsSection(
            onStartVideoConsultation = onStartVideoConsultation,
            onNavigateToAppointments = onNavigateToAppointments,
            onNavigateToReports = onNavigateToReports
        )

        Spacer(modifier = Modifier.height(20.dp))

        CareDirectorySection(
            onHospitalClick = onNavigateToHospitals,
            onClinicClick = onNavigateToClinics,
            onPharmacyClick = onNavigateToPharmacies,
            onDiagnosticClick = onNavigateToDiagnostic
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Smart Reminder Section
        SmartReminderSection(
            reminders = reminders,
            onViewAllClick = onNavigateToVitals
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Quick Actions
        QuickActionsSection(
            onAmbulanceClick = onNavigateToEmergency,
            onHelpClick = onNavigateToChatbot,
            onVitalsClick = onNavigateToVitals,
            onOrderHistoryClick = onNavigateToOrderHistory,
            onBookingHistoryClick = onNavigateToBookingHistory,
            onPrescriptionClick = onNavigateToPrescriptions
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Doctor Recommendation Strip
        DoctorRecommendationSection(
            doctors = doctors,
            onDoctorClick = { doctor -> onNavigateToBooking(doctor.id) },
            onBookClick = { doctor -> onNavigateToBooking(doctor.id) },
            onSeeAllClick = onNavigateToAppointments
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Enhanced ChatBot Section
        EnhancedChatBotSection(
            onChatbotClick = onNavigateToChatbot
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Trust & Compliance Signals
        TrustSignalsStrip()

        // Extra bottom spacing for bottom nav
        Spacer(modifier = Modifier.height(140.dp))
    }
}
