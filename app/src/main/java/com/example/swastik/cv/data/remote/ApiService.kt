package com.example.swastik.data.remote

import com.example.swastik.data.model.*
import com.example.swastik.data.remote.dto.EmergencyRequest
import com.example.swastik.data.remote.dto.ReviewRequest
import com.example.swastik.data.remote.dto.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit API Service for Swastik Healthcare Platform
 */
interface ApiService {

    // ==================== AUTH ====================
    
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>
    
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>
    
    @POST("auth/resend-verification")
    suspend fun resendVerification(@Body request: ResendVerificationRequest): Response<ApiResponse<Unit>>

    @POST("auth/refresh-token")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<TokenResponse>
    
    @POST("auth/logout")
    suspend fun logout(@Body request: LogoutRequest): Response<ApiResponse<Unit>>
    
    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): Response<ApiResponse<Unit>>

    @POST("auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<ApiResponse<Unit>>

    @POST("auth/reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): Response<ApiResponse<Unit>>

    @GET("auth/me")
    suspend fun getCurrentUser(): Response<ApiResponse<UserDto>>

    // ==================== PATIENT ====================
    
    @GET("patients/dashboard")
    suspend fun getPatientDashboard(): Response<ApiResponse<PatientDashboardResponse>>
    
    @GET("patients/profile")
    suspend fun getPatientProfile(): Response<ApiResponse<PatientDto>>
    
    @PUT("patients/profile")
    suspend fun updatePatientProfile(@Body profile: UpdateProfileRequest): Response<ApiResponse<PatientDto>>

    @POST("patients/emergency-contacts")
    suspend fun addEmergencyContact(@Body request: AddEmergencyContactRequest): Response<ApiResponse<EmergencyContactDto>>

    @HTTP(method = "DELETE", path = "patients/emergency-contacts/{id}", hasBody = false)
    suspend fun deleteEmergencyContact(@Path("id") contactId: String): Response<ApiResponse<Unit>>

    @POST("patients/family-members")
    suspend fun addFamilyMember(@Body request: AddFamilyMemberRequest): Response<ApiResponse<FamilyMemberDto>>

    @HTTP(method = "DELETE", path = "patients/family-members/{id}", hasBody = false)
    suspend fun deleteFamilyMember(@Path("id") memberId: String): Response<ApiResponse<Unit>>

    @GET("patients/appointments")
    suspend fun getPatientAppointments(
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<Appointment>>
    
    @POST("patients/appointments")
    suspend fun bookAppointment(@Body request: CreateAppointmentRequest): Response<ApiResponse<Appointment>>
    
    @PUT("patients/appointments/{id}/cancel")
    suspend fun cancelAppointment(
        @Path("id") id: String,
        @Body request: CancelRequest
    ): Response<ApiResponse<Appointment>>

    @POST("appointments/{id}/reschedule")
    suspend fun rescheduleAppointment(
        @Path("id") id: String,
        @Body request: RescheduleRequest
    ): Response<ApiResponse<Appointment>>

    @GET("appointments/{id}")
    suspend fun getAppointmentDetails(
        @Path("id") id: String
    ): Response<ApiResponse<Appointment>>
    
    @GET("patients/prescriptions")
    suspend fun getPatientPrescriptions(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<Prescription>>
    
    @GET("patients/prescriptions/{id}")
    suspend fun getPrescriptionDetails(@Path("id") id: String): Response<ApiResponse<Prescription>>
    
    @GET("patients/reports")
    suspend fun getPatientReports(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<ReportDto>>
    
    @DELETE("reports/{id}")
    suspend fun deleteReport(@Path("id") id: String): Response<ApiResponse<Unit>>
    
    @POST("patients/emergency")
    suspend fun requestEmergency(@Body request: com.example.swastik.data.remote.dto.EmergencyRequest): Response<ApiResponse<EmergencyResponse>>
    
    @GET("patients/emergency/active")
    suspend fun getActiveEmergency(): Response<ApiResponse<EmergencyResponse>>
    
    @PUT("patients/emergency/{id}/cancel")
    suspend fun cancelEmergency(
        @Path("id") id: String,
        @Body request: CancelRequest
    ): Response<ApiResponse<EmergencyResponse>>
    
    @POST("patients/reviews")
    suspend fun submitReview(@Body request: com.example.swastik.data.remote.dto.ReviewRequest): Response<ApiResponse<Review>>

    // ==================== DOCTORS ====================

    @GET("patients/doctors/recommended")
    suspend fun getRecommendedDoctors(
        @Query("limit") limit: Int = 8
    ): Response<ApiResponse<List<com.example.swastik.data.remote.dto.RecommendedDoctorDto>>>
    
    @GET("patients/doctors")
    suspend fun searchDoctors(
        @Query("specialization") specialization: String? = null,
        @Query("search") search: String? = null,
        @Query("hospitalId") hospitalId: String? = null,
        @Query("clinicId") clinicId: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<Doctor>>
    
    @GET("patients/doctors/{id}")
    suspend fun getDoctorDetails(@Path("id") id: String): Response<ApiResponse<DoctorDetails>>
    
    @GET("patients/doctors/{id}/slots")
    suspend fun getDoctorSlots(
        @Path("id") id: String,
        @Query("date") date: String
    ): Response<ApiResponse<SlotsResponse>>

    // ==================== HOSPITALS ====================
    
    @GET("hospitals/nearby")
    suspend fun getNearbyHospitals(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 10
    ): Response<ApiResponse<List<Hospital>>>
    
    @GET("hospitals/{id}")
    suspend fun getHospitalDetails(@Path("id") id: String): Response<ApiResponse<Hospital>>

    @GET("hospitals/pharmacies")
    suspend fun getPharmaciesFromHospitals(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 5
    ): Response<ApiResponse<List<PharmacyDto>>>

    @GET("hospitals/clinics")
    suspend fun getClinicsFromHospitals(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 5
    ): Response<ApiResponse<List<ClinicDto>>>

    @GET("hospitals/diagnostic-centers")
    suspend fun getDiagnosticCenters(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 10
    ): Response<ApiResponse<List<DiagnosticCenterDto>>>

    @GET("hospitals/emergency")
    suspend fun getEmergencyHospitals(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double
    ): Response<ApiResponse<List<Hospital>>>

    @POST("hospitals/{id}/reviews")
    suspend fun submitHospitalReview(
        @Path("id") hospitalId: String,
        @Body request: com.example.swastik.data.remote.dto.ReviewRequest
    ): Response<ApiResponse<Review>>

    @GET("hospitals/{id}/reviews")
    suspend fun getHospitalReviews(
        @Path("id") hospitalId: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<HospitalReviewDto>>>

    @GET("hospitals/search")
    suspend fun searchHospitals(
        @Query("q") query: String,
        @Query("latitude") latitude: Double? = null,
        @Query("longitude") longitude: Double? = null
    ): Response<ApiResponse<List<Hospital>>>

    @GET("clinics/search")
    suspend fun searchClinics(
        @Query("city") city: String? = null,
        @Query("search") search: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<PaginatedResponse<ClinicDto>>

    @GET("pharmacy/search")
    suspend fun searchPharmacies(
        @Query("city") city: String? = null,
        @Query("search") search: String? = null,
        @Query("deliveryAvailable") deliveryAvailable: Boolean? = null,
        @Query("isOpen") isOpen: Boolean? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<PaginatedResponse<PharmacyDto>>

    // Get clinic doctors (public — for patient discovery in hospital finder)
    @GET("hospitals/clinics/{clinicId}/doctors")
    suspend fun getClinicDoctors(
        @Path("clinicId") clinicId: String
    ): Response<ApiResponse<List<ClinicDoctorDto>>>

    // Get pharmacy inventory (public — for patient to browse medicines at a specific pharmacy)
    @GET("hospitals/pharmacies/{pharmacyId}/inventory")
    suspend fun getPharmacyInventory(
        @Path("pharmacyId") pharmacyId: String,
        @Query("search") search: String? = null,
        @Query("category") category: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<PharmacyInventoryResponse>

    // ==================== AMBULANCE ====================
    
    @GET("ambulances/nearby")
    suspend fun getNearbyAmbulances(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 10
    ): Response<ApiResponse<List<AmbulanceDto>>>
    
    @GET("ambulances/track/{requestId}")
    suspend fun trackAmbulance(@Path("requestId") id: String): Response<ApiResponse<AmbulanceTrack>>

    // ==================== MEDICINES ====================
    
    @GET("medicines/search")
    suspend fun searchMedicines(
        @Query("q") query: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<Medicine>>

    @GET("medicines/categories")
    suspend fun getMedicineCategories(): Response<ApiResponse<List<MedicineCategoryDto>>>

    @GET("medicines/popular")
    suspend fun getPopularMedicines(): Response<PaginatedResponse<Medicine>>

    @GET("medicines/nearby")
    suspend fun getNearbyMedicines(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 25
    ): Response<ApiResponse<List<NearbyMedicineDto>>>

    @GET("medicines/{id}")
    suspend fun getMedicineDetails(@Path("id") id: String): Response<ApiResponse<Medicine>>

    @GET("medicines/{id}/availability")
    suspend fun getMedicineAvailability(
        @Path("id") id: String,
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double
    ): Response<ApiResponse<List<MedicineAvailabilityDto>>>

    @GET("medicines/{id}/alternatives")
    suspend fun getMedicineAlternatives(@Path("id") id: String): Response<PaginatedResponse<Medicine>>
    
    @GET("pharmacy/nearby")
    suspend fun getNearbyPharmacies(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("medicineId") medicineId: String,
        @Query("radius") radius: Int = 10
    ): Response<ApiResponse<List<Pharmacy>>>

    // ==================== MEDICINE ORDERS ====================

    @POST("medicines/orders")
    suspend fun createMedicineOrder(@Body request: MedicineOrderRequest): Response<ApiResponse<MedicineOrderDto>>

    @GET("patients/orders")
    suspend fun getMyOrders(
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<MedicineOrderDto>>

    @GET("patients/orders/{id}")
    suspend fun getOrderById(@Path("id") id: String): Response<ApiResponse<MedicineOrderDto>>

    @PATCH("patients/orders/{id}/cancel")
    suspend fun cancelOrder(@Path("id") id: String): Response<ApiResponse<MedicineOrderDto>>

    // ==================== DIAGNOSTIC CENTERS ====================

    @GET("diagnostic-centers/search")
    suspend fun searchDiagnosticCenters(
        @Query("city") city: String? = null,
        @Query("search") search: String? = null,
        @Query("testType") testType: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<DiagnosticCenterDto>>

    @GET("diagnostic-centers/nearby")
    suspend fun getNearbyDiagnosticCenters(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 10
    ): Response<ApiResponse<List<DiagnosticCenterDto>>>

    @GET("diagnostic-centers/{id}")
    suspend fun getDiagnosticCenterById(
        @Path("id") id: String
    ): Response<ApiResponse<DiagnosticCenterDto>>

    @GET("diagnostic-centers/{id}/tests")
    suspend fun getDiagnosticTests(
        @Path("id") centerId: String,
        @Query("search") search: String? = null,
        @Query("category") category: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<PaginatedResponse<DiagnosticTestDto>>

    @POST("diagnostic-centers/book")
    suspend fun bookDiagnosticTest(@Body request: DiagnosticBookingRequest): Response<ApiResponse<DiagnosticBookingDto>>

    @GET("patients/diagnostic-bookings")
    suspend fun getMyDiagnosticBookings(
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<DiagnosticBookingDto>>

    @GET("patients/diagnostic-bookings/{id}")
    suspend fun getDiagnosticBookingById(@Path("id") id: String): Response<ApiResponse<DiagnosticBookingDto>>

    @PATCH("patients/diagnostic-bookings/{id}/cancel")
    suspend fun cancelDiagnosticBooking(@Path("id") id: String): Response<ApiResponse<DiagnosticBookingDto>>

    // ==================== VITALS ====================

    @GET("patients/vitals")
    suspend fun getPatientVitals(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<VitalDto>>

    @POST("patients/vitals")
    suspend fun recordVital(@Body request: CreateVitalRequest): Response<ApiResponse<VitalDto>>

    // ==================== REMINDERS ====================

    @GET("patients/reminders")
    suspend fun getReminders(
        @Query("type") type: String? = null,
        @Query("isActive") isActive: Boolean? = null
    ): Response<ApiResponse<List<ReminderDto>>>

    @POST("patients/reminders")
    suspend fun createReminder(@Body request: CreateReminderRequest): Response<ApiResponse<ReminderDto>>

    @PUT("patients/reminders/{id}")
    suspend fun updateReminder(
        @Path("id") id: String,
        @Body request: UpdateReminderRequest
    ): Response<ApiResponse<ReminderDto>>

    @DELETE("patients/reminders/{id}")
    suspend fun deleteReminder(@Path("id") id: String): Response<ApiResponse<Unit>>

    // ==================== CHATBOT ====================

    @GET("consultations")
    suspend fun getConsultations(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<PaginatedResponse<ConsultationDto>>

    @POST("consultations/{appointmentId}/join")
    suspend fun joinConsultation(
        @Path("appointmentId") appointmentId: String
    ): Response<ApiResponse<ConsultationDto>>

    @GET("consultations/{id}")
    suspend fun getConsultationDetails(
        @Path("id") id: String
    ): Response<ApiResponse<ConsultationDto>>

    @PUT("consultations/{id}/end")
    suspend fun endConsultation(
        @Path("id") id: String,
        @Body body: EndConsultationRequest
    ): Response<ApiResponse<ConsultationDto>>

    @POST("consultations/{id}/leave")
    suspend fun leaveConsultation(
        @Path("id") id: String
    ): Response<ApiResponse<Any>>
    
    @POST("chatbot/session/start")
    suspend fun startChatSession(): Response<ApiResponse<ChatSession>>
    
    @POST("chatbot/message")
    suspend fun sendChatMessage(@Body request: ChatMessageRequest): Response<ApiResponse<ChatbotMessageResult>>

    @Multipart
    @POST("chatbot/analyze-image")
    suspend fun analyzeImage(
        @Part image: MultipartBody.Part,
        @Part("sessionId") sessionId: RequestBody,
        @Part("description") description: RequestBody
    ): Response<ApiResponse<ChatbotMessageResult>>
    
    @POST("chatbot/analyze-symptoms")
    suspend fun analyzeSymptoms(@Body request: SymptomAnalysisRequest): Response<ApiResponse<SymptomAnalysis>>
    
    @GET("chatbot/health-tips")
    suspend fun getHealthTips(@Query("category") category: String?): Response<ApiResponse<List<HealthTip>>>

    @GET("chatbot/session/{sessionId}")
    suspend fun getChatHistory(
        @Path("sessionId") sessionId: String
    ): Response<ApiResponse<List<ChatMessage>>>

    @GET("chatbot/sessions")
    suspend fun getChatSessions(): Response<ApiResponse<List<ChatSession>>>

    @POST("chatbot/session/{sessionId}/end")
    suspend fun endChatSession(
        @Path("sessionId") sessionId: String
    ): Response<ApiResponse<Unit>>

    @GET("chatbot/provider-status")
    suspend fun getAiProviderStatus(): Response<ApiResponse<List<AiProviderStatus>>>

    // ==================== NOTIFICATIONS ====================
    
    @GET("notifications")
    suspend fun getNotifications(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<NotificationsListData>>
    
    @PUT("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String): Response<ApiResponse<Unit>>
    
    @PUT("notifications/read-all")
    suspend fun markAllNotificationsRead(): Response<ApiResponse<Unit>>

    @GET("notifications/unread-count")
    suspend fun getUnreadNotificationCount(): Response<ApiResponse<UnreadCountDto>>

    @POST("notifications/register-device")
    suspend fun registerDevice(@Body request: RegisterDeviceRequest): Response<ApiResponse<Unit>>

    @HTTP(method = "DELETE", path = "notifications/unregister-device", hasBody = true)
    suspend fun unregisterDevice(@Body request: RegisterDeviceRequest): Response<ApiResponse<Unit>>

    // ==================== HEALTH CARD ====================

    @POST("health-card/generate")
    suspend fun generateHealthCard(): Response<ApiResponse<HealthCardTokenResponse>>

    @GET("health-card/status")
    suspend fun getHealthCardStatus(): Response<ApiResponse<HealthCardStatusResponse>>

    @POST("health-card/revoke")
    suspend fun revokeHealthCard(): Response<ApiResponse<Unit>>

    // ==================== UPLOADS ====================
    
    @Multipart
    @POST("uploads/profile")
    suspend fun uploadProfileImage(
        @Part file: okhttp3.MultipartBody.Part
    ): Response<ApiResponse<UploadResponse>>
    
    @Multipart
    @POST("uploads/report")
    suspend fun uploadMedicalReport(
        @Part file: okhttp3.MultipartBody.Part
    ): Response<ApiResponse<UploadResponse>>
}
