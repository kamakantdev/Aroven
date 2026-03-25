package com.example.swastik.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.model.*
import com.example.swastik.data.remote.dto.EmergencyRequest
import com.example.swastik.data.remote.SocketManager
import com.example.swastik.data.remote.dto.UpdateProfileRequest
import com.example.swastik.data.remote.dto.AddEmergencyContactRequest
import com.example.swastik.data.remote.dto.AddFamilyMemberRequest
import com.example.swastik.data.repository.Result
import com.example.swastik.data.repository.PatientRepository
import com.example.swastik.data.repository.EmergencyRepository
import com.example.swastik.utils.NetworkObserver
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State for Patient Dashboard
 */
data class PatientDashboardUiState(
    val isLoading: Boolean = true,
    val dashboard: PatientDashboard? = null,
    val error: String? = null,
    val activeEmergency: EmergencyResponse? = null
)

/**
 * Patient Dashboard ViewModel
 */
@HiltViewModel
class PatientDashboardViewModel @Inject constructor(
    private val patientRepository: PatientRepository,
    private val emergencyRepository: EmergencyRepository,
    private val socketManager: SocketManager,
    networkObserver: NetworkObserver
) : ViewModel() {

    private val _uiState = MutableStateFlow(PatientDashboardUiState())
    val uiState: StateFlow<PatientDashboardUiState> = _uiState.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    /** Emits false when the device has no internet */
    val isOnline: StateFlow<Boolean> = networkObserver.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)

    private var hasObservedSocketConnection = false

    init {
        loadDashboard()
        collectRealtimeNotifications()
        collectProviderCatalogUpdates()
        observeSocketReconnects()
    }

    val patientProfile = patientRepository.patientProfile
    val notifications = patientRepository.notifications
    val stats = patientRepository.stats
    val reminders = patientRepository.reminders
    val recommendedDoctors = patientRepository.recommendedDoctors

    /**
     * Collect real-time notifications from Socket.IO and merge into notification list
     */
    private fun collectRealtimeNotifications() {
        viewModelScope.launch {
            patientRepository.realtimeNotifications.collect { socketNotification ->
                // Convert socket notification to UI model and prepend
                val newNotification = NotificationItem(
                    id = socketNotification.id,
                    title = socketNotification.title,
                    message = socketNotification.message,
                    time = "Just now",
                    type = when (socketNotification.type.lowercase()) {
                        "appointment", "appointment_booked", "appointment_confirmed", "appointment_reminder", "follow_up_reminder", "appointment_status_changed", "appointment_rescheduled", "appointment_cancelled" -> NotificationType.APPOINTMENT
                        "medicine", "medicine_reminder", "medicine_missed", "health_task_reminder", "care_plan_reminder" -> NotificationType.MEDICINE_REMINDER
                        "report", "report_ready", "diagnostic_result", "diagnostic_test_reminder", "report_review_reminder" -> NotificationType.REPORT_READY
                        "prescription", "prescription_created", "prescription_expiry_reminder" -> NotificationType.PRESCRIPTION
                        else -> NotificationType.SYSTEM
                    },
                    isRead = false,
                    actionLabel = null
                )
                // Merge: add to start of existing list
                val current = patientRepository.notifications.value.toMutableList()
                current.add(0, newNotification)
                // Trigger a re-read to update the private _notifications in repository
                patientRepository.fetchNotifications()
            }
        }
    }

    private fun collectProviderCatalogUpdates() {
        viewModelScope.launch {
            socketManager.providerCatalogUpdates.collect {
                refresh()
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
                if (connected) {
                    refresh()
                }
            }
        }
    }

    fun loadDashboard() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            when (val result = patientRepository.getDashboard()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        dashboard = result.data,
                        activeEmergency = result.data.activeEmergency
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {
                    // Already handled above
                }
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            when (val result = patientRepository.getDashboard()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        dashboard = result.data,
                        activeEmergency = result.data.activeEmergency
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> { }
            }
            _isRefreshing.value = false
        }
    }

    fun requestEmergency(
        latitude: Double,
        longitude: Double,
        address: String?,
        emergencyType: String,
        description: String?
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            val request = EmergencyRequest(
                latitude = latitude,
                longitude = longitude,
                address = address,
                emergencyType = emergencyType,
                notes = description
            )
            
            when (val result = emergencyRepository.requestEmergency(request)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        activeEmergency = result.data
                    )
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

    fun cancelEmergency(emergencyId: String, reason: String) {
        viewModelScope.launch {
            when (val result = emergencyRepository.cancelEmergency(emergencyId, reason)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(activeEmergency = null)
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(error = result.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    // ── Notification Actions ────────────────────────────────────

    fun markNotificationRead(notificationId: String) {
        viewModelScope.launch {
            patientRepository.markNotificationRead(notificationId)
            // Refresh notifications list to reflect the change
            patientRepository.fetchNotifications()
        }
    }

    fun markAllNotificationsRead() {
        viewModelScope.launch {
            patientRepository.markAllNotificationsRead()
            // Refresh notifications list to reflect the change
            patientRepository.fetchNotifications()
        }
    }

    // ── Profile Update ──────────────────────────────────────────

    private val _profileUpdateState = MutableStateFlow<ProfileUpdateState>(ProfileUpdateState.Idle)
    val profileUpdateState: StateFlow<ProfileUpdateState> = _profileUpdateState.asStateFlow()

    fun updateProfile(request: UpdateProfileRequest) {
        viewModelScope.launch {
            _profileUpdateState.value = ProfileUpdateState.Loading
            when (val result = patientRepository.updateProfile(request)) {
                is Result.Success -> {
                    _profileUpdateState.value = ProfileUpdateState.Success
                    // Refresh the entire dashboard so updated profile data
                    // (name, age, blood group, etc.) reflects everywhere in the app
                    loadDashboard()
                }
                is Result.Error -> {
                    _profileUpdateState.value = ProfileUpdateState.Error(result.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun resetProfileUpdateState() {
        _profileUpdateState.value = ProfileUpdateState.Idle
    }

    // ── Profile Image Upload ────────────────────────────────────

    private val _imageUploadState = MutableStateFlow<ProfileUpdateState>(ProfileUpdateState.Idle)
    val imageUploadState: StateFlow<ProfileUpdateState> = _imageUploadState.asStateFlow()

    fun uploadProfileImage(imagePart: okhttp3.MultipartBody.Part) {
        viewModelScope.launch {
            _imageUploadState.value = ProfileUpdateState.Loading
            when (val result = patientRepository.uploadProfileImage(imagePart)) {
                is Result.Success -> {
                    _imageUploadState.value = ProfileUpdateState.Success
                    loadDashboard()
                }
                is Result.Error -> {
                    _imageUploadState.value = ProfileUpdateState.Error(result.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun resetImageUploadState() {
        _imageUploadState.value = ProfileUpdateState.Idle
    }

    // ── Change Password ─────────────────────────────────────────

    private val _changePasswordState = MutableStateFlow<ProfileUpdateState>(ProfileUpdateState.Idle)
    val changePasswordState: StateFlow<ProfileUpdateState> = _changePasswordState.asStateFlow()

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _changePasswordState.value = ProfileUpdateState.Loading
            when (val result = patientRepository.changePassword(currentPassword, newPassword)) {
                is Result.Success -> {
                    _changePasswordState.value = ProfileUpdateState.Success
                }
                is Result.Error -> {
                    _changePasswordState.value = ProfileUpdateState.Error(result.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun resetChangePasswordState() {
        _changePasswordState.value = ProfileUpdateState.Idle
    }

    // ── Emergency Contacts CRUD ─────────────────────────────────

    fun addEmergencyContact(name: String, phone: String, relation: String) {
        viewModelScope.launch {
            _profileUpdateState.value = ProfileUpdateState.Loading
            when (val result = patientRepository.addEmergencyContact(
                AddEmergencyContactRequest(name = name, phone = phone, relation = relation)
            )) {
                is Result.Success -> {
                    _profileUpdateState.value = ProfileUpdateState.Success
                }
                is Result.Error -> {
                    _profileUpdateState.value = ProfileUpdateState.Error(result.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun deleteEmergencyContact(contactId: String) {
        viewModelScope.launch {
            patientRepository.deleteEmergencyContact(contactId)
        }
    }

    // ── Family Members CRUD ─────────────────────────────────────

    fun addFamilyMember(name: String, relation: String, phone: String?) {
        viewModelScope.launch {
            _profileUpdateState.value = ProfileUpdateState.Loading
            when (val result = patientRepository.addFamilyMember(
                AddFamilyMemberRequest(name = name, relation = relation, phone = phone)
            )) {
                is Result.Success -> {
                    _profileUpdateState.value = ProfileUpdateState.Success
                }
                is Result.Error -> {
                    _profileUpdateState.value = ProfileUpdateState.Error(result.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun deleteFamilyMember(memberId: String) {
        viewModelScope.launch {
            patientRepository.deleteFamilyMember(memberId)
        }
    }

    // ── Health Card QR ──────────────────────────────────────────

    data class HealthCardState(
        val isLoading: Boolean = false,
        val url: String? = null,
        val token: String? = null,
        val expiresAt: String? = null,
        val hasActiveCard: Boolean = false,
        val error: String? = null
    )

    private val _healthCardState = MutableStateFlow(HealthCardState())
    val healthCardState: StateFlow<HealthCardState> = _healthCardState.asStateFlow()

    fun generateHealthCard() {
        viewModelScope.launch {
            _healthCardState.value = _healthCardState.value.copy(isLoading = true, error = null)
            when (val result = patientRepository.generateHealthCard()) {
                is Result.Success -> {
                    _healthCardState.value = HealthCardState(
                        url = result.data.url,
                        token = result.data.token,
                        expiresAt = result.data.expiresAt,
                        hasActiveCard = true
                    )
                }
                is Result.Error -> {
                    _healthCardState.value = _healthCardState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    fun checkHealthCardStatus() {
        viewModelScope.launch {
            when (val result = patientRepository.getHealthCardStatus()) {
                is Result.Success -> {
                    _healthCardState.value = HealthCardState(
                        hasActiveCard = result.data.hasActiveCard,
                        url = result.data.url,
                        expiresAt = result.data.expiresAt
                    )
                }
                is Result.Error -> { /* Silently ignore — no active card */ }
                is Result.Loading -> {}
            }
        }
    }

    fun revokeHealthCard() {
        viewModelScope.launch {
            _healthCardState.value = _healthCardState.value.copy(isLoading = true)
            when (patientRepository.revokeHealthCard()) {
                is Result.Success -> {
                    _healthCardState.value = HealthCardState() // reset
                }
                is Result.Error -> {
                    _healthCardState.value = _healthCardState.value.copy(
                        isLoading = false,
                        error = "Failed to revoke"
                    )
                }
                is Result.Loading -> {}
            }
        }
    }
}

sealed class ProfileUpdateState {
    data object Idle : ProfileUpdateState()
    data object Loading : ProfileUpdateState()
    data object Success : ProfileUpdateState()
    data class Error(val message: String) : ProfileUpdateState()
}
