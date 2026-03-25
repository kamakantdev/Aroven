package com.example.swastik.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.model.MedicalFacility
import com.example.swastik.data.model.Medicine
import com.example.swastik.data.model.FacilityType
import com.example.swastik.data.model.HospitalDoctor
import com.example.swastik.data.remote.SocketManager
import com.example.swastik.data.remote.dto.ClinicDoctorDto
import com.example.swastik.data.remote.dto.PharmacyInventoryItemDto
import com.example.swastik.data.repository.HospitalRepository
import com.example.swastik.utils.LocationHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HospitalFinderUiState(
    val facilities: List<MedicalFacility> = emptyList(),
    val emergencyFacilities: List<MedicalFacility> = emptyList(),
    val isLoading: Boolean = false,
    val isEmergencyLoading: Boolean = false,
    val error: String? = null,
    val locationAvailable: Boolean = false,
    val userLatitude: Double = 0.0,
    val userLongitude: Double = 0.0,
    val activeRadiusKm: Int = DEFAULT_DISCOVERY_RADIUS_KM,
    val pharmacyMedicines: List<Medicine> = emptyList(),
    val isMedicineSearching: Boolean = false,
    val reviewSubmitting: Boolean = false,
    val reviewSuccess: Boolean = false,
    val reviewError: String? = null,
    // Clinic detail
    val clinicDoctors: List<ClinicDoctorDto> = emptyList(),
    val isClinicDoctorsLoading: Boolean = false,
    // Pharmacy inventory
    val pharmacyInventory: List<PharmacyInventoryItemDto> = emptyList(),
    val isPharmacyInventoryLoading: Boolean = false,
)

@HiltViewModel
class HospitalFinderViewModel @Inject constructor(
    private val hospitalRepository: HospitalRepository,
    private val locationHelper: LocationHelper,
    private val socketManager: SocketManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(HospitalFinderUiState())
    val uiState: StateFlow<HospitalFinderUiState> = _uiState.asStateFlow()

    private var currentLatitude: Double = 0.0
    private var currentLongitude: Double = 0.0
    private var currentRadius: Int = DEFAULT_DISCOVERY_RADIUS_KM
    private var currentFacilityType: FacilityType? = null
    private var hasObservedSocketConnection = false

    // Cache of all loaded facilities for client-side search filtering
    private var allFacilities: List<MedicalFacility> = emptyList()

    init {
        // Auto-fetch location if permission already granted
        fetchLocationAndLoad()
        observeProviderCatalogUpdates()
        observeSocketReconnects()
    }

    private fun observeProviderCatalogUpdates() {
        viewModelScope.launch {
            socketManager.providerCatalogUpdates.collect {
                if (_uiState.value.locationAvailable) {
                    loadNearbyFacilities()
                }
            }
        }
    }

    private fun observeSocketReconnects() {
        viewModelScope.launch {
            socketManager.connectionState.collect { connected ->
                if (!hasObservedSocketConnection) {
                    hasObservedSocketConnection = true
                    return@collect
                }
                if (connected && _uiState.value.locationAvailable) {
                    loadNearbyFacilities()
                }
            }
        }
    }

    /**
     * Called from init and from the UI after permission is granted.
     * Gets GPS coordinates and loads nearby facilities.
     */
    fun fetchLocationAndLoad(facilityType: FacilityType? = currentFacilityType) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            if (!locationHelper.hasLocationPermission()) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Location permission required. Please allow location access."
                )
                return@launch
            }

            val location = locationHelper.getLastLocation()
            if (location != null) {
                updateLocationAndLoad(location.latitude, location.longitude, facilityType = facilityType)
            } else {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Could not determine your location. Please enable GPS."
                )
            }
        }
    }

    /**
     * Update user's current GPS location and reload facilities.
     * Should be called from the UI layer with real coordinates from FusedLocationProvider.
     */
    fun updateLocationAndLoad(
        latitude: Double,
        longitude: Double,
        radius: Int = DEFAULT_DISCOVERY_RADIUS_KM,
        facilityType: FacilityType? = currentFacilityType
    ) {
        currentLatitude = latitude
        currentLongitude = longitude
        currentRadius = radius
        currentFacilityType = facilityType
        _uiState.value = _uiState.value.copy(
            locationAvailable = true,
            userLatitude = latitude,
            userLongitude = longitude,
            activeRadiusKm = radius
        )
        loadNearbyFacilities(latitude, longitude, radius, facilityType)
    }

    fun loadNearbyFacilities(
        latitude: Double = currentLatitude,
        longitude: Double = currentLongitude,
        radius: Int = currentRadius,
        facilityType: FacilityType? = currentFacilityType
    ) {
        if (latitude == 0.0 && longitude == 0.0) {
            _uiState.value = _uiState.value.copy(
                error = "Location not available. Please enable GPS.",
                isLoading = false
            )
            return
        }
        viewModelScope.launch {
            currentRadius = radius
            currentFacilityType = facilityType
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                error = null,
                activeRadiusKm = radius
            )
            try {
                var activeRadius = radius
                var loadedFacilities = fetchFacilities(latitude, longitude, activeRadius, facilityType)

                // Retry once with a wider radius so the discovery screen does not
                // look completely broken when facilities exist just outside 10km.
                if (loadedFacilities.isEmpty() && activeRadius < EXPANDED_DISCOVERY_RADIUS_KM) {
                    activeRadius = EXPANDED_DISCOVERY_RADIUS_KM
                    currentRadius = activeRadius
                    loadedFacilities = fetchFacilities(latitude, longitude, activeRadius, facilityType)
                }

                // Cache for search filtering
                allFacilities = loadedFacilities

                _uiState.value = _uiState.value.copy(
                    facilities = loadedFacilities,
                    isLoading = false,
                    activeRadiusKm = activeRadius
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load nearby facilities"
                )
            }
        }
    }

    private suspend fun fetchFacilities(
        latitude: Double,
        longitude: Double,
        radius: Int,
        facilityType: FacilityType?
    ): List<MedicalFacility> = coroutineScope {
        val requests = buildList {
            if (facilityType == null || facilityType == FacilityType.HOSPITAL) {
                add(async {
                    try { hospitalRepository.getNearbyHospitals(latitude, longitude, radius) }
                    catch (_: Exception) { emptyList() }
                })
            }
            if (facilityType == null || facilityType == FacilityType.MEDICAL_STORE) {
                add(async {
                    try { hospitalRepository.getNearbyPharmacies(latitude, longitude, radius) }
                    catch (_: Exception) { emptyList() }
                })
            }
            if (facilityType == null || facilityType == FacilityType.CLINIC) {
                add(async {
                    try { hospitalRepository.getNearbyClinics(latitude, longitude, radius) }
                    catch (_: Exception) { emptyList() }
                })
            }
            if (facilityType == null || facilityType == FacilityType.DIAGNOSTIC_CENTER) {
                add(async {
                    try { hospitalRepository.getNearbyDiagnosticCenters(latitude, longitude, radius) }
                    catch (_: Exception) { emptyList() }
                })
            }
        }

        requests.awaitAll().flatten()
    }

    fun searchFacilities(query: String, facilityType: FacilityType? = null) {
        if (query.isBlank()) {
            // Restore full list when search is cleared
            _uiState.value = _uiState.value.copy(facilities = allFacilities, isLoading = false)
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val lat = if (currentLatitude != 0.0) currentLatitude else null
                val lng = if (currentLongitude != 0.0) currentLongitude else null

                val searches = buildList {
                    if (facilityType == null || facilityType == FacilityType.HOSPITAL) {
                        add(async { hospitalRepository.searchHospitals(query, lat, lng) })
                    }
                    if (facilityType == null || facilityType == FacilityType.CLINIC) {
                        add(async { hospitalRepository.searchClinics(query, lat, lng) })
                    }
                    if (facilityType == null || facilityType == FacilityType.MEDICAL_STORE) {
                        add(async { hospitalRepository.searchPharmacies(query, lat, lng) })
                    }
                    if (facilityType == null || facilityType == FacilityType.DIAGNOSTIC_CENTER) {
                        add(async { hospitalRepository.searchDiagnosticCenters(query, lat, lng) })
                    }
                }

                val remoteResults = searches.awaitAll().flatten()
                val seen = mutableSetOf<String>()
                val dedupedResults = remoteResults.filter { facility ->
                    seen.add("${facility.type}:${facility.id}")
                }

                _uiState.value = _uiState.value.copy(
                    facilities = dedupedResults,
                    isLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Search failed"
                )
            }
        }
    }

    /**
     * Search medicines at a specific pharmacy/store.
     * Uses the general medicine search API and filters results.
     */
    fun searchPharmacyMedicines(query: String) {
        if (query.isBlank()) {
            _uiState.value = _uiState.value.copy(pharmacyMedicines = emptyList(), isMedicineSearching = false)
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isMedicineSearching = true)
            try {
                val medicines = hospitalRepository.searchMedicines(query)
                _uiState.value = _uiState.value.copy(
                    pharmacyMedicines = medicines,
                    isMedicineSearching = false
                )
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(isMedicineSearching = false)
            }
        }
    }

    fun clearPharmacyMedicines() {
        _uiState.value = _uiState.value.copy(pharmacyMedicines = emptyList(), isMedicineSearching = false)
    }

    /**
     * Load emergency hospitals from the dedicated server endpoint (50km radius).
     */
    fun loadEmergencyHospitals() {
        if (currentLatitude == 0.0 && currentLongitude == 0.0) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isEmergencyLoading = true)
            try {
                val emergencyList = hospitalRepository.getEmergencyHospitals(currentLatitude, currentLongitude)
                _uiState.value = _uiState.value.copy(
                    emergencyFacilities = emergencyList,
                    isEmergencyLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isEmergencyLoading = false,
                    error = e.message ?: "Failed to load emergency hospitals"
                )
            }
        }
    }

    /**
     * Submit a review for a hospital.
     */
    fun submitHospitalReview(hospitalId: String, rating: Int, comment: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(reviewSubmitting = true, reviewError = null, reviewSuccess = false)
            val success = hospitalRepository.submitHospitalReview(hospitalId, rating, comment)
            _uiState.value = _uiState.value.copy(
                reviewSubmitting = false,
                reviewSuccess = success,
                reviewError = if (!success) "Failed to submit review. You may have already reviewed this hospital." else null
            )
        }
    }

    fun clearReviewState() {
        _uiState.value = _uiState.value.copy(reviewSubmitting = false, reviewSuccess = false, reviewError = null)
    }

    // ==================== Clinic Detail ====================

    /**
     * Load doctors affiliated with a clinic for the detail sheet.
     */
    fun loadClinicDoctors(clinicId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isClinicDoctorsLoading = true, clinicDoctors = emptyList())
            try {
                val doctors = hospitalRepository.getClinicDoctors(clinicId)
                _uiState.value = _uiState.value.copy(
                    clinicDoctors = doctors,
                    isClinicDoctorsLoading = false
                )
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(isClinicDoctorsLoading = false)
            }
        }
    }

    fun clearClinicDoctors() {
        _uiState.value = _uiState.value.copy(clinicDoctors = emptyList(), isClinicDoctorsLoading = false)
    }

    // ==================== Pharmacy Inventory ====================

    /**
     * Load pharmacy inventory for the detail sheet.
     */
    fun loadPharmacyInventory(pharmacyId: String, search: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPharmacyInventoryLoading = true)
            try {
                val items = hospitalRepository.getPharmacyInventory(pharmacyId, search)
                _uiState.value = _uiState.value.copy(
                    pharmacyInventory = items,
                    isPharmacyInventoryLoading = false
                )
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(isPharmacyInventoryLoading = false)
            }
        }
    }

    fun clearPharmacyInventory() {
        _uiState.value = _uiState.value.copy(pharmacyInventory = emptyList(), isPharmacyInventoryLoading = false)
    }
}

private const val DEFAULT_DISCOVERY_RADIUS_KM = 10
private const val EXPANDED_DISCOVERY_RADIUS_KM = 25
