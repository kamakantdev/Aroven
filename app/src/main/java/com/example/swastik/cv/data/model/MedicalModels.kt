package com.example.swastik.data.model

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.LocalPharmacy
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material.icons.filled.Science
import com.google.gson.annotations.SerializedName

data class MedicalFacility(
    val id: String,
    val name: String,
    val type: FacilityType,
    val address: String,
    val distance: String,
    val distanceKm: Double = 0.0,
    val rating: Float,
    @SerializedName("review_count") val reviewCount: Int,
    val latitude: Double,
    val longitude: Double,
    val phone: String,
    @SerializedName("open_time") val openTime: String? = null,
    @SerializedName("close_time") val closeTime: String? = null,
    @SerializedName("is_open") val isOpen: Boolean = true,
    @SerializedName("is_emergency_available") val isEmergencyAvailable: Boolean = false,
    val specializations: List<String> = emptyList(),
    val doctors: List<HospitalDoctor> = emptyList(),
    val hospitalSubType: String? = null // "Government" or "Private"
)

enum class FacilityType {
    HOSPITAL,
    CLINIC,
    MEDICAL_STORE,
    DIAGNOSTIC_CENTER;

    fun getDisplayName(): String {
        return when (this) {
            HOSPITAL -> "Hospital"
            CLINIC -> "Clinic"
            MEDICAL_STORE -> "Medical Store"
            DIAGNOSTIC_CENTER -> "Diagnostic Center"
        }
    }

    fun getMarkerIcon(): ImageVector {
        return when (this) {
            HOSPITAL -> Icons.Default.LocalHospital
            CLINIC -> Icons.Default.MedicalServices
            MEDICAL_STORE -> Icons.Default.LocalPharmacy
            DIAGNOSTIC_CENTER -> Icons.Default.Science // Biotech might be missing, Science is safe
        }
    }

    fun getMarkerColor(): Color {
        return when (this) {
            HOSPITAL -> Color(0xFFE53935) // Red
            CLINIC -> Color(0xFF4CAF50) // Green
            MEDICAL_STORE -> Color(0xFF2196F3) // Blue
            DIAGNOSTIC_CENTER -> Color(0xFF7C3AED) // Purple
        }
    }
}

data class HospitalDoctor(
    val id: String,
    val name: String,
    val specialization: String,
    val experience: String,
    val rating: Float,
    @SerializedName("consultation_fee") val consultationFee: Int,
    @SerializedName("available_slots") val availableSlots: List<String> = emptyList(),
    @SerializedName("image_emoji") val imageEmoji: String = "👨‍⚕️"
)
