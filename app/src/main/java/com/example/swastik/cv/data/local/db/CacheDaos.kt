package com.example.swastik.data.local.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Room DAOs for offline cache operations.
 */

@Dao
interface DoctorDao {
    @Query("SELECT * FROM cached_doctors ORDER BY averageRating DESC")
    fun getAllDoctors(): Flow<List<CachedDoctor>>

    @Query("SELECT * FROM cached_doctors ORDER BY averageRating DESC")
    suspend fun getAllDoctorsSync(): List<CachedDoctor>

    @Query("SELECT * FROM cached_doctors WHERE specialization = :specialization ORDER BY averageRating DESC")
    fun getDoctorsBySpecialization(specialization: String): Flow<List<CachedDoctor>>

    @Query("SELECT * FROM cached_doctors WHERE name LIKE '%' || :query || '%' OR specialization LIKE '%' || :query || '%'")
    fun searchDoctors(query: String): Flow<List<CachedDoctor>>

    @Query("SELECT * FROM cached_doctors WHERE name LIKE '%' || :query || '%' OR specialization LIKE '%' || :query || '%'")
    suspend fun searchDoctorsSync(query: String): List<CachedDoctor>

    @Query("SELECT * FROM cached_doctors WHERE id = :id")
    suspend fun getDoctorById(id: String): CachedDoctor?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDoctors(doctors: List<CachedDoctor>)

    @Query("DELETE FROM cached_doctors WHERE cachedAt < :olderThan")
    suspend fun deleteStaleCache(olderThan: Long)

    @Query("DELETE FROM cached_doctors")
    suspend fun clearAll()
}

@Dao
interface AppointmentDao {
    @Query("SELECT * FROM cached_appointments ORDER BY date DESC, timeSlot DESC")
    fun getAllAppointments(): Flow<List<CachedAppointment>>

    @Query("SELECT * FROM cached_appointments ORDER BY date DESC, timeSlot DESC")
    suspend fun getAllAppointmentsSync(): List<CachedAppointment>

    @Query("SELECT * FROM cached_appointments WHERE status IN ('confirmed', 'pending') ORDER BY date ASC")
    fun getUpcomingAppointments(): Flow<List<CachedAppointment>>

    @Query("SELECT * FROM cached_appointments WHERE status IN ('confirmed', 'pending') ORDER BY date ASC")
    suspend fun getUpcomingAppointmentsSync(): List<CachedAppointment>

    @Query("SELECT * FROM cached_appointments WHERE id = :id")
    suspend fun getAppointmentById(id: String): CachedAppointment?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAppointments(appointments: List<CachedAppointment>)

    @Query("DELETE FROM cached_appointments")
    suspend fun clearAll()
}

@Dao
interface NotificationDao {
    @Query("SELECT * FROM cached_notifications ORDER BY createdAt DESC")
    fun getAllNotifications(): Flow<List<CachedNotification>>

    @Query("SELECT * FROM cached_notifications ORDER BY createdAt DESC")
    suspend fun getAllNotificationsSync(): List<CachedNotification>

    @Query("SELECT COUNT(*) FROM cached_notifications WHERE isRead = 0")
    fun getUnreadCount(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNotifications(notifications: List<CachedNotification>)

    @Query("UPDATE cached_notifications SET isRead = 1 WHERE id = :id")
    suspend fun markAsRead(id: String)

    @Query("UPDATE cached_notifications SET isRead = 1")
    suspend fun markAllAsRead()

    @Query("DELETE FROM cached_notifications")
    suspend fun clearAll()
}

@Dao
interface PrescriptionDao {
    @Query("SELECT * FROM cached_prescriptions ORDER BY createdAt DESC")
    fun getAllPrescriptions(): Flow<List<CachedPrescription>>

    @Query("SELECT * FROM cached_prescriptions ORDER BY createdAt DESC")
    suspend fun getAllPrescriptionsSync(): List<CachedPrescription>

    @Query("SELECT * FROM cached_prescriptions WHERE id = :id")
    suspend fun getPrescriptionById(id: String): CachedPrescription?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPrescriptions(prescriptions: List<CachedPrescription>)

    @Query("DELETE FROM cached_prescriptions")
    suspend fun clearAll()
}

@Dao
interface MedicineDao {
    @Query("SELECT * FROM cached_medicines ORDER BY name ASC")
    fun getAllMedicines(): Flow<List<CachedMedicine>>

    @Query("SELECT * FROM cached_medicines ORDER BY name ASC")
    suspend fun getAllMedicinesSync(): List<CachedMedicine>

    @Query("SELECT * FROM cached_medicines WHERE name LIKE '%' || :query || '%' OR genericName LIKE '%' || :query || '%'")
    fun searchMedicines(query: String): Flow<List<CachedMedicine>>

    @Query("SELECT * FROM cached_medicines WHERE name LIKE '%' || :query || '%' OR genericName LIKE '%' || :query || '%'")
    suspend fun searchMedicinesSync(query: String): List<CachedMedicine>

    @Query("SELECT * FROM cached_medicines WHERE id = :id")
    suspend fun getMedicineById(id: String): CachedMedicine?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMedicines(medicines: List<CachedMedicine>)

    @Query("DELETE FROM cached_medicines WHERE cachedAt < :olderThan")
    suspend fun deleteStaleCache(olderThan: Long)

    @Query("DELETE FROM cached_medicines")
    suspend fun clearAll()
}

@Dao
interface HospitalDao {
    @Query("SELECT * FROM cached_hospitals ORDER BY name ASC")
    fun getAllHospitals(): Flow<List<CachedHospital>>

    @Query("SELECT * FROM cached_hospitals ORDER BY name ASC")
    suspend fun getAllHospitalsSync(): List<CachedHospital>

    @Query("SELECT * FROM cached_hospitals WHERE emergencyServices = 1")
    fun getEmergencyHospitals(): Flow<List<CachedHospital>>

    @Query("SELECT * FROM cached_hospitals WHERE id = :id")
    suspend fun getHospitalById(id: String): CachedHospital?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHospitals(hospitals: List<CachedHospital>)

    @Query("DELETE FROM cached_hospitals")
    suspend fun clearAll()
}
