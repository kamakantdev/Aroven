package com.example.swastik.data.webrtc

import android.content.Context
import android.util.Log
import org.webrtc.*
import org.webrtc.audio.AudioDeviceModule
import org.webrtc.audio.JavaAudioDeviceModule
import java.util.concurrent.CopyOnWriteArrayList

/**
 * WebRTC Manager — handles the full lifecycle of a WebRTC peer connection.
 *
 * Responsibilities:
 * - Initialize PeerConnectionFactory with hardware codecs
 * - Capture local camera and microphone
 * - Create/manage PeerConnection with ICE servers
 * - Handle offer/answer/ICE candidate exchange
 * - Provide local and remote VideoTrack for rendering
 *
 * The signaling (sending/receiving offers, answers, ICE candidates) is delegated
 * to the ViewModel layer, which uses Socket.IO via AppointmentRepository.
 */
class WebRTCManager(
    private val context: Context
) {
    companion object {
        private const val TAG = "WebRTCManager"

        /** Default STUN-only servers — used when backend ICE config is unavailable */
        private val DEFAULT_ICE_SERVERS = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )
    }

    /**
     * ICE servers to use for peer connection. Should be set from backend
     * response (e.g., GET /consultations/:id/ice-servers) before calling
     * [createPeerConnection]. Falls back to STUN-only if not set.
     */
    var iceServers: List<PeerConnection.IceServer> = DEFAULT_ICE_SERVERS

    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var localVideoTrack: VideoTrack? = null
    private var localAudioTrack: AudioTrack? = null
    private var videoCapturer: CameraVideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var isReleased = false

    // ICE candidate buffer — queue candidates received before remote description is set
    // CopyOnWriteArrayList is thread-safe since WebRTC callbacks arrive on different threads
    private val pendingIceCandidates = CopyOnWriteArrayList<IceCandidate>()
    @Volatile
    private var hasRemoteDescription = false

    val eglBase: EglBase = EglBase.create()

    // Callbacks — set by the ViewModel
    var onLocalVideoTrack: ((VideoTrack) -> Unit)? = null
    var onRemoteVideoTrack: ((VideoTrack) -> Unit)? = null
    var onIceCandidateGenerated: ((IceCandidate) -> Unit)? = null
    var onOfferCreated: ((SessionDescription) -> Unit)? = null
    var onAnswerCreated: ((SessionDescription) -> Unit)? = null
    var onConnectionStateChanged: ((PeerConnection.IceConnectionState) -> Unit)? = null
    var onRemoteStreamRemoved: (() -> Unit)? = null
    var onNetworkQualityChanged: ((NetworkQuality) -> Unit)? = null

    /** Network quality classification */
    enum class NetworkQuality { EXCELLENT, GOOD, POOR, CRITICAL }

    /** Current ICE connection state for external checks */
    val currentIceState: PeerConnection.IceConnectionState?
        get() = peerConnection?.iceConnectionState()

    /**
     * Get the underlying PeerConnection for stats polling.
     * Used by ViewModel to monitor network quality.
     */
    fun getPeerConnection(): PeerConnection? = peerConnection

    /**
     * Initialize the PeerConnectionFactory. Must be called once before anything else.
     */
    fun initialize() {
        Log.d(TAG, "Initializing PeerConnectionFactory")

        val initOptions = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(initOptions)

        val encoderFactory = DefaultVideoEncoderFactory(
            eglBase.eglBaseContext, true, true
        )
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)

        val audioDeviceModule: AudioDeviceModule = JavaAudioDeviceModule.builder(context)
            .createAudioDeviceModule()

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(audioDeviceModule)
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()

        Log.d(TAG, "PeerConnectionFactory initialized")
    }

    /**
     * Start local camera and microphone capture.
     * Returns the local VideoTrack so the UI can render it.
     */
    fun startLocalMedia(): VideoTrack? {
        val factory = peerConnectionFactory ?: run {
            Log.e(TAG, "PeerConnectionFactory not initialized")
            return null
        }

        // --- Audio ---
        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("echoCancellation", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("noiseSuppression", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("autoGainControl", "true"))
        }
        val audioSource = factory.createAudioSource(audioConstraints)
        localAudioTrack = factory.createAudioTrack("audio_local", audioSource)
        localAudioTrack?.setEnabled(true)

        // --- Video ---
        videoCapturer = createCameraCapturer()
        if (videoCapturer == null) {
            Log.e(TAG, "No camera found on device")
            return null
        }

        surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        val videoSource = factory.createVideoSource(videoCapturer!!.isScreencast)
        videoCapturer!!.initialize(surfaceTextureHelper, context, videoSource.capturerObserver)
        startCaptureWithFallback(videoCapturer!!)

        localVideoTrack = factory.createVideoTrack("video_local", videoSource)
        localVideoTrack?.setEnabled(true)

        Log.d(TAG, "Local media started")
        onLocalVideoTrack?.invoke(localVideoTrack!!)
        return localVideoTrack
    }

    /**
     * Try higher capture quality first, then gracefully fallback.
     * WebRTC then adapts bitrate dynamically based on network conditions.
     */
    private fun startCaptureWithFallback(capturer: CameraVideoCapturer) {
        val profiles = listOf(
            Triple(1280, 720, 30),
            Triple(960, 540, 24),
            Triple(640, 480, 20),
        )

        var lastError: Throwable? = null
        for ((w, h, fps) in profiles) {
            try {
                capturer.startCapture(w, h, fps)
                Log.d(TAG, "Camera capture started at ${w}x${h}@${fps}fps")
                return
            } catch (e: Exception) {
                lastError = e
                Log.w(TAG, "Capture profile failed ${w}x${h}@${fps}: ${e.message}")
            }
        }

        throw RuntimeException("Failed to start camera capture", lastError)
    }

    /**
     * Create the PeerConnection and set up observers.
     */
    fun createPeerConnection() {
        val factory = peerConnectionFactory ?: return

        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        peerConnection = factory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                Log.d(TAG, "ICE Candidate generated: ${candidate.sdpMid}")
                onIceCandidateGenerated?.invoke(candidate)
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {
                Log.d(TAG, "ICE Candidates removed")
            }

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                Log.d(TAG, "ICE Connection State: $state")
                onConnectionStateChanged?.invoke(state)
                // Auto ICE restart on failure
                if (state == PeerConnection.IceConnectionState.FAILED) {
                    Log.w(TAG, "ICE failed — attempting restart")
                    peerConnection?.restartIce()
                }
            }

            override fun onAddStream(stream: MediaStream) {
                Log.d(TAG, "Remote stream added: ${stream.videoTracks.size} video, ${stream.audioTracks.size} audio")
                if (stream.videoTracks.isNotEmpty()) {
                    onRemoteVideoTrack?.invoke(stream.videoTracks[0])
                }
            }

            override fun onRemoveStream(stream: MediaStream) {
                Log.d(TAG, "Remote stream removed")
                onRemoteStreamRemoved?.invoke()
            }

            override fun onTrack(transceiver: RtpTransceiver) {
                val track = transceiver.receiver?.track()
                if (track is VideoTrack) {
                    Log.d(TAG, "Remote VideoTrack received via onTrack")
                    onRemoteVideoTrack?.invoke(track)
                }
            }

            override fun onSignalingChange(state: PeerConnection.SignalingState) {
                Log.d(TAG, "Signaling State: $state")
            }

            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
            override fun onDataChannel(dc: DataChannel) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>) {}
            override fun onConnectionChange(state: PeerConnection.PeerConnectionState) {
                Log.d(TAG, "PeerConnection State: $state")
            }
            override fun onSelectedCandidatePairChanged(event: CandidatePairChangeEvent?) {}
            override fun onStandardizedIceConnectionChange(state: PeerConnection.IceConnectionState) {}
        }) ?: run {
            Log.e(TAG, "Failed to create PeerConnection")
            return
        }

        // Add local tracks
        localAudioTrack?.let { peerConnection?.addTrack(it, listOf("stream_local")) }
        localVideoTrack?.let { peerConnection?.addTrack(it, listOf("stream_local")) }

        Log.d(TAG, "PeerConnection created and local tracks added")
    }

    /**
     * Create an SDP offer (caller side).
     */
    fun createOffer() {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }

        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                Log.d(TAG, "Offer created")
                peerConnection?.setLocalDescription(SimpleSdpObserver("SetLocalOffer"), sdp)
                onOfferCreated?.invoke(sdp)
            }
            override fun onCreateFailure(error: String) { Log.e(TAG, "Offer creation failed: $error") }
            override fun onSetSuccess() {}
            override fun onSetFailure(error: String) {}
        }, constraints)
    }

    /**
     * Handle a remote offer (callee side) — set remote SDP and create answer.
     */
    fun handleRemoteOffer(sdp: String, type: String = "offer") {
        val sessionDescription = SessionDescription(
            SessionDescription.Type.fromCanonicalForm(type),
            sdp
        )

        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() {
                Log.d(TAG, "Remote offer set, creating answer")
                drainPendingCandidates()
                createAnswer()
            }
            override fun onSetFailure(error: String) { Log.e(TAG, "Failed to set remote offer: $error") }
            override fun onCreateSuccess(sdp: SessionDescription) {}
            override fun onCreateFailure(error: String) {}
        }, sessionDescription)
    }

    /**
     * Create an SDP answer (callee side).
     */
    private fun createAnswer() {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }

        peerConnection?.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                Log.d(TAG, "Answer created")
                peerConnection?.setLocalDescription(SimpleSdpObserver("SetLocalAnswer"), sdp)
                onAnswerCreated?.invoke(sdp)
            }
            override fun onCreateFailure(error: String) { Log.e(TAG, "Answer creation failed: $error") }
            override fun onSetSuccess() {}
            override fun onSetFailure(error: String) {}
        }, constraints)
    }

    /**
     * Handle a remote answer (caller side).
     */
    fun handleRemoteAnswer(sdp: String, type: String = "answer") {
        val sessionDescription = SessionDescription(
            SessionDescription.Type.fromCanonicalForm(type),
            sdp
        )
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() {
                Log.d(TAG, "SetRemoteAnswer: success")
                drainPendingCandidates()
            }
            override fun onSetFailure(error: String) { Log.e(TAG, "SetRemoteAnswer: set failed: $error") }
            override fun onCreateSuccess(sdp: SessionDescription) {}
            override fun onCreateFailure(error: String) {}
        }, sessionDescription)
    }

    /**
     * Add a remote ICE candidate.
     * If remote description hasn't been set yet, buffer the candidate.
     */
    fun addIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidate: String) {
        val iceCandidate = IceCandidate(sdpMid, sdpMLineIndex, candidate)
        if (hasRemoteDescription) {
            peerConnection?.addIceCandidate(iceCandidate)
        } else {
            Log.d(TAG, "Buffering ICE candidate (no remote description yet)")
            pendingIceCandidates.add(iceCandidate)
        }
    }

    /**
     * Flush buffered ICE candidates after remote description is set.
     */
    private fun drainPendingCandidates() {
        hasRemoteDescription = true
        if (pendingIceCandidates.isNotEmpty()) {
            Log.d(TAG, "Draining ${pendingIceCandidates.size} buffered ICE candidates")
            for (candidate in pendingIceCandidates) {
                peerConnection?.addIceCandidate(candidate)
            }
            pendingIceCandidates.clear()
        }
    }

    /**
     * Toggle microphone on/off.
     */
    fun setMicEnabled(enabled: Boolean) {
        localAudioTrack?.setEnabled(enabled)
    }

    /**
     * Toggle camera on/off.
     */
    fun setCameraEnabled(enabled: Boolean) {
        localVideoTrack?.setEnabled(enabled)
    }

    /**
     * Switch between front and back camera.
     */
    fun switchCamera() {
        videoCapturer?.switchCamera(null)
    }

    /**
     * Release all resources. Must be called when the call ends.
     */
    fun release() {
        if (isReleased) return
        isReleased = true
        Log.d(TAG, "Releasing WebRTC resources")
        try {
            videoCapturer?.stopCapture()
        } catch (e: InterruptedException) {
            Log.e(TAG, "Error stopping capturer", e)
        }
        videoCapturer?.dispose()
        videoCapturer = null

        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null

        localVideoTrack?.dispose()
        localVideoTrack = null

        localAudioTrack?.dispose()
        localAudioTrack = null

        // dispose() internally calls close() — calling both separately can crash
        peerConnection?.dispose()
        peerConnection = null

        peerConnectionFactory?.dispose()
        peerConnectionFactory = null

        eglBase.release()

        Log.d(TAG, "WebRTC resources released")
    }

    /**
     * Find a camera capturer (prefer front camera).
     */
    private fun createCameraCapturer(): CameraVideoCapturer? {
        val enumerator = Camera2Enumerator(context)
        val deviceNames = enumerator.deviceNames

        // Prefer front camera
        for (name in deviceNames) {
            if (enumerator.isFrontFacing(name)) {
                val capturer = enumerator.createCapturer(name, null)
                if (capturer != null) return capturer
            }
        }

        // Fall back to any camera
        for (name in deviceNames) {
            val capturer = enumerator.createCapturer(name, null)
            if (capturer != null) return capturer
        }

        return null
    }

    /**
     * Simple SdpObserver that just logs errors.
     */
    private class SimpleSdpObserver(private val tag: String) : SdpObserver {
        override fun onCreateSuccess(sdp: SessionDescription) {}
        override fun onSetSuccess() { Log.d(TAG, "$tag: success") }
        override fun onCreateFailure(error: String) { Log.e(TAG, "$tag: create failed: $error") }
        override fun onSetFailure(error: String) { Log.e(TAG, "$tag: set failed: $error") }
    }
}
