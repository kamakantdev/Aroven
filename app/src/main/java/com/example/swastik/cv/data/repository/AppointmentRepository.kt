package com.example.swastik.data.repository

import com.example.swastik.data.model.*
import com.example.swastik.data.remote.dto.*
import com.example.swastik.data.remote.ApiService
import com.example.swastik.data.remote.SocketManager
import com.example.swastik.data.local.db.AppointmentDao
import com.example.swastik.data.local.db.CachedAppointment
import com.example.swastik.data.local.db.PendingSyncAction
import com.example.swastik.data.local.db.SyncQueueDao
import com.example.swastik.utils.NetworkObserver
import android.util.Log
import com.google.gson.Gson
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Appointment Repository - handles appointment operations with Room caching
 * and offline write queue.
 * - getAppointments: network-first with cache fallback on network failure
 * - Write operations: network first, queue to SyncQueue on network failure
 */
@Singleton
class AppointmentRepository @Inject constructor(
    private val apiService: ApiService,
    private val socketManager: SocketManager,
    private val appointmentDao: AppointmentDao,
    private val syncQueueDao: SyncQueueDao,
    private val networkObserver: NetworkObserver
) {
    
    companion object {
        private const val TAG = "AppointmentRepository"
    }

    private val gson = Gson()
    
    /**
     * Get all appointments with optional filters.
     * Network-first: fetch from API, cache locally, fallback to cache on failure.
     */
    suspend fun getAppointments(
        status: String? = null,
        upcoming: Boolean? = null
    ): Result<List<Appointment>> {
        // Try network first
        try {
            val queryStatus = status
            val response = apiService.getPatientAppointments(status = queryStatus)
            
            if (response.isSuccessful && response.body()?.success == true) {
                val appointments = response.body()?.data ?: emptyList()
                // Cache appointments
                try {
                    val cached = appointments.map { it.toCachedAppointment() }
                    appointmentDao.clearAll()
                    appointmentDao.insertAppointments(cached)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to cache appointments: ${e.message}")
                }
                return Result.Success(appointments)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Network error, falling back to cache: ${e.message}")
        }

        // Fallback to cache
        return try {
            val cached = if (upcoming == true) {
                appointmentDao.getUpcomingAppointmentsSync()
            } else {
                appointmentDao.getAllAppointmentsSync()
            }
            if (cached.isNotEmpty()) {
                val appointments = cached
                    .let { list -> if (status != null) list.filter { it.status == status } else list }
                    .map { it.toDomainAppointment() }
                Result.Success(appointments)
            } else {
                Result.Error("No internet connection and no cached appointments")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Cache fallback also failed: ${e.message}")
            Result.Error("Failed to load appointments")
        }
    }
    
    /**
     * Get time slots for a doctor
     */
    suspend fun getDoctorTimeSlots(doctorId: String, date: String): Result<List<TimeSlot>> {
        return try {
            val response = apiService.getDoctorSlots(doctorId, date)
            if (response.isSuccessful && response.body()?.success == true) {
                val slots = response.body()?.data?.slots ?: emptyList()
                Result.Success(slots)
            } else {
                Result.Error(response.body()?.message ?: "Failed to load time slots")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Create a new appointment — queues offline if no network.
     */
    suspend fun createAppointment(
        doctorId: String, 
        date: String, 
        timeSlot: String, 
        type: String, 
        notes: String?,
        hospitalId: String?,
        clinicId: String?
    ): Result<Appointment> {
        val request = CreateAppointmentRequest(
            doctorId = doctorId,
            date = date,
            timeSlot = timeSlot,
            type = type,
            notes = notes,
            hospitalId = hospitalId,
            clinicId = clinicId
        )

        // If no network, queue for later sync
        if (!networkObserver.isConnected) {
            return try {
                syncQueueDao.enqueue(
                    PendingSyncAction(
                        actionType = "book_appointment",
                        payload = gson.toJson(request)
                    )
                )
                Log.d(TAG, "Appointment queued for offline sync")
                Result.Error("No internet — appointment will be booked when you're back online")
            } catch (e: Exception) {
                Result.Error("Failed to queue appointment: ${e.message}")
            }
        }

        return try {
            val response = apiService.bookAppointment(request)
            if (response.isSuccessful && response.body()?.success == true) {
                val appointment = response.body()?.data
                if (appointment != null) {
                    // Invalidate cache so next fetch gets fresh data
                    try { appointmentDao.clearAll() } catch (_: Exception) {}
                    Result.Success(appointment)
                } else {
                    Result.Error("Failed to parse appointment data")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to book appointment")
            }
        } catch (e: Exception) {
            // Network error during call — queue for sync
            try {
                syncQueueDao.enqueue(
                    PendingSyncAction(
                        actionType = "book_appointment",
                        payload = gson.toJson(request)
                    )
                )
                Result.Error("Connection lost — appointment will be booked when you're back online")
            } catch (qe: Exception) {
                Result.Error(e.message ?: "Network error")
            }
        }
    }

    /**
     * Cancel an appointment — queues offline if no network.
     */
    suspend fun cancelAppointment(appointmentId: String, reason: String?): Result<Appointment> {
        val cancelReason = reason ?: "Cancelled by user"

        // If no network, queue for later sync
        if (!networkObserver.isConnected) {
            return try {
                val payload = gson.toJson(mapOf("appointmentId" to appointmentId, "reason" to cancelReason))
                syncQueueDao.enqueue(
                    PendingSyncAction(
                        actionType = "cancel_appointment",
                        payload = payload
                    )
                )
                Log.d(TAG, "Cancellation queued for offline sync")
                Result.Error("No internet — cancellation will be processed when you're back online")
            } catch (e: Exception) {
                Result.Error("Failed to queue cancellation: ${e.message}")
            }
        }

        return try {
            val request = CancelRequest(reason = cancelReason)
            val response = apiService.cancelAppointment(appointmentId, request)
            if (response.isSuccessful && response.body()?.success == true) {
                 val appointment = response.body()?.data
                if (appointment != null) {
                    try { appointmentDao.clearAll() } catch (_: Exception) {}
                    Result.Success(appointment)
                } else {
                    Result.Error("Failed to parse appointment data")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to cancel appointment")
            }
        } catch (e: Exception) {
            // Network error — queue for sync
            try {
                val payload = gson.toJson(mapOf("appointmentId" to appointmentId, "reason" to cancelReason))
                syncQueueDao.enqueue(
                    PendingSyncAction(actionType = "cancel_appointment", payload = payload)
                )
                Result.Error("Connection lost — cancellation will be processed when you're back online")
            } catch (qe: Exception) {
                Result.Error(e.message ?: "Network error")
            }
        }
    }

    /**
     * Reschedule an appointment — queues offline if no network.
     */
    suspend fun rescheduleAppointment(
        appointmentId: String,
        date: String,
        timeSlot: String,
        reason: String? = null
    ): Result<Appointment> {
        // If no network, queue for later sync
        if (!networkObserver.isConnected) {
            return try {
                val payload = gson.toJson(
                    mapOf(
                        "appointmentId" to appointmentId,
                        "date" to date,
                        "timeSlot" to timeSlot,
                        "reason" to (reason ?: "")
                    )
                )
                syncQueueDao.enqueue(
                    PendingSyncAction(actionType = "reschedule_appointment", payload = payload)
                )
                Log.d(TAG, "Reschedule queued for offline sync")
                Result.Error("No internet — reschedule will be processed when you're back online")
            } catch (e: Exception) {
                Result.Error("Failed to queue reschedule: ${e.message}")
            }
        }

        return try {
            val request = RescheduleRequest(date = date, timeSlot = timeSlot, reason = reason)
            val response = apiService.rescheduleAppointment(appointmentId, request)
            if (response.isSuccessful && response.body()?.success == true) {
                val appointment = response.body()?.data
                if (appointment != null) {
                    try { appointmentDao.clearAll() } catch (_: Exception) {}
                    Result.Success(appointment)
                } else {
                    Result.Error("Failed to parse appointment data")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to reschedule appointment")
            }
        } catch (e: Exception) {
            // Network error — queue for sync
            try {
                val payload = gson.toJson(
                    mapOf("appointmentId" to appointmentId, "date" to date, "timeSlot" to timeSlot, "reason" to (reason ?: ""))
                )
                syncQueueDao.enqueue(
                    PendingSyncAction(actionType = "reschedule_appointment", payload = payload)
                )
                Result.Error("Connection lost — reschedule will be processed when you're back online")
            } catch (qe: Exception) {
                Result.Error(e.message ?: "Network error")
            }
        }
    }

    /**
     * Get single appointment details
     * GET /api/appointments/:id
     */
    suspend fun getAppointmentDetails(appointmentId: String): Result<Appointment> {
        return try {
            val response = apiService.getAppointmentDetails(appointmentId)
            if (response.isSuccessful && response.body()?.success == true) {
                val appointment = response.body()?.data
                if (appointment != null) {
                    Result.Success(appointment)
                } else {
                    Result.Error("Appointment not found")
                }
            } else {
                Result.Error(response.body()?.message ?: "Failed to load appointment")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Join a video consultation
     * Returns a token or room ID for the video call
     */
    // Expose flows
    val signalingEvents = socketManager.signalingEvents
    val chatMessages = socketManager.chatMessages

    fun sendOffer(roomId: String, sdp: String, type: String) = socketManager.sendOffer(roomId, sdp, type)
    fun sendAnswer(roomId: String, sdp: String, type: String) = socketManager.sendAnswer(roomId, sdp, type)
    fun sendIceCandidate(roomId: String, sdpMid: String, sdpMLineIndex: Int, candidate: String) = socketManager.sendIceCandidate(roomId, sdpMid, sdpMLineIndex, candidate)
    fun sendChatMessage(consultationId: String, message: String) = socketManager.sendChatMessage(consultationId, message)
    fun joinChat(consultationId: String) = socketManager.joinChat(consultationId)

    /**
     * Join a video consultation
     * 1. Calls backend POST /consultations/:appointmentId/join to register participation
     * 2. Connects socket and joins the video/chat rooms
     * Returns the consultation session info
     */
    suspend fun joinVideoConsultation(appointmentId: String): Result<VideoCallSession> {
        return try {
            // 1. Call the backend REST API to formally join the consultation
            val joinResponse = apiService.joinConsultation(appointmentId)
            val consultationId: String

            if (joinResponse.isSuccessful && joinResponse.body()?.success == true) {
                val consultation = joinResponse.body()?.data
                consultationId = consultation?.id ?: appointmentId
                Log.d(TAG, "Joined consultation: $consultationId")
            } else {
                // Join failed — don't silently fall back, surface the error
                val errorMsg = joinResponse.body()?.message ?: "Consultation hasn't started yet. Please wait for the doctor."
                Log.w(TAG, "Backend join failed: $errorMsg")
                return Result.Error(errorMsg)
            }

            // 2. Ensure socket is connected
            socketManager.connect()
            
            // Wait for connection (up to 5 seconds)
            if (socketManager.getSocket()?.connected() != true) {
                try {
                    kotlinx.coroutines.withTimeout(5000) {
                        socketManager.connectionState.first { connected -> connected }
                    }
                } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
                    Log.w(TAG, "Socket connection timed out, proceeding anyway")
                    // Proceed — the REST join already succeeded, socket is best-effort
                }
            }
            
            // 3. Join video and chat socket rooms
            // Use raw consultationId as roomId — must match web client which uses consultationId directly
            val roomId = consultationId
            socketManager.joinVideoRoom(roomId)
            socketManager.joinChat(roomId)
            
            Result.Success(
                VideoCallSession(
                    sessionId = roomId,
                    token = roomId,
                    roomName = "Consultation Room",
                    consultationId = consultationId
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to join video call: ${e.message}")
            Result.Error(e.message ?: "Failed to join video call")
        }
    }

    /**
     * End/Leave a video consultation.
     * Patients call POST /consultations/:id/leave (signal they left the call).
     * Doctors call PUT /consultations/:id/end (terminates the consultation).
     * Since this is a patient app, we call the leave endpoint.
     */
    suspend fun endConsultation(consultationId: String): Result<Unit> {
        return try {
            val response = apiService.leaveConsultation(consultationId)
            if (response.isSuccessful && response.body()?.success == true) {
                Log.d(TAG, "Left consultation on server: $consultationId")
                Result.Success(Unit)
            } else {
                Log.w(TAG, "Failed to leave consultation on server: ${response.body()?.message}")
                Result.Success(Unit) // Still succeed locally even if backend fails
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error leaving consultation: ${e.message}")
            Result.Success(Unit) // Don't block user from leaving call
        }
    }

    /**
     * Get full consultation details by ID.
     * GET /api/consultations/:id
     */
    suspend fun getConsultationDetails(consultationId: String): Result<com.example.swastik.data.remote.dto.ConsultationDto> {
        return try {
            val response = apiService.getConsultationDetails(consultationId)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let { Result.Success(it) }
                    ?: Result.Error("Consultation not found")
            } else {
                Result.Error(response.body()?.message ?: "Failed to load consultation details")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    // ==================== Cache Mapping Extensions ====================

    private fun Appointment.toCachedAppointment() = CachedAppointment(
        id = id,
        doctorId = doctorId,
        doctorName = doctor?.name,
        doctorSpecialization = doctor?.specialization,
        date = date,
        timeSlot = timeSlot,
        type = type,
        status = status,
        notes = notes
    )

    private fun CachedAppointment.toDomainAppointment() = Appointment(
        id = id,
        appointmentNumber = null,
        patientId = "",
        doctorId = doctorId,
        date = date,
        timeSlot = timeSlot,
        type = type,
        status = status,
        reason = null,
        notes = notes,
        consultationFee = null,
        cancellationReason = null,
        doctor = if (doctorName != null) Doctor(
            id = doctorId,
            name = doctorName,
            specialization = doctorSpecialization ?: "",
            profileImageUrl = null,
            experienceYears = null,
            qualification = null,
            consultationFee = null,
            videoConsultationFee = null,
            averageRating = null,
            totalReviews = null,
            isAvailable = true
        ) else null,
        patient = null
    )
}

// Domain Helper Models
data class VideoCallSession(
    val sessionId: String,
    val token: String,
    val roomName: String,
    val consultationId: String = ""
)
