package com.example.swastik.data.repository

import com.example.swastik.data.model.*
import com.example.swastik.data.remote.ApiService
import com.example.swastik.data.remote.SocketManager
import com.example.swastik.data.remote.dto.*
import com.example.swastik.data.local.db.NotificationDao
import com.example.swastik.data.local.db.PrescriptionDao
import com.example.swastik.data.local.db.CachedNotification
import com.example.swastik.data.local.db.CachedPrescription
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import javax.inject.Inject
import javax.inject.Singleton
import android.util.Log

/**
 * Repository for managing patient data.
 * Uses Room DB caching for notifications and prescriptions.
 * Network-first with cache fallback for offline support.
 */
@Singleton
class PatientRepository @Inject constructor(
    private val apiService: ApiService,
    private val socketManager: SocketManager,
    private val notificationDao: NotificationDao,
    private val prescriptionDao: PrescriptionDao
) {
    // Real-time flows
    val orderUpdates = socketManager.orderUpdates
    val realtimeNotifications = socketManager.notifications
    val ambulanceUpdates = socketManager.ambulanceUpdates
    val ambulanceLocationUpdates = socketManager.ambulanceLocationUpdates
    
    // Patient Profile State
    private val _patientProfile = MutableStateFlow<PatientProfile?>(null)
    val patientProfile: StateFlow<PatientProfile?> = _patientProfile.asStateFlow()

    // Reminders State
    private val _reminders = MutableStateFlow<List<Reminder>>(emptyList())
    val reminders: StateFlow<List<Reminder>> = _reminders.asStateFlow()

    // Doctors State
    private val _recommendedDoctors = MutableStateFlow<List<Doctor>>(emptyList())
    val recommendedDoctors: StateFlow<List<Doctor>> = _recommendedDoctors.asStateFlow()

    // Consultations State
    private val _consultations = MutableStateFlow<List<ConsultationRecord>>(emptyList())
    val consultations: StateFlow<List<ConsultationRecord>> = _consultations.asStateFlow()

    // Notifications State
    private val _notifications = MutableStateFlow<List<NotificationItem>>(emptyList())
    val notifications: StateFlow<List<NotificationItem>> = _notifications.asStateFlow()

    // Stats
    private val _stats = MutableStateFlow(PatientStats())
    val stats: StateFlow<PatientStats> = _stats.asStateFlow()

    /**
     * Fetch patient dashboard data
     * Fetches Dashboard Stats + Profile + Notifications
     */
    suspend fun getDashboard(): Result<PatientDashboard> = coroutineScope {
        try {
            // Parallel execution of independent API calls
            val dashboardDeferred = async { apiService.getPatientDashboard() }
            val profileDeferred = async { apiService.getPatientProfile() }
            val notificationsDeferred = async { apiService.getNotifications() }
            val emergencyDeferred = async { apiService.getActiveEmergency() }
            val prescriptionsDeferred = async { apiService.getPatientPrescriptions(1, 5) }

            val dashboardResponse = dashboardDeferred.await()
            val profileResponse = profileDeferred.await()
            val notificationsResponse = notificationsDeferred.await()
            val emergencyResponse = emergencyDeferred.await()
            val prescriptionsResponse = prescriptionsDeferred.await()
            
            var patient: Patient? = null
            var upcomingAppointments: List<Appointment> = emptyList()
            var recentPrescriptions: List<Prescription> = emptyList()
            var unreadNotifications = 0
            var activeEmergency: EmergencyResponse? = null

            // 1. Process Dashboard (Stats, Reminders, Consultations, Recommended Doctors)
            if (dashboardResponse.isSuccessful && dashboardResponse.body()?.success == true) {
                val dashboardData = dashboardResponse.body()?.data
                // dashboardData is PatientDashboardResponse?
                
                if (dashboardData != null) {
                    // Update Stats
                    _stats.value = PatientStats(
                        totalConsultations = dashboardData.stats?.totalConsultations ?: 0,
                        totalPrescriptions = dashboardData.stats?.totalPrescriptions ?: 0,
                        totalReports = dashboardData.stats?.totalReports ?: 0
                    )
                    
                    // Update Reminders
                    if (dashboardData.reminders != null) {
                        _reminders.value = dashboardData.reminders.map { it.toReminder() }
                    }
                    
                    // Update Recent Consultations
                    if (dashboardData.recentConsultations != null) {
                         _consultations.value = dashboardData.recentConsultations.map { it.toConsultationRecord() }
                    }
                    
                    if (dashboardData.upcomingAppointments != null) {
                        upcomingAppointments = dashboardData.upcomingAppointments.map { it.toAppointment() }
                    }

                    // Update Recommended Doctors from smart recommendation engine
                    if (dashboardData.recommendedDoctors != null) {
                        _recommendedDoctors.value = dashboardData.recommendedDoctors.map { it.toDoctor() }
                        Log.d("PatientRepository", "Loaded ${dashboardData.recommendedDoctors.size} recommended doctors")
                    }
                }
            }

            // 2. Process Profile
            if (profileResponse.isSuccessful && profileResponse.body()?.success == true) {
                val patientData = profileResponse.body()?.data
                if (patientData != null) {
                    patient = patientData.toPatient()
                    val profile = PatientProfile(
                        id = patientData.id,
                        name = patientData.name,
                        phoneNumber = patientData.phone ?: "",
                        email = patientData.email ?: "",
                        age = patientData.age ?: 0,
                        bloodGroup = patientData.bloodGroup ?: "",
                        weight = patientData.weight ?: 0f, 
                        height = patientData.height ?: 0f, 
                        gender = patientData.gender ?: "",
                        location = patientData.location ?: "",
                        abhaNumber = patientData.abhaNumber ?: "",
                        profileImageUrl = patientData.profileImageUrl ?: "",
                        isVerified = patientData.isVerified,
                        linkedHospitals = patientData.linkedHospitals ?: 0,
                        familyMembers = patientData.familyMembers?.map {
                            FamilyMember(id = it.id, name = it.name, relationship = it.relationship, phone = it.phone ?: "")
                        } ?: emptyList(),
                        emergencyContacts = patientData.emergencyContacts?.map {
                            EmergencyContact(id = it.id, name = it.name, phone = it.phone, relationship = it.relationship)
                        } ?: emptyList(),
                        savedAddresses = patientData.savedAddresses?.map {
                            SavedAddress(id = it.id, label = it.label, address = it.address, city = it.city ?: "", pincode = it.pincode ?: "", isDefault = it.isDefault)
                        } ?: emptyList()
                    )
                    _patientProfile.value = profile
                }
            }

            // 3. Process Notifications — cache to Room
            if (notificationsResponse.isSuccessful && notificationsResponse.body()?.success == true) {
                val notifData = notificationsResponse.body()?.data // NotificationsListData
                val apiNotifications = notifData?.notifications
                if (apiNotifications != null) {
                    val uiNotifications = apiNotifications.map { notification ->
                        NotificationItem(
                            id = notification.id,
                            title = notification.title,
                            message = notification.message,
                            time = formatRelativeTime(notification.createdAt),
                            type = mapNotificationType(notification.type),
                            isRead = notification.isRead,
                            actionLabel = null
                        )
                    }
                    _notifications.value = uiNotifications
                    unreadNotifications = apiNotifications.count { !it.isRead }
                    // Cache notifications
                    try {
                        val cached = apiNotifications.map { it.toCachedNotification() }
                        notificationDao.clearAll()
                        notificationDao.insertNotifications(cached)
                    } catch (e: Exception) {
                        Log.w("PatientRepository", "Failed to cache notifications: ${e.message}")
                    }
                }
            } else {
                // Network failed for notifications — load from cache
                try {
                    val cached = notificationDao.getAllNotificationsSync()
                    if (cached.isNotEmpty()) {
                        val uiNotifications = cached.map { it.toDomainNotification() }
                        _notifications.value = uiNotifications
                        unreadNotifications = cached.count { !it.isRead }
                    }
                } catch (_: Exception) {}
            }
            
            // 4. Process Prescriptions — cache to Room
            if (prescriptionsResponse.isSuccessful) {
                val rxData = prescriptionsResponse.body()?.data
                if (rxData != null) {
                    recentPrescriptions = rxData
                    // Cache prescriptions
                    try {
                        val cached = rxData.map { it.toCachedPrescription() }
                        prescriptionDao.clearAll()
                        prescriptionDao.insertPrescriptions(cached)
                    } catch (e: Exception) {
                        Log.w("PatientRepository", "Failed to cache prescriptions: ${e.message}")
                    }
                }
            } else {
                // Fallback to cached prescriptions
                try {
                    val cached = prescriptionDao.getAllPrescriptionsSync()
                    if (cached.isNotEmpty()) {
                        recentPrescriptions = cached.map { it.toDomainPrescription() }
                    }
                } catch (_: Exception) {}
            }
            
            // 5. Process Emergency
            if (emergencyResponse.isSuccessful && emergencyResponse.body()?.success == true) {
                activeEmergency = emergencyResponse.body()?.data
            }

            // Use real patient or a minimal fallback so dashboard still shows other data
            val resolvedPatient = patient ?: Patient(
                id = "", userId = "", name = "Patient", phone = "", email = null,
                dateOfBirth = null, gender = null, bloodGroup = null,
                emergencyContact = null, address = null, profileImageUrl = null,
                allergies = null, chronicConditions = null
            )
            Result.Success(
                PatientDashboard(
                    patient = resolvedPatient,
                    upcomingAppointments = upcomingAppointments,
                    recentPrescriptions = recentPrescriptions,
                    unreadNotifications = unreadNotifications,
                    activeEmergency = activeEmergency,
                    stats = _stats.value
                )
            )
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load dashboard")
        }
    }
    
    suspend fun fetchNotifications() {
        try {
             val response = apiService.getNotifications()
             if (response.isSuccessful && response.body()?.success == true) {
                val apiNotifications = response.body()?.data
                if (apiNotifications != null) {
                    val uiNotifications = apiNotifications.notifications.map { notification ->
                        NotificationItem(
                            id = notification.id,
                            title = notification.title,
                            message = notification.message,
                            time = formatRelativeTime(notification.createdAt),
                            type = mapNotificationType(notification.type),
                            isRead = notification.isRead,
                            actionLabel = null
                        )
                    }
                    _notifications.value = uiNotifications
                    // Update cache
                    try {
                        val cached = apiNotifications.notifications.map { it.toCachedNotification() }
                        notificationDao.clearAll()
                        notificationDao.insertNotifications(cached)
                    } catch (_: Exception) {}
                }
             }
        } catch(e: Exception) {
            // On network failure, load from cache if state is empty
            if (_notifications.value.isEmpty()) {
                try {
                    val cached = notificationDao.getAllNotificationsSync()
                    if (cached.isNotEmpty()) {
                        _notifications.value = cached.map { it.toDomainNotification() }
                    }
                } catch (_: Exception) {}
            }
        }
    }

    /**
     * Update patient profile
     * PUT /api/patients/profile
     */
    suspend fun updateProfile(request: UpdateProfileRequest): Result<PatientProfile> {
        return try {
            val response = apiService.updatePatientProfile(request)
            if (response.isSuccessful && response.body()?.success == true) {
                val patientData = response.body()?.data
                if (patientData != null) {
                    val profile = PatientProfile(
                        id = patientData.id,
                        name = patientData.name,
                        phoneNumber = patientData.phone ?: "",
                        email = patientData.email ?: "",
                        age = patientData.age ?: 0,
                        bloodGroup = patientData.bloodGroup ?: "",
                        weight = patientData.weight ?: 0f,
                        height = patientData.height ?: 0f,
                        gender = patientData.gender ?: "",
                        location = patientData.location ?: "",
                        abhaNumber = patientData.abhaNumber ?: "",
                        profileImageUrl = patientData.profileImageUrl ?: "",
                        isVerified = patientData.isVerified,
                        linkedHospitals = patientData.linkedHospitals ?: 0,
                        familyMembers = patientData.familyMembers?.map {
                            FamilyMember(id = it.id, name = it.name, relationship = it.relationship, phone = it.phone ?: "")
                        } ?: emptyList(),
                        emergencyContacts = patientData.emergencyContacts?.map {
                            EmergencyContact(id = it.id, name = it.name, phone = it.phone, relationship = it.relationship)
                        } ?: emptyList(),
                        savedAddresses = patientData.savedAddresses?.map {
                            SavedAddress(id = it.id, label = it.label, address = it.address, city = it.city ?: "", pincode = it.pincode ?: "", isDefault = it.isDefault)
                        } ?: emptyList()
                    )
                    _patientProfile.value = profile
                    Result.Success(profile)
                } else {
                    Result.Error("Failed to parse profile data")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to update profile")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get patient prescriptions with cache fallback
     */
    suspend fun getPrescriptions(page: Int = 1, limit: Int = 20): Result<List<Prescription>> {
        // Try network first
        try {
            val response = apiService.getPatientPrescriptions(page, limit)
            if (response.isSuccessful && response.body()?.success == true) {
                val prescriptions = response.body()?.data ?: emptyList()
                // Cache page 1
                if (page == 1) {
                    try {
                        val cached = prescriptions.map { it.toCachedPrescription() }
                        prescriptionDao.clearAll()
                        prescriptionDao.insertPrescriptions(cached)
                    } catch (_: Exception) {}
                }
                return Result.Success(prescriptions)
            }
        } catch (e: Exception) {
            Log.w("PatientRepository", "Prescriptions network failed, using cache: ${e.message}")
        }

        // Fallback to cache
        return try {
            val cached = prescriptionDao.getAllPrescriptionsSync()
            if (cached.isNotEmpty()) {
                Result.Success(cached.map { it.toDomainPrescription() })
            } else {
                Result.Error("No internet connection and no cached prescriptions")
            }
        } catch (e: Exception) {
            Result.Error("Failed to load prescriptions")
        }
    }

    /**
     * Get prescription details
     * GET /api/patients/prescriptions/:id
     */
    suspend fun getPrescriptionDetails(id: String): Result<Prescription> {
        return try {
            val response = apiService.getPrescriptionDetails(id)
            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()?.data
                if (data != null) {
                    Result.Success(data)
                } else {
                    Result.Error("Prescription not found")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to load prescription")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get patient reports
     * GET /api/patients/reports
     */
    suspend fun getReports(page: Int = 1, limit: Int = 20): Result<List<ReportDto>> {
        return try {
            val response = apiService.getPatientReports(page, limit)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error("Failed to load reports")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Submit review for doctor/hospital
     * POST /api/patients/reviews
     */
    suspend fun submitReview(appointmentId: String, doctorId: String? = null, hospitalId: String? = null, rating: Int, comment: String?): Result<Review> {
        return try {
            val request = com.example.swastik.data.remote.dto.ReviewRequest(
                doctorId = doctorId,
                hospitalId = hospitalId,
                rating = rating,
                comment = comment
            )
            val response = apiService.submitReview(request)
            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()?.data
                if (data != null) {
                    Result.Success(data)
                } else {
                    Result.Error("Failed to parse review data")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to submit review")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Mark a notification as read
     * PUT /api/notifications/:id/read
     */
    suspend fun markNotificationRead(notificationId: String): Result<Unit> {
        return try {
            val response = apiService.markNotificationRead(notificationId)
            if (response.isSuccessful && response.body()?.success == true) {
                // Update local state
                _notifications.value = _notifications.value.map { n ->
                    if (n.id == notificationId) n.copy(isRead = true) else n
                }
                // Update Room cache
                try { notificationDao.markAsRead(notificationId) } catch (_: Exception) {}
                Result.Success(Unit)
            } else {
                Result.Error("Failed to mark notification as read")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Mark all notifications as read
     * PUT /api/notifications/read-all
     */
    suspend fun markAllNotificationsRead(): Result<Unit> {
        return try {
            val response = apiService.markAllNotificationsRead()
            if (response.isSuccessful && response.body()?.success == true) {
                _notifications.value = _notifications.value.map { it.copy(isRead = true) }
                // Update Room cache
                try { notificationDao.markAllAsRead() } catch (_: Exception) {}
                Result.Success(Unit)
            } else {
                Result.Error("Failed to mark all notifications as read")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Upload profile image
     * POST /api/uploads/profile
     */
    suspend fun uploadProfileImage(imagePart: okhttp3.MultipartBody.Part): Result<String> {
        return try {
            val response = apiService.uploadProfileImage(imagePart)
            if (response.isSuccessful && response.body()?.success == true) {
                val url = response.body()?.data?.url ?: ""
                // Update local profile state with new image URL
                _patientProfile.value = _patientProfile.value?.copy(profileImageUrl = url)
                Result.Success(url)
            } else {
                Result.Error("Failed to upload profile image")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Change password
     * POST /api/auth/change-password
     */
    suspend fun changePassword(currentPassword: String, newPassword: String): Result<Unit> {
        return try {
            val response = apiService.changePassword(ChangePasswordRequest(currentPassword, newPassword))
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(Unit)
            } else {
                Result.Error(response.body()?.message ?: "Failed to change password")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Add emergency contact
     * POST /api/patients/emergency-contacts
     */
    suspend fun addEmergencyContact(request: AddEmergencyContactRequest): Result<EmergencyContact> {
        return try {
            val response = apiService.addEmergencyContact(request)
            if (response.isSuccessful && response.body()?.success == true) {
                val dto = response.body()?.data
                if (dto != null) {
                    val contact = EmergencyContact(id = dto.id, name = dto.name, phone = dto.phone, relationship = dto.relationship)
                    // Update local profile state
                    _patientProfile.value = _patientProfile.value?.let {
                        it.copy(emergencyContacts = it.emergencyContacts + contact)
                    }
                    Result.Success(contact)
                } else {
                    Result.Error("Failed to parse contact data")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to add emergency contact")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Delete emergency contact
     * DELETE /api/patients/emergency-contacts/:id
     */
    suspend fun deleteEmergencyContact(contactId: String): Result<Unit> {
        return try {
            val response = apiService.deleteEmergencyContact(contactId)
            if (response.isSuccessful && response.body()?.success == true) {
                // Update local profile state
                _patientProfile.value = _patientProfile.value?.let {
                    it.copy(emergencyContacts = it.emergencyContacts.filter { c -> c.id != contactId })
                }
                Result.Success(Unit)
            } else {
                Result.Error("Failed to delete emergency contact")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Add family member
     * POST /api/patients/family-members
     */
    suspend fun addFamilyMember(request: AddFamilyMemberRequest): Result<FamilyMember> {
        return try {
            val response = apiService.addFamilyMember(request)
            if (response.isSuccessful && response.body()?.success == true) {
                val dto = response.body()?.data
                if (dto != null) {
                    val member = FamilyMember(id = dto.id, name = dto.name, relationship = dto.relationship, phone = dto.phone ?: "")
                    _patientProfile.value = _patientProfile.value?.let {
                        it.copy(familyMembers = it.familyMembers + member)
                    }
                    Result.Success(member)
                } else {
                    Result.Error("Failed to parse member data")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to add family member")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Delete family member
     * DELETE /api/patients/family-members/:id
     */
    suspend fun deleteFamilyMember(memberId: String): Result<Unit> {
        return try {
            val response = apiService.deleteFamilyMember(memberId)
            if (response.isSuccessful && response.body()?.success == true) {
                _patientProfile.value = _patientProfile.value?.let {
                    it.copy(familyMembers = it.familyMembers.filter { m -> m.id != memberId })
                }
                Result.Success(Unit)
            } else {
                Result.Error("Failed to delete family member")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Upload medical report
     * POST /api/uploads/report
     */
    suspend fun uploadMedicalReport(filePart: okhttp3.MultipartBody.Part): Result<String> {
        return try {
            val response = apiService.uploadMedicalReport(filePart)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data?.url ?: "")
            } else {
                Result.Error("Failed to upload report")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    // ==================== HEALTH CARD ====================

    /**
     * Generate a new health card QR token (24h expiry)
     * POST /api/health-card/generate
     */
    suspend fun generateHealthCard(): Result<com.example.swastik.data.remote.dto.HealthCardTokenResponse> {
        return try {
            val response = apiService.generateHealthCard()
            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()?.data
                if (data != null) Result.Success(data)
                else Result.Error("No data received")
            } else {
                Result.Error(response.body()?.message ?: "Failed to generate health card")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Check current health card status
     * GET /api/health-card/status
     */
    suspend fun getHealthCardStatus(): Result<com.example.swastik.data.remote.dto.HealthCardStatusResponse> {
        return try {
            val response = apiService.getHealthCardStatus()
            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()?.data
                if (data != null) Result.Success(data)
                else Result.Error("No data received")
            } else {
                Result.Error(response.body()?.message ?: "Failed to get status")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Revoke active health card
     * POST /api/health-card/revoke
     */
    suspend fun revokeHealthCard(): Result<Unit> {
        return try {
            val response = apiService.revokeHealthCard()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(Unit)
            } else {
                Result.Error(response.body()?.message ?: "Failed to revoke")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get unread notification count (lightweight badge check).
     * GET /api/notifications/unread-count
     */
    suspend fun getUnreadNotificationCount(): Result<Int> {
        return try {
            val response = apiService.getUnreadNotificationCount()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data?.count ?: 0)
            } else {
                Result.Error("Failed to get unread count")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Register device for push notifications (FCM token).
     * POST /api/notifications/register-device
     */
    suspend fun registerDeviceForPush(fcmToken: String, platform: String = "android"): Result<Unit> {
        return try {
            val response = apiService.registerDevice(
                com.example.swastik.data.remote.dto.RegisterDeviceRequest(fcmToken = fcmToken, deviceType = platform)
            )
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(Unit)
            } else {
                Result.Error("Failed to register device")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Unregister device from push notifications (on logout).
     * DELETE /api/notifications/unregister-device
     */
    suspend fun unregisterDeviceForPush(fcmToken: String, platform: String = "android"): Result<Unit> {
        return try {
            val response = apiService.unregisterDevice(
                com.example.swastik.data.remote.dto.RegisterDeviceRequest(fcmToken = fcmToken, deviceType = platform)
            )
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(Unit)
            } else {
                Result.Error("Failed to unregister device")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    private fun calculateAge(dob: String?): Int {
        if (dob.isNullOrBlank()) return 0
        return try {
            val birthDate = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).parse(dob)
            if (birthDate != null) {
                val now = java.util.Calendar.getInstance()
                val birth = java.util.Calendar.getInstance().apply { time = birthDate }
                var age = now.get(java.util.Calendar.YEAR) - birth.get(java.util.Calendar.YEAR)
                if (now.get(java.util.Calendar.DAY_OF_YEAR) < birth.get(java.util.Calendar.DAY_OF_YEAR)) age--
                age
            } else 0
        } catch (_: Exception) { 0 }
    }

    private fun formatRelativeTime(isoDate: String): String {
        return try {
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault())
            sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val date = sdf.parse(isoDate) ?: return isoDate
            val diffMs = System.currentTimeMillis() - date.time
            val diffMin = diffMs / 60_000
            when {
                diffMin < 1 -> "Just now"
                diffMin < 60 -> "${diffMin}m ago"
                diffMin < 1440 -> "${diffMin / 60}h ago"
                diffMin < 10080 -> "${diffMin / 1440}d ago"
                else -> java.text.SimpleDateFormat("MMM dd", java.util.Locale.getDefault()).format(date)
            }
        } catch (_: Exception) { isoDate }
    }

    // --- MAPPING EXTENSIONS ---

    private fun ReminderDto.toReminder(): Reminder {
        return Reminder(
            title = title,
            time = time,
            type = when(type.lowercase()) {
                "medicine" -> ReminderType.MEDICINE
                "appointment" -> ReminderType.APPOINTMENT
                else -> ReminderType.TEST
            },
            isCompleted = isCompleted
        )
    }
    
    private fun ConsultationDto.toConsultationRecord(): ConsultationRecord {
        return ConsultationRecord(
            id = id,
            doctorName = doctorName,
            doctorSpecialty = doctorSpecialty,
            date = date,
            diagnosis = diagnosis ?: "No diagnosis",
            prescriptions = prescriptions?.flatMap { it.allMedicines.map { m -> m.toPrescriptionItem() } } ?: emptyList(),
            notes = notes ?: "",
            followUpDate = followUpDate
        )
    }
    
    private fun PrescriptionItemDto.toPrescriptionItem(): PrescriptionItem {
        return PrescriptionItem(
            medicineName = medicineName,
            dosage = dosage,
            frequency = frequency,
            duration = duration
        )
    }
    
    private fun PatientDto.toPatient(): Patient {
         return Patient(
             id = id,
             userId = id, // fallback
             name = name,
             phone = phone ?: "",
             email = email,
             dateOfBirth = null, // mapping incomplete fields from DTO
             gender = gender,
             bloodGroup = bloodGroup,
             emergencyContact = null,
             address = location,
             profileImageUrl = profileImageUrl,
             allergies = null,
             chronicConditions = null
         )
    }
    
    private fun AppointmentDto.toAppointment(): Appointment {
        return Appointment(
            id = id,
            appointmentNumber = null,
            patientId = "", // Not needed for UI display typically if patient context is known
            doctorId = doctorId,
            date = date,
            timeSlot = timeSlot,
            type = type,
            status = status,
            reason = null,
            notes = notes,
            consultationFee = null,
            cancellationReason = null,
            doctor = doctor?.toDoctor(),
            patient = null
        )
    }
    
    private fun DoctorDto.toDoctor(): Doctor {
        return Doctor(
            id = id,
            name = name,
            specialization = specialization,
            profileImageUrl = profileImageUrl,
            experienceYears = experience,
            qualification = null,
            consultationFee = consultationFee,
            videoConsultationFee = null,
            averageRating = rating,
            totalReviews = null,
            isAvailable = isAvailable
        )
    }

    private fun mapNotificationType(type: String): NotificationType {
        return when(type.lowercase()) {
            "appointment", "appointment_booked", "appointment_confirmed", "appointment_reminder", "follow_up_reminder", "appointment_status_changed", "appointment_rescheduled", "appointment_cancelled" -> NotificationType.APPOINTMENT
            "medicine", "medicine_reminder", "medicine_missed", "health_task_reminder", "care_plan_reminder" -> NotificationType.MEDICINE_REMINDER
            "report", "report_ready", "report_uploaded", "diagnostic_result", "diagnostic_test_reminder", "report_review_reminder" -> NotificationType.REPORT_READY
            "prescription", "prescription_created", "prescription_expiry_reminder" -> NotificationType.PRESCRIPTION
            else -> NotificationType.SYSTEM
        }
    }

    // ==================== Room Cache Mapping Extensions ====================

    private fun NotificationDto.toCachedNotification() = CachedNotification(
        id = id,
        title = title,
        message = message,
        type = type,
        isRead = isRead,
        createdAt = createdAt
    )

    private fun CachedNotification.toDomainNotification() = NotificationItem(
        id = id,
        title = title,
        message = message,
        time = formatRelativeTime(createdAt),
        type = mapNotificationType(type),
        isRead = isRead,
        actionLabel = null
    )

    private fun Prescription.toCachedPrescription() = CachedPrescription(
        id = id,
        prescriptionNumber = prescriptionNumber,
        diagnosis = diagnosis,
        doctorName = doctor?.name,
        notes = notes,
        followUpDate = followUpDate,
        createdAt = createdAt
    )

    private fun CachedPrescription.toDomainPrescription() = Prescription(
        id = id,
        prescriptionNumber = prescriptionNumber ?: "",
        diagnosis = diagnosis,
        notes = notes,
        followUpDate = followUpDate,
        createdAt = createdAt,
        doctor = if (doctorName != null) Doctor(
            id = "",
            name = doctorName,
            specialization = "",
            profileImageUrl = null,
            experienceYears = null,
            qualification = null,
            consultationFee = null,
            videoConsultationFee = null,
            averageRating = null,
            totalReviews = null,
            isAvailable = true
        ) else null,
        medicines = null
    )
}
