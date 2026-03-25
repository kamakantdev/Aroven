package com.example.swastik.ui.screens.patient

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.ui.screens.patient.components.*
import com.example.swastik.ui.screens.patient.tabs.*
import com.example.swastik.ui.theme.*
import com.example.swastik.ui.viewmodel.PatientDashboardViewModel
import kotlinx.coroutines.delay

/**
 * Main Patient Dashboard Screen
 * This is the entry point for the patient section of the app.
 *
 * The dashboard is organized into 4 tabs:
 * - Home: Health overview, quick actions, doctor recommendations
 * - Medicine: Medicine finder functionality
 * - Records: Medical records and consultation history
 * - Profile: User profile and settings
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientDashboardScreen(
    viewModel: PatientDashboardViewModel = hiltViewModel(),
    initialTab: Int = 0,
    onNavigateToMedicine: () -> Unit = {},
    onNavigateToRecords: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onLogout: () -> Unit = {},
    onStartVideoConsultation: (appointmentId: String, doctorName: String) -> Unit = { _, _ -> },
    onNavigateToAppointments: () -> Unit = {},
    onNavigateToHospitals: () -> Unit = {},
    onNavigateToClinics: () -> Unit = {},
    onNavigateToPharmacies: () -> Unit = {},
    onNavigateToReports: () -> Unit = {},
    onNavigateToPrescriptions: () -> Unit = {},
    onNavigateToChatbot: () -> Unit = {},
    onNavigateToBooking: (String?) -> Unit = {},
    onNavigateToEmergency: () -> Unit = {},
    onNavigateToDiagnostic: () -> Unit = {},
    onNavigateToVitals: () -> Unit = {},
    onNavigateToOrderHistory: () -> Unit = {},
    onNavigateToBookingHistory: () -> Unit = {},
    onNavigateToMedicineDetail: (String) -> Unit = {},
    onNavigateToMedicineCart: () -> Unit = {},
    onSearchClick: () -> Unit = {}
) {
    var selectedTab by remember(initialTab) { mutableIntStateOf(initialTab.coerceIn(0, 3)) }
    var showNotificationPanel by remember { mutableStateOf(false) }

    // Collect data from ViewModel
    val profile by viewModel.patientProfile.collectAsState()
    val notifications by viewModel.notifications.collectAsState()
    val stats by viewModel.stats.collectAsState()
    val reminders by viewModel.reminders.collectAsState()
    val doctors by viewModel.recommendedDoctors.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val isOnline by viewModel.isOnline.collectAsState()
    val unreadCount = notifications.count { !it.isRead }

    // Pull-to-refresh state
    val pullToRefreshState = rememberPullToRefreshState()
    if (pullToRefreshState.isRefreshing) {
        LaunchedEffect(true) {
            viewModel.refresh()
            // Wait a minimum of 500ms so the indicator is visible
            delay(500)
            pullToRefreshState.endRefresh()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            bottomBar = {
                PatientBottomNavigation(
                    selectedTab = selectedTab,
                    onTabSelected = { selectedTab = it }
                )
            },
            floatingActionButton = {
                FloatingActionButton(
                    onClick = { onNavigateToBooking(null) },
                    containerColor = SwastikPurple,
                    shape = CircleShape,
                    modifier = Modifier.offset(y = 50.dp)
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = "Book Appointment",
                        tint = Color.White
                    )
                }
            },
            floatingActionButtonPosition = FabPosition.Center
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .nestedScroll(pullToRefreshState.nestedScrollConnection)
            ) {
                Crossfade(
                    targetState = selectedTab,
                    animationSpec = tween(300),
                    label = "tab_crossfade"
                ) { tab ->
                    when (tab) {
                        0 -> HomeTabContent(
                            profile = profile,
                            unreadNotificationsCount = unreadCount,
                            reminders = reminders,
                            doctors = doctors,
                            paddingValues = paddingValues,
                            onNotificationClick = { showNotificationPanel = true },
                            onProfileClick = { selectedTab = 3 },
                            onStartVideoConsultation = { onNavigateToAppointments() },
                            onNavigateToAppointments = onNavigateToAppointments,
                            onNavigateToReports = onNavigateToReports,
                            onNavigateToHospitals = onNavigateToHospitals,
                            onNavigateToClinics = onNavigateToClinics,
                            onNavigateToPharmacies = onNavigateToPharmacies,
                            onNavigateToEmergency = onNavigateToEmergency,
                            onNavigateToChatbot = onNavigateToChatbot,
                            onNavigateToDiagnostic = onNavigateToDiagnostic,
                            onNavigateToVitals = onNavigateToVitals,
                            onNavigateToOrderHistory = onNavigateToOrderHistory,
                            onNavigateToBookingHistory = onNavigateToBookingHistory,
                            onNavigateToPrescriptions = onNavigateToPrescriptions,
                            onNavigateToBooking = onNavigateToBooking,
                            onNavigateToMedicineDetail = onNavigateToMedicineDetail,
                            onSearchClick = onSearchClick
                        )
                        1 -> MedicineTabContent(
                            modifier = Modifier.padding(paddingValues),
                            profile = profile,
                            unreadNotificationsCount = unreadCount,
                            onMedicineClick = onNavigateToMedicineDetail,
                            onNotificationClick = { showNotificationPanel = true },
                            onNavigateToCart = onNavigateToMedicineCart
                        )
                        2 -> RecordsTabContent(
                            modifier = Modifier.padding(paddingValues),
                            profile = profile,
                            unreadNotificationsCount = unreadCount,
                            onNotificationClick = { showNotificationPanel = true },
                            onUploadClick = { /* Handled inside RecordsTabContent via UploadReportDialog */ },
                            onNavigateToPrescriptions = onNavigateToPrescriptions,
                            onNavigateToReports = onNavigateToReports
                        )
                        3 -> ProfileTabContent(
                            modifier = Modifier.padding(paddingValues),
                            profile = profile,
                            stats = stats,
                            onLogout = onLogout,
                            viewModel = viewModel
                        )
                    }
                }

                // Pull-to-refresh indicator
                PullToRefreshContainer(
                    state = pullToRefreshState,
                    modifier = Modifier.align(Alignment.TopCenter),
                    containerColor = SwastikPurpleLight,
                    contentColor = SwastikPurple
                )
            }
        }

        // Offline banner — overlaid at the top
        com.example.swastik.ui.components.OfflineBanner(
            isOffline = !isOnline,
            modifier = Modifier.align(Alignment.TopCenter)
        )

        // Emergency SOS Button
        EmergencySOSButton(
            onClick = onNavigateToEmergency,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 100.dp)
        )

        // Notification Panel
        if (showNotificationPanel) {
            NotificationPanelDialog(
                notifications = notifications,
                onDismiss = { showNotificationPanel = false },
                onMarkAllRead = {
                    viewModel.markAllNotificationsRead()
                },
                onMarkAsRead = { notificationId ->
                    viewModel.markNotificationRead(notificationId)
                }
            )
        }
    }
}
