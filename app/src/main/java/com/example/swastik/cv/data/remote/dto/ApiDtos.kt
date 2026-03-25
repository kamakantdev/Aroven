package com.example.swastik.data.remote.dto

import com.google.gson.annotations.SerializedName

// ==================== AUTH DTOs ====================

data class ApiResponse<T>(
    val success: Boolean,
    val message: String?,
    val data: T?
)

// ==================== COMMON & MISSING DTOs ====================

data class LoginRequest(
    val email: String,
    val password: String,
    val role: String? = null
)

data class PaginatedResponse<T>(
    val success: Boolean,
    val data: List<T>,
    val pagination: PaginationDto?
)

data class EmergencyRequest(
    val latitude: Double,
    val longitude: Double,
    val address: String?,
    val emergencyType: String,
    val notes: String?
)

data class ReviewRequest(
    val doctorId: String?,
    val hospitalId: String?,
    val rating: Int,
    val comment: String?
)

data class SymptomAnalysisRequest(
    val sessionId: String,
    val symptoms: List<String>,
    val duration: String?,
    val severity: String?
)

data class SymptomAnalysis(
    @SerializedName("possible_conditions") val possibleConditions: List<Condition>,
    val severity: String,
    @SerializedName("recommended_specialties") val recommendedSpecialties: List<String>,
    val suggestions: List<String>,
    @SerializedName("seek_immediate_care") val seekImmediateCare: Boolean
)

data class Condition(
    val name: String,
    val probability: String,
    val description: String?
)

data class HealthTip(
    val id: String,
    val title: String,
    val content: String,
    val category: String
)

data class UploadResponse(
    val url: String,
    @SerializedName("file_name") val fileName: String
)

// ==================== HEALTH CARD DTOs ====================

data class HealthCardTokenResponse(
    val token: String,
    val url: String,
    @SerializedName("expires_at") val expiresAt: String,
    @SerializedName("expires_in_hours") val expiresInHours: Int
)

data class HealthCardStatusResponse(
    @SerializedName("has_active_card") val hasActiveCard: Boolean,
    val url: String?,
    @SerializedName("generated_at") val generatedAt: String?,
    @SerializedName("expires_at") val expiresAt: String?
)

data class ChatSession(
    val id: String? = null,
    val sessionId: String,
    val message: String? = null
)

data class ChatMessage(
    val id: String?,
    val role: String, // user, assistant
    val content: String,
    val timestamp: String?,
    @SerializedName("audio_url") val audioUrl: String?
)


data class RegisterRequest(
    val email: String,
    val phone: String,
    val password: String,
    val name: String,
    val role: String = "patient"
)

data class ResendVerificationRequest(
    val email: String
)

data class RefreshTokenRequest(
    val refreshToken: String
)

data class LogoutRequest(
    val refreshToken: String
)

data class AuthData(
    val accessToken: String?,
    val refreshToken: String?,
    val user: UserDto?,
    val expiresIn: Long? = null
)

data class AuthResponse(
    val success: Boolean,
    // Top-level fields (for direct responses)
    val accessToken: String?,
    val refreshToken: String?,
    val user: UserDto?,
    val expiresIn: Long? = null,
    // Nested data field (for login, register which wrap in data: {})
    val data: AuthData?,
    val message: String?
) {
    /** Resolve tokens/user regardless of backend response shape */
    fun resolvedAccessToken(): String? = accessToken ?: data?.accessToken
    fun resolvedRefreshToken(): String? = refreshToken ?: data?.refreshToken
    fun resolvedUser(): UserDto? = user ?: data?.user
    fun resolvedExpiresIn(): Long = expiresIn ?: data?.expiresIn ?: 604800L // default 7 days
}

data class UserDto(
    val id: String,
    val email: String,
    val phone: String,
    val role: String,
    val name: String?,
    @SerializedName("is_verified")
    val isVerified: Boolean
)

// ==================== PATIENT DTOs ====================

data class PatientDto(
    val id: String,
    val name: String,
    val email: String?,
    val phone: String?,
    val age: Int?,
    val gender: String?,
    @SerializedName("blood_group")
    val bloodGroup: String?,
    val weight: Float?,
    val height: Float?,
    val location: String?,
    @SerializedName("abha_number")
    val abhaNumber: String?,
    @SerializedName("profile_image_url")
    val profileImageUrl: String?,
    @SerializedName("is_verified")
    val isVerified: Boolean = false,
    val emergencyContacts: List<EmergencyContactDto>? = null,
    val familyMembers: List<FamilyMemberDto>? = null,
    @SerializedName("saved_addresses")
    val savedAddresses: List<SavedAddressDto>? = null,
    @SerializedName("linked_hospitals")
    val linkedHospitals: Int? = null
)

data class EmergencyProvider(
    val id: String,
    val name: String,
    val distanceText: String,
    val estimatedArrival: String
)

data class NearbyMedicineDto(
    val id: String, // Inventory ID
    val medicineId: String?,
    val name: String,
    val category: String?,
    val price: Float,
    val pharmacyName: String?,
    val pharmacyId: String?,
    val inStock: Boolean,
    val quantity: Int
)

data class EmergencyContactDto(
    val id: String,
    val name: String,
    val phone: String,
    val relationship: String
)

data class FamilyMemberDto(
    val id: String,
    val name: String,
    val relationship: String,
    val phone: String? = null
)

data class SavedAddressDto(
    val id: String,
    val label: String,
    val address: String,
    val city: String? = null,
    val pincode: String? = null,
    @SerializedName("is_default")
    val isDefault: Boolean = false
)

data class AddEmergencyContactRequest(
    val name: String,
    val phone: String,
    val relation: String
)

data class AddFamilyMemberRequest(
    val name: String,
    val relation: String,
    val phone: String? = null
)

data class UpdateProfileRequest(
    val name: String? = null,
    val age: Int? = null,
    val gender: String? = null,
    val bloodGroup: String? = null,
    val weight: Float? = null,
    val height: Float? = null,
    val location: String? = null
)

data class PatientDashboardResponse(
    val success: Boolean,
    val reminders: List<ReminderDto>?,
    val upcomingAppointments: List<AppointmentDto>?,
    val recentConsultations: List<ConsultationDto>?,
    val stats: PatientStatsDto?,
    val recommendedDoctors: List<RecommendedDoctorDto>?,
    val message: String?
)

/**
 * DTO for recommended doctors returned from the dashboard endpoint.
 * Backend returns 'rating' (not 'average_rating'), so we map here.
 */
data class RecommendedDoctorDto(
    val id: String,
    val name: String,
    val specialization: String,
    val rating: Float?,
    @SerializedName("experience_years") val experienceYears: Int?,
    @SerializedName("profile_image_url") val profileImageUrl: String?,
    @SerializedName("consultation_fee") val consultationFee: Int?,
    @SerializedName("is_available") val isAvailable: Boolean?,
    @SerializedName("recommendation_reason") val recommendationReason: String?
) {
    fun toDoctor() = com.example.swastik.data.model.Doctor(
        id = id,
        name = name,
        specialization = specialization,
        profileImageUrl = profileImageUrl,
        experienceYears = experienceYears,
        qualification = null,
        consultationFee = consultationFee,
        videoConsultationFee = null,
        averageRating = rating,
        totalReviews = null,
        isAvailable = isAvailable ?: true,
        hospitalValues = emptyList()
    )
}

data class PatientStatsDto(
    @SerializedName("total_consultations")
    val totalConsultations: Int,
    @SerializedName("total_prescriptions")
    val totalPrescriptions: Int,
    @SerializedName("total_reports")
    val totalReports: Int
)

data class ReminderDto(
    val id: String,
    val title: String,
    val time: String,
    val type: String,
    @SerializedName("is_completed")
    val isCompleted: Boolean
)

// ==================== DOCTOR DTOs ====================

data class DoctorDto(
    val id: String,
    val name: String,
    val specialization: String,
    @SerializedName("experience_years") val experience: Int = 0,
    val rating: Float? = null,
    @SerializedName("consultation_fee")
    val consultationFee: Int = 0,
    @SerializedName("profile_image_url")
    val profileImageUrl: String?,
    val hospital: HospitalDto?,
    @SerializedName("is_available")
    val isAvailable: Boolean = true
)

data class TimeSlotDto(
    val time: String,
    val isAvailable: Boolean
)

// ==================== APPOINTMENT DTOs ====================

data class CreateAppointmentRequest(
    val doctorId: String,
    val date: String,
    val timeSlot: String,
    val type: String,
    val notes: String? = null,
    val hospitalId: String? = null,
    val clinicId: String? = null
)

data class AppointmentDto(
    val id: String,
    @SerializedName("doctor_id")
    val doctorId: String,
    val doctor: DoctorDto?,
    @SerializedName("appointment_date")
    val date: String,
    @SerializedName("time_slot")
    val timeSlot: String,
    val type: String,
    val status: String,
    val notes: String?
)

data class CancelAppointmentRequest(
    val reason: String?
)

// ==================== CONSULTATION DTOs ====================

/**
 * Matches backend response shape:
 * { id, status, diagnosis, notes, follow_up_date, created_at, started_at,
 *   doctor: { id, name, specialization, profile_image_url },
 *   patient: { id, name, phone },
 *   appointment: { id, appointment_date, time_slot, type },
 *   prescriptions: [...] }
 */
data class ConsultationDto(
    val id: String,
    val status: String? = null,
    val diagnosis: String? = null,
    val notes: String? = null,
    @SerializedName("follow_up_date")
    val followUpDate: String? = null,
    @SerializedName("created_at")
    val createdAt: String? = null,
    @SerializedName("started_at")
    val startedAt: String? = null,
    @SerializedName("ended_at")
    val endedAt: String? = null,
    @SerializedName("doctor_id")
    val doctorId: String? = null,
    @SerializedName("patient_id")
    val patientId: String? = null,
    @SerializedName("appointment_id")
    val appointmentId: String? = null,
    // Nested objects from Supabase joins
    val doctor: ConsultationDoctorDto? = null,
    val patient: ConsultationPatientDto? = null,
    val appointment: ConsultationAppointmentDto? = null,
    val prescriptions: List<PrescriptionDto>? = null
) {
    /** Helper: resolve doctor name from nested object */
    val doctorName: String get() = doctor?.name ?: "Doctor"
    /** Helper: resolve doctor specialty from nested object */
    val doctorSpecialty: String get() = doctor?.specialization ?: "General"
    /** Helper: resolve date from appointment or creation timestamp */
    val date: String get() = appointment?.appointmentDate ?: createdAt ?: ""
}

data class ConsultationDoctorDto(
    val id: String?,
    val name: String?,
    val specialization: String?,
    @SerializedName("profile_image_url")
    val profileImageUrl: String? = null
)

data class ConsultationPatientDto(
    val id: String?,
    val name: String?,
    val phone: String? = null
)

data class ConsultationAppointmentDto(
    val id: String?,
    @SerializedName("appointment_date")
    val appointmentDate: String?,
    @SerializedName("time_slot")
    val timeSlot: String?,
    val type: String? = null
)

data class PrescriptionDto(
    val id: String? = null,
    @SerializedName("consultation_id")
    val consultationId: String? = null,
    val diagnosis: String? = null,
    val notes: String? = null,
    @SerializedName("created_at")
    val createdAt: String? = null,
    // Backend returns as "medicines" from patient route and "prescription_medicines" from consultation detail
    val medicines: List<PrescriptionItemDto>? = null,
    @SerializedName("prescription_medicines")
    val prescriptionMedicines: List<PrescriptionItemDto>? = null
) {
    /** Unified accessor — prefers explicit medicines, falls back to nested join result */
    val allMedicines: List<PrescriptionItemDto>
        get() = medicines?.takeIf { it.isNotEmpty() } ?: prescriptionMedicines ?: emptyList()
}

data class PrescriptionItemDto(
    @SerializedName("medicine_name")
    val medicineName: String,
    val dosage: String,
    val frequency: String,
    val duration: String,
    val instructions: String? = null,
    val quantity: Int? = null
)

data class EndConsultationRequest(
    val diagnosis: String? = null,
    val notes: String? = null,
    @SerializedName("follow_up_date")
    val followUpDate: String? = null
)

// ==================== HOSPITAL DTOs ====================

data class HospitalDto(
    val id: String,
    val name: String,
    val type: String,
    val address: String,
    val city: String?,
    val phone: String?,
    val latitude: Double,
    val longitude: Double,
    val rating: Float?,
    @SerializedName("is_emergency_available")
    val isEmergencyAvailable: Boolean?,
    val distance: Float?
)

// ==================== MEDICINE DTOs ====================

data class MedicineDto(
    val id: String,
    val name: String,
    @SerializedName("generic_name")
    val genericName: String?,
    val manufacturer: String,
    val category: String,
    val price: Float,
    val description: String?,
    @SerializedName("requires_prescription")
    val requiresPrescription: Boolean,
    @SerializedName("image_url")
    val imageUrl: String?
)

data class MedicineCategoryDto(
    val id: String,
    val name: String,
    val icon: String,
    val count: Int
)

// ==================== REPORT DTOs ====================

data class ReportDto(
    val id: String,
    val name: String,
    val type: String,
    @SerializedName("test_date")
    val testDate: String?,
    @SerializedName("result_date")
    val resultDate: String?,
    @SerializedName("lab_name")
    val labName: String?,
    val status: String,
    @SerializedName("file_url")
    val fileUrl: String?,
    @SerializedName("file_size")
    val fileSize: String?,
    @SerializedName("doctor_notes")
    val doctorNotes: String?,
    @SerializedName("consultation_id")
    val consultationId: String?,
    val parameters: List<ReportParameterDto>?,
    @SerializedName("created_at")
    val createdAt: String?
) {
    /** Fallback date: test_date → created_at → today */
    val displayDate: String
        get() = testDate ?: createdAt?.take(10) ?: ""
}

data class ReportParameterDto(
    val name: String,
    val value: String,
    val unit: String?,
    @SerializedName("normal_range")
    val normalRange: String?,
    val status: String
)

// ==================== NOTIFICATION DTOs ====================

data class UnreadCountDto(
    val count: Int
)

data class NotificationsListData(
    val notifications: List<NotificationDto>,
    val pagination: PaginationDto?
)

data class NotificationDto(
    val id: String,
    val title: String,
    val message: String,
    val type: String,
    @SerializedName("is_read")
    val isRead: Boolean,
    @SerializedName("created_at")
    val createdAt: String
)

data class TokenResponse(
    val success: Boolean,
    val accessToken: String?,
    val refreshToken: String?
)

data class ForgotPasswordRequest(
    val email: String
)

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)

data class ResetPasswordRequest(
    val token: String,
    @SerializedName("password") val newPassword: String
)

data class UpdateStatusRequest(
    val status: String,
    val notes: String? = null
)

data class RescheduleRequest(
    val date: String,
    val timeSlot: String,
    val reason: String? = null
)

data class AddPrescriptionRequest(
    val diagnosis: String,
    val notes: String? = null,
    @SerializedName("follow_up_date") val followUpDate: String? = null,
    val items: List<PrescriptionItemDto>
)

data class UploadReportRequest(
    val name: String,
    val type: String,
    @SerializedName("file_url") val fileUrl: String,
    @SerializedName("lab_name") val labName: String? = null
)

data class ShareReportRequest(
    @SerializedName("doctor_id") val doctorId: String
)

data class MedicineAvailabilityDto(
    @SerializedName("pharmacy_id") val pharmacyId: String,
    @SerializedName("pharmacy_name") val pharmacyName: String,
    val address: String?,
    val price: Float?,
    @SerializedName("in_stock") val inStock: Boolean,
    val distance: Float?
)

data class TtsRequest(
    val text: String,
    val language: String = "en"
)

data class TtsResponse(
    @SerializedName("audio_url") val audioUrl: String
)

data class RegisterDeviceRequest(
    val fcmToken: String,
    val deviceType: String = "android"
)

data class ChatMessageRequest(
    val sessionId: String,
    val message: String,
    val messageType: String = "text", // "text" or "voice"
    val language: String = "en" // "en" or "hi"
)

data class ChatMessageResponse(
    val success: Boolean,
    val response: String?,
    val message: String?
)

// ==================== STRUCTURED AI RESPONSE DTOs ====================

/**
 * Structured response from AI chatbot.
 * The backend enforces JSON output from the AI provider.
 */
data class StructuredAiResponse(
    val summary: String,
    @SerializedName("possible_conditions") val possibleConditions: List<String>?,
    val severity: String, // low, medium, high, critical
    @SerializedName("recommended_specialist") val recommendedSpecialist: String?,
    @SerializedName("requires_emergency") val requiresEmergency: Boolean,
    @SerializedName("confidence_score") val confidenceScore: Float?,
    @SerializedName("follow_up_question") val followUpQuestion: String?
)

/**
 * Full chatbot message response including provider metadata.
 */
data class ChatbotMessageResult(
    val response: StructuredAiResponse,
    val provider: String?, // "huggingface", "groq", "emergency_engine", "fallback"
    val model: String?,
    val latencyMs: Long?,
    val isEmergency: Boolean?,
    val emergencyNumbers: EmergencyNumbers?,
    val rateLimited: Boolean?,
    val usage: AiUsage?
)

data class EmergencyNumbers(
    val ambulance: String?,
    val national: String?,
    @SerializedName("poison_control") val poisonControl: String?
)

data class AiUsage(
    val promptTokens: Int?,
    val completionTokens: Int?,
    val totalTokens: Int?
)

/**
 * AI provider status for monitoring.
 */
data class AiProviderStatus(
    val name: String,
    val available: Boolean,
    @SerializedName("circuit_open") val circuitOpen: Boolean?,
    @SerializedName("failure_count") val failureCount: Int?
)

// ==================== AMBULANCE DTOs ====================

data class AmbulanceRequest(
    val latitude: Double,
    val longitude: Double,
    val emergencyType: String? = null,
    val notes: String? = null
)

data class AmbulanceDto(
    val id: String,
    @SerializedName("vehicle_number")
    val vehicleNumber: String,
    @SerializedName("driver_name")
    val driverName: String,
    @SerializedName("driver_phone")
    val driverPhone: String,
    val latitude: Double?,
    val longitude: Double?
)

/**
 * Backend getAmbulanceLocation returns:
 * { requestId, status, ambulance: { id, vehicleNumber, driverName, driverPhone, type },
 *   currentLocation: { latitude, longitude, heading, speed },
 *   pickupLocation: { latitude, longitude },
 *   distance: "3.5 km", estimatedArrival: "12 min" }
 */
data class AmbulanceTrack(
    val requestId: String? = null,
    val status: String? = null,
    val ambulance: AmbulanceTrackInfo? = null,
    val currentLocation: AmbulanceTrackLocation? = null,
    val pickupLocation: AmbulanceTrackLocation? = null,
    val distance: String? = null,
    val estimatedArrival: String? = null
)

data class AmbulanceTrackInfo(
    val id: String?,
    val vehicleNumber: String?,
    val driverName: String?,
    val driverPhone: String?,
    val type: String?
)

data class AmbulanceTrackLocation(
    val latitude: Double?,
    val longitude: Double?,
    val heading: Float? = null,
    val speed: Float? = null
)

data class CancelRequest(
    val reason: String?
)

// ==================== PHARMACY / CLINIC / DIAGNOSTIC DTOs ====================

data class PharmacyDto(
    val id: String,
    val name: String,
    val address: String?,
    val phone: String?,
    val latitude: Double?,
    val longitude: Double?,
    val distance: Float?,
    @SerializedName("is_open")
    val isOpen: Boolean?,
    val rating: Float?,
    @SerializedName("total_reviews")
    val totalReviews: Int?
)

data class ClinicDto(
    val id: String,
    val name: String,
    val address: String?,
    val phone: String?,
    val latitude: Double?,
    val longitude: Double?,
    val distance: Float?,
    val rating: Float?,
    val specializations: List<String>?,
    @SerializedName("total_reviews")
    val totalReviews: Int?,
    @SerializedName("is_24_hours")
    val is24Hours: Boolean?
)

data class DiagnosticCenterDto(
    val id: String,
    val name: String,
    val address: String?,
    val phone: String?,
    val latitude: Double?,
    val longitude: Double?,
    val distance: Float?,
    val rating: Float?,
    @SerializedName("emergency_services")
    val emergencyServices: Boolean?,
    @SerializedName("test_categories")
    val specialties: List<String>?,
    @SerializedName("total_reviews")
    val totalReviews: Int?,
    @SerializedName("is_24_hours")
    val is24Hours: Boolean?
)

// ==================== COMMON DTOs ====================

data class PaginationDto(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int
)

data class ApiError(
    val success: Boolean = false,
    val message: String,
    val error: String?
)

// ==================== MEDICINE ORDER DTOs ====================

data class MedicineOrderRequest(
    val pharmacyId: String,
    val items: List<OrderItemRequest>,
    val deliveryAddress: String
)

data class OrderItemRequest(
    val medicineId: String,
    val quantity: Int
)

data class MedicineOrderDto(
    val id: String,
    @SerializedName("patient_id") val patientId: String,
    @SerializedName("pharmacy_id") val pharmacyId: String,
    val items: List<OrderItemDto>?,
    @SerializedName("delivery_address") val deliveryAddress: String?,
    @SerializedName("total_amount") val totalAmount: Float?,
    val status: String,
    @SerializedName("payment_status") val paymentStatus: String?,
    @SerializedName("created_at") val createdAt: String?,
    @SerializedName("updated_at") val updatedAt: String?,
    val pharmacy: OrderPharmacyDto?
)

data class OrderPharmacyDto(
    val id: String,
    val name: String?,
    val phone: String?,
    val address: String?,
    val city: String?
)

data class OrderItemDto(
    val medicineId: String?,
    @SerializedName("medicine_id") val medicineIdAlt: String?,
    val quantity: Int,
    val name: String?,
    val price: Float?,
    val subtotal: Float?
)

// ==================== DIAGNOSTIC CENTER DTOs ====================

data class DiagnosticTestDto(
    val id: String,
    val name: String,
    val description: String?,
    val category: String?,
    val price: Float?,
    @SerializedName("preparation_instructions") val preparationInstructions: String?,
    @SerializedName("report_time") val reportTime: String?,
    @SerializedName("is_active") val isActive: Boolean?
)

data class DiagnosticBookingRequest(
    val centerId: String,
    val testId: String,
    val bookingDate: String,
    val bookingTime: String?,
    val collectionType: String?,
    val collectionAddress: String?,
    val notes: String?
)

data class DiagnosticBookingDto(
    val id: String,
    @SerializedName("patient_id") val patientId: String?,
    @SerializedName("center_id") val centerId: String?,
    @SerializedName("test_id") val testId: String?,
    @SerializedName("booking_date") val bookingDate: String?,
    @SerializedName("booking_time") val bookingTime: String?,
    @SerializedName("collection_type") val collectionType: String?,
    @SerializedName("collection_address") val collectionAddress: String?,
    val status: String?,
    @SerializedName("result_status") val resultStatus: String?,
    val notes: String?,
    @SerializedName("created_at") val createdAt: String?,
    val test: DiagnosticTestDto?,
    val center: DiagnosticCenterDto?
)

// ==================== VITALS DTOs ====================

data class VitalDto(
    val id: String,
    @SerializedName("patient_id") val patientId: String?,
    val type: String? = null,
    val value: String? = null,
    val unit: String? = null,
    val notes: String? = null,
    @SerializedName("recorded_at") val recordedAt: String? = null,
    // Columnar vitals from DB — backend may return these instead of type/value
    @SerializedName("heart_rate") val heartRate: Float? = null,
    @SerializedName("blood_pressure_systolic") val bloodPressureSystolic: Float? = null,
    @SerializedName("blood_pressure_diastolic") val bloodPressureDiastolic: Float? = null,
    val temperature: Float? = null,
    @SerializedName("oxygen_saturation") val oxygenSaturation: Float? = null,
    @SerializedName("oxygen_level") val oxygenLevel: Float? = null,
    @SerializedName("blood_sugar") val bloodSugar: Float? = null,
    val weight: Float? = null,
    val height: Float? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class CreateVitalRequest(
    val type: String,
    val value: String,
    val unit: String? = null,
    val notes: String? = null
)

// ==================== REMINDER DTOs (CRUD) ====================

data class CreateReminderRequest(
    val title: String,
    val type: String,
    val time: String
)

data class UpdateReminderRequest(
    val title: String? = null,
    val type: String? = null,
    val time: String? = null,
    @SerializedName("is_active") val isActive: Boolean? = null
)

// ==================== CLINIC DOCTOR DTOs (public discovery) ====================

data class ClinicDoctorDto(
    val id: String,
    val name: String,
    val specialization: String?,
    @SerializedName("profile_image_url") val profileImageUrl: String?,
    @SerializedName("consultation_fee") val consultationFee: Int?,
    @SerializedName("experience_years") val experienceYears: Int?,
    val rating: Float? = null,
    @SerializedName("average_rating") val averageRating: Float? = null
) {
    /** Unified accessor: prefer explicit rating, then average_rating, default 0 */
    val resolvedRating: Float get() = rating ?: averageRating ?: 0f
}

// ==================== PHARMACY INVENTORY DTOs (public browse) ====================

data class PharmacyInventoryResponse(
    val success: Boolean,
    val data: List<PharmacyInventoryItemDto>?,
    val items: List<PharmacyInventoryItemDto>?,
    val pagination: PaginationDto?
) {
    /** Backend returns both 'data' and 'items' aliases — use whichever is populated */
    val allItems: List<PharmacyInventoryItemDto> get() = data ?: items ?: emptyList()
}

data class PharmacyInventoryItemDto(
    val id: String,
    @SerializedName("medicine_id") val medicineId: String?,
    val name: String?,
    @SerializedName("medicine_name") val medicineName: String?,
    val category: String?,
    val quantity: Int?,
    val price: Float?,
    val mrp: Float?,
    val manufacturer: String?,
    @SerializedName("requires_prescription") val requiresPrescription: Boolean?,
    @SerializedName("expiry_date") val expiryDate: String?,
    val unit: String?
) {
    /** Unified display name */
    val displayName: String get() = name ?: medicineName ?: "Unknown"
    /** In stock if quantity > 0 */
    val inStock: Boolean get() = (quantity ?: 0) > 0
}

// ==================== HOSPITAL REVIEW DTO ====================

data class HospitalReviewDto(
    val id: String,
    val rating: Int,
    val comment: String?,
    val patientName: String?,
    val patientImage: String?,
    val createdAt: String?
)
