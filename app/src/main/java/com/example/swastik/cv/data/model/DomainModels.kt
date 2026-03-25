package com.example.swastik.data.model

import com.google.gson.annotations.SerializedName

// ==================== Dashboard & Utility Models ====================

data class PatientStats(
    @SerializedName("total_consultations") val totalConsultations: Int = 0,
    @SerializedName("total_prescriptions") val totalPrescriptions: Int = 0,
    @SerializedName("total_reports") val totalReports: Int = 0
)

data class Reminder(
    val title: String,
    val time: String,
    val type: ReminderType,
    @SerializedName("is_completed") val isCompleted: Boolean
)

enum class ReminderType {
    MEDICINE,
    APPOINTMENT,
    TEST
}

data class ConsultationRecord(
    val id: String,
    @SerializedName("doctor_name") val doctorName: String,
    @SerializedName("doctor_specialty") val doctorSpecialty: String,
    val date: String,
    val diagnosis: String,
    val prescriptions: List<PrescriptionItem>,
    val notes: String,
    @SerializedName("follow_up_date") val followUpDate: String?
)

data class PrescriptionItem(
    @SerializedName("medicine_name") val medicineName: String,
    val dosage: String,
    val frequency: String,
    val duration: String
)

data class NotificationItem(
    val id: String,
    val title: String,
    val message: String,
    val time: String,
    val type: NotificationType,
    @SerializedName("is_read") val isRead: Boolean = false,
    @SerializedName("action_label") val actionLabel: String? = null
)

enum class NotificationType {
    APPOINTMENT,
    MEDICINE_REMINDER,
    REPORT_READY,
    PRESCRIPTION,
    SYSTEM,
    OFFER
}

data class PatientDashboard(
    val patient: Patient,
    @SerializedName("upcoming_appointments") val upcomingAppointments: List<Appointment>,
    @SerializedName("recent_prescriptions") val recentPrescriptions: List<Prescription> = emptyList(),
    @SerializedName("unread_notifications") val unreadNotifications: Int = 0,
    @SerializedName("active_emergency") val activeEmergency: EmergencyResponse? = null,
    val stats: PatientStats = PatientStats()
)

data class MedicalDocument(
    val id: String,
    val name: String,
    val type: DocumentType,
    val date: String,
    @SerializedName("doctor_name") val doctorName: String?,
    @SerializedName("file_url") val fileUrl: String,
    val size: String? = null
)

enum class DocumentType {
    PRESCRIPTION,
    REPORT,
    INVOICE,
    CERTIFICATE,
    LAB_REPORT,
    SCAN,
    DISCHARGE_SUMMARY,
    VACCINATION
}

// ==================== DOMAIN MODELS ====================

data class Patient(
    val id: String,
    @SerializedName("user_id") val userId: String,
    val name: String,
    val phone: String,
    val email: String?,
    @SerializedName("date_of_birth") val dateOfBirth: String?,
    val gender: String?,
    @SerializedName("blood_group") val bloodGroup: String?,
    @SerializedName("emergency_contact") val emergencyContact: String?,
    val address: String?,
    @SerializedName("profile_image_url") val profileImageUrl: String?,
    val allergies: List<String>?,
    @SerializedName("chronic_conditions") val chronicConditions: List<String>?
)

data class Doctor(
    val id: String,
    val name: String,
    val specialization: String,
    @SerializedName("profile_image_url") val profileImageUrl: String?,
    @SerializedName("experience_years") val experienceYears: Int?,
    val qualification: String?,
    @SerializedName("consultation_fee") val consultationFee: Int?,
    @SerializedName("video_consultation_fee") val videoConsultationFee: Int?,
    // Backend sends "rating" from doctors table; some endpoints send "average_rating"
    // Using "rating" to match the primary DB column name returned by getAllDoctors / getDoctorById
    @SerializedName("rating") val averageRating: Float?,
    @SerializedName("total_reviews") val totalReviews: Int?,
    @SerializedName("is_available") val isAvailable: Boolean,
    @SerializedName("hospital_values") val hospitalValues: List<String> = emptyList()
)

data class DoctorDetails(
    val doctor: Doctor,
    val schedules: List<DoctorSchedule> = emptyList(),
    val hospitals: List<Hospital>? = null,
    val clinics: List<Clinic>? = null,
    val reviews: List<Review>? = null
)

data class DoctorSchedule(
    val id: String,
    @SerializedName("day_of_week") val dayOfWeek: Int,
    @SerializedName("start_time") val startTime: String,
    @SerializedName("end_time") val endTime: String,
    @SerializedName("slot_duration") val slotDuration: Int,
    @SerializedName("is_available") val isAvailable: Boolean
)

data class Hospital(
    val id: String,
    val name: String,
    val address: String,
    val phone: String?,
    @SerializedName("image_url") val imageUrl: String?,
    val latitude: Double?,
    val longitude: Double?,
    val distance: Float?,
    val rating: Float?,
    @SerializedName("total_reviews") val reviewCount: Int?,
    val specializations: List<String>?,
    @SerializedName("is_emergency_available") val isEmergencyAvailable: Boolean?,
    @SerializedName("ambulance_service") val ambulanceService: Boolean?,
    @SerializedName("is_24_hours") val is24Hours: Boolean?,
    val type: String? = null,
    val city: String? = null
)

data class Clinic(
    val id: String,
    val name: String,
    val address: String
)

data class Review(
    val id: String,
    val rating: Int,
    val comment: String?,
    @SerializedName("created_at") val createdAt: String,
    val patient: Patient?
)

data class Appointment(
    val id: String,
    @SerializedName("appointment_number") val appointmentNumber: String?,
    @SerializedName("patient_id") val patientId: String,
    @SerializedName("doctor_id") val doctorId: String,
    @SerializedName("appointment_date") val date: String,
    @SerializedName("time_slot") val timeSlot: String,
    val type: String,
    val status: String,
    val reason: String?,
    val notes: String?,
    @SerializedName("consultation_fee") val consultationFee: Int?,
    @SerializedName("cancellation_reason") val cancellationReason: String?,
    val doctor: Doctor?,
    val patient: Patient?
)

data class Prescription(
    val id: String,
    @SerializedName("prescription_number") val prescriptionNumber: String? = null,
    val diagnosis: String,
    val notes: String?,
    @SerializedName("follow_up_date") val followUpDate: String?,
    @SerializedName("created_at") val createdAt: String,
    val doctor: Doctor?,
    val medicines: List<PrescriptionItem>?
)

data class Medicine(
    val id: String,
    val name: String,
    @SerializedName("generic_name") val genericName: String? = null,
    val manufacturer: String?,
    val price: Float?,
    @SerializedName("requires_prescription") val requiresPrescription: Boolean,
    val category: MedicineCategory = MedicineCategory.TABLET,
    val description: String? = null,
    @SerializedName("in_stock") val inStock: Boolean = true,
    @SerializedName("stock_count") val stockCount: Int = 0,
    @SerializedName("nearby_pharmacy") val nearbyPharmacy: String? = null,
    @SerializedName("pharmacy_distance") val pharmacyDistance: String? = null
)

enum class MedicineCategory {
    TABLET, CAPSULE, SYRUP, OINTMENT, DROPS, POWDER, INJECTION, OTHER
}

data class Pharmacy(
    val id: String,
    val name: String,
    val address: String,
    val phone: String?,
    val latitude: Double?,
    val longitude: Double?,
    val distance: Float?,
    @SerializedName("is_open") val isOpen: Boolean?,
    @SerializedName("medicine_available") val medicineAvailable: Boolean?,
    val price: Float?
)

data class TimeSlot(
    val time: String,
    @SerializedName("is_available") val isAvailable: Boolean
)

data class SlotsResponse(
    val date: String,
    val slots: List<TimeSlot>
)

// ReviewRequest and EmergencyRequest live in data.remote.dto.ApiDtos.kt — single source of truth

/**
 * Backend returns:
 * { requestId, ambulance: { id, vehicleNumber, driverName, driverPhone, type, currentLocation: {lat,lng} },
 *   estimatedArrival: "12 min", distance: "3.5 km", status, message }
 * For GET /active it returns raw DB row.
 * This model handles both shapes via nullable fields + helper accessors.
 */
data class EmergencyResponse(
    // -- Fields from POST /emergency (create) response --
    val requestId: String? = null,
    val ambulance: AmbulanceInfo? = null,
    @SerializedName("estimatedArrival") val estimatedArrival: String? = null,
    val distance: String? = null,
    val status: String? = null,
    val message: String? = null,

    // -- Fields from GET /active (raw DB row) --
    val id: String? = null,
    @SerializedName("patient_id") val patientId: String? = null,
    @SerializedName("pickup_latitude") val pickupLatitude: Double? = null,
    @SerializedName("pickup_longitude") val pickupLongitude: Double? = null,
    @SerializedName("pickup_address") val pickupAddress: String? = null,
    @SerializedName("emergency_type") val emergencyType: String? = null,
    @SerializedName("vehicle_id") val vehicleId: String? = null,
    @SerializedName("created_at") val createdAt: String? = null,

    // DB row join: vehicle: { vehicle_number, driver_name, driver_phone, ... }
    val vehicle: AmbulanceVehicle? = null
) {
    /** Unified request ID from either response shape */
    fun resolvedRequestId(): String = requestId ?: id ?: ""

    /** Unified status */
    fun resolvedStatus(): String = status ?: "pending"

    /** Unified driver name from either shape */
    fun resolvedDriverName(): String? = ambulance?.driverName ?: vehicle?.driverName
    fun resolvedDriverPhone(): String? = ambulance?.driverPhone ?: vehicle?.driverPhone
    fun resolvedVehicleNumber(): String? = ambulance?.vehicleNumber ?: vehicle?.vehicleNumber
    fun resolvedLatitude(): Double? = pickupLatitude
    fun resolvedLongitude(): Double? = pickupLongitude
}

data class AmbulanceInfo(
    val id: String?,
    val vehicleNumber: String?,
    val driverName: String?,
    val driverPhone: String?,
    val type: String?,
    val currentLocation: AmbulanceLocation? = null
)

data class AmbulanceLocation(
    val latitude: Double?,
    val longitude: Double?
)

data class AmbulanceVehicle(
    @SerializedName("vehicle_number") val vehicleNumber: String?,
    @SerializedName("driver_name") val driverName: String?,
    @SerializedName("driver_phone") val driverPhone: String?,
    @SerializedName("vehicle_type") val vehicleType: String?,
    @SerializedName("current_latitude") val currentLatitude: Double?,
    @SerializedName("current_longitude") val currentLongitude: Double?
)

val ConsultationRecord.doctorEmoji: String
    get() = "🩺"

// ==================== Medicine Order Models ====================

data class CartItem(
    val medicine: Medicine,
    var quantity: Int = 1
) {
    val totalPrice: Float get() = (medicine.price ?: 0f) * quantity
}

data class MedicineOrder(
    val id: String,
    val pharmacyId: String,
    val items: List<CartItem>,
    val deliveryAddress: String,
    val status: String,
    @SerializedName("payment_status") val paymentStatus: String?,
    @SerializedName("created_at") val createdAt: String?
)

// ==================== Diagnostic Models ====================

data class DiagnosticTest(
    val id: String,
    val name: String,
    val description: String?,
    val category: String?,
    val price: Float?,
    val preparationInstructions: String?,
    val reportTime: String?
)

data class DiagnosticCenter(
    val id: String,
    val name: String,
    val address: String,
    val phone: String?,
    val latitude: Double?,
    val longitude: Double?,
    val distance: Float?,
    val rating: Float?
)

data class DiagnosticBooking(
    val id: String,
    val centerId: String?,
    val testId: String?,
    val bookingDate: String?,
    val bookingTime: String?,
    val collectionType: String?,
    val status: String?,
    val resultStatus: String?,
    val test: DiagnosticTest?,
    val center: DiagnosticCenter?
)

// ==================== Vitals Models ====================

data class Vital(
    val id: String,
    val type: String,
    val value: String,
    val unit: String?,
    val notes: String?,
    @SerializedName("recorded_at") val recordedAt: String?
)

enum class VitalType(val displayName: String, val defaultUnit: String) {
    BLOOD_PRESSURE("Blood Pressure", "mmHg"),
    HEART_RATE("Heart Rate", "bpm"),
    TEMPERATURE("Temperature", "°F"),
    BLOOD_SUGAR("Blood Sugar", "mg/dL"),
    OXYGEN_SATURATION("Oxygen Level", "%"),
    WEIGHT("Weight", "kg"),
    HEIGHT("Height", "cm");

    val apiValue: String get() = name.lowercase()
}
