package com.example.swastik.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.remote.dto.UpdateProfileRequest
import com.example.swastik.data.repository.PatientRepository
import com.example.swastik.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val name: String = "",
    val age: String = "",
    val gender: String = "",
    val bloodGroup: String = "",
    val weight: String = "",
    val height: String = "",
    val location: String = "",
    val email: String = "",
    val phone: String = "",
    val isSaving: Boolean = false,
    val isLoading: Boolean = false,
    val saveSuccess: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val patientRepository: PatientRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        loadProfile()
    }

    private fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            // First, trigger an API fetch to populate the repository's StateFlow
            patientRepository.getDashboard()

            // Then read the now-populated profile
            val profile = patientRepository.patientProfile.value
            if (profile != null) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    name = profile.name,
                    age = if (profile.age > 0) profile.age.toString() else "",
                    gender = profile.gender,
                    bloodGroup = profile.bloodGroup,
                    weight = if (profile.weight > 0f) profile.weight.toString() else "",
                    height = if (profile.height > 0f) profile.height.toString() else "",
                    location = profile.location,
                    email = profile.email,
                    phone = profile.phoneNumber
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Failed to load profile"
                )
            }
        }
    }

    fun updateProfile(
        name: String,
        age: Int?,
        gender: String,
        bloodGroup: String,
        weight: Float?,
        height: Float?,
        location: String
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true, error = null, saveSuccess = false)

            val request = UpdateProfileRequest(
                name = name.ifBlank { null },
                age = age,
                gender = gender.ifBlank { null },
                bloodGroup = bloodGroup.ifBlank { null },
                weight = weight,
                height = height,
                location = location.ifBlank { null }
            )

            when (val result = patientRepository.updateProfile(request)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isSaving = false,
                        saveSuccess = true,
                        name = result.data.name,
                        age = if (result.data.age > 0) result.data.age.toString() else "",
                        gender = result.data.gender,
                        bloodGroup = result.data.bloodGroup,
                        weight = if (result.data.weight > 0f) result.data.weight.toString() else "",
                        height = if (result.data.height > 0f) result.data.height.toString() else "",
                        location = result.data.location
                    )
                    // Re-fetch dashboard data so the PatientRepository's shared
                    // patientProfile StateFlow is fresh and the entire app sees updated data
                    patientRepository.getDashboard()
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isSaving = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }
}
