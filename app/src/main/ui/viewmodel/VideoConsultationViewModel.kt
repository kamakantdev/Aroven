package com.example.swastik.ui.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.model.*
import com.example.swastik.data.remote.SignalingEvent
import com.example.swastik.data.local.TokenManager
import com.example.swastik.data.remote.SocketManager
import com.example.swastik.data.repository.AppointmentRepository
import com.example.swastik.data.repository.PatientRepository
import com.example.swastik.data.repository.Result
import com.example.swastik.data.repository.VideoCallSession
import com.example.swastik.data.webrtc.WebRTCManager
import com.example.swastik.util.vision.ComputerVisionAnalyzer
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.coroutines.coroutineContext
import org.webrtc.EglBase
import org.webrtc.PeerConnection
import org.webrtc.VideoTrack
import javax.inject.Inject

/**
 * Consultation connection mode — degrades gracefully based on network quality.
 */
enum class ConsultationMode { VIDEO, AUDIO, CHAT }

/**
 * UI State for video consultation
 */
data class VideoConsultationUiState(
    val isConnecting: Boolean = false,
    val isConnected: Boolean = false,
    val isMicEnabled: Boolean = true,
    val isCameraEnabled: Boolean = true,
    val session: VideoCallSession? = null,
    val error: String? = null,
    val chatMessages: List<ChatMessageUi> = emptyList(),
    val callDuration: Long = 0L,
    val hasRemoteVideo: Boolean = false,
    val connectionMode: ConsultationMode = ConsultationMode.VIDEO,
    val networkQuality: WebRTCManager.NetworkQuality = WebRTCManager.NetworkQuality.GOOD,
    val modeBanner: String? = null
)

data class ChatMessageUi(
    val id: String,
    val message: String,
    val senderName: String,
    val isMe: Boolean,
    val timestamp: String
)

/**
 * ViewModel for video consultation — integrates WebRTC with Socket.IO signaling.
 *
 * Flow:
 * 1. joinConsultation() → REST API join + Socket.IO room join
 * 2. WebRTCManager initializes local media (camera + mic)
 * 3. When remote user joins (via Socket.IO), create an SDP offer
 * 4. Exchange offer/answer/ICE candidates via Socket.IO signaling
 * 5. WebRTC connection established — local & remote video streams render
 */
@HiltViewModel
class VideoConsultationViewModel @Inject constructor(
    private val appointmentRepository: AppointmentRepository,
    private val patientRepository: PatientRepository,
    private val socketManager: SocketManager,
    private val tokenManager: TokenManager,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(VideoConsultationUiState())
    val uiState: StateFlow<VideoConsultationUiState> = _uiState.asStateFlow()

    // WebRTC Manager
    private var webRTCManager: WebRTCManager? = null
    private var isWebRTCInitialized = false
    private var networkMonitorJob: kotlinx.coroutines.Job? = null
    private var cvAnalyzer: ComputerVisionAnalyzer? = null

    // Expose local and remote video tracks for the UI to render
    private val _localVideoTrack = MutableStateFlow<VideoTrack?>(null)
    val localVideoTrack: StateFlow<VideoTrack?> = _localVideoTrack.asStateFlow()

    private val _remoteVideoTrack = MutableStateFlow<VideoTrack?>(null)
    val remoteVideoTrack: StateFlow<VideoTrack?> = _remoteVideoTrack.asStateFlow()

    // EGL context for SurfaceViewRenderers
    val eglBaseContext: EglBase.Context?
        get() = webRTCManager?.eglBase?.eglBaseContext

    // Patient name from shared profile for display in prepare/completion screens
    val patientName: StateFlow<String> = patientRepository.patientProfile
        .map { it?.name ?: "Patient" }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "Patient")

    // Expose WebRTC signaling events for the UI layer
    val signalingEvents = appointmentRepository.signalingEvents
    val chatMessages = appointmentRepository.chatMessages

    init {
        // Listen for incoming chat messages
        viewModelScope.launch {
            appointmentRepository.chatMessages.collect { msg ->
                _uiState.value = _uiState.value.copy(
                    chatMessages = _uiState.value.chatMessages + ChatMessageUi(
                        id = System.currentTimeMillis().toString(),
                        message = msg.message,
                        senderName = msg.role,
                        isMe = msg.isMe,
                        timestamp = msg.timestamp
                    )
                )
            }
        }

        // Listen for WebRTC signaling events from Socket.IO
        viewModelScope.launch {
            socketManager.signalingEvents.collect { event ->
                handleSignalingEvent(event)
            }
        }
    }

    /**
     * Initialize WebRTC engine and start local media.
     */
    private fun initializeWebRTC() {
        if (isWebRTCInitialized) return
        isWebRTCInitialized = true

        webRTCManager = WebRTCManager(appContext).apply {
            cvAnalyzer = ComputerVisionAnalyzer(appContext)
            
            // Set up callbacks
            onLocalVideoTrack = { track ->
                _localVideoTrack.value = track
                cvAnalyzer?.let { track.addSink(it) } // Intercept frames for MediaPipe CV Vitals
            }
            onRemoteVideoTrack = { track ->
                _remoteVideoTrack.value = track
                _uiState.value = _uiState.value.copy(hasRemoteVideo = true)
            }
            onIceCandidateGenerated = { candidate ->
                // Send ICE candidate to remote peer via Socket.IO
                val roomId = _uiState.value.session?.sessionId
                if (roomId != null) {
                    appointmentRepository.sendIceCandidate(
                        roomId,
                        candidate.sdpMid ?: "",
                        candidate.sdpMLineIndex,
                        candidate.sdp
                    )
                }
            }
            onOfferCreated = { sdp ->
                val roomId = _uiState.value.session?.sessionId
                if (roomId != null) {
                    appointmentRepository.sendOffer(roomId, sdp.description, sdp.type.canonicalForm())
                }
            }
            onAnswerCreated = { sdp ->
                val roomId = _uiState.value.session?.sessionId
                if (roomId != null) {
                    appointmentRepository.sendAnswer(roomId, sdp.description, sdp.type.canonicalForm())
                }
            }
            onConnectionStateChanged = { state ->
                when (state) {
                    PeerConnection.IceConnectionState.CONNECTED,
                    PeerConnection.IceConnectionState.COMPLETED -> {
                        _uiState.value = _uiState.value.copy(isConnected = true, isConnecting = false)
                        startNetworkQualityMonitor()
                        startVitalsStreaming() // Launch parallel Edge CV MediaPipe processor
                    }
                    PeerConnection.IceConnectionState.DISCONNECTED -> {
                        _uiState.value = _uiState.value.copy(
                            modeBanner = "⚠️ Connection interrupted — reconnecting..."
                        )
                        viewModelScope.launch {
                            kotlinx.coroutines.delay(5000)
                            if (_uiState.value.modeBanner?.contains("reconnecting") == true) {
                                _uiState.value = _uiState.value.copy(modeBanner = null)
                            }
                        }
                    }
                    PeerConnection.IceConnectionState.FAILED -> {
                        _uiState.value = _uiState.value.copy(
                            isConnected = false,
                            hasRemoteVideo = false,
                            connectionMode = ConsultationMode.CHAT,
                            modeBanner = "❌ Connection lost — switched to Chat mode"
                        )
                        networkMonitorJob?.cancel()
                    }
                    PeerConnection.IceConnectionState.CLOSED -> {
                        _uiState.value = _uiState.value.copy(isConnected = false, hasRemoteVideo = false)
                        networkMonitorJob?.cancel()
                    }
                    else -> {}
                }
            }
            onRemoteStreamRemoved = {
                _remoteVideoTrack.value = null
                _uiState.value = _uiState.value.copy(hasRemoteVideo = false)
            }

            // Initialize and start
            initialize()
            startLocalMedia()
            createPeerConnection()
        }
    }

    /**
     * Monitor network quality every 3 seconds using ICE connection state heuristics.
     * On Android, full RTCStatsReport access varies by library version, so we also
     * use ICE connection state transitions as a quality signal.
     */
    private fun startNetworkQualityMonitor() {
        networkMonitorJob?.cancel()
        networkMonitorJob = viewModelScope.launch {
            while (true) {
                kotlinx.coroutines.delay(3000)
                val iceState = webRTCManager?.currentIceState
                val quality = when (iceState) {
                    PeerConnection.IceConnectionState.CONNECTED,
                    PeerConnection.IceConnectionState.COMPLETED -> WebRTCManager.NetworkQuality.GOOD
                    PeerConnection.IceConnectionState.CHECKING -> WebRTCManager.NetworkQuality.POOR
                    PeerConnection.IceConnectionState.DISCONNECTED -> WebRTCManager.NetworkQuality.POOR
                    PeerConnection.IceConnectionState.FAILED -> WebRTCManager.NetworkQuality.CRITICAL
                    else -> _uiState.value.networkQuality
                }
                if (quality != _uiState.value.networkQuality) {
                    _uiState.value = _uiState.value.copy(networkQuality = quality)
                    handleQualityChange(quality)
                }
            }
        }
    }

    /**
     * Auto-degrade or restore consultation mode based on network quality.
     * VIDEO → AUDIO (poor) → CHAT (critical); restores when quality improves.
     */
    private fun handleQualityChange(quality: WebRTCManager.NetworkQuality) {
        val currentMode = _uiState.value.connectionMode
        when {
            quality == WebRTCManager.NetworkQuality.CRITICAL && currentMode != ConsultationMode.CHAT -> {
                webRTCManager?.setCameraEnabled(false)
                webRTCManager?.setMicEnabled(false)
                _uiState.value = _uiState.value.copy(
                    connectionMode = ConsultationMode.CHAT,
                    isCameraEnabled = false,
                    isMicEnabled = false,
                    modeBanner = "⚠️ Very poor network — switched to Chat mode"
                )
                clearBannerAfterDelay(5000)
            }
            quality == WebRTCManager.NetworkQuality.POOR && currentMode == ConsultationMode.VIDEO -> {
                webRTCManager?.setCameraEnabled(false)
                _uiState.value = _uiState.value.copy(
                    connectionMode = ConsultationMode.AUDIO,
                    isCameraEnabled = false,
                    modeBanner = "📶 Low bandwidth — switched to Audio-only mode"
                )
                clearBannerAfterDelay(5000)
            }
            (quality == WebRTCManager.NetworkQuality.GOOD || quality == WebRTCManager.NetworkQuality.EXCELLENT) && currentMode == ConsultationMode.AUDIO -> {
                webRTCManager?.setCameraEnabled(true)
                _uiState.value = _uiState.value.copy(
                    connectionMode = ConsultationMode.VIDEO,
                    isCameraEnabled = true,
                    modeBanner = "✅ Network improved — Video restored"
                )
                clearBannerAfterDelay(3000)
            }
            (quality == WebRTCManager.NetworkQuality.GOOD || quality == WebRTCManager.NetworkQuality.EXCELLENT) && currentMode == ConsultationMode.CHAT -> {
                webRTCManager?.setCameraEnabled(true)
                webRTCManager?.setMicEnabled(true)
                _uiState.value = _uiState.value.copy(
                    connectionMode = ConsultationMode.VIDEO,
                    isCameraEnabled = true,
                    isMicEnabled = true,
                    modeBanner = "✅ Network recovered — Video restored"
                )
                clearBannerAfterDelay(3000)
            }
        }
    }

    private fun clearBannerAfterDelay(delayMs: Long) {
        viewModelScope.launch {
            kotlinx.coroutines.delay(delayMs)
            _uiState.value = _uiState.value.copy(modeBanner = null)
        }
    }

    /**
     * Manually switch consultation mode (user override).
     */
    fun switchMode(mode: ConsultationMode) {
        when (mode) {
            ConsultationMode.VIDEO -> {
                webRTCManager?.setCameraEnabled(true)
                webRTCManager?.setMicEnabled(true)
                _uiState.value = _uiState.value.copy(connectionMode = mode, isCameraEnabled = true, isMicEnabled = true)
            }
            ConsultationMode.AUDIO -> {
                webRTCManager?.setCameraEnabled(false)
                webRTCManager?.setMicEnabled(true)
                _uiState.value = _uiState.value.copy(connectionMode = mode, isCameraEnabled = false, isMicEnabled = true)
            }
            ConsultationMode.CHAT -> {
                webRTCManager?.setCameraEnabled(false)
                webRTCManager?.setMicEnabled(false)
                _uiState.value = _uiState.value.copy(connectionMode = mode, isCameraEnabled = false, isMicEnabled = false)
            }
        }
    }

    /**
     * Handle incoming signaling events from Socket.IO.
     */
    private fun handleSignalingEvent(event: SignalingEvent) {
        when (event) {
            is SignalingEvent.UserJoined -> {
                // Remote user joined — create offer to initiate connection
                webRTCManager?.createOffer()
            }
            is SignalingEvent.Offer -> {
                // Received offer — set remote description and create answer
                webRTCManager?.handleRemoteOffer(event.sdp, event.type)
            }
            is SignalingEvent.Answer -> {
                // Received answer — set remote description
                webRTCManager?.handleRemoteAnswer(event.sdp, event.type)
            }
            is SignalingEvent.IceCandidate -> {
                // Add remote ICE candidate
                webRTCManager?.addIceCandidate(event.sdpMid, event.sdpMLineIndex, event.sdp)
            }
            is SignalingEvent.UserLeft -> {
                // Remote user left — clean up
                _remoteVideoTrack.value = null
                _uiState.value = _uiState.value.copy(isConnected = false, hasRemoteVideo = false)
            }
        }
    }

    /**
     * Join a video consultation for the given appointment.
     */
    fun joinConsultation(appointmentId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isConnecting = true, error = null)

            // Initialize WebRTC before joining
            initializeWebRTC()

            when (val result = appointmentRepository.joinVideoConsultation(appointmentId)) {
                is Result.Success -> {
                    // REST join succeeded. Don't set isConnected=true yet —
                    // the WebRTC ICE callback will set it when peer-to-peer connects.
                    _uiState.value = _uiState.value.copy(
                        isConnecting = false,
                        session = result.data
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isConnecting = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    /**
     * Send a WebRTC offer SDP (legacy — now handled automatically by WebRTCManager callbacks).
     */
    fun sendOffer(sdp: String, type: String) {
        val roomId = _uiState.value.session?.sessionId ?: return
        appointmentRepository.sendOffer(roomId, sdp, type)
    }

    /**
     * Send a WebRTC answer SDP (legacy — now handled automatically by WebRTCManager callbacks).
     */
    fun sendAnswer(sdp: String, type: String) {
        val roomId = _uiState.value.session?.sessionId ?: return
        appointmentRepository.sendAnswer(roomId, sdp, type)
    }

    /**
     * Send an ICE candidate (legacy — now handled automatically by WebRTCManager callbacks).
     */
    fun sendIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidate: String) {
        val roomId = _uiState.value.session?.sessionId ?: return
        appointmentRepository.sendIceCandidate(roomId, sdpMid, sdpMLineIndex, candidate)
    }

    /**
     * Send a chat message during consultation.
     */
    fun sendChatMessage(message: String) {
        val consultationId = _uiState.value.session?.sessionId ?: return
        appointmentRepository.sendChatMessage(consultationId, message)
        // Note: The message will come back via socket echo with isMe=true,
        // so we DON'T add it locally here to avoid duplicates.
    }

    /**
     * Toggle microphone.
     */
    fun toggleMic() {
        val newState = !_uiState.value.isMicEnabled
        _uiState.value = _uiState.value.copy(isMicEnabled = newState)
        webRTCManager?.setMicEnabled(newState)
    }

    /**
     * Toggle camera.
     */
    fun toggleCamera() {
        val newState = !_uiState.value.isCameraEnabled
        _uiState.value = _uiState.value.copy(isCameraEnabled = newState)
        webRTCManager?.setCameraEnabled(newState)
    }

    /**
     * Switch between front/back camera.
     */
    fun switchCamera() {
        webRTCManager?.switchCamera()
    }

    /**
     * End the consultation call.
     * Notifies backend, leaves socket room, releases WebRTC resources.
     */
    fun endCall() {
        val session = _uiState.value.session ?: return
        val roomId = session.sessionId
        val consultationId = session.consultationId.ifEmpty { roomId }

        // 1. Notify backend that consultation has ended
        viewModelScope.launch {
            appointmentRepository.endConsultation(consultationId)
        }

        // 2. Leave socket room and release local resources
        socketManager.leaveVideoRoom(roomId)
        releaseWebRTC()
        _uiState.value = VideoConsultationUiState() // Reset state
    }

    private var vitalsStreamJob: kotlinx.coroutines.Job? = null
    private var vitalsWebSocket: okhttp3.WebSocket? = null
    private val okHttpClient = okhttp3.OkHttpClient()

    private fun startVitalsStreaming() {
        vitalsStreamJob?.cancel()
        vitalsStreamJob = viewModelScope.launch {
            val sessionId = _uiState.value.session?.sessionId ?: return@launch
            // JWT from EncryptedSharedPreferences — null in dev, added as query param in prod
            val token = tokenManager.accessToken
            // In-memory payload buffer for reconnect replay (capped at 50 entries)
            val pendingPayloads = ArrayDeque<String>()
            var reconnectAttempts = 0

            while (coroutineContext.isActive) {
                // ── Build authenticated WebSocket URL ──────────────────────
                val authSuffix = if (token != null)
                    "?token=${java.net.URLEncoder.encode(token, "UTF-8")}" else ""
                val request = okhttp3.Request.Builder()
                    .url("ws://10.0.2.2:8000/ws/vitals/$sessionId/patient$authSuffix")
                    .build()

                vitalsWebSocket = okHttpClient.newWebSocket(request, object : okhttp3.WebSocketListener() {
                    override fun onOpen(webSocket: okhttp3.WebSocket, response: okhttp3.Response) {
                        android.util.Log.d("VitalsStream", "✅ Connected to FastAPI AI Service")
                        reconnectAttempts = 0
                        // Flush buffered payloads from previous disconnection
                        while (pendingPayloads.isNotEmpty()) {
                            webSocket.send(pendingPayloads.removeFirst())
                        }
                    }
                    override fun onMessage(webSocket: okhttp3.WebSocket, text: String) {
                        // Respond to server keepalive pings with pong
                        try {
                            val msg = org.json.JSONObject(text)
                            if (msg.optString("type") == "ping") {
                                webSocket.send(
                                    org.json.JSONObject()
                                        .put("type", "pong")
                                        .put("ts", msg.optDouble("ts"))
                                        .toString()
                                )
                            }
                        } catch (_: Exception) {}
                    }
                    override fun onFailure(webSocket: okhttp3.WebSocket, t: Throwable, response: okhttp3.Response?) {
                        android.util.Log.e("VitalsStream", "Vitals WS failure: ${t.message}")
                        vitalsWebSocket = null
                    }
                    override fun onClosed(webSocket: okhttp3.WebSocket, code: Int, reason: String) {
                        android.util.Log.d("VitalsStream", "Vitals WS closed: $code $reason")
                        vitalsWebSocket = null
                    }
                })

                // Allow brief time for OkHttp to open the connection before ticking
                kotlinx.coroutines.delay(600)

                // ── CV tick loop at 1.5 Hz while WebSocket is alive ────────
                while (coroutineContext.isActive) {
                    kotlinx.coroutines.delay(1500) // 1.5 Hz — 666ms per frame, low-bandwidth
                    if (!_uiState.value.isConnected) continue
                    
                    val cvMetrics = cvAnalyzer?.vitalsData?.value ?: ComputerVisionAnalyzer.CVMetrics()

                    val payload = org.json.JSONObject().apply {
                        put("session_id", sessionId)
                        put("heart_rate", cvMetrics.heartRate)
                        put("respiration_rate", cvMetrics.respirationRate)
                        put("posture", cvMetrics.posture)
                        put("spine_angle", cvMetrics.spineAngle)
                        put("fall_detected", false)
                        put("drowsiness_score", cvMetrics.drowsinessScore)
                        put("facial_asymmetry_score", cvMetrics.facialAsymmetryScore)
                        put("tremor_severity", cvMetrics.tremorSeverity)
                        put("tremor_frequency", cvMetrics.tremorFrequency)
                        put("spo2", cvMetrics.spo2)
                    }.toString()

                    val ws = vitalsWebSocket
                    if (ws != null) {
                        ws.send(payload)
                    } else {
                        // WebSocket dropped — buffer payload and break to reconnect
                        if (pendingPayloads.size < 50) pendingPayloads.addLast(payload)
                        break
                    }
                }

                if (!coroutineContext.isActive) break

                // ── Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s cap
                val backoffMs = minOf(1000L * (1L shl reconnectAttempts.coerceAtMost(5)), 30_000L)
                reconnectAttempts++
                android.util.Log.d("VitalsStream", "⏳ Reconnecting in ${backoffMs}ms (attempt #$reconnectAttempts)")
                kotlinx.coroutines.delay(backoffMs)
            }
        }
    }

    private fun releaseWebRTC() {
        networkMonitorJob?.cancel()
        networkMonitorJob = null
        vitalsStreamJob?.cancel()
        vitalsStreamJob = null
        vitalsWebSocket?.close(1000, "Consultation Ended")
        vitalsWebSocket = null
        _localVideoTrack.value = null
        _remoteVideoTrack.value = null
        cvAnalyzer?.release()
        cvAnalyzer = null
        webRTCManager?.release()
        webRTCManager = null
        isWebRTCInitialized = false
    }

    override fun onCleared() {
        super.onCleared()
        val roomId = _uiState.value.session?.sessionId
        if (roomId != null && _uiState.value.isConnected) {
            socketManager.leaveVideoRoom(roomId)
        }
        releaseWebRTC()
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
