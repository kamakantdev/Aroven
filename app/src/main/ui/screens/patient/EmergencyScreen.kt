package com.example.swastik.ui.screens.patient

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.ui.viewmodel.EmergencyViewModel
import com.example.swastik.ui.viewmodel.EmergencyUiState
import com.example.swastik.utils.NavigationHelper
import com.example.swastik.ui.components.OsmMapView
import com.example.swastik.ui.components.MapMarkerData
import org.osmdroid.util.GeoPoint

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmergencyScreen(
    onBackClick: () -> Unit = {},
    viewModel: EmergencyViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    // ===== LOCATION PERMISSION =====
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            viewModel.fetchLocation()
        }
    }

    // Request permission as soon as screen opens
    LaunchedEffect(Unit) {
        if (!uiState.locationAvailable) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Emergency Services", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFFD32F2F),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        when {
            uiState.activeEmergency != null -> {
                // Show active emergency tracking
                ActiveEmergencyView(
                    uiState = uiState,
                    onCancel = { viewModel.cancelEmergency() },
                    modifier = Modifier.padding(paddingValues)
                )
            }
            uiState.requestSent -> {
                // Show confirmation
                EmergencyConfirmation(
                    uiState = uiState,
                    onCancel = { viewModel.cancelEmergency() },
                    modifier = Modifier.padding(paddingValues)
                )
            }
            else -> {
                // Show emergency type selection
                EmergencyTypeSelection(
                    uiState = uiState,
                    onRequestEmergency = { type, description ->
                        viewModel.requestEmergency(type, description)
                    },
                    onCheckActive = { viewModel.checkActiveEmergency() },
                    modifier = Modifier.padding(paddingValues)
                )
            }
        }
    }
}

@Composable
private fun EmergencyTypeSelection(
    uiState: EmergencyUiState,
    onRequestEmergency: (String, String) -> Unit,
    onCheckActive: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedType by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var showConfirmDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { onCheckActive() }

    val emergencyTypes = listOf(
        EmergencyTypeItem(Icons.Filled.LocalHospital, "General", "general", Color(0xFFD32F2F)),
        EmergencyTypeItem(Icons.Filled.Warning, "Accident", "accident", Color(0xFFE65100)),
        EmergencyTypeItem(Icons.Filled.Favorite, "Cardiac", "cardiac", Color(0xFFC62828)),
        EmergencyTypeItem(Icons.Filled.Person, "Pregnancy", "pregnancy", Color(0xFF6A1B9A)),
        EmergencyTypeItem(Icons.Filled.MedicalServices, "Other", "other", Color(0xFF1565C0))
    )

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFFFF5F5))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            // SOS Header
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFD32F2F)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Filled.Warning,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Request Emergency Ambulance",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        "Select emergency type and request an ambulance",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (uiState.locationAvailable) Color(0xFFE8F5E9) else Color(0xFFFFF3E0)
                ),
                shape = RoundedCornerShape(14.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        if (uiState.locationAvailable) Icons.Filled.MyLocation else Icons.Filled.LocationDisabled,
                        contentDescription = null,
                        tint = if (uiState.locationAvailable) Color(0xFF2E7D32) else Color(0xFFE65100)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            if (uiState.locationAvailable) "Location ready for dispatch" else "Waiting for live location",
                            fontWeight = FontWeight.SemiBold,
                            color = if (uiState.locationAvailable) Color(0xFF1B5E20) else Color(0xFFE65100)
                        )
                        Text(
                            if (uiState.locationAvailable) "Your current GPS will be shared with the responding ambulance." else "Enable GPS so the nearest ambulance can navigate to you accurately.",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                    }
                }
            }
        }

        item {
            Text(
                "Emergency Type",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        // Emergency type grid
        items(emergencyTypes.chunked(2)) { rowItems ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                rowItems.forEach { item ->
                    EmergencyTypeCard(
                        item = item,
                        isSelected = selectedType == item.value,
                        onClick = { selectedType = item.value },
                        modifier = Modifier.weight(1f)
                    )
                }
                if (rowItems.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }

        item {
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description (optional)") },
                placeholder = { Text("Describe the emergency...") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                shape = RoundedCornerShape(12.dp)
            )
        }

        if (uiState.error != null) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFEBEE)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        uiState.error,
                        color = Color(0xFFD32F2F),
                        modifier = Modifier.padding(12.dp),
                        fontSize = 14.sp
                    )
                }
            }
        }

        item {
            Button(
                onClick = { showConfirmDialog = true },
                enabled = selectedType.isNotBlank() && !uiState.isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F)),
                shape = RoundedCornerShape(12.dp)
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Filled.LocalHospital, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Request Ambulance", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    if (showConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("Confirm Emergency Request") },
            text = { Text("Are you sure you want to request an emergency ambulance? This will dispatch the nearest available ambulance to your location.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showConfirmDialog = false
                        onRequestEmergency(selectedType, description)
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFD32F2F))
                ) {
                    Text("Yes, Request Now")
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun EmergencyTypeCard(
    item: EmergencyTypeItem,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) item.color.copy(alpha = 0.15f) else Color.White
        ),
        border = if (isSelected) androidx.compose.foundation.BorderStroke(2.dp, item.color) else null,
        elevation = CardDefaults.cardElevation(if (isSelected) 4.dp else 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(item.color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    item.icon,
                    contentDescription = null,
                    tint = item.color,
                    modifier = Modifier.size(28.dp)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                item.label,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
                color = if (isSelected) item.color else Color.Black
            )
        }
    }
}

@Composable
private fun ActiveEmergencyView(
    uiState: EmergencyUiState,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    val emergency = uiState.activeEmergency
    val resolvedStatus = uiState.ambulanceStatus ?: emergency?.resolvedStatus() ?: "pending"
    val resolvedDriverName = uiState.driverName ?: emergency?.resolvedDriverName()
    val resolvedDriverPhone = uiState.driverPhone ?: emergency?.resolvedDriverPhone()
    val resolvedVehicleNumber = uiState.vehicleNumber ?: emergency?.resolvedVehicleNumber()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFFFF5F5))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        // Pulsing ambulance icon
        val infiniteTransition = rememberInfiniteTransition(label = "pulse")
        val scale by infiniteTransition.animateFloat(
            initialValue = 1f,
            targetValue = 1.2f,
            animationSpec = infiniteRepeatable(
                animation = tween(1000),
                repeatMode = RepeatMode.Reverse
            ),
            label = "scale"
        )

        Box(
            modifier = Modifier
                .size((80 * scale).dp)
                .clip(CircleShape)
                .background(Color(0xFFD32F2F)),
            contentAlignment = Alignment.Center
        ) {
            Text("🚑", fontSize = 36.sp)
        }

        Spacer(modifier = Modifier.height(16.dp))

        val statusText = when (resolvedStatus) {
            "pending" -> "Finding Ambulance..."
            "broadcasting" -> "Searching Nearby Ambulances..."
            "assigned" -> "Ambulance Assigned — Waiting for Driver"
            "accepted" -> "Driver Accepted — Preparing"
            "dispatched" -> "Ambulance Dispatched"
            "en_route" -> "Ambulance On The Way"
            "arrived" -> "Ambulance Arrived!"
            "picked_up" -> "You've Been Picked Up"
            "en_route_hospital" -> "On The Way to Hospital"
            "arrived_hospital" -> "Arrived at Hospital"
            "completed" -> "Emergency Completed"
            "timeout" -> "Search Timed Out — Retrying..."
            "no_ambulance" -> "No Ambulance Available"
            else -> "Ambulance On The Way"
        }

        val statusSubtext = when (resolvedStatus) {
            "pending", "broadcasting" -> "We're notifying nearby ambulance drivers"
            "assigned" -> "Driver has been assigned to your request"
            "accepted" -> "Driver accepted — will start soon"
            "en_route" -> "Help is coming to your location"
            "arrived" -> "The ambulance is at your pickup point"
            "picked_up" -> "Heading to the nearest hospital"
            "en_route_hospital" -> "Transporting to the hospital"
            "arrived_hospital" -> "You've arrived at the hospital"
            "timeout", "no_ambulance" -> "Please call 108 for immediate help"
            else -> "Help is coming to your location"
        }

        Text(
            statusText,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            color = Color(0xFFD32F2F)
        )
        Text(
            statusSubtext,
            fontSize = 14.sp,
            color = Color.Gray,
            modifier = Modifier.padding(top = 4.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        PatientEmergencyOverviewCard(
            uiState = uiState,
            statusText = statusText,
            statusSubtext = statusSubtext,
            resolvedDriverName = resolvedDriverName,
            resolvedVehicleNumber = resolvedVehicleNumber,
            resolvedDriverPhone = resolvedDriverPhone
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Live tracking indicator
        if (uiState.isTrackingAmbulance) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val dotAlpha by infiniteTransition.animateFloat(
                        initialValue = 0.3f,
                        targetValue = 1f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(600),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "dot"
                    )
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF4CAF50).copy(alpha = dotAlpha))
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "📡 Live tracking active",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF2E7D32)
                    )

                    if (uiState.ambulanceLatitude != null && uiState.ambulanceLongitude != null) {
                        Spacer(modifier = Modifier.weight(1f))
                        val speedKmh = (uiState.ambulanceSpeed * 3.6f).toInt()
                        Text(
                            "${speedKmh} km/h",
                            fontSize = 12.sp,
                            color = Color(0xFF388E3C)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // ── Embedded real-time OSM tracking map ──
        if (uiState.ambulanceLatitude != null && uiState.ambulanceLongitude != null) {
            val ambLat = uiState.ambulanceLatitude
            val ambLng = uiState.ambulanceLongitude
            val midLat = (uiState.latitude + ambLat) / 2
            val midLng = (uiState.longitude + ambLng) / 2

            val trackingMarkers = listOf(
                MapMarkerData(
                    id = "patient",
                    latitude = uiState.latitude,
                    longitude = uiState.longitude,
                    title = "Your Location",
                    markerColor = android.graphics.Color.parseColor("#7C3AED")
                ),
                MapMarkerData(
                    id = "ambulance",
                    latitude = ambLat,
                    longitude = ambLng,
                    title = "Ambulance",
                    snippet = uiState.ambulanceStatus ?: "En Route",
                    markerColor = android.graphics.Color.parseColor("#D32F2F")
                )
            )

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(4.dp)
            ) {
                OsmMapView(
                    modifier = Modifier.fillMaxSize(),
                    center = GeoPoint(midLat, midLng),
                    zoom = 14.0,
                    markers = trackingMarkers,
                    showUserLocation = false
                )
            }
        } else if (uiState.latitude != 0.0 && uiState.longitude != 0.0) {
            // Show patient location while waiting for ambulance GPS
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(4.dp)
            ) {
                OsmMapView(
                    modifier = Modifier.fillMaxSize(),
                    center = GeoPoint(uiState.latitude, uiState.longitude),
                    zoom = 15.0,
                    markers = emptyList(),
                    showUserLocation = true,
                    userLatitude = uiState.latitude,
                    userLongitude = uiState.longitude
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Emergency info card
        if (emergency != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(4.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    InfoRow("Request #", emergency.resolvedRequestId())
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    InfoRow("Status", resolvedStatus)
                    InfoRow("Type", emergency.emergencyType ?: "Emergency")
                    if (emergency.estimatedArrival != null) {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        InfoRow("ETA", emergency.estimatedArrival)
                    }
                    if (resolvedDriverName != null) {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        InfoRow("Driver", resolvedDriverName)
                        if (resolvedVehicleNumber != null) InfoRow("Vehicle", resolvedVehicleNumber)
                        if (resolvedDriverPhone != null) InfoRow("Phone", resolvedDriverPhone)
                    }
                }
            }
        }

        PatientResponseJourneyCard(currentStatus = resolvedStatus)

        // Ambulance location card — distance, ETA, direction + navigate button
        if (uiState.ambulanceLatitude != null && uiState.ambulanceLongitude != null) {
            val ambulanceLat = uiState.ambulanceLatitude
            val ambulanceLng = uiState.ambulanceLongitude
            val context = LocalContext.current
            val distanceKm = NavigationHelper.calculateDistanceKm(
                uiState.latitude, uiState.longitude,
                ambulanceLat, ambulanceLng
            )
            val distanceText = NavigationHelper.formatDistance(distanceKm)
            val etaMinutes = NavigationHelper.estimateEtaMinutes(distanceKm, 50.0) // ambulance speed
            val dirArrow = NavigationHelper.getDirectionArrow(
                uiState.latitude, uiState.longitude,
                ambulanceLat, ambulanceLng
            )

            Spacer(modifier = Modifier.height(12.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF3E5F5)),
                elevation = CardDefaults.cardElevation(4.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "$dirArrow Ambulance is $distanceText away",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = Color(0xFF6A1B9A)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "Estimated arrival: ${uiState.ambulanceEta ?: "~$etaMinutes min"}",
                        fontSize = 14.sp,
                        color = Color(0xFF8E24AA)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = {
                            NavigationHelper.openDirectionsFromTo(
                                context,
                                uiState.latitude, uiState.longitude,
                                ambulanceLat, ambulanceLng,
                                "Ambulance Location"
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6A1B9A)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Navigation, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Track in Maps App", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Call Driver button
        if (!resolvedDriverPhone.isNullOrBlank()) {
            val context = LocalContext.current
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = { NavigationHelper.openDialer(context, resolvedDriverPhone) },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.Call, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Call Ambulance Driver", fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        OutlinedButton(
            onClick = onCancel,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFD32F2F)),
            shape = RoundedCornerShape(12.dp),
            enabled = !uiState.isLoading
        ) {
            Text("Cancel Emergency Request")
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun PatientEmergencyOverviewCard(
    uiState: EmergencyUiState,
    statusText: String,
    statusSubtext: String,
    resolvedDriverName: String?,
    resolvedVehicleNumber: String?,
    resolvedDriverPhone: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = "Emergency response in progress",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = Color(0xFF212121)
            )

            Text(
                text = statusText,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                color = Color(0xFFD32F2F),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = statusSubtext,
                fontSize = 13.sp,
                color = Color.Gray
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                SummaryPill(
                    modifier = Modifier.weight(1f),
                    title = "Driver",
                    value = resolvedDriverName ?: "Matching...",
                    accent = Color(0xFF1976D2)
                )
                SummaryPill(
                    modifier = Modifier.weight(1f),
                    title = "Vehicle",
                    value = resolvedVehicleNumber ?: "Pending",
                    accent = Color(0xFF6A1B9A)
                )
            }

            if (!resolvedDriverPhone.isNullOrBlank()) {
                SummaryPill(
                    modifier = Modifier.fillMaxWidth(),
                    title = "Contact",
                    value = resolvedDriverPhone,
                    accent = Color(0xFF2E7D32)
                )
            }

            if (uiState.ambulanceDistanceKm != null || uiState.ambulanceEta != null) {
                SummaryPill(
                    modifier = Modifier.fillMaxWidth(),
                    title = "Tracking",
                    value = listOfNotNull(
                        uiState.ambulanceDistanceKm?.let { String.format(java.util.Locale.US, "%.1f km away", it) },
                        uiState.ambulanceEta
                    ).joinToString(" • "),
                    accent = Color(0xFFD32F2F)
                )
            }
        }
    }
}

@Composable
private fun SummaryPill(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    accent: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = accent.copy(alpha = 0.08f)),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, fontSize = 11.sp, color = accent, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(2.dp))
            Text(value, fontSize = 13.sp, color = Color(0xFF212121), maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun PatientResponseJourneyCard(currentStatus: String) {
    val stages = listOf(
        "pending" to "Request created",
        "broadcasting" to "Nearby ambulances alerted",
        "assigned" to "Ambulance assigned",
        "accepted" to "Driver accepted",
        "en_route" to "Ambulance en route",
        "arrived" to "Ambulance arrived",
        "picked_up" to "Patient onboard",
        "en_route_hospital" to "To hospital",
        "arrived_hospital" to "At hospital",
        "completed" to "Completed"
    )

    val currentIndex = stages.indexOfFirst { it.first == currentStatus.lowercase() }.coerceAtLeast(0)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Response Journey", fontWeight = FontWeight.Bold, fontSize = 18.sp)

            stages.forEachIndexed { index, (_, label) ->
                val active = index <= currentIndex
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(if (active) Color(0xFFD32F2F) else Color(0xFFE0E0E0))
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        label,
                        color = if (active) Color(0xFF212121) else Color.Gray,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun EmergencyConfirmation(
    uiState: EmergencyUiState,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFFFF5F5))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        val infiniteTransition = rememberInfiniteTransition(label = "pulse")
        val alpha by infiniteTransition.animateFloat(
            initialValue = 0.5f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(800),
                repeatMode = RepeatMode.Reverse
            ),
            label = "alpha"
        )

        Icon(
            Icons.Filled.CheckCircle,
            contentDescription = null,
            tint = Color(0xFF4CAF50),
            modifier = Modifier
                .size(80.dp)
                .alpha(alpha)
        )

        Spacer(modifier = Modifier.height(16.dp))
        Text(
            "Emergency Request Sent!",
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp
        )
        Text(
            "An ambulance is being dispatched to your location",
            textAlign = TextAlign.Center,
            color = Color.Gray,
            modifier = Modifier.padding(top = 8.dp, start = 32.dp, end = 32.dp)
        )

        Spacer(modifier = Modifier.height(32.dp))

        OutlinedButton(
            onClick = onCancel,
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFD32F2F)),
            shape = RoundedCornerShape(12.dp),
            enabled = !uiState.isLoading
        ) {
            Text("Cancel Request")
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Color.Gray, fontSize = 14.sp)
        Text(value, fontWeight = FontWeight.Medium, fontSize = 14.sp)
    }
}

private data class EmergencyTypeItem(
    val icon: ImageVector,
    val label: String,
    val value: String,
    val color: Color
)
