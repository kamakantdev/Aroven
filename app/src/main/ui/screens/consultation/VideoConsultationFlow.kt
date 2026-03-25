package com.example.swastik.ui.screens.consultation

import androidx.compose.runtime.*
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.ui.viewmodel.VideoConsultationViewModel

/**
 * Main Video Consultation Flow
 * Handles navigation between:
 * 1. ConsultationPrepareScreen - Welcome screen before starting
 * 2. VideoCallScreen - Active video call with doctor (real WebRTC)
 * 3. ConsultationCompletionDialog - Success dialog after call ends
 */
@Composable
fun VideoConsultationFlow(
    appointmentId: String = "",
    doctorName: String = "Doctor",
    onBackClick: () -> Unit,
    onConsultationComplete: () -> Unit,
    viewModel: VideoConsultationViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val localVideoTrack by viewModel.localVideoTrack.collectAsState()
    val remoteVideoTrack by viewModel.remoteVideoTrack.collectAsState()
    var showCompletionDialog by remember { mutableStateOf(false) }
    var hasBeenConnected by remember { mutableStateOf(false) }

    // Get patient name from shared repository
    val patientName = viewModel.patientName.collectAsState().value

    // EGL context for video renderers
    val eglBaseContext = viewModel.eglBaseContext

    // Track when user was connected
    LaunchedEffect(uiState.isConnected) {
        if (uiState.isConnected) {
            hasBeenConnected = true
        }
    }

    // If was connected and now disconnected, show completion
    LaunchedEffect(uiState.isConnected, hasBeenConnected) {
        if (hasBeenConnected && !uiState.isConnected && !uiState.isConnecting) {
            showCompletionDialog = true
        }
    }

    // Connection status message
    val statusMessage = when {
        uiState.isConnecting -> "Connecting..."
        uiState.isConnected && uiState.hasRemoteVideo -> "Connected"
        uiState.isConnected -> "Waiting for doctor..."
        uiState.error != null -> uiState.error ?: "Error"
        else -> "Ready"
    }

    // Determine current screen — show video/audio/chat based on connectionMode
    if (uiState.isConnected || uiState.connectionMode == com.example.swastik.ui.viewmodel.ConsultationMode.CHAT) {
        VideoCallScreen(
            doctorName = doctorName,
            connectionStatus = statusMessage,
            isMicMuted = !uiState.isMicEnabled,
            isCameraOff = !uiState.isCameraEnabled,
            localVideoTrack = localVideoTrack,
            remoteVideoTrack = remoteVideoTrack,
            eglBaseContext = eglBaseContext,
            hasRemoteVideo = uiState.hasRemoteVideo,
            connectionMode = uiState.connectionMode,
            modeBanner = uiState.modeBanner,
            chatMessages = uiState.chatMessages,
            onBackClick = {
                viewModel.endCall()
                onBackClick()
            },
            onEndCall = {
                viewModel.endCall()
            },
            onMicToggle = { viewModel.toggleMic() },
            onCameraFlip = { viewModel.switchCamera() },
            onSpeakerToggle = { /* Speaker toggle handled by AudioManager if needed */ },
            onSendChatMessage = { viewModel.sendChatMessage(it) },
            onSwitchMode = { viewModel.switchMode(it) }
        )
    } else {
        ConsultationPrepareScreen(
            userName = patientName,
            doctorName = doctorName,
            isConnecting = uiState.isConnecting,
            statusMessage = statusMessage,
            onBackClick = onBackClick,
            onStartConsultation = {
                viewModel.joinConsultation(appointmentId)
            }
        )
    }

    if (showCompletionDialog) {
        ConsultationCompletionDialog(
            userName = patientName,
            onDismiss = {
                showCompletionDialog = false
                onConsultationComplete()
            }
        )
    }
}
