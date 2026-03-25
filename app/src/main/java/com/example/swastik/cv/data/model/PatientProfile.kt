package com.example.swastik.data.model

import com.google.gson.annotations.SerializedName

/**
 * Data class representing a patient's profile
 */
data class PatientProfile(
    val id: String = "",
    val name: String = "",
    @SerializedName("phone_number") val phoneNumber: String = "",
    val email: String = "",
    val age: Int = 0,
    @SerializedName("blood_group") val bloodGroup: String = "",
    val weight: Float = 0f,
    val height: Float = 0f,
    val gender: String = "",
    val location: String = "",
    @SerializedName("abha_number") val abhaNumber: String = "",
    @SerializedName("profile_image_url") val profileImageUrl: String = "",
    @SerializedName("is_verified") val isVerified: Boolean = false,
    @SerializedName("linked_hospitals") val linkedHospitals: Int = 0,
    @SerializedName("family_members") val familyMembers: List<FamilyMember> = emptyList(),
    @SerializedName("emergency_contacts") val emergencyContacts: List<EmergencyContact> = emptyList(),
    @SerializedName("saved_addresses") val savedAddresses: List<SavedAddress> = emptyList()
) {
    val displayAge: String get() = if (age > 0) "$age" else "--"
    val displayBloodGroup: String get() = bloodGroup.ifEmpty { "--" }
    val displayWeight: String get() = if (weight > 0) weight.toInt().toString() else "--"
    val displayHeight: String get() = if (height > 0) height.toInt().toString() else "--"
    val initials: String get() = name.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString("")
}

data class FamilyMember(
    val id: String,
    val name: String,
    val relationship: String,
    val phone: String = ""
)

data class EmergencyContact(
    val id: String,
    val name: String,
    val phone: String,
    val relationship: String
)

data class SavedAddress(
    val id: String,
    val label: String,
    val address: String,
    val city: String,
    val pincode: String,
    @SerializedName("is_default") val isDefault: Boolean = false
)
