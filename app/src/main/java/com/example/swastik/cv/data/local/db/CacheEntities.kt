package com.example.swastik.data.local.db

import androidx.room.*
import androidx.room.Index

/**
 * Room entities for offline caching.
 * These mirror the domain models for local persistence.
 */

@Entity(tableName = "cached_doctors")
data class CachedDoctor(
    @PrimaryKey val id: String,
    val name: String,
    val specialization: String,
    val profileImageUrl: String?,
    val experienceYears: Int?,
    val qualification: String?,
    val consultationFee: Int?,
    val videoConsultationFee: Int?,
    val averageRating: Float?,
    val totalReviews: Int?,
    val isAvailable: Boolean,
    val cachedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "cached_appointments",
    indices = [Index(value = ["status"]), Index(value = ["doctorId"])]
)
data class CachedAppointment(
    @PrimaryKey val id: String,
    val doctorId: String,
    val doctorName: String?,
    val doctorSpecialization: String?,
    val date: String,
    val timeSlot: String,
    val type: String,
    val status: String,
    val notes: String?,
    val cachedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_notifications")
data class CachedNotification(
    @PrimaryKey val id: String,
    val title: String,
    val message: String,
    val type: String,
    val isRead: Boolean,
    val createdAt: String,
    val cachedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_prescriptions")
data class CachedPrescription(
    @PrimaryKey val id: String,
    val prescriptionNumber: String?,
    val diagnosis: String,
    val doctorName: String?,
    val notes: String?,
    val followUpDate: String?,
    val createdAt: String,
    val cachedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "cached_medicines",
    indices = [Index(value = ["name"]), Index(value = ["category"])]
)
data class CachedMedicine(
    @PrimaryKey val id: String,
    val name: String,
    val genericName: String?,
    val manufacturer: String?,
    val price: Double?,
    val category: String,
    val description: String?,
    val requiresPrescription: Boolean,
    val cachedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_hospitals")
data class CachedHospital(
    @PrimaryKey val id: String,
    val name: String,
    val address: String,
    val phone: String?,
    val imageUrl: String?,
    val latitude: Double?,
    val longitude: Double?,
    val emergencyServices: Boolean?,
    val ambulanceService: Boolean?,
    val rating: Float = 0f,
    val reviewCount: Int = 0,
    val specializations: String? = null,  // JSON-encoded list
    val hospitalType: String? = null,     // "Government" or "Private"
    val cachedAt: Long = System.currentTimeMillis()
)
