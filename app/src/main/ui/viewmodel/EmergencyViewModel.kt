package com.example.swastik.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.model.EmergencyResponse
import com.example.swastik.data.remote.dto.EmergencyRequest
import com.example.swastik.data.remote.AmbulanceLocationUpdate
import com.example.swastik.data.remote.AmbulanceStatusUpdate
import com.example.swastik.data.remote.AmbulanceAssignedUpdate
import com.example.swastik.data.remote.SocketManager
import com.example.swastik.data.repository.EmergencyRepository
import com.example.swastik.data.repository.Result
import com.example.swastik.utils.LocationHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.plus
import javax.inject.Inject

data class EmergencyUiState(
    val isLoading: Boolean = false,
    val requestSent: Boolean = false,
    val activeEmergency: EmergencyResponse? = null,
    val error: String? = null,
    val locationAvailable: Boolean = false,
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    // Live ambulance tracking
    val ambulanceLatitude: Double? = null,
    val ambulanceLongitude: Double? = null,
    val ambulanceHeading: Float = 0f,
    val ambulanceSpeed: Float = 0f,
    val ambulanceStatus: String? = null,
    val isTrackingAmbulance: Boolean = false,
    // Driver info from ambulance:assigned
    val driverName: String? = null,
    val driverPhone: String? = null,
    val vehicleNumber: String? = null,
    // ETA from ambulance location updates
    val ambulanceEta: String? = null,
    val ambulanceDistanceKm: Double? = null
)

@HiltViewModel
class EmergencyViewModel @Inject constructor(
    private val emergencyRepository: EmergencyRepository,
    private val socketManager: SocketManager,
    private val locationHelper: LocationHelper
) : ViewModel() {

    private val _uiState = MutableStateFlow(EmergencyUiState())
    val uiState: StateFlow<EmergencyUiState> = _uiState.asStateFlow()

    // SupervisorJob-backed scope: a single location error won't cancel other coroutines
    private val locationScope = viewModelScope + SupervisorJob()
    /** Cancellable job that streams patient GPS to the backend during active emergency */
    private var locationStreamJob: Job? = null

    init {
        checkActiveEmergency()
        collectAmbulanceUpdates()
        fetchLocation()
    }

    /**
     * Auto-fetch GPS location. Called on init and after permission is granted.
     */
    fun fetchLocation() {
        viewModelScope.launch {
            if (!locationHelper.hasLocationPermission()) return@launch

            val location = locationHelper.getLastLocation()
            if (location != null) {
                updateLocation(location.latitude, location.longitude)
            }
        }
    }

    /**
     * Check if there's already an active emergency request.
     * If found, start tracking ambulance location.
     */
    fun checkActiveEmergency() {
        viewModelScope.launch {
            when (val result = emergencyRepository.getActiveEmergency()) {
                is Result.Success -> {
                    if (result.data != null) {
                        _uiState.value = _uiState.value.copy(
                            activeEmergency = result.data,
                            requestSent = true,
                            ambulanceStatus = result.data.resolvedStatus()
                        )
                        // Start tracking ambulance for the active request
                        startTrackingAmbulance(result.data.resolvedRequestId())
                    }
                }
                is Result.Error -> {
                    // No active emergency — that's fine
                }
                is Result.Loading -> {}
            }
        }
    }

    /**
     * Collect real-time ambulance location and status updates from SocketManager.
     */
    private fun collectAmbulanceUpdates() {
        // Location updates
        viewModelScope.launch {
            socketManager.ambulanceLocationUpdates.collect { locationUpdate ->
                val activeId = _uiState.value.activeEmergency?.resolvedRequestId()
                if (!activeId.isNullOrEmpty() && locationUpdate.requestId == activeId) {
                    _uiState.value = _uiState.value.copy(
                        ambulanceLatitude = locationUpdate.latitude,
                        ambulanceLongitude = locationUpdate.longitude,
                        ambulanceHeading = locationUpdate.heading,
                        ambulanceSpeed = locationUpdate.speed,
                        ambulanceEta = locationUpdate.eta ?: _uiState.value.ambulanceEta,
                        ambulanceDistanceKm = locationUpdate.distanceKm ?: _uiState.value.ambulanceDistanceKm
                    )
                }
            }
        }

        // Status updates (arrived, en_route, completed, etc.)
        viewModelScope.launch {
            socketManager.ambulanceUpdates.collect { statusUpdate ->
                val activeId = _uiState.value.activeEmergency?.resolvedRequestId()
                if (!activeId.isNullOrEmpty() && statusUpdate.requestId == activeId) {
                    _uiState.value = _uiState.value.copy(
                        ambulanceStatus = statusUpdate.status
                    )
                    // If completed, cancelled, or terminal — stop tracking and unsubscribe
                    if (statusUpdate.status in listOf("completed", "cancelled", "timeout", "no_ambulance")) {
                        socketManager.untrackAmbulance(activeId)
                        stopPatientLocationStream()
                        _uiState.value = _uiState.value.copy(
                            isTrackingAmbulance = false,
                            activeEmergency = null,
                            requestSent = false,
                            driverName = null,
                            driverPhone = null,
                            vehicleNumber = null
                        )
                    }
                }
            }
        }

        // Ambulance assigned — driver info
        viewModelScope.launch {
            socketManager.ambulanceAssigned.collect { assigned ->
                val activeId = _uiState.value.activeEmergency?.resolvedRequestId()
                if (!activeId.isNullOrEmpty() && assigned.requestId == activeId) {
                    _uiState.value = _uiState.value.copy(
                        ambulanceStatus = "assigned",
                        driverName = assigned.driverName,
                        driverPhone = assigned.driverPhone,
                        vehicleNumber = assigned.vehicleNumber
                    )
                }
            }
        }
    }

    /**
     * Start tracking ambulance via Socket.IO room subscription.
     */
    private fun startTrackingAmbulance(requestId: String) {
        socketManager.connect() // Ensure socket is connected
        socketManager.trackAmbulance(requestId)
        _uiState.value = _uiState.value.copy(isTrackingAmbulance = true)
        startPatientLocationStream(requestId)
    }

    /**
     * Stream patient's live GPS to the backend so the ambulance driver
     * always navigates to the patient's current position, not a stale one.
     */
    private fun startPatientLocationStream(requestId: String) {
        locationStreamJob?.cancel()
        locationStreamJob = locationScope.launch {
            try {
                locationHelper.requestLocationUpdates(intervalMs = 10_000L).collect { location ->
                    // Update local UI state
                    updateLocation(location.latitude, location.longitude)
                    // Push to backend via socket
                    socketManager.sendPatientLocationUpdate(requestId, location.latitude, location.longitude)
                }
            } catch (_: SecurityException) {
                // Location permission revoked mid-stream — silently stop
            }
        }
    }

    /** Stop the continuous location stream */
    private fun stopPatientLocationStream() {
        locationStreamJob?.cancel()
        locationStreamJob = null
    }

    /**
     * Update user's current GPS location.
     */
    fun updateLocation(latitude: Double, longitude: Double) {
        _uiState.value = _uiState.value.copy(
            latitude = latitude,
            longitude = longitude,
            locationAvailable = true
        )
    }

    /**
     * Request an emergency ambulance.
     * Retries up to 3 times with exponential backoff for network failures.
     */
    fun requestEmergency(emergencyType: String, description: String = "") {
        val state = _uiState.value
        if (!state.locationAvailable) {
            _uiState.value = state.copy(error = "Location not available. Please enable GPS and try again.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            val request = EmergencyRequest(
                latitude = state.latitude,
                longitude = state.longitude,
                address = null,
                emergencyType = emergencyType,
                notes = description
            )

            var lastError: String? = null
            val maxRetries = 3
            for (attempt in 0 until maxRetries) {
                when (val result = emergencyRepository.requestEmergency(request)) {
                    is Result.Success -> {
                        val activeEmergency = result.data
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            requestSent = true,
                            activeEmergency = activeEmergency
                        )
                        // Start tracking the ambulance in real-time
                        startTrackingAmbulance(activeEmergency.resolvedRequestId())
                        return@launch // success — exit
                    }
                    is Result.Error -> {
                        lastError = result.message
                        if (attempt < maxRetries - 1) {
                            // Exponential backoff: 1s, 2s, 4s
                            kotlinx.coroutines.delay(1000L * (1 shl attempt))
                        }
                    }
                    is Result.Loading -> {}
                }
            }

            // All retries exhausted
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                error = lastError ?: "Emergency request failed after $maxRetries attempts"
            )
        }
    }

    /**
     * Cancel current emergency request.
     */
    fun cancelEmergency() {
        val emergencyId = _uiState.value.activeEmergency?.resolvedRequestId()
        if (emergencyId.isNullOrEmpty()) return

        // Unsubscribe from tracking room before cancelling
        socketManager.untrackAmbulance(emergencyId)
        stopPatientLocationStream()

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            when (val result = emergencyRepository.cancelEmergency(emergencyId, "Cancelled by user")) {
                is Result.Success -> {
                    _uiState.value = EmergencyUiState() // Reset state
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopPatientLocationStream()
        // Unsubscribe from ambulance tracking room if still active
        val activeId = _uiState.value.activeEmergency?.resolvedRequestId()
        if (!activeId.isNullOrEmpty() && _uiState.value.isTrackingAmbulance) {
            socketManager.untrackAmbulance(activeId)
        }
    }
}
