package com.example.swastik.ambulance.ui.screens.dashboard

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.ambulance.data.remote.dto.DashboardStats
import com.example.swastik.ambulance.data.remote.dto.EmergencyDto
import com.example.swastik.ambulance.service.LocationTrackingService
import com.example.swastik.ambulance.ui.components.MapMarkerData
import com.example.swastik.ambulance.ui.components.OsmMapView
import com.example.swastik.ambulance.ui.viewmodel.AuthViewModel
import com.example.swastik.ambulance.ui.viewmodel.DashboardViewModel
import kotlinx.coroutines.launch
import org.osmdroid.util.GeoPoint

/** Check whether our foreground service is actually running. */
private fun isServiceRunning(context: Context): Boolean {
    val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    @Suppress("DEPRECATION") // still works for own-process services
    return manager.getRunningServices(Int.MAX_VALUE)
        .any { it.service.className == LocationTrackingService::class.java.name }
}

private fun hasPermission(context: Context, permission: String): Boolean {
    return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToEmergencies: () -> Unit,
    onNavigateToEmergencyDetail: (String) -> Unit,
    onNavigateToProfile: () -> Unit = {},
    onLogout: () -> Unit,
    dashboardViewModel: DashboardViewModel = hiltViewModel(),
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val dashboardState by dashboardViewModel.dashboardState.collectAsState()
    val context = LocalContext.current

    // Persist tracking state across recomposition by querying actual service state
    var isTracking by remember { mutableStateOf(isServiceRunning(context)) }
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // Logout confirmation dialog state
    var showLogoutDialog by remember { mutableStateOf(false) }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Confirm Logout") },
            text = { Text("Are you sure you want to logout? Active tracking will be stopped.") },
            confirmButton = {
                TextButton(onClick = {
                    showLogoutDialog = false
                    stopTracking(context)
                    authViewModel.logout()
                    onLogout()
                }) {
                    Text("Logout", color = Color(0xFFD32F2F))
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // --- Permission launchers ---

    // Step 3: Background location (requested AFTER foreground location is granted)
    val backgroundLocationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            scope.launch {
                snackbarHostState.showSnackbar("Background location denied. Tracking works while app is open.")
            }
        }
        // Start tracking regardless — background location is optional but improves reliability
        startTracking(context)
        isTracking = true
    }

    // Step 2: Notification permission (Android 13+), then request background location
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            scope.launch {
                snackbarHostState.showSnackbar("Notifications denied. You may miss emergency alerts.")
            }
        }
        // After notification permission, request background location for Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        } else {
            startTracking(context)
            isTracking = true
        }
    }

    // Step 1: Foreground location permission
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocation = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        if (fineLocation) {
            // Next: request notification permission (Android 13+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            } else {
                startTracking(context)
                isTracking = true
            }
        } else {
            scope.launch {
                snackbarHostState.showSnackbar("Location permission is required to start GPS tracking.")
            }
        }
    }

    /** Kick off the permission chain → eventually starts tracking */
    fun requestPermissionsAndTrack() {
        val hasFineLocation = hasPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        val hasNotification = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            hasPermission(context, Manifest.permission.POST_NOTIFICATIONS)
        val hasBackground = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            hasPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)

        when {
            !hasFineLocation -> {
                locationPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
            !hasNotification -> {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            !hasBackground -> {
                backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
            else -> {
                startTracking(context)
                isTracking = true
            }
        }
    }

    // Observe user messages from ViewModel as Snackbar
    val topEmergencyWithLocation = dashboardState.activeEmergencies.firstOrNull {
        it.latitude != null && it.longitude != null
    }
    LaunchedEffect(Unit) {
        dashboardViewModel.userMessage.collect { msg ->
            snackbarHostState.showSnackbar(msg, duration = SnackbarDuration.Short)
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Dashboard", fontWeight = FontWeight.Bold)
                        Text(
                            text = if (isTracking) "GPS tracking active" else "GPS tracking is off",
                            fontSize = 12.sp,
                            color = if (isTracking) Color(0xFFB9F6CA) else Color(0xFFFFCDD2)
                        )
                    }
                },
                actions = {
                    // GPS Toggle
                    IconButton(onClick = {
                        if (isTracking) {
                            stopTracking(context)
                            isTracking = false
                        } else {
                            requestPermissionsAndTrack()
                        }
                    }) {
                        Icon(
                            Icons.Default.MyLocation,
                            contentDescription = "Toggle GPS",
                            tint = if (isTracking) Color(0xFF4CAF50) else Color.Gray
                        )
                    }
                    // Refresh
                    IconButton(onClick = { dashboardViewModel.loadDashboard() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                    // Profile
                    IconButton(onClick = onNavigateToProfile) {
                        Icon(Icons.Default.Person, contentDescription = "Profile")
                    }
                    // Logout
                    IconButton(onClick = {
                        showLogoutDialog = true
                    }) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Logout")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFFB71C1C),
                    titleContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        if (dashboardState.isLoading) {
            Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = Color(0xFFD32F2F))
            }
        } else if (dashboardState.error != null) {
            Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.ErrorOutline, null, modifier = Modifier.size(64.dp), tint = Color.Gray)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(dashboardState.error ?: "Error", color = Color.Gray)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { dashboardViewModel.loadDashboard() }) {
                        Text("Retry")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Stats Cards
                item {
                    dashboardState.stats?.let { stats ->
                        StatsRow(stats)
                    }
                }

                // Quick Actions
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        ActionCard(
                            modifier = Modifier.weight(1f),
                            icon = Icons.Default.Warning,
                            title = "Emergency Queue",
                            color = Color(0xFFE53935),
                            onClick = onNavigateToEmergencies
                        )
                        ActionCard(
                            modifier = Modifier.weight(1f),
                            icon = Icons.Default.MyLocation,
                            title = if (isTracking) "Stop GPS" else "Start GPS",
                            color = if (isTracking) Color(0xFF4CAF50) else Color(0xFF2196F3),
                            onClick = {
                                if (isTracking) {
                                    stopTracking(context)
                                    isTracking = false
                                } else {
                                    requestPermissionsAndTrack()
                                }
                            }
                        )
                    }
                }

                if (topEmergencyWithLocation != null) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFFFF))
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = "Live Pickup Monitoring",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF212121)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = topEmergencyWithLocation.address
                                        ?: topEmergencyWithLocation.location
                                        ?: "Pickup location unavailable",
                                    fontSize = 12.sp,
                                    color = Color(0xFF616161),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Spacer(modifier = Modifier.height(8.dp))

                                OsmMapView(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(180.dp)
                                        .clip(RoundedCornerShape(12.dp)),
                                    center = GeoPoint(
                                        topEmergencyWithLocation.latitude ?: 20.5937,
                                        topEmergencyWithLocation.longitude ?: 78.9629,
                                    ),
                                    zoom = 14.0,
                                    markers = listOf(
                                        MapMarkerData(
                                            id = topEmergencyWithLocation.id,
                                            latitude = topEmergencyWithLocation.latitude ?: 20.5937,
                                            longitude = topEmergencyWithLocation.longitude ?: 78.9629,
                                            title = topEmergencyWithLocation.patientName ?: "Patient pickup",
                                            snippet = topEmergencyWithLocation.emergencyType ?: "Emergency request",
                                            markerColor = android.graphics.Color.parseColor("#D32F2F")
                                        )
                                    )
                                )
                            }
                        }
                    }
                }

                // Active Emergencies Header
                if (dashboardState.activeEmergencies.isNotEmpty()) {
                    item {
                        Text(
                            "Active Emergencies",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF212121)
                        )
                    }

                    items(dashboardState.activeEmergencies) { emergency ->
                        EmergencyCard(
                            emergency = emergency,
                            onTap = { onNavigateToEmergencyDetail(emergency.id) },
                            onAccept = { dashboardViewModel.acceptEmergency(emergency.id) },
                            onReject = if (emergency.status in listOf("pending", "broadcasting", "assigned")) {
                                { dashboardViewModel.rejectEmergency(emergency.id) }
                            } else null,
                            onUpdateStatus = { status ->
                                dashboardViewModel.updateEmergencyStatus(emergency.id, status)
                            }
                        )
                    }
                } else {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFF5F5F5))
                        ) {
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    Icons.Default.CheckCircle,
                                    null,
                                    modifier = Modifier.size(48.dp),
                                    tint = Color(0xFF4CAF50)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("No active emergencies", fontWeight = FontWeight.Medium)
                                Text("No pending emergency requests.", fontSize = 14.sp, color = Color.Gray)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatsRow(stats: DashboardStats) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatCard(
            modifier = Modifier.weight(1f),
            label = "Active",
            value = "${stats.activeEmergencies}",
            color = Color(0xFFE53935)
        )
        StatCard(
            modifier = Modifier.weight(1f),
            label = "Vehicles",
            value = "${stats.availableVehicles}",
            color = Color(0xFF2196F3)
        )
        StatCard(
            modifier = Modifier.weight(1f),
            label = "Completed",
            value = "${stats.completedToday}",
            color = Color(0xFF4CAF50)
        )
    }
}

@Composable
private fun StatCard(modifier: Modifier, label: String, value: String, color: Color) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.14f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(value, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = color)
            Text(label, fontSize = 12.sp, color = color.copy(alpha = 0.7f))
        }
    }
}

@Composable
private fun ActionCard(
    modifier: Modifier,
    icon: ImageVector,
    title: String,
    color: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = color)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, null, tint = Color.White, modifier = Modifier.size(32.dp))
            Spacer(modifier = Modifier.height(8.dp))
            Text(title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        }
    }
}

@Composable
private fun EmergencyCard(
    emergency: EmergencyDto,
    onTap: () -> Unit,
    onAccept: () -> Unit,
    onReject: (() -> Unit)? = null,
    onUpdateStatus: (String) -> Unit
) {
    val priorityColor = when (emergency.priority) {
        "critical" -> Color(0xFFD32F2F)
        "high" -> Color(0xFFFF9800)
        else -> Color(0xFF2196F3)
    }

    val statusLabel = when (emergency.status) {
        "broadcasting" -> "📡 SOS BROADCAST"
        "assigned" -> "📋 ASSIGNED"
        "accepted" -> "✅ ACCEPTED"
        "en_route" -> "🚑 EN ROUTE"
        "arrived" -> "📍 ARRIVED"
        "picked_up" -> "🏥 TRANSPORTING"
        "en_route_hospital" -> "🏥 TO HOSPITAL"
        "arrived_hospital" -> "✅ AT HOSPITAL"
        "completed" -> "✔ COMPLETED"
        "cancelled" -> "✖ CANCELLED"
        "timeout" -> "⏰ TIMEOUT"
        "no_ambulance" -> "⚠ NO AMBULANCE"
        else -> "⏳ ${emergency.status.uppercase()}"
    }

    val isBroadcast = emergency.dispatchMode == "sos_broadcast"
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onTap),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(priorityColor)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        emergency.emergencyType ?: "Emergency request",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
                Text(
                    statusLabel,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = priorityColor
                )
            }

            // Dispatch mode badge
            if (isBroadcast && emergency.status == "broadcasting") {
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color(0xFFFFF3E0))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("📡", fontSize = 12.sp)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        "SOS Broadcast — Accept to respond",
                        fontSize = 11.sp,
                        color = Color(0xFFE65100),
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (emergency.patientName != null || emergency.patientInfo != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Person, null, modifier = Modifier.size(16.dp), tint = Color.Gray)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(emergency.patientName ?: emergency.patientInfo ?: "", fontSize = 14.sp, color = Color.Gray)
                }
            }

            if (emergency.address != null || emergency.location != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.LocationOn, null, modifier = Modifier.size(16.dp), tint = Color.Gray)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        emergency.address ?: emergency.location ?: "",
                        fontSize = 14.sp,
                        color = Color.Gray,
                        maxLines = 2
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action buttons based on status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                when (emergency.status) {
                    "pending", "requested", "broadcasting", "assigned" -> {
                        // Accept button
                        Button(
                            onClick = onAccept,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) { Text("Accept") }
                        // Reject button (for broadcasts)
                        if (onReject != null) {
                            OutlinedButton(
                                onClick = onReject,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp)
                            ) { Text("Decline", color = Color(0xFFD32F2F)) }
                        }
                    }
                    "accepted" -> {
                        Button(
                            onClick = { onUpdateStatus("en_route") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1976D2)),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) { Text("Start Route") }
                    }
                    "en_route" -> {
                        Button(
                            onClick = { onUpdateStatus("arrived") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF9800)),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) { Text("Arrived") }
                    }
                    "arrived" -> {
                        Button(
                            onClick = { onUpdateStatus("picked_up") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF9C27B0)),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) { Text("Picked Up") }
                    }
                    "picked_up" -> {
                        Button(
                            onClick = { onUpdateStatus("en_route_hospital") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00897B)),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) { Text("To Hospital") }
                    }
                    "en_route_hospital" -> {
                        Button(
                            onClick = { onUpdateStatus("arrived_hospital") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B5E20)),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) { Text("At Hospital") }
                    }
                    "arrived_hospital" -> {
                        Button(
                            onClick = { onUpdateStatus("completed") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) { Text("Complete") }
                    }
                }
            }
        }
    }
}

private fun startTracking(context: android.content.Context) {
    val intent = Intent(context, LocationTrackingService::class.java).apply {
        action = LocationTrackingService.ACTION_START
    }
    context.startForegroundService(intent)
}

private fun stopTracking(context: android.content.Context) {
    val intent = Intent(context, LocationTrackingService::class.java).apply {
        action = LocationTrackingService.ACTION_STOP
    }
    context.startService(intent)
}
