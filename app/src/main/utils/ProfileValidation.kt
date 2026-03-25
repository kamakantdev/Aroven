package com.example.swastik.utils

/**
 * Shared profile validation contract for patient profile forms.
 * Keeps validation consistent across profile UI flows.
 */
object ProfileValidation {
    val GENDER_OPTIONS = listOf("male", "female", "other")
    val BLOOD_GROUP_OPTIONS = listOf("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")

    fun validate(
        name: String,
        age: Int?,
        weight: Float?,
        height: Float?,
        gender: String?,
        bloodGroup: String?
    ): String? {
        if (name.isBlank() || name.trim().length < 2) return "Name must be at least 2 characters"
        if (age != null && (age < 1 || age > 150)) return "Age must be between 1 and 150"
        if (weight != null && (weight < 1f || weight > 500f)) return "Weight must be between 1 and 500 kg"
        if (height != null && (height < 30f || height > 300f)) return "Height must be between 30 and 300 cm"
        if (!gender.isNullOrBlank() && !GENDER_OPTIONS.contains(gender)) return "Please select a valid gender"
        if (!bloodGroup.isNullOrBlank() && !BLOOD_GROUP_OPTIONS.contains(bloodGroup)) return "Please select a valid blood group"
        return null
    }
}
