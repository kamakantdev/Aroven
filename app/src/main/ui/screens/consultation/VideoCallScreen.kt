package com.example.swastik.ui.screens.consultation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.ui.viewmodel.ConsultationMode
import com.example.swastik.ui.viewmodel.ChatMessageUi
import org.webrtc.EglBase
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

@Composable
fun VideoCallScreen(
    doctorName: String = "Doctor",
    connectionStatus: String = "Connecting...",
    isMicMuted: Boolean = false,
    isCameraOff: Boolean = false,
    localVideoTrack: VideoTrack? = null,
    remoteVideoTrack: VideoTrack? = null,
    eglBaseContext: EglBase.Context? = null,
    hasRemoteVideo: Boolean = false,
    connectionMode: ConsultationMode = ConsultationMode.VIDEO,
    modeBanner: String? = null,
    chatMessages: List<ChatMessageUi> = emptyList(),
    onBackClick: () -> Unit,
    onEndCall: () -> Unit,
    onMicToggle: () -> Unit = {},
    onCameraFlip: () -> Unit = {},
    onSpeakerToggle: () -> Unit = {},
    onSendChatMessage: (String) -> Unit = {},
    onSwitchMode: (ConsultationMode) -> Unit = {}
) {
    var isSpeakerOn by remember { mutableStateOf(true) }
    var chatInput by remember { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize()) {
        when (connectionMode) {
            ConsultationMode.CHAT -> {
                // ── Full-screen Chat Mode ──────────────────────────
                ChatModeScreen(
                    doctorName = doctorName,
                    chatMessages = chatMessages,
                    chatInput = chatInput,
                    onChatInputChange = { chatInput = it },
                    onSendMessage = {
                        if (chatInput.isNotBlank()) {
                            onSendChatMessage(chatInput.trim())
                            chatInput = ""
                        }
                    },
                    onEndCall = onEndCall,
                    onBackClick = onBackClick,
                    modeBanner = modeBanner
                )
            }
            ConsultationMode.AUDIO -> {
                // ── Audio-only Mode ────────────────────────────────
                AudioModeScreen(
                    doctorName = doctorName,
                    connectionStatus = connectionStatus,
                    isMicMuted = isMicMuted,
                    modeBanner = modeBanner,
                    onBackClick = onBackClick,
                    onEndCall = onEndCall,
                    onMicToggle = onMicToggle,
                    onSpeakerToggle = {
                        isSpeakerOn = !isSpeakerOn
                        onSpeakerToggle()
                    },
                    isSpeakerOn = isSpeakerOn
                )
            }
            ConsultationMode.VIDEO -> {
        // Remote Video (Full Screen Background)
        if (hasRemoteVideo && remoteVideoTrack != null && eglBaseContext != null) {
            WebRTCVideoView(
                videoTrack = remoteVideoTrack,
                eglContext = eglBaseContext,
                mirror = false,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            // Placeholder when no remote video
            DoctorVideoPlaceholder(
                doctorName = doctorName,
                status = connectionStatus,
                modifier = Modifier.fillMaxSize()
            )
        }

        // Back Button
        IconButton(
            onClick = onBackClick,
            modifier = Modifier
                .padding(16.dp)
                .padding(top = 24.dp)
                .align(Alignment.TopStart)
        ) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = Color.White,
                modifier = Modifier.size(28.dp)
            )
        }

        // Connection status overlay
        if (!hasRemoteVideo) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 80.dp)
                    .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text(
                    text = connectionStatus,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        // Self Video Thumbnail (Bottom Left) — actual camera feed
        if (!isCameraOff && localVideoTrack != null && eglBaseContext != null) {
            Box(
                modifier = Modifier
                    .padding(start = 16.dp, bottom = 180.dp)
                    .align(Alignment.BottomStart)
                    .size(100.dp, 140.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .border(3.dp, Color.White, RoundedCornerShape(12.dp))
            ) {
                WebRTCVideoView(
                    videoTrack = localVideoTrack,
                    eglContext = eglBaseContext,
                    mirror = true, // Front camera is mirrored
                    modifier = Modifier.fillMaxSize()
                )
            }
        } else {
            SelfVideoPlaceholder(
                isCameraOff = isCameraOff,
                modifier = Modifier
                    .padding(start = 16.dp, bottom = 180.dp)
                    .align(Alignment.BottomStart)
            )
        }

        // Bottom Control Bar
        VideoCallControls(
            isMicMuted = isMicMuted,
            isSpeakerOn = isSpeakerOn,
            onMicToggle = onMicToggle,
            onEndCall = onEndCall,
            onCameraFlip = onCameraFlip,
            onSpeakerToggle = {
                isSpeakerOn = !isSpeakerOn
                onSpeakerToggle()
            },
            modifier = Modifier.align(Alignment.BottomCenter)
        )

        // Mode transition banner for video mode
        if (modeBanner != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 80.dp)
                    .background(Color(0xFFFFC107).copy(alpha = 0.9f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text(text = modeBanner, color = Color.Black, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            }
        }
            } // end VIDEO
        } // end when
    }
}

/**
 * Composable wrapper around WebRTC's SurfaceViewRenderer.
 * Renders a live VideoTrack using the GPU via EGL.
 */
@Composable
fun WebRTCVideoView(
    videoTrack: VideoTrack,
    eglContext: EglBase.Context,
    modifier: Modifier = Modifier,
    mirror: Boolean = false
) {
    val context = LocalContext.current

    AndroidView(
        factory = {
            SurfaceViewRenderer(context).apply {
                init(eglContext, null)
                setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                setMirror(mirror)
                setEnableHardwareScaler(true)
                videoTrack.addSink(this)
            }
        },
        update = { renderer ->
            renderer.setMirror(mirror)
        },
        onRelease = { renderer ->
            try {
                videoTrack.removeSink(renderer)
            } catch (_: Exception) { }
            renderer.release()
        },
        modifier = modifier
    )
}

/**
 * Audio-only mode — shows an avatar with pulsing animation + audio controls.
 */
@Composable
private fun AudioModeScreen(
    doctorName: String,
    connectionStatus: String,
    isMicMuted: Boolean,
    isSpeakerOn: Boolean,
    modeBanner: String?,
    onBackClick: () -> Unit,
    onEndCall: () -> Unit,
    onMicToggle: () -> Unit,
    onSpeakerToggle: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF1A1A2E)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (modeBanner != null) {
                Box(
                    modifier = Modifier
                        .background(Color(0xFFFFC107).copy(alpha = 0.9f), RoundedCornerShape(20.dp))
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text(text = modeBanner, color = Color.Black, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF00897B)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(60.dp), tint = Color.White)
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(doctorName, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Text("Audio Consultation", fontSize = 14.sp, color = Color(0xFF4CAF50))
            Spacer(modifier = Modifier.height(8.dp))
            Text("Low bandwidth — video disabled", fontSize = 12.sp, color = Color.White.copy(alpha = 0.5f))
            Spacer(modifier = Modifier.height(40.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                ControlButton(icon = if (isMicMuted) Icons.Default.MicOff else Icons.Default.Mic, contentDescription = "Mic", onClick = onMicToggle, isActive = !isMicMuted)
                FloatingActionButton(onClick = onEndCall, containerColor = Color(0xFFE57373), shape = CircleShape) {
                    Icon(Icons.Default.CallEnd, contentDescription = "End Call", tint = Color.White, modifier = Modifier.size(28.dp))
                }
                ControlButton(
                    icon = if (isSpeakerOn) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff,
                    contentDescription = "Speaker", onClick = onSpeakerToggle, isActive = isSpeakerOn
                )
            }
        }
        IconButton(onClick = onBackClick, modifier = Modifier.padding(16.dp).padding(top = 24.dp).align(Alignment.TopStart)) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White, modifier = Modifier.size(28.dp))
        }
    }
}

/**
 * Chat-only mode — full-screen chat when network is too poor for audio/video.
 */
@Composable
private fun ChatModeScreen(
    doctorName: String,
    chatMessages: List<ChatMessageUi>,
    chatInput: String,
    onChatInputChange: (String) -> Unit,
    onSendMessage: () -> Unit,
    onEndCall: () -> Unit,
    onBackClick: () -> Unit,
    modeBanner: String?
) {
    Column(modifier = Modifier.fillMaxSize().background(Color(0xFF1A1A2E))) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().background(Color(0xFF16213E)).padding(horizontal = 16.dp, vertical = 12.dp).padding(top = 24.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBackClick) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(doctorName, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 16.sp)
                Text("Chat Consultation • Poor network", fontSize = 12.sp, color = Color(0xFF64B5F6))
            }
            FloatingActionButton(onClick = onEndCall, containerColor = Color(0xFFE57373), shape = CircleShape, modifier = Modifier.size(40.dp)) {
                Icon(Icons.Default.CallEnd, contentDescription = "End", tint = Color.White, modifier = Modifier.size(20.dp))
            }
        }

        if (modeBanner != null) {
            Box(modifier = Modifier.fillMaxWidth().background(Color(0xFFFFC107).copy(alpha = 0.9f)).padding(8.dp)) {
                Text(text = modeBanner, color = Color.Black, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.align(Alignment.Center))
            }
        }

        // Messages
        Column(
            modifier = Modifier.weight(1f).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.Bottom
        ) {
            if (chatMessages.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text("Send a message to continue", color = Color.White.copy(alpha = 0.4f), fontSize = 14.sp)
                }
            }
            chatMessages.forEach { msg ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .align(if (msg.isMe) Alignment.CenterEnd else Alignment.CenterStart)
                            .background(
                                if (msg.isMe) Color(0xFF3F51B5) else Color(0xFF2D2D44),
                                RoundedCornerShape(16.dp)
                            )
                            .padding(horizontal = 14.dp, vertical = 10.dp)
                    ) {
                        Column {
                            Text(msg.message, color = Color.White, fontSize = 14.sp)
                            Text(msg.timestamp, color = Color.White.copy(alpha = 0.5f), fontSize = 10.sp)
                        }
                    }
                }
            }
        }

        // Input
        Row(
            modifier = Modifier.fillMaxWidth().background(Color(0xFF16213E)).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = chatInput,
                onValueChange = onChatInputChange,
                placeholder = { Text("Type a message...", color = Color.White.copy(alpha = 0.4f)) },
                modifier = Modifier.weight(1f),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF3F51B5),
                    unfocusedBorderColor = Color(0xFF2D2D44),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    cursorColor = Color.White
                ),
                shape = RoundedCornerShape(24.dp),
                singleLine = true
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(onClick = onSendMessage, modifier = Modifier.size(48.dp).background(Color(0xFF3F51B5), CircleShape)) {
                Icon(Icons.Default.Send, contentDescription = "Send", tint = Color.White, modifier = Modifier.size(24.dp))
            }
        }
    }
}

/**
 * Placeholder shown when the remote doctor hasn't connected yet.
 */
@Composable
private fun DoctorVideoPlaceholder(doctorName: String, status: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.background(Color(0xFF1A1A2E)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF16213E)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(80.dp),
                    tint = Color.White.copy(alpha = 0.7f)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                doctorName,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                status,
                fontSize = 14.sp,
                color = when {
                    status.contains("Connected") -> Color(0xFF4CAF50)
                    status.contains("Waiting") -> Color(0xFFFFC107)
                    else -> Color.White.copy(alpha = 0.6f)
                },
                fontWeight = if (status.contains("Connected")) FontWeight.Bold else FontWeight.Normal
            )
        }
    }
}

/**
 * Placeholder for self-video when camera is off or not yet started.
 */
@Composable
private fun SelfVideoPlaceholder(isCameraOff: Boolean, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(100.dp, 140.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF2D2D44))
            .border(3.dp, Color.White, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                if (isCameraOff) Icons.Default.VideocamOff else Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier.size(40.dp),
                tint = Color.White.copy(alpha = 0.7f)
            )
            Text(
                if (isCameraOff) "Camera Off" else "You",
                fontSize = 12.sp,
                color = Color.White.copy(alpha = 0.7f),
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun VideoCallControls(
    isMicMuted: Boolean,
    isSpeakerOn: Boolean,
    onMicToggle: () -> Unit,
    onEndCall: () -> Unit,
    onCameraFlip: () -> Unit,
    onSpeakerToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // End Call Button (Floating above control bar)
        FloatingActionButton(
            onClick = onEndCall,
            modifier = Modifier
                .size(64.dp)
                .offset(y = 32.dp),
            containerColor = Color(0xFFE57373),
            shape = CircleShape,
            elevation = FloatingActionButtonDefaults.elevation(8.dp)
        ) {
            Icon(
                Icons.Default.CallEnd,
                contentDescription = "End Call",
                tint = Color.White,
                modifier = Modifier.size(32.dp)
            )
        }

        // Control Bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp)
                .background(SwastikPurple)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 40.dp)
                    .padding(top = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Mic Button
                ControlButton(
                    icon = if (isMicMuted) Icons.Default.MicOff else Icons.Default.Mic,
                    contentDescription = if (isMicMuted) "Unmute" else "Mute",
                    onClick = onMicToggle,
                    isActive = !isMicMuted
                )

                Spacer(modifier = Modifier.width(80.dp))

                // Camera Flip Button
                ControlButton(
                    icon = Icons.Default.Cameraswitch,
                    contentDescription = "Flip Camera",
                    onClick = onCameraFlip
                )
            }

            // Speaker Control (Bottom Center)
            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                IconButton(onClick = onSpeakerToggle) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            if (isSpeakerOn) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            if (isSpeakerOn) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff,
                            contentDescription = "Speaker",
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ControlButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    isActive: Boolean = true
) {
    IconButton(
        onClick = onClick,
        modifier = Modifier
            .size(56.dp)
            .background(
                Color.White.copy(alpha = if (isActive) 0.2f else 0.4f),
                CircleShape
            )
    ) {
        Icon(
            icon,
            contentDescription = contentDescription,
            tint = Color.White,
            modifier = Modifier.size(28.dp)
        )
    }
}
