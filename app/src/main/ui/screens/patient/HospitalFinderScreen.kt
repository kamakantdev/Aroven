package com.example.swastik.ui.screens.patient

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.data.model.*
import com.example.swastik.data.remote.dto.ClinicDoctorDto
import com.example.swastik.data.remote.dto.PharmacyInventoryItemDto
import com.example.swastik.ui.viewmodel.HospitalFinderViewModel
import com.example.swastik.ui.viewmodel.MedicineViewModel
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.utils.NavigationHelper
import com.example.swastik.ui.components.OsmMapView
import com.example.swastik.ui.components.MapMarkerData
import org.osmdroid.util.GeoPoint

private const val DEFAULT_DISCOVERY_RADIUS_KM = 10f
private const val MAX_DISCOVERY_RADIUS_KM = 25f

// ==================== MAIN SCREEN ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HospitalFinderScreen(
    initialFacilityType: FacilityType? = null,
    onBackClick: () -> Unit,
    onDoctorBookClick: (HospitalDoctor, MedicalFacility) -> Unit = { _, _ -> },
    onHospitalClick: (String) -> Unit = {},
    onMedicineClick: (String) -> Unit = {},
    onNavigateToCart: () -> Unit = {},
    onNavigateToOrders: () -> Unit = {},
    onNavigateToDiagnosticBooking: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {},
    isDarkMode: Boolean = false,
    viewModel: HospitalFinderViewModel = hiltViewModel(),
    medicineViewModel: MedicineViewModel = hiltViewModel()
) {
    @Suppress("UNUSED_VARIABLE")
    val _unusedOnMedicineClick = onMedicineClick
    val appContext = LocalContext.current
    var selectedFacilityTypeOverride by remember { mutableStateOf<FacilityType?>(null) }
    var selectedFacility by remember { mutableStateOf<MedicalFacility?>(null) }
    var showBottomSheet by remember { mutableStateOf(false) }
    var showFilterSheet by remember { mutableStateOf(false) }
    var isMapView by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    var isEmergencyMode by remember { mutableStateOf(false) }

    // Filter states
    var distanceFilter by remember { mutableFloatStateOf(DEFAULT_DISCOVERY_RADIUS_KM) }
    var openNowOnly by remember { mutableStateOf(false) }
    var minimumRating by remember { mutableFloatStateOf(0f) }
    var hospitalTypeFilter by remember { mutableStateOf<String?>(null) }
    var emergencyServicesOnly by remember { mutableStateOf(false) }

    val hospitalState by viewModel.uiState.collectAsState()
    val facilities = hospitalState.facilities
    val selectedFacilityType = initialFacilityType ?: selectedFacilityTypeOverride
    val screenTitle = when (initialFacilityType) {
        FacilityType.HOSPITAL -> "Hospitals"
        FacilityType.CLINIC -> "Clinics"
        FacilityType.MEDICAL_STORE -> "Medical Stores"
        FacilityType.DIAGNOSTIC_CENTER -> "Diagnostic Centers"
        null -> "Nearby Care"
    }

    // ===== LOCATION PERMISSION =====
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            viewModel.fetchLocationAndLoad(selectedFacilityType)
        }
    }

    // Request permission on first composition if not already granted
    LaunchedEffect(Unit) {
        if (!hospitalState.locationAvailable && hospitalState.facilities.isEmpty()) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    val filteredFacilities = facilities.filter { facility ->
        val typeMatch = selectedFacilityType == null || facility.type == selectedFacilityType
        val searchMatch = searchQuery.isEmpty() || facility.name.contains(searchQuery, ignoreCase = true)
        val openMatch = !openNowOnly || facility.isOpen
        val ratingMatch = facility.rating >= minimumRating
        val emergencyMatch = !emergencyServicesOnly || facility.isEmergencyAvailable
        val distanceMatch = facility.distanceKm <= 0.0 || facility.distanceKm <= distanceFilter
        val hospitalTypeMatch = hospitalTypeFilter == null || (
            facility.type == FacilityType.HOSPITAL &&
                facility.hospitalSubType.equals(hospitalTypeFilter, ignoreCase = true)
            )

        typeMatch && searchMatch && openMatch && ratingMatch && emergencyMatch && distanceMatch && hospitalTypeMatch
    }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val filterSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Colors based on mode
    val backgroundColor = if (isDarkMode) Color(0xFF121212) else Color.White
    val surfaceColor = if (isDarkMode) Color(0xFF1E1E1E) else Color.White
    val textColor = if (isDarkMode) Color.White else Color.Black
    val resetFilters = {
        selectedFacilityTypeOverride = null
        searchQuery = ""
        distanceFilter = hospitalState.activeRadiusKm.toFloat()
        openNowOnly = false
        minimumRating = 0f
        emergencyServicesOnly = false
        hospitalTypeFilter = null
    }

    LaunchedEffect(hospitalState.activeRadiusKm, facilities.size, filteredFacilities.size) {
        val onlyDistanceIsHidingResults =
            facilities.isNotEmpty() &&
                filteredFacilities.isEmpty() &&
                searchQuery.isEmpty() &&
                !openNowOnly &&
                minimumRating == 0f &&
                !emergencyServicesOnly &&
                hospitalTypeFilter == null &&
                distanceFilter < hospitalState.activeRadiusKm.toFloat()

        if (onlyDistanceIsHidingResults) {
            distanceFilter = hospitalState.activeRadiusKm.toFloat()
        }
    }

    LaunchedEffect(selectedFacilityType, hospitalState.activeRadiusKm, facilities.size, filteredFacilities.size) {
        val selectedTypeMissingInCurrentRadius =
            selectedFacilityType != null &&
                facilities.isNotEmpty() &&
                filteredFacilities.isEmpty() &&
                searchQuery.isEmpty() &&
                !openNowOnly &&
                minimumRating == 0f &&
                !emergencyServicesOnly &&
                hospitalTypeFilter == null &&
                hospitalState.activeRadiusKm < MAX_DISCOVERY_RADIUS_KM.toInt()

        if (selectedTypeMissingInCurrentRadius) {
            distanceFilter = MAX_DISCOVERY_RADIUS_KM
            viewModel.loadNearbyFacilities(
                radius = MAX_DISCOVERY_RADIUS_KM.toInt(),
                facilityType = selectedFacilityType
            )
        }
    }

    LaunchedEffect(selectedFacilityType, hospitalState.locationAvailable) {
        if (hospitalState.locationAvailable) {
            viewModel.loadNearbyFacilities(facilityType = selectedFacilityType)
        }
    }

    Scaffold(
        topBar = {
            if (isEmergencyMode) {
                EmergencyTopBar(onExitEmergency = { isEmergencyMode = false })
            } else {
                TopAppBar(
                    title = {
                        Text(
                            screenTitle,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 18.sp,
                            color = textColor
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onBackClick) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = textColor
                            )
                        }
                    },
                    actions = {
                        // Emergency Mode Toggle
                        IconButton(onClick = { isEmergencyMode = true }) {
                            Icon(
                                Icons.Default.LocalHospital,
                                contentDescription = "Emergency",
                                tint = Color(0xFFE53935)
                            )
                        }
                        IconButton(onClick = { isMapView = !isMapView }) {
                            Icon(
                                if (isMapView) Icons.AutoMirrored.Filled.ViewList else Icons.Default.Map,
                                contentDescription = "Toggle View",
                                tint = textColor
                            )
                        }
                        IconButton(onClick = onNavigateToNotifications) {
                            Icon(
                                Icons.Default.Notifications,
                                contentDescription = "Notifications",
                                tint = textColor
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = backgroundColor)
                )
            }
        },
        containerColor = backgroundColor
    ) { paddingValues ->
        if (isEmergencyMode) {
            // Load emergency hospitals from dedicated server endpoint on toggle
            LaunchedEffect(isEmergencyMode) {
                viewModel.loadEmergencyHospitals()
            }
            EmergencyModeContent(
                facilities = hospitalState.emergencyFacilities.ifEmpty {
                    facilities.filter { it.isEmergencyAvailable }
                },
                isLoading = hospitalState.isEmergencyLoading,
                onFacilityClick = {
                    selectedFacility = it
                    showBottomSheet = true
                },
                modifier = Modifier.padding(paddingValues)
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                SearchBarSection(
                    selectedFacilityType = selectedFacilityType,
                    searchQuery = searchQuery,
                    onSearchChange = { newQuery ->
                        searchQuery = newQuery
                        // Debounced search is handled by LaunchedEffect below
                        if (newQuery.isEmpty()) {
                            viewModel.searchFacilities("") // restores full list immediately
                        }
                    },
                    onFilterClick = { showFilterSheet = true },
                    isDarkMode = isDarkMode
                )

                // Debounce search: wait 400ms after last keystroke before firing API call
                LaunchedEffect(searchQuery, selectedFacilityType) {
                    if (searchQuery.length >= 3) {
                        kotlinx.coroutines.delay(400L)
                        viewModel.searchFacilities(searchQuery, selectedFacilityType)
                    }
                }

                if (initialFacilityType == null) {
                    FilterChipsSection(
                        selectedType = selectedFacilityType,
                        onTypeSelected = { selectedFacilityTypeOverride = it },
                        isDarkMode = isDarkMode
                    )
                }

                if (hospitalState.isLoading) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = SwastikPurple)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                "Finding nearby facilities...",
                                color = textColor,
                                fontSize = 14.sp
                            )
                        }
                    }
                } else if (hospitalState.error != null) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(32.dp)
                        ) {
                            Icon(
                                Icons.Default.ErrorOutline,
                                contentDescription = null,
                                tint = Color(0xFFE53935),
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                hospitalState.error ?: "Something went wrong",
                                color = textColor,
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = { viewModel.fetchLocationAndLoad(selectedFacilityType) },
                                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                            ) {
                                Text("Retry")
                            }
                        }
                    }
                } else if (isMapView) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        EnhancedMapView(
                            facilities = filteredFacilities,
                            userLat = hospitalState.userLatitude,
                            userLng = hospitalState.userLongitude,
                            onFacilityClick = { facility ->
                                selectedFacility = facility
                                showBottomSheet = true
                            }
                        )

                        FloatingActionButton(
                            onClick = { viewModel.fetchLocationAndLoad(selectedFacilityType) },
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .padding(16.dp)
                                .padding(bottom = 180.dp),
                            containerColor = surfaceColor,
                            contentColor = SwastikPurple
                        ) {
                            Icon(Icons.Default.MyLocation, contentDescription = "My Location")
                        }

                        if (filteredFacilities.isEmpty()) {
                            MapEmptyStateCard(
                                selectedFacilityType = selectedFacilityType,
                                activeRadiusKm = hospitalState.activeRadiusKm,
                                onResetFilters = resetFilters,
                                onRefreshNearby = { viewModel.loadNearbyFacilities(facilityType = selectedFacilityType) },
                                modifier = Modifier
                                    .align(Alignment.BottomCenter)
                                    .padding(horizontal = 16.dp, vertical = 24.dp)
                            )
                        } else {
                            LazyRow(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .align(Alignment.BottomCenter)
                                    .padding(bottom = 16.dp),
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                items(filteredFacilities) { facility ->
                                    FacilityMapCard(
                                        facility = facility,
                                        onClick = {
                                            selectedFacility = facility
                                            showBottomSheet = true
                                        },
                                        isDarkMode = isDarkMode
                                    )
                                }
                            }
                        }
                    }
                } else if (filteredFacilities.isEmpty()) {
                    EmptyStateView(
                        selectedFacilityType = selectedFacilityType,
                        activeRadiusKm = hospitalState.activeRadiusKm,
                        onResetFilters = resetFilters,
                        onRefreshNearby = { viewModel.loadNearbyFacilities(facilityType = selectedFacilityType) }
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(filteredFacilities) { facility ->
                            FacilityListCard(
                                facility = facility,
                                onClick = {
                                    selectedFacility = facility
                                    showBottomSheet = true
                                },
                                isDarkMode = isDarkMode
                            )
                        }
                    }
                }
            }
        }

        // Facility Detail Bottom Sheet
        if (showBottomSheet && selectedFacility != null) {
            val facility = selectedFacility ?: return@Scaffold
            ModalBottomSheet(
                onDismissRequest = {
                    showBottomSheet = false
                    selectedFacility = null
                    viewModel.clearPharmacyMedicines()
                    viewModel.clearClinicDoctors()
                    viewModel.clearPharmacyInventory()
                },
                sheetState = sheetState,
                containerColor = surfaceColor
            ) {
                val cartState by medicineViewModel.cartState.collectAsState()
                cartState.pharmacyConflict?.let { conflict ->
                    AlertDialog(
                        onDismissRequest = { medicineViewModel.resolvePharmacyConflict(false) },
                        title = { Text("Change Pharmacy?", fontWeight = FontWeight.Bold) },
                        text = {
                            Text("Your cart contains items from another pharmacy. Would you like to clear your cart and add this item from ${conflict.newPharmacyName ?: "the new pharmacy"}?")
                        },
                        confirmButton = {
                            Button(
                                onClick = { medicineViewModel.resolvePharmacyConflict(true) },
                                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                            ) { Text("Clear & Add") }
                        },
                        dismissButton = {
                            TextButton(onClick = { medicineViewModel.resolvePharmacyConflict(false) }) { Text("Cancel") }
                        }
                    )
                }

                if (isEmergencyMode && facility.isEmergencyAvailable) {
                    EmergencyFacilityDetailSheet(
                        facility = facility,
                        isDarkMode = isDarkMode
                    )
                } else when (facility.type) {
                    FacilityType.MEDICAL_STORE -> {
                        // Load inventory when pharmacy sheet opens
                        LaunchedEffect(facility.id) {
                            viewModel.loadPharmacyInventory(facility.id)
                            // Pre-set the pharmacy in cart so orders go to this store
                            medicineViewModel.setPharmacy(facility.id, facility.name)
                        }
                        val pharmacyCartState by medicineViewModel.cartState.collectAsState()
                        MedicalStoreDetailSheet(
                            facility = facility,
                            inventoryItems = hospitalState.pharmacyInventory,
                            isInventoryLoading = hospitalState.isPharmacyInventoryLoading,
                            onInventorySearch = { query -> viewModel.loadPharmacyInventory(facility.id, query) },
                            onAddInventoryToCart = { item ->
                                // Convert PharmacyInventoryItemDto → Medicine → add to cart
                                val medicine = Medicine(
                                    id = item.medicineId ?: item.id,
                                    name = item.displayName,
                                    genericName = null,
                                    manufacturer = item.manufacturer,
                                    price = item.price,
                                    requiresPrescription = item.requiresPrescription ?: false,
                                    category = MedicineCategory.TABLET,
                                    description = null,
                                    inStock = item.inStock,
                                    stockCount = item.quantity ?: 0,
                                    nearbyPharmacy = facility.name,
                                    pharmacyDistance = facility.distance
                                )
                                medicineViewModel.addToCart(medicine, facility.id, facility.name)
                            },
                            cartItemCount = pharmacyCartState.totalItems,
                            onViewCart = {
                                showBottomSheet = false
                                onNavigateToCart()
                            },
                            onViewOrders = {
                                showBottomSheet = false
                                onNavigateToOrders()
                            },
                            isDarkMode = isDarkMode
                        )
                    }
                    FacilityType.CLINIC -> {
                        // Load clinic doctors when sheet opens
                        LaunchedEffect(facility.id) {
                            viewModel.loadClinicDoctors(facility.id)
                        }
                        ClinicDetailSheet(
                            facility = facility,
                            clinicDoctors = hospitalState.clinicDoctors,
                            isDoctorsLoading = hospitalState.isClinicDoctorsLoading,
                            onDoctorBook = { doctor ->
                                showBottomSheet = false
                                onDoctorBookClick(doctor, facility)
                            },
                            onBookAppointment = {
                                val preferredDoctor = hospitalState.clinicDoctors.firstOrNull()?.let { doc ->
                                    HospitalDoctor(
                                        id = doc.id,
                                        name = doc.name,
                                        specialization = doc.specialization ?: "Specialization not listed",
                                        experience = doc.experienceYears?.takeIf { it > 0 }?.let { "$it yrs" } ?: "Experience not listed",
                                        rating = doc.resolvedRating,
                                        consultationFee = doc.consultationFee ?: 0
                                    )
                                } ?: facility.doctors.firstOrNull()

                                if (preferredDoctor != null) {
                                    showBottomSheet = false
                                    onDoctorBookClick(preferredDoctor, facility)
                                } else {
                                    android.widget.Toast.makeText(
                                        appContext,
                                        "No doctors available for booking right now",
                                        android.widget.Toast.LENGTH_SHORT
                                    ).show()
                                }
                            },
                            isDarkMode = isDarkMode
                        )
                    }
                    FacilityType.DIAGNOSTIC_CENTER -> {
                        DiagnosticCenterDetailSheet(
                            facility = facility,
                            onBookTest = {
                                showBottomSheet = false
                                onNavigateToDiagnosticBooking()
                            },
                            isDarkMode = isDarkMode
                        )
                    }
                    else -> FacilityDetailSheet(
                        facility = facility,
                        onDoctorBook = { doctor ->
                            showBottomSheet = false
                            onDoctorBookClick(doctor, facility)
                        },
                        onBookAppointment = {
                            // Navigate to appointment booking via the first available doctor or general booking
                            if (facility.doctors.isNotEmpty()) {
                                showBottomSheet = false
                                onDoctorBookClick(facility.doctors.first(), facility)
                            } else {
                                android.widget.Toast.makeText(
                                    appContext,
                                    "No doctors available for booking right now",
                                    android.widget.Toast.LENGTH_SHORT
                                ).show()
                            }
                        },
                        onViewDetails = {
                            showBottomSheet = false
                            onHospitalClick(facility.id)
                        },
                        isDarkMode = isDarkMode
                    )
                }
            }
        }

        // Filter Bottom Sheet
        if (showFilterSheet) {
            ModalBottomSheet(
                onDismissRequest = { showFilterSheet = false },
                sheetState = filterSheetState,
                containerColor = surfaceColor
            ) {
                FilterBottomSheet(
                    distanceFilter = distanceFilter,
                    onDistanceChange = { distanceFilter = it },
                    openNowOnly = openNowOnly,
                    onOpenNowChange = { openNowOnly = it },
                    minimumRating = minimumRating,
                    onRatingChange = { minimumRating = it },
                    hospitalTypeFilter = hospitalTypeFilter,
                    onHospitalTypeChange = { hospitalTypeFilter = it },
                    emergencyServicesOnly = emergencyServicesOnly,
                    onEmergencyServicesChange = { emergencyServicesOnly = it },
                    showHospitalTypeFilter = selectedFacilityType == null || selectedFacilityType == FacilityType.HOSPITAL,
                    onApplyFilters = { showFilterSheet = false },
                    isDarkMode = isDarkMode
                )
            }
        }
    }
}

// ==================== 1️⃣ REAL OPENSTREETMAP VIEW ====================
@Composable
private fun EnhancedMapView(
    facilities: List<MedicalFacility>,
    userLat: Double = 0.0,
    userLng: Double = 0.0,
    onFacilityClick: (MedicalFacility) -> Unit
) {
    // Use actual user GPS location as map center (if available), fallback to facility centroid
    val centerLat = if (userLat != 0.0) userLat
        else facilities.filter { it.latitude != 0.0 }
            .map { it.latitude }.average().takeIf { !it.isNaN() } ?: 20.5937
    val centerLng = if (userLng != 0.0) userLng
        else facilities.filter { it.longitude != 0.0 }
            .map { it.longitude }.average().takeIf { !it.isNaN() } ?: 78.9629

    val mapMarkers = facilities.mapNotNull { facility ->
        if (kotlin.math.abs(facility.latitude) < 1.0 && kotlin.math.abs(facility.longitude) < 1.0) return@mapNotNull null
        val color = when (facility.type) {
            FacilityType.HOSPITAL -> android.graphics.Color.parseColor("#D32F2F")       // Red
            FacilityType.CLINIC -> android.graphics.Color.parseColor("#4CAF50")         // Green (matches model)
            FacilityType.MEDICAL_STORE -> android.graphics.Color.parseColor("#2196F3")  // Blue (matches model)
            FacilityType.DIAGNOSTIC_CENTER -> android.graphics.Color.parseColor("#7C3AED") // Purple
        }
        MapMarkerData(
            id = facility.id,
            latitude = facility.latitude,
            longitude = facility.longitude,
            title = facility.name,
            snippet = "${facility.type.name} • ${if (facility.isOpen) "Open" else "Closed"}",
            markerColor = color,
            onClick = { onFacilityClick(facility) }
        )
    }

    OsmMapView(
        modifier = Modifier.fillMaxSize(),
        center = GeoPoint(centerLat, centerLng),
        zoom = when {
            facilities.isNotEmpty() -> 13.0
            userLat != 0.0 && userLng != 0.0 -> 14.0
            else -> 5.0
        },
        markers = mapMarkers,
        showUserLocation = userLat != 0.0 && userLng != 0.0,
        userLatitude = userLat,
        userLongitude = userLng
    )
}

// ==================== 2️⃣ ADVANCED FILTER BOTTOM SHEET ====================
@Composable
private fun FilterBottomSheet(
    distanceFilter: Float,
    onDistanceChange: (Float) -> Unit,
    openNowOnly: Boolean,
    onOpenNowChange: (Boolean) -> Unit,
    minimumRating: Float,
    onRatingChange: (Float) -> Unit,
    hospitalTypeFilter: String?,
    onHospitalTypeChange: (String?) -> Unit,
    emergencyServicesOnly: Boolean,
    onEmergencyServicesChange: (Boolean) -> Unit,
    showHospitalTypeFilter: Boolean,
    onApplyFilters: () -> Unit,
    isDarkMode: Boolean
) {
    val textColor = if (isDarkMode) Color.White else Color.Black
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color(0xFFF5F5F5)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .padding(bottom = 32.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Filters",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = textColor
            )
            TextButton(onClick = {
                onDistanceChange(DEFAULT_DISCOVERY_RADIUS_KM)
                onOpenNowChange(false)
                onRatingChange(0f)
                onHospitalTypeChange(null)
                onEmergencyServicesChange(false)
            }) {
                Text("Reset", color = SwastikPurple)
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Distance Slider
        FilterSectionCard(
            icon = Icons.Outlined.Place,
            title = "Distance",
            cardColor = cardColor
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("1 km", fontSize = 12.sp, color = Color.Gray)
                    Text(
                        "${distanceFilter.toInt()} km",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = SwastikPurple
                    )
                    Text("${MAX_DISCOVERY_RADIUS_KM.toInt()} km", fontSize = 12.sp, color = Color.Gray)
                }
                Slider(
                    value = distanceFilter,
                    onValueChange = onDistanceChange,
                    valueRange = 1f..MAX_DISCOVERY_RADIUS_KM,
                    steps = 23,
                    colors = SliderDefaults.colors(
                        thumbColor = SwastikPurple,
                        activeTrackColor = SwastikPurple
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Open Now Toggle
        FilterSectionCard(
            icon = Icons.Outlined.AccessTime,
            title = "Open Now",
            cardColor = cardColor
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Show only open facilities",
                    fontSize = 14.sp,
                    color = if (isDarkMode) Color.LightGray else Color.DarkGray
                )
                Switch(
                    checked = openNowOnly,
                    onCheckedChange = onOpenNowChange,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = SwastikPurple
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Rating Filter
        FilterSectionCard(
            icon = Icons.Default.Star,
            title = "Minimum Rating",
            cardColor = cardColor
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                listOf(0f, 3f, 3.5f, 4f, 4.5f).forEach { rating ->
                    FilterChip(
                        selected = minimumRating == rating,
                        onClick = { onRatingChange(rating) },
                        label = {
                            Text(
                                if (rating == 0f) "All" else "${rating}+",
                                fontSize = 12.sp
                            )
                        },
                        leadingIcon = if (rating > 0f) {
                            {
                                Icon(
                                    Icons.Default.Star,
                                    contentDescription = null,
                                    modifier = Modifier.size(14.dp),
                                    tint = if (minimumRating == rating) Color.White else Color(0xFFFFC107)
                                )
                            }
                        } else null,
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = SwastikPurple,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (showHospitalTypeFilter) {
            Spacer(modifier = Modifier.height(12.dp))

            FilterSectionCard(
                icon = Icons.Outlined.LocalHospital,
                title = "Hospital Type",
                cardColor = cardColor
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    listOf("Government", "Private", null).forEach { type ->
                        FilterChip(
                            selected = hospitalTypeFilter == type,
                            onClick = { onHospitalTypeChange(type) },
                            label = { Text(type ?: "All", fontSize = 13.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = SwastikPurple,
                                selectedLabelColor = Color.White
                            ),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Emergency Services Toggle
        FilterSectionCard(
            icon = Icons.Default.MedicalServices,
            title = "Emergency Services",
            cardColor = cardColor
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Only with emergency services",
                    fontSize = 14.sp,
                    color = if (isDarkMode) Color.LightGray else Color.DarkGray
                )
                Switch(
                    checked = emergencyServicesOnly,
                    onCheckedChange = onEmergencyServicesChange,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = Color(0xFFE53935)
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Apply Filters Button
        Button(
            onClick = onApplyFilters,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
        ) {
            Icon(Icons.Default.FilterList, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Apply Filters", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun FilterSectionCard(
    icon: ImageVector,
    title: String,
    cardColor: Color,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = SwastikPurple,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = SwastikPurple
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            content()
        }
    }
}

// ==================== 3️⃣ HOSPITAL DETAIL BOTTOM SHEET ====================
@Composable
private fun FacilityDetailSheet(
    facility: MedicalFacility,
    onDoctorBook: (HospitalDoctor) -> Unit,
    onBookAppointment: () -> Unit = {},
    onViewDetails: () -> Unit = {},
    isDarkMode: Boolean
) {
    val textColor = if (isDarkMode) Color.White else Color.Black
    val subtextColor = if (isDarkMode) Color.Gray else Color.Gray
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color(0xFFF5F5F5)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 32.dp)
    ) {
        // Sticky Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(facility.type.getMarkerColor().copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = facility.type.getMarkerIcon(),
                        contentDescription = null,
                        tint = facility.type.getMarkerColor(),
                        modifier = Modifier.size(32.dp)
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(
                        text = facility.name,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = textColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = facility.type.getDisplayName(),
                        fontSize = 14.sp,
                        color = subtextColor
                    )
                }
            }
            StatusBadge(isOpen = facility.isOpen)
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Rating and Distance
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Star,
                    contentDescription = null,
                    tint = Color(0xFFFFC107),
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    " ${facility.rating} (${facility.reviewCount} reviews)",
                    fontSize = 14.sp,
                    color = textColor
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.LocationOn,
                    contentDescription = null,
                    tint = SwastikPurple,
                    modifier = Modifier.size(20.dp)
                )
                Text(" ${facility.distance}", fontSize = 14.sp, color = textColor)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Quick Action Buttons
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val actionContext = LocalContext.current
            QuickActionButton(
                icon = Icons.Default.Call,
                label = "Call",
                color = Color(0xFF4CAF50),
                modifier = Modifier.weight(1f),
                onClick = { if (facility.phone.isNotBlank()) NavigationHelper.openDialer(actionContext, facility.phone) }
            )
            QuickActionButton(
                icon = Icons.Default.Directions,
                label = "Directions",
                color = Color(0xFF2196F3),
                modifier = Modifier.weight(1f),
                onClick = { NavigationHelper.openDirections(actionContext, facility.latitude, facility.longitude, facility.name) }
            )
            QuickActionButton(
                icon = Icons.Default.CalendarMonth,
                label = "Book",
                color = SwastikPurple,
                modifier = Modifier.weight(1f),
                onClick = onBookAppointment
            )
            QuickActionButton(
                icon = Icons.Default.Info,
                label = "Details",
                color = Color(0xFF607D8B),
                modifier = Modifier.weight(1f),
                onClick = onViewDetails
            )
            if (facility.isEmergencyAvailable) {
                QuickActionButton(
                    icon = Icons.Default.LocalHospital,
                    label = "Emergency",
                    color = Color(0xFFE53935),
                    modifier = Modifier.weight(1f),
                    onClick = { NavigationHelper.openDialer(actionContext, "108") }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(modifier = Modifier.padding(horizontal = 20.dp))
        Spacer(modifier = Modifier.height(16.dp))

        // Info Cards
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            InfoCard(
                icon = Icons.Outlined.AccessTime,
                title = "Timings",
                value = if (facility.openTime == "24 hrs") "24x7" else "${facility.openTime ?: "N/A"} - ${facility.closeTime ?: ""}",
                modifier = Modifier.weight(1f),
                cardColor = cardColor,
                textColor = textColor
            )
            InfoCard(
                icon = Icons.Outlined.Phone,
                title = "Contact",
                value = facility.phone.ifBlank { "N/A" },
                modifier = Modifier.weight(1f),
                cardColor = cardColor,
                textColor = textColor
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Address Card
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            colors = CardDefaults.cardColors(containerColor = cardColor),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Outlined.Place,
                    contentDescription = null,
                    tint = SwastikPurple
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Address",
                        fontSize = 12.sp,
                        color = subtextColor
                    )
                    Text(
                        facility.address,
                        fontSize = 14.sp,
                        color = textColor
                    )
                }
                val dirContext = LocalContext.current
                IconButton(onClick = {
                    NavigationHelper.openDirections(dirContext, facility.latitude, facility.longitude, facility.name)
                }) {
                    Icon(
                        Icons.Default.Directions,
                        contentDescription = "Directions",
                        tint = SwastikPurple
                    )
                }
            }
        }

        // Emergency Badge
        if (facility.isEmergencyAvailable) {
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .background(
                        Color(0xFFE53935).copy(alpha = 0.1f),
                        RoundedCornerShape(12.dp)
                    )
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.LocalHospital,
                    contentDescription = null,
                    tint = Color(0xFFE53935),
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        "Emergency Services Available",
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFFE53935),
                        fontSize = 14.sp
                    )
                    Text(
                        "24/7 Emergency care with ambulance service",
                        fontSize = 12.sp,
                        color = Color(0xFFE53935).copy(alpha = 0.8f)
                    )
                }
            }
        }

        // Doctor Listing (only for hospitals and clinics)
        if ((facility.type == FacilityType.HOSPITAL || facility.type == FacilityType.CLINIC) && facility.doctors.isNotEmpty()) {
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = "Available Doctors",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = textColor,
                modifier = Modifier.padding(horizontal = 20.dp)
            )
            Spacer(modifier = Modifier.height(12.dp))
            LazyColumn(
                modifier = Modifier.heightIn(max = 350.dp),
                contentPadding = PaddingValues(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(facility.doctors) { doctor ->
                    DoctorCard(
                        doctor = doctor,
                        onBook = { onDoctorBook(doctor) },
                        isDarkMode = isDarkMode
                    )
                }
            }
        }
    }
}

// ==================== 4️⃣ DOCTOR LISTING CARD ====================
@Composable
private fun DoctorCard(
    doctor: HospitalDoctor,
    onBook: () -> Unit,
    isDarkMode: Boolean
) {
    val textColor = if (isDarkMode) Color.White else Color.Black
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color.White

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, if (isDarkMode) Color(0xFF3A3A3A) else Color.LightGray.copy(alpha = 0.5f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Doctor Avatar
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .clip(CircleShape)
                    .background(SwastikPurple.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Text(doctor.imageEmoji, fontSize = 28.sp)
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Doctor Info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = doctor.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = textColor
                )
                Text(
                    text = doctor.specialization,
                    fontSize = 13.sp,
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(4.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.WorkHistory,
                        contentDescription = null,
                        tint = Color.Gray,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        " ${doctor.experience} exp",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(
                        Icons.Default.Star,
                        contentDescription = null,
                        tint = Color(0xFFFFC107),
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        " ${doctor.rating}",
                        fontSize = 12.sp,
                        color = textColor
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "₹${doctor.consultationFee}",
                        fontSize = 14.sp,
                        color = SwastikPurple,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        " consultation",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }

                // Next available slot
                if (doctor.availableSlots.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(Color(0xFF4CAF50), CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            "Next: ${doctor.availableSlots.first()}",
                            fontSize = 12.sp,
                            color = Color(0xFF4CAF50),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Book Button
            Button(
                onClick = onBook,
                modifier = Modifier.height(40.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple),
                contentPadding = PaddingValues(horizontal = 20.dp)
            ) {
                Text("Book", fontSize = 14.sp)
            }
        }
    }
}

// ==================== 5️⃣ MEDICAL STORE DETAIL SHEET ====================
@Composable
private fun MedicalStoreDetailSheet(
    facility: MedicalFacility,
    inventoryItems: List<PharmacyInventoryItemDto> = emptyList(),
    isInventoryLoading: Boolean = false,
    onInventorySearch: (String) -> Unit = {},
    onAddInventoryToCart: (PharmacyInventoryItemDto) -> Unit = {},
    cartItemCount: Int = 0,
    onViewCart: () -> Unit = {},
    onViewOrders: () -> Unit = {},
    isDarkMode: Boolean
) {
    val storeContext = LocalContext.current
    val textColor = if (isDarkMode) Color.White else Color.Black
    val subtextColor = if (isDarkMode) Color.Gray else Color.Gray
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color(0xFFF5F5F5)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 32.dp)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF4CAF50).copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.LocalPharmacy,
                        contentDescription = null,
                        tint = Color(0xFF4CAF50),
                        modifier = Modifier.size(32.dp)
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(
                        text = facility.name,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = textColor
                    )
                    Text(
                        text = "Medical Store",
                        fontSize = 14.sp,
                        color = subtextColor
                    )
                }
            }
            StatusBadge(isOpen = facility.isOpen)
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Rating and Distance
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Star,
                    contentDescription = null,
                    tint = Color(0xFFFFC107),
                    modifier = Modifier.size(18.dp)
                )
                Text(" ${facility.rating}", fontSize = 14.sp, color = textColor)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.LocationOn,
                    contentDescription = null,
                    tint = Color(0xFF4CAF50),
                    modifier = Modifier.size(18.dp)
                )
                Text(" ${facility.distance}", fontSize = 14.sp, color = textColor)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Features Badges — only show if facility has specific capabilities
        val badges = buildList {
            if (facility.isOpen) add(Triple(Icons.Default.CheckCircle, "Open Now", Color(0xFF4CAF50)))
            if (facility.isEmergencyAvailable) add(Triple(Icons.Default.LocalHospital, "Emergency", Color(0xFFE53935)))
        }
        if (badges.isNotEmpty()) {
            LazyRow(
                modifier = Modifier.padding(vertical = 8.dp),
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(badges.size) { index ->
                    FeatureBadge(
                        icon = badges[index].first,
                        text = badges[index].second,
                        color = badges[index].third
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(modifier = Modifier.padding(horizontal = 20.dp))
        Spacer(modifier = Modifier.height(16.dp))

        // ========== PHARMACY-SPECIFIC INVENTORY ==========
        Text(
            "Available at ${facility.name}",
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            color = textColor,
            modifier = Modifier.padding(horizontal = 20.dp)
        )
        Text(
            "Only showing medicines stocked at this store",
            fontSize = 13.sp,
            color = subtextColor,
            modifier = Modifier.padding(horizontal = 20.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Inventory search
        var inventoryQuery by remember { mutableStateOf("") }
        OutlinedTextField(
            value = inventoryQuery,
            onValueChange = { query ->
                inventoryQuery = query
                if (query.length >= 2) onInventorySearch(query)
                else if (query.isEmpty()) onInventorySearch("")
            },
            placeholder = { Text("Search inventory...", color = Color.Gray) },
            leadingIcon = { Icon(Icons.Default.Inventory2, contentDescription = null, tint = Color(0xFF4CAF50)) },
            trailingIcon = {
                if (isInventoryLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Color(0xFF4CAF50))
                } else if (inventoryQuery.isNotEmpty()) {
                    IconButton(onClick = { inventoryQuery = ""; onInventorySearch("") }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear", tint = Color.Gray)
                    }
                }
            },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedBorderColor = Color.LightGray,
                focusedBorderColor = Color(0xFF4CAF50),
                unfocusedContainerColor = cardColor,
                focusedContainerColor = cardColor
            ),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (isInventoryLoading && inventoryItems.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFF4CAF50))
            }
        } else if (inventoryItems.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("📦", fontSize = 32.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    if (inventoryQuery.isNotEmpty()) "No medicines found for \"$inventoryQuery\""
                    else "No inventory data available",
                    fontSize = 14.sp, color = Color.Gray, textAlign = TextAlign.Center
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.heightIn(max = 300.dp),
                contentPadding = PaddingValues(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(inventoryItems) { item ->
                    PharmacyInventoryCard(
                        item = item,
                        isDarkMode = isDarkMode,
                        onAddToCart = { onAddInventoryToCart(item) }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Cart Badge (only show when items in cart)
        if (cartItemCount > 0) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .clickable { onViewCart() },
                colors = CardDefaults.cardColors(containerColor = SwastikPurple.copy(alpha = 0.1f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = SwastikPurple)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "$cartItemCount item(s) in cart",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = SwastikPurple
                        )
                        Text("From ${facility.name}", fontSize = 12.sp, color = SwastikPurple.copy(alpha = 0.7f))
                    }
                    Button(
                        onClick = onViewCart,
                        colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Text("View Cart", fontSize = 13.sp)
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
        }

        // Action Buttons Row 1: Call + Directions
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = {
                    if (facility.phone.isNotBlank()) {
                        NavigationHelper.openDialer(storeContext, facility.phone)
                    }
                },
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp),
                border = ButtonDefaults.outlinedButtonBorder.copy(
                    brush = Brush.linearGradient(listOf(Color(0xFF4CAF50), Color(0xFF4CAF50)))
                )
            ) {
                Icon(
                    Icons.Default.Call,
                    contentDescription = null,
                    tint = Color(0xFF4CAF50)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Call Store", color = Color(0xFF4CAF50))
            }
            Button(
                onClick = {
                    NavigationHelper.openDirections(
                        context = storeContext,
                        destLat = facility.latitude,
                        destLng = facility.longitude,
                        label = facility.name
                    )
                },
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
            ) {
                Icon(Icons.Default.Directions, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Directions")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Action Buttons Row 2: My Orders
        OutlinedButton(
            onClick = onViewOrders,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .padding(horizontal = 20.dp),
            shape = RoundedCornerShape(12.dp),
            border = ButtonDefaults.outlinedButtonBorder.copy(
                brush = Brush.linearGradient(listOf(SwastikPurple, SwastikPurple))
            )
        ) {
            Icon(Icons.Default.History, contentDescription = null, tint = SwastikPurple)
            Spacer(modifier = Modifier.width(8.dp))
            Text("My Orders", color = SwastikPurple)
        }
    }
}

@Composable
private fun FeatureBadge(
    icon: ImageVector,
    text: String,
    color: Color
) {
    Row(
        modifier = Modifier
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(20.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text,
            fontSize = 12.sp,
            color = color,
            fontWeight = FontWeight.Medium
        )
    }
}

// ==================== PHARMACY INVENTORY CARD ====================
@Composable
private fun PharmacyInventoryCard(
    item: PharmacyInventoryItemDto,
    isDarkMode: Boolean,
    onAddToCart: () -> Unit = {}
) {
    val textColor = if (isDarkMode) Color.White else Color.Black
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color(0xFFF8F8F8)
    var showAdded by remember { mutableStateOf(false) }

    LaunchedEffect(showAdded) {
        if (showAdded) {
            kotlinx.coroutines.delay(1500)
            showAdded = false
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .background(
                        if (item.inStock) Color(0xFF4CAF50).copy(alpha = 0.1f)
                        else Color(0xFFE53935).copy(alpha = 0.1f),
                        RoundedCornerShape(10.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Medication,
                    contentDescription = null,
                    tint = if (item.inStock) Color(0xFF4CAF50) else Color(0xFFE53935),
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        item.displayName,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        color = textColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    if (item.requiresPrescription == true) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .background(Color(0xFFFF9800).copy(alpha = 0.1f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 4.dp, vertical = 2.dp)
                        ) {
                            Text("Rx", fontSize = 9.sp, color = Color(0xFFFF9800), fontWeight = FontWeight.Bold)
                        }
                    }
                }
                if (item.manufacturer != null) {
                    Text(item.manufacturer, fontSize = 12.sp, color = Color.Gray, maxLines = 1)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (item.category != null) {
                        Text(item.category, fontSize = 11.sp, color = Color.Gray)
                        Text(" • ", fontSize = 11.sp, color = Color.Gray)
                    }
                    Text(
                        "Stock: ${item.quantity ?: 0} ${item.unit ?: "units"}",
                        fontSize = 11.sp,
                        color = if (item.inStock) Color(0xFF4CAF50) else Color(0xFFE53935)
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    item.price?.let { "₹$it" } ?: "Price unavailable",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = textColor
                )
                if (item.mrp != null && item.mrp != item.price) {
                    Text(
                        "MRP ₹${item.mrp}",
                        fontSize = 11.sp,
                        color = Color.Gray,
                        fontWeight = FontWeight.Normal
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                // Add to Cart button (replaces the old static badge)
                if (item.inStock) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(
                                if (showAdded) Color(0xFF4CAF50) else SwastikPurple
                            )
                            .clickable {
                                onAddToCart()
                                showAdded = true
                            }
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                if (showAdded) Icons.Default.Check else Icons.Default.AddShoppingCart,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                if (showAdded) "Added!" else "Add",
                                fontSize = 10.sp,
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .background(Color(0xFFFFEBEE), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text("Out of Stock", fontSize = 10.sp, color = Color(0xFFE53935), fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }
}

// ==================== CLINIC DETAIL SHEET ====================
@Composable
private fun ClinicDetailSheet(
    facility: MedicalFacility,
    clinicDoctors: List<ClinicDoctorDto> = emptyList(),
    isDoctorsLoading: Boolean = false,
    onDoctorBook: (HospitalDoctor) -> Unit = {},
    onBookAppointment: () -> Unit = {},
    isDarkMode: Boolean
) {
    val clinicContext = LocalContext.current
    val textColor = if (isDarkMode) Color.White else Color.Black
    val subtextColor = if (isDarkMode) Color.Gray else Color.Gray
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color(0xFFF5F5F5)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 32.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF4CAF50).copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.MedicalServices, contentDescription = null, tint = Color(0xFF4CAF50), modifier = Modifier.size(32.dp))
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(facility.name, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = textColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Clinic", fontSize = 14.sp, color = subtextColor)
                }
            }
            StatusBadge(isOpen = facility.isOpen)
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Rating, Distance, Specialization
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFFFC107), modifier = Modifier.size(18.dp))
                Text(" ${facility.rating}", fontSize = 14.sp, color = textColor)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = Color(0xFF4CAF50), modifier = Modifier.size(18.dp))
                Text(" ${facility.distance}", fontSize = 14.sp, color = textColor)
            }
        }

        // Specialization badges
        if (facility.specializations.isNotEmpty()) {
            Spacer(modifier = Modifier.height(12.dp))
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(facility.specializations) { spec ->
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF4CAF50).copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(spec, fontSize = 11.sp, color = Color(0xFF4CAF50), fontWeight = FontWeight.Medium)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Quick Actions
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            QuickActionButton(
                icon = Icons.Default.Call, label = "Call", color = Color(0xFF4CAF50),
                modifier = Modifier.weight(1f),
                onClick = { if (facility.phone.isNotBlank()) NavigationHelper.openDialer(clinicContext, facility.phone) }
            )
            QuickActionButton(
                icon = Icons.Default.Directions, label = "Directions", color = Color(0xFF2196F3),
                modifier = Modifier.weight(1f),
                onClick = { NavigationHelper.openDirections(clinicContext, facility.latitude, facility.longitude, facility.name) }
            )
            QuickActionButton(
                icon = Icons.Default.CalendarMonth, label = "Book", color = SwastikPurple,
                modifier = Modifier.weight(1f),
                onClick = onBookAppointment
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(modifier = Modifier.padding(horizontal = 20.dp))
        Spacer(modifier = Modifier.height(16.dp))

        // Info Cards - Timings & Contact
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            InfoCard(
                icon = Icons.Outlined.AccessTime,
                title = "Timings",
                value = if (facility.openTime == "24 hrs") "24x7" else "${facility.openTime ?: "N/A"} - ${facility.closeTime ?: ""}",
                modifier = Modifier.weight(1f),
                cardColor = cardColor,
                textColor = textColor
            )
            InfoCard(
                icon = Icons.Outlined.Phone,
                title = "Contact",
                value = facility.phone.ifBlank { "N/A" },
                modifier = Modifier.weight(1f),
                cardColor = cardColor,
                textColor = textColor
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Address
        Card(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            colors = CardDefaults.cardColors(containerColor = cardColor),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Place, contentDescription = null, tint = Color(0xFF4CAF50))
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Address", fontSize = 12.sp, color = subtextColor)
                    Text(facility.address, fontSize = 14.sp, color = textColor)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Clinic Doctors
        Text(
            "Available Doctors",
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = textColor,
            modifier = Modifier.padding(horizontal = 20.dp)
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (isDoctorsLoading) {
            Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFF4CAF50))
            }
        } else if (clinicDoctors.isEmpty() && facility.doctors.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("👨‍⚕️", fontSize = 32.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("No doctors listed at this clinic yet", fontSize = 14.sp, color = Color.Gray, textAlign = TextAlign.Center)
            }
        } else {
            // Show dynamically loaded clinic doctors (deduplicated)
            val apiDoctorIds = clinicDoctors.map { it.id }.toSet()
            val embeddedDoctors = facility.doctors.filter { it.id !in apiDoctorIds }

            LazyColumn(
                modifier = Modifier.heightIn(max = 350.dp),
                contentPadding = PaddingValues(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // API-loaded clinic doctors (preferred source)
                items(clinicDoctors) { doc ->
                    val hospitalDoctor = HospitalDoctor(
                        id = doc.id,
                        name = doc.name,
                        specialization = doc.specialization ?: "Specialization not listed",
                        experience = doc.experienceYears?.takeIf { it > 0 }?.let { "$it yrs" } ?: "Experience not listed",
                        rating = doc.resolvedRating,
                        consultationFee = doc.consultationFee ?: 0
                    )
                    DoctorCard(doctor = hospitalDoctor, onBook = { onDoctorBook(hospitalDoctor) }, isDarkMode = isDarkMode)
                }
                // Embedded doctors not already returned by API
                items(embeddedDoctors) { doctor ->
                    DoctorCard(doctor = doctor, onBook = { onDoctorBook(doctor) }, isDarkMode = isDarkMode)
                }
            }
        }
    }
}

// ==================== DIAGNOSTIC CENTER DETAIL SHEET ====================
@Composable
private fun DiagnosticCenterDetailSheet(
    facility: MedicalFacility,
    onBookTest: () -> Unit = {},
    isDarkMode: Boolean
) {
    val dcContext = LocalContext.current
    val textColor = if (isDarkMode) Color.White else Color.Black
    val subtextColor = if (isDarkMode) Color.Gray else Color.Gray
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color(0xFFF5F5F5)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 32.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF7C3AED).copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Science, contentDescription = null, tint = Color(0xFF7C3AED), modifier = Modifier.size(32.dp))
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(facility.name, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = textColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Diagnostic Center", fontSize = 14.sp, color = subtextColor)
                }
            }
            StatusBadge(isOpen = facility.isOpen)
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Rating and Distance
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFFFC107), modifier = Modifier.size(18.dp))
                Text(" ${facility.rating}", fontSize = 14.sp, color = textColor)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = Color(0xFF7C3AED), modifier = Modifier.size(18.dp))
                Text(" ${facility.distance}", fontSize = 14.sp, color = textColor)
            }
        }

        // Specialties
        if (facility.specializations.isNotEmpty()) {
            Spacer(modifier = Modifier.height(12.dp))
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(facility.specializations) { spec ->
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF7C3AED).copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(spec, fontSize = 11.sp, color = Color(0xFF7C3AED), fontWeight = FontWeight.Medium)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Quick Actions
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            QuickActionButton(
                icon = Icons.Default.Call, label = "Call", color = Color(0xFF4CAF50),
                modifier = Modifier.weight(1f),
                onClick = { if (facility.phone.isNotBlank()) NavigationHelper.openDialer(dcContext, facility.phone) }
            )
            QuickActionButton(
                icon = Icons.Default.Directions, label = "Directions", color = Color(0xFF2196F3),
                modifier = Modifier.weight(1f),
                onClick = { NavigationHelper.openDirections(dcContext, facility.latitude, facility.longitude, facility.name) }
            )
            if (facility.isEmergencyAvailable) {
                QuickActionButton(
                    icon = Icons.Default.LocalHospital, label = "Emergency", color = Color(0xFFE53935),
                    modifier = Modifier.weight(1f),
                    onClick = { NavigationHelper.openDialer(dcContext, "108") }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(modifier = Modifier.padding(horizontal = 20.dp))
        Spacer(modifier = Modifier.height(16.dp))

        // Info Cards
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            InfoCard(
                icon = Icons.Outlined.AccessTime,
                title = "Timings",
                value = if (facility.openTime == "24 hrs") "24x7" else "${facility.openTime ?: "N/A"} - ${facility.closeTime ?: ""}",
                modifier = Modifier.weight(1f),
                cardColor = cardColor,
                textColor = textColor
            )
            InfoCard(
                icon = Icons.Outlined.Phone,
                title = "Contact",
                value = facility.phone.ifBlank { "N/A" },
                modifier = Modifier.weight(1f),
                cardColor = cardColor,
                textColor = textColor
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Address
        Card(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            colors = CardDefaults.cardColors(containerColor = cardColor),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Place, contentDescription = null, tint = Color(0xFF7C3AED))
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Address", fontSize = 12.sp, color = subtextColor)
                    Text(facility.address, fontSize = 14.sp, color = textColor)
                }
                IconButton(onClick = {
                    NavigationHelper.openDirections(dcContext, facility.latitude, facility.longitude, facility.name)
                }) {
                    Icon(Icons.Default.Directions, contentDescription = "Directions", tint = Color(0xFF7C3AED))
                }
            }
        }

        // Emergency badge
        if (facility.isEmergencyAvailable) {
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .background(Color(0xFFE53935).copy(alpha = 0.1f), RoundedCornerShape(12.dp))
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.LocalHospital, contentDescription = null, tint = Color(0xFFE53935), modifier = Modifier.size(24.dp))
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text("Emergency Services Available", fontWeight = FontWeight.SemiBold, color = Color(0xFFE53935), fontSize = 14.sp)
                    Text("24/7 emergency diagnostic services", fontSize = 12.sp, color = Color(0xFFE53935).copy(alpha = 0.8f))
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Book Test Button
        Button(
            onClick = onBookTest,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.Science, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Book a Test", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// ==================== 6️⃣ EMERGENCY MODE UI ====================
@Composable
private fun EmergencyModeContent(
    facilities: List<MedicalFacility>,
    isLoading: Boolean,
    onFacilityClick: (MedicalFacility) -> Unit,
    modifier: Modifier = Modifier
) {
    EmergencyFacilitiesList(
        facilities = facilities,
        onFacilityClick = onFacilityClick,
        modifier = modifier,
        isLoading = isLoading
    )
}

@Composable
private fun EmergencyTopBar(onExitEmergency: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xFFE53935)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Warning,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(28.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    "EMERGENCY MODE",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }

            TextButton(
                onClick = onExitEmergency,
                colors = ButtonDefaults.textButtonColors(contentColor = Color.White)
            ) {
                Text("Exit", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun EmergencyFacilitiesList(
    facilities: List<MedicalFacility>,
    onFacilityClick: (MedicalFacility) -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF1A1A1A))
    ) {
        // Emergency Banner
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFE53935)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    Icons.Default.LocalHospital,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    "Need Emergency Help?",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "We're showing nearest emergency hospitals",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(16.dp))
                val emergencyCallContext = LocalContext.current
                Button(
                    onClick = { NavigationHelper.openDialer(emergencyCallContext, "108") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                ) {
                    Icon(
                        Icons.Default.Call,
                        contentDescription = null,
                        tint = Color(0xFFE53935),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        "Call Ambulance (108)",
                        color = Color(0xFFE53935),
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                }
            }
        }

        // Emergency Hospitals List
        Text(
            "Nearest Emergency Hospitals",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = Color(0xFFE53935))
            }
        } else {
        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(facilities) { facility ->
                EmergencyHospitalCard(
                    facility = facility,
                    onClick = { onFacilityClick(facility) }
                )
            }
        }
        } // end else
    }
}

@Composable
private fun EmergencyHospitalCard(
    facility: MedicalFacility,
    onClick: () -> Unit
) {
    val cardContext = LocalContext.current
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = Color(0xFF2A2A2A)),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(2.dp, Color(0xFFE53935))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .background(Color(0xFFE53935), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.LocalHospital,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        facility.name,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = Color(0xFFE53935),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            if (facility.distance.isNotBlank()) facility.distance else "Distance unavailable",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                        // ETA estimate
                        if (facility.distanceKm > 0) {
                            val etaMin = NavigationHelper.estimateEtaMinutes(facility.distanceKm, 50.0)
                            Text(
                                " • ~${etaMin} min",
                                fontSize = 12.sp,
                                color = Color(0xFFFFA726),
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "24/7 Emergency Services",
                        color = Color(0xFF4CAF50),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                    // Show phone number inline
                    if (facility.phone.isNotBlank()) {
                        Text(
                            "📞 ${facility.phone}",
                            color = Color.Gray,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action buttons: Call + Navigate
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Call button
                Button(
                    onClick = {
                        if (facility.phone.isNotBlank()) {
                            NavigationHelper.openDialer(cardContext, facility.phone)
                        } else {
                            NavigationHelper.openDialer(cardContext, "108")
                        }
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(44.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(Icons.Default.Call, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        if (facility.phone.isNotBlank()) "Call" else "Call 108",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Navigate button
                Button(
                    onClick = {
                        NavigationHelper.openDirections(
                            cardContext,
                            facility.latitude,
                            facility.longitude,
                            facility.name
                        )
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(44.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1565C0)),
                    shape = RoundedCornerShape(10.dp),
                    enabled = facility.latitude != 0.0 && facility.longitude != 0.0
                ) {
                    Icon(Icons.Default.Navigation, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Navigate", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun EmergencyFacilityDetailSheet(
    facility: MedicalFacility,
    isDarkMode: Boolean
) {
    val emergencyContext = LocalContext.current
    val textColor = if (isDarkMode) Color.White else Color.Black
    val subtextColor = if (isDarkMode) Color.LightGray else Color.Gray
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color(0xFFF5F5F5)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 32.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFE53935).copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.LocalHospital,
                    contentDescription = null,
                    tint = Color(0xFFE53935),
                    modifier = Modifier.size(30.dp)
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = facility.name,
                    color = textColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (facility.distance.isNotBlank()) "${facility.distance} away" else "Distance unavailable",
                    color = subtextColor,
                    fontSize = 13.sp
                )
            }
            StatusBadge(isOpen = facility.isOpen)
        }

        Spacer(modifier = Modifier.height(14.dp))

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFE53935).copy(alpha = 0.1f)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFE53935))
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text("Emergency-ready facility", fontWeight = FontWeight.SemiBold, color = Color(0xFFE53935))
                    Text("Quick call and turn-by-turn navigation", fontSize = 12.sp, color = Color(0xFFE53935).copy(alpha = 0.85f))
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Button(
                onClick = {
                    if (facility.phone.isNotBlank()) {
                        NavigationHelper.openDialer(emergencyContext, facility.phone)
                    } else {
                        NavigationHelper.openDialer(emergencyContext, "108")
                    }
                },
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
            ) {
                Icon(Icons.Default.Call, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(if (facility.phone.isNotBlank()) "Call Hospital" else "Call 108", fontWeight = FontWeight.SemiBold)
            }

            Button(
                onClick = {
                    NavigationHelper.openDirections(
                        emergencyContext,
                        facility.latitude,
                        facility.longitude,
                        facility.name
                    )
                },
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1565C0)),
                enabled = facility.latitude != 0.0 && facility.longitude != 0.0
            ) {
                Icon(Icons.Default.Navigation, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Navigate", fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            colors = CardDefaults.cardColors(containerColor = cardColor),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Place, contentDescription = null, tint = Color(0xFF7C3AED), modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(facility.address.ifBlank { "Address unavailable" }, color = textColor, fontSize = 14.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Phone, contentDescription = null, tint = Color(0xFF7C3AED), modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(facility.phone.ifBlank { "N/A (fallback: 108)" }, color = textColor, fontSize = 14.sp)
                }
            }
        }
    }
}

// ==================== 7️⃣ EMPTY STATE DESIGN ====================
@Composable
private fun EmptyStateView(
    selectedFacilityType: FacilityType? = null,
    activeRadiusKm: Int,
    onResetFilters: () -> Unit,
    onRefreshNearby: () -> Unit
) {
    val emptyLabel = when (selectedFacilityType) {
        FacilityType.HOSPITAL -> "hospitals"
        FacilityType.CLINIC -> "clinics"
        FacilityType.MEDICAL_STORE -> "medical stores"
        FacilityType.DIAGNOSTIC_CENTER -> "diagnostic centers"
        null -> "facilities"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Medical Illustration
        Box(
            modifier = Modifier
                .size(150.dp)
                .background(SwastikPurple.copy(alpha = 0.1f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🏥", fontSize = 60.sp)
                Text("❓", fontSize = 30.sp)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            "No $emptyLabel found nearby",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = Color.DarkGray
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            "No approved results were found within $activeRadiusKm km of your current location. Try refreshing location or resetting filters.",
            fontSize = 14.sp,
            color = Color.Gray,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onRefreshNearby,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
        ) {
            Icon(
                Icons.Default.MyLocation,
                contentDescription = null,
                tint = Color.White
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Refresh Nearby", color = Color.White)
        }

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedButton(
            onClick = onResetFilters,
            shape = RoundedCornerShape(12.dp),
            border = ButtonDefaults.outlinedButtonBorder.copy(
                brush = Brush.linearGradient(listOf(SwastikPurple, SwastikPurple))
            )
        ) {
            Icon(
                Icons.Default.Refresh,
                contentDescription = null,
                tint = SwastikPurple
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Reset Filters", color = SwastikPurple)
        }
    }
}

@Composable
private fun MapEmptyStateCard(
    selectedFacilityType: FacilityType? = null,
    activeRadiusKm: Int,
    onResetFilters: () -> Unit,
    onRefreshNearby: () -> Unit,
    modifier: Modifier = Modifier
) {
    val emptyLabel = when (selectedFacilityType) {
        FacilityType.HOSPITAL -> "hospitals"
        FacilityType.CLINIC -> "clinics"
        FacilityType.MEDICAL_STORE -> "medical stores"
        FacilityType.DIAGNOSTIC_CENTER -> "diagnostic centers"
        null -> "facilities"
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.94f))
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "No $emptyLabel found within $activeRadiusKm km",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF212121)
            )
            Text(
                "The map is centered on your current location. Refresh location or reset filters to try again.",
                fontSize = 14.sp,
                color = Color(0xFF616161)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = onRefreshNearby,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.MyLocation, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Refresh")
                }
                OutlinedButton(
                    onClick = onResetFilters,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = SwastikPurple)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Reset", color = SwastikPurple)
                }
            }
        }
    }
}

// ==================== HELPER COMPONENTS ====================
@Composable
private fun SearchBarSection(
    selectedFacilityType: FacilityType?,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    onFilterClick: () -> Unit,
    isDarkMode: Boolean
) {
    val containerColor = if (isDarkMode) Color(0xFF2A2A2A) else Color.White
    val placeholderText = when (selectedFacilityType) {
        FacilityType.HOSPITAL -> "Search hospitals..."
        FacilityType.CLINIC -> "Search clinics..."
        FacilityType.MEDICAL_STORE -> "Search medical stores..."
        FacilityType.DIAGNOSTIC_CENTER -> "Search diagnostic centers..."
        null -> "Search hospitals, clinics, stores..."
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            placeholder = {
                Text(
                    placeholderText,
                    color = Color.Gray
                )
            },
            leadingIcon = {
                Icon(
                    Icons.Default.Search,
                    contentDescription = null,
                    tint = Color.Gray
                )
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { onSearchChange("") }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear")
                    }
                } else {
                    Icon(
                        Icons.Default.Mic,
                        contentDescription = "Voice Search",
                        tint = SwastikPurple
                    )
                }
            },
            modifier = Modifier
                .weight(1f)
                .shadow(4.dp, RoundedCornerShape(16.dp)),
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedBorderColor = Color.Transparent,
                focusedBorderColor = SwastikPurple,
                unfocusedContainerColor = containerColor,
                focusedContainerColor = containerColor
            ),
            singleLine = true
        )

        Spacer(modifier = Modifier.width(8.dp))

        // Filter Button
        IconButton(
            onClick = onFilterClick,
            modifier = Modifier
                .size(50.dp)
                .shadow(4.dp, RoundedCornerShape(12.dp))
                .background(containerColor, RoundedCornerShape(12.dp))
        ) {
            Icon(
                Icons.Default.Tune,
                contentDescription = "Filter",
                tint = SwastikPurple
            )
        }
    }
}

@Suppress("UNUSED_PARAMETER")
@Composable
private fun FilterChipsSection(
    selectedType: FacilityType?,
    onTypeSelected: (FacilityType?) -> Unit,
    isDarkMode: Boolean
) {
    LazyRow(
        modifier = Modifier.padding(vertical = 8.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            FilterChip(
                selected = selectedType == null,
                onClick = { onTypeSelected(null) },
                label = { Text("All") },
                leadingIcon = {
                    if (selectedType == null) {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SwastikPurple,
                    selectedLabelColor = Color.White
                )
            )
        }
        items(FacilityType.entries.toTypedArray()) { type ->
            FilterChip(
                selected = selectedType == type,
                onClick = { onTypeSelected(if (selectedType == type) null else type) },
                label = { Text(type.getDisplayName()) },
                leadingIcon = {
                    Icon(
                        imageVector = type.getMarkerIcon(),
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (selectedType == type) Color.White else type.getMarkerColor()
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = type.getMarkerColor(),
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

@Composable
private fun FacilityMapCard(
    facility: MedicalFacility,
    onClick: () -> Unit,
    isDarkMode: Boolean
) {
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color.White
    val textColor = if (isDarkMode) Color.White else Color.Black
    val mapCardContext = LocalContext.current

    Card(
        modifier = Modifier
            .width(300.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(50.dp)
                        .clip(CircleShape)
                        .background(facility.type.getMarkerColor().copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = facility.type.getMarkerIcon(),
                        contentDescription = null,
                        tint = facility.type.getMarkerColor(),
                        modifier = Modifier.size(26.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = facility.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = textColor,
                            modifier = Modifier.weight(1f)
                        )
                        if (facility.isEmergencyAvailable) {
                            Spacer(modifier = Modifier.width(4.dp))
                            Box(
                                modifier = Modifier
                                    .background(Color(0xFFE53935), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    "24/7",
                                    fontSize = 9.sp,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                    Text(
                        text = facility.type.getDisplayName(),
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            tint = Color(0xFFFFC107),
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = " ${facility.rating} • ${facility.distance}",
                            fontSize = 11.sp,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        StatusBadge(isOpen = facility.isOpen, small = true)
                    }
                }
            }

            // Quick action row: Call + Navigate + View Details
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Call
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .clickable {
                            if (facility.phone.isNotBlank()) {
                                NavigationHelper.openDialer(mapCardContext, facility.phone)
                            } else {
                                NavigationHelper.openDialer(mapCardContext, "108")
                            }
                        },
                    color = if (facility.phone.isNotBlank()) Color(0xFF4CAF50).copy(alpha = 0.1f) else Color(0xFFFFA726).copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Default.Call,
                            contentDescription = "Call",
                            tint = if (facility.phone.isNotBlank()) Color(0xFF4CAF50) else Color(0xFFF57C00),
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            if (facility.phone.isNotBlank()) "Call" else "Call 108",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (facility.phone.isNotBlank()) Color(0xFF4CAF50) else Color(0xFFF57C00)
                        )
                    }
                }

                // Navigate
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .clickable {
                            NavigationHelper.openDirections(
                                mapCardContext,
                                facility.latitude,
                                facility.longitude,
                                facility.name
                            )
                        },
                    color = Color(0xFF2196F3).copy(alpha = 0.1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Default.Navigation,
                            contentDescription = "Navigate",
                            tint = Color(0xFF2196F3),
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            "Navigate",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF2196F3)
                        )
                    }
                }

                // View Details
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { onClick() },
                    color = SwastikPurple.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Default.ChevronRight,
                            contentDescription = "Details",
                            tint = SwastikPurple,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            "Details",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = SwastikPurple
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FacilityListCard(
    facility: MedicalFacility,
    onClick: () -> Unit,
    isDarkMode: Boolean
) {
    val cardColor = if (isDarkMode) Color(0xFF2A2A2A) else Color.White
    val textColor = if (isDarkMode) Color.White else Color.Black

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(facility.type.getMarkerColor().copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = facility.type.getMarkerIcon(),
                        contentDescription = null,
                        tint = facility.type.getMarkerColor(),
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = facility.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = textColor
                        )
                        StatusBadge(isOpen = facility.isOpen)
                    }
                    Text(
                        text = facility.type.getDisplayName(),
                        fontSize = 13.sp,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            tint = Color(0xFFFFC107),
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = " ${facility.rating} (${facility.reviewCount})",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Icon(
                            Icons.Outlined.LocationOn,
                            contentDescription = null,
                            tint = SwastikPurple,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = " ${facility.distance}",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.Top) {
                Icon(
                    Icons.Outlined.Place,
                    contentDescription = null,
                    tint = Color.Gray,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = facility.address,
                    fontSize = 13.sp,
                    color = Color.Gray,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            if (facility.specializations.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(facility.specializations.take(3)) { spec ->
                        Box(
                            modifier = Modifier
                                .background(
                                    facility.type.getMarkerColor().copy(alpha = 0.1f),
                                    RoundedCornerShape(8.dp)
                                )
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(text = spec, fontSize = 11.sp, color = facility.type.getMarkerColor())
                        }
                    }
                }
            }

            if (facility.isEmergencyAvailable) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .background(Color(0xFFFFEBEE), RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Icon(
                        Icons.Default.LocalHospital,
                        contentDescription = null,
                        tint = Color(0xFFE53935),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "24/7 Emergency Available",
                        fontSize = 12.sp,
                        color = Color(0xFFE53935),
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(isOpen: Boolean, small: Boolean = false) {
    Box(
        modifier = Modifier
            .background(
                if (isOpen) Color(0xFFE8F5E9) else Color(0xFFFFEBEE),
                RoundedCornerShape(if (small) 4.dp else 6.dp)
            )
            .padding(
                horizontal = if (small) 6.dp else 8.dp,
                vertical = if (small) 2.dp else 4.dp
            )
    ) {
        Text(
            text = if (isOpen) "Open" else "Closed",
            fontSize = if (small) 10.sp else 11.sp,
            color = if (isOpen) Color(0xFF4CAF50) else Color(0xFFE53935),
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun QuickActionButton(
    icon: ImageVector,
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .background(color.copy(alpha = 0.1f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(24.dp)
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            label,
            fontSize = 12.sp,
            color = color,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun InfoCard(
    icon: ImageVector,
    title: String,
    value: String,
    modifier: Modifier = Modifier,
    cardColor: Color = Color(0xFFF5F5F5),
    textColor: Color = Color.Black
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = cardColor),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = SwastikPurple,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(title, fontSize = 11.sp, color = Color.Gray)
                Text(
                    value,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = textColor
                )
            }
        }
    }
}

// Note: getMarkerIcon() and getMarkerColor() are defined in MedicalModels.kt (FacilityType enum)
