package com.example.swastik.ui.screens.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.model.PatientProfile
import com.example.swastik.data.repository.AuthRepository
import com.example.swastik.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State for authentication screens
 */
data class AuthUiState(
    val isLoading: Boolean = false,
    val isSuccess: Boolean = false,
    val errorMessage: String? = null,
    val registrationComplete: Boolean = false // Email verification required
)

/**
 * Auth ViewModel - handles authentication logic
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    
    var uiState by mutableStateOf(AuthUiState())
        private set
        
    // Profile creation state
    var patientProfile by mutableStateOf(PatientProfile(
        id = "",
        name = "",
        phoneNumber = "",
        email = "",
        age = 0,
        bloodGroup = "",
        weight = 0f,
        height = 0f,
        gender = "",
        location = "",
        abhaNumber = "",
        isVerified = false
    ))
        private set

    /**
     * Login with email+password.
     */
    fun login(email: String, password: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, errorMessage = null)

            authRepository.loginWithEmail(email, password).collectLatest { result ->
                when (result) {
                    is Result.Success -> {
                        uiState = uiState.copy(
                            isLoading = false,
                            isSuccess = true,
                            errorMessage = null
                        )
                    }
                    is Result.Error -> {
                        uiState = uiState.copy(isLoading = false, errorMessage = result.message)
                    }
                    is Result.Loading -> {
                        uiState = uiState.copy(isLoading = true)
                    }
                }
            }
        }
    }
    
    /**
     * Register new patient — backend sends verification email
     */
    fun register(name: String, phone: String, email: String, password: String? = null) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, errorMessage = null)
            
            authRepository.register(name, phone, email, password ?: "").collectLatest { result ->
                when (result) {
                    is Result.Success -> {
                        uiState = uiState.copy(
                            isLoading = false,
                            registrationComplete = true // Show "check your email" screen
                        )
                    }
                    is Result.Error -> {
                        uiState = uiState.copy(isLoading = false, errorMessage = result.message)
                    }
                    is Result.Loading -> {
                        uiState = uiState.copy(isLoading = true)
                    }
                }
            }
        }
    }
    
    /**
     * Initialize patient profile data
     */
    fun initializePatientData(phoneNumber: String = "", name: String = "") {
        patientProfile = PatientProfile(
            id = "",
            name = name,
            phoneNumber = phoneNumber,
            email = "",
            age = 0,
            bloodGroup = "",
            weight = 0f,
            height = 0f,
            gender = "",
            location = "",
            abhaNumber = "",
            isVerified = false
        )
    }
    
    /**
     * Update a field in patient profile
     */
    fun updateProfileField(field: String, value: Any) {
        // Simple reflection-less update for key fields used in UI
        patientProfile = when(field) {
            "name" -> patientProfile.copy(name = value.toString())
            "phone" -> patientProfile.copy(phoneNumber = value.toString())
            "email" -> patientProfile.copy(email = value.toString())
            "age" -> if (value is Int) patientProfile.copy(age = value) else patientProfile.copy(age = (value as? String)?.toIntOrNull() ?: 0)
            "gender" -> patientProfile.copy(gender = value.toString())
            "bloodGroup" -> patientProfile.copy(bloodGroup = value.toString())
            "weight" -> if (value is Float) patientProfile.copy(weight = value) else patientProfile.copy(weight = (value as? String)?.toFloatOrNull() ?: 0f)
            "height" -> if (value is Float) patientProfile.copy(height = value) else patientProfile.copy(height = (value as? String)?.toFloatOrNull() ?: 0f)
            "address" -> patientProfile.copy(location = value.toString()) // Mapping to location
            else -> patientProfile
        }
    }

    fun updateProfileField(email: String) {
        patientProfile = patientProfile.copy(email = email)
    }
    
    /**
     * Clear the registrationComplete flag after navigation
     */
    fun onRegistrationNavigated() {
        uiState = uiState.copy(registrationComplete = false)
    }

    /**
     * Resend verification email
     */
    fun resendVerification(email: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, errorMessage = null)
            when (val result = authRepository.resendVerification(email)) {
                is Result.Success -> {
                    uiState = uiState.copy(isLoading = false, errorMessage = null)
                }
                is Result.Error -> {
                    uiState = uiState.copy(isLoading = false, errorMessage = result.message)
                }
                is Result.Loading -> {
                    uiState = uiState.copy(isLoading = true)
                }
            }
        }
    }

    /**
     * Logout
     */
    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            uiState = AuthUiState()
        }
    }
    
    /**
     * Clear error message
     */
    fun clearError() {
         uiState = uiState.copy(errorMessage = null)
    }
    
    /**
     * Reset state
     */
    fun resetState() {
        uiState = AuthUiState()
        initializePatientData()
    }
}
