package com.example.swastik.ambulance.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.ambulance.data.local.TokenManager
import com.example.swastik.ambulance.data.repository.AmbulanceRepository
import com.example.swastik.ambulance.ui.screens.profile.ProfileUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repository: AmbulanceRepository,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    private val _userMessage = MutableSharedFlow<String>(extraBufferCapacity = 5)
    val userMessage: SharedFlow<String> = _userMessage.asSharedFlow()

    init {
        loadProfile()
        loadVehicles()
    }

    fun loadProfile() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = repository.getProfile()
            result.fold(
                onSuccess = { user ->
                    _state.value = _state.value.copy(isLoading = false, user = user)
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(isLoading = false, error = e.message)
                }
            )
        }
    }

    fun loadVehicles() {
        viewModelScope.launch {
            val result = repository.getVehicles()
            result.fold(
                onSuccess = { vehicles ->
                    _state.value = _state.value.copy(vehicles = vehicles)
                    // Restore persisted selection, or auto-select first vehicle
                    val savedId = tokenManager.getSelectedVehicleId()
                    val restoredId = if (savedId != null && vehicles.any { it.id == savedId }) savedId
                        else vehicles.firstOrNull()?.id
                    if (_state.value.selectedVehicleId == null && restoredId != null) {
                        _state.value = _state.value.copy(selectedVehicleId = restoredId)
                    }
                },
                onFailure = { /* vehicles are optional */ }
            )
        }
    }

    fun selectVehicle(vehicleId: String) {
        _state.value = _state.value.copy(selectedVehicleId = vehicleId)
        tokenManager.saveSelectedVehicleId(vehicleId)
        _userMessage.tryEmit("Vehicle selected")
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(
                isChangingPassword = true,
                passwordChangeError = null,
                passwordChangeSuccess = false
            )
            val result = repository.changePassword(currentPassword, newPassword)
            result.fold(
                onSuccess = {
                    _state.value = _state.value.copy(
                        isChangingPassword = false,
                        passwordChangeSuccess = true
                    )
                    _userMessage.tryEmit("✅ Password changed successfully")
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(
                        isChangingPassword = false,
                        passwordChangeError = e.message
                    )
                }
            )
        }
    }
}
