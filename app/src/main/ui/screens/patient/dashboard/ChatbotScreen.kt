package com.example.swastik.ui.screens.patient.dashboard

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.ui.viewmodel.ChatLanguage
import com.example.swastik.ui.viewmodel.ChatUiMessage
import kotlinx.coroutines.launch
import java.io.File
import java.util.Locale


data class ChatQuickAction(
    val icon: ImageVector,
    val label: String,
    val query: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatbotScreen(
    onBackClick: () -> Unit = {},
    onNavigateToEmergency: () -> Unit = {},
    viewModel: com.example.swastik.ui.viewmodel.ChatbotViewModel = androidx.hilt.navigation.compose.hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val messages = uiState.messages
    val isLoading = uiState.isLoading
    val isSending = uiState.isSending
    val selectedLanguage = uiState.selectedLanguage

    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    // ==================== TTS ENGINE ====================
    var ttsReady by remember { mutableStateOf(false) }
    var isSpeaking by remember { mutableStateOf(false) }
    val tts = remember {
        var engine: TextToSpeech? = null
        engine = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                ttsReady = true
            }
        }
        engine
    }

    // Update TTS language when selected language changes
    LaunchedEffect(selectedLanguage, ttsReady) {
        if (ttsReady && tts != null) {
            val locale = when (selectedLanguage) {
                ChatLanguage.HINDI -> Locale("hi", "IN")
                ChatLanguage.ENGLISH -> Locale("en", "IN")
            }
            tts.setLanguage(locale)
        }
    }

    // Auto-speak AI responses when ttsEnabled
    LaunchedEffect(uiState.lastAiMessageToSpeak) {
        val msgId = uiState.lastAiMessageToSpeak
        if (msgId != null && ttsReady && tts != null) {
            val msg = messages.find { it.id == msgId }
            if (msg != null && !msg.isUser) {
                tts.stop()
                tts.speak(msg.content, TextToSpeech.QUEUE_FLUSH, null, msgId)
                isSpeaking = true
            }
            viewModel.clearSpeakFlag()
        }
    }

    // Cleanup TTS on dispose
    DisposableEffect(Unit) {
        onDispose {
            tts?.stop()
            tts?.shutdown()
        }
    }

    // ==================== VOICE INPUT STATE ====================
    var isListening by remember { mutableStateOf(false) }
    var voicePartialResult by remember { mutableStateOf("") }
    var voiceErrorMessage by remember { mutableStateOf<String?>(null) }
    val speechRecognizer = remember { SpeechRecognizer.createSpeechRecognizer(context) }

    // ==================== IMAGE PICKER STATE ====================
    var showAttachMenu by remember { mutableStateOf(false) }
    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }
    var showImagePreview by remember { mutableStateOf(false) }
    var imageDescription by remember { mutableStateOf("") }
    var cameraImageUri by remember { mutableStateOf<Uri?>(null) }

    // Gallery picker launcher
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            selectedImageUri = it
            showImagePreview = true
        }
    }

    // Camera launcher
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success: Boolean ->
        if (success && cameraImageUri != null) {
            selectedImageUri = cameraImageUri
            showImagePreview = true
        }
    }

    // Permission launcher for camera
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            val file = File(context.cacheDir, "camera_photo_${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
            cameraImageUri = uri
            cameraLauncher.launch(uri)
        }
    }

    // Permission launcher for microphone
    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                val msg = if (selectedLanguage == ChatLanguage.HINDI) {
                    "इस डिवाइस पर वॉइस रिकग्निशन उपलब्ध नहीं है"
                } else {
                    "Voice recognition is not available on this device"
                }
                voiceErrorMessage = msg
                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                return@rememberLauncherForActivityResult
            }
            try {
                startVoiceRecognition(speechRecognizer, context, selectedLanguage)
                isListening = true
            } catch (e: Exception) {
                val msg = if (selectedLanguage == ChatLanguage.HINDI) {
                    "माइक शुरू नहीं हो सका। फिर से प्रयास करें।"
                } else {
                    "Could not start microphone. Please try again."
                }
                voiceErrorMessage = msg
                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            }
        } else {
            val msg = if (selectedLanguage == ChatLanguage.HINDI) {
                "माइक अनुमति अस्वीकृत है"
            } else {
                "Microphone permission denied"
            }
            voiceErrorMessage = msg
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    }

    // Setup SpeechRecognizer listener
    DisposableEffect(speechRecognizer) {
        speechRecognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                voiceErrorMessage = null
                voicePartialResult = if (selectedLanguage == ChatLanguage.HINDI) "सुन रहा हूँ..." else "Listening..."
            }
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { isListening = false }
            override fun onError(error: Int) {
                isListening = false
                voicePartialResult = ""
                val msg = when (error) {
                    SpeechRecognizer.ERROR_NETWORK,
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> if (selectedLanguage == ChatLanguage.HINDI) "नेटवर्क समस्या। दोबारा कोशिश करें।" else "Network issue. Please try again."
                    SpeechRecognizer.ERROR_NO_MATCH,
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> if (selectedLanguage == ChatLanguage.HINDI) "आवाज़ स्पष्ट नहीं मिली। फिर से बोलें।" else "Could not hear clearly. Please speak again."
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> if (selectedLanguage == ChatLanguage.HINDI) "माइक अनुमति आवश्यक है" else "Microphone permission is required"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> if (selectedLanguage == ChatLanguage.HINDI) "वॉइस सेवा व्यस्त है। एक सेकंड बाद कोशिश करें।" else "Voice service is busy. Try again in a second."
                    else -> if (selectedLanguage == ChatLanguage.HINDI) "वॉइस इनपुट विफल हुआ" else "Voice input failed"
                }
                voiceErrorMessage = msg
                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            }
            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val transcript = matches?.firstOrNull() ?: ""
                voicePartialResult = ""
                if (transcript.isNotBlank()) {
                    viewModel.sendMessage(transcript, "voice")
                }
            }
            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                voicePartialResult = matches?.firstOrNull() ?: ""
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        onDispose { speechRecognizer.destroy() }
    }

    // Emergency auto-navigation trigger
    LaunchedEffect(uiState.emergencyTriggered) {
        if (uiState.emergencyTriggered) {
            viewModel.acknowledgeEmergency()
            onNavigateToEmergency()
        }
    }

    // Auto-scroll logic
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    val quickActions = remember {
        listOf(
            ChatQuickAction(Icons.Outlined.Thermostat, "I have fever", "I'm experiencing fever symptoms"),
            ChatQuickAction(Icons.Outlined.Favorite, "Chest pain", "I'm having chest pain"),
            ChatQuickAction(Icons.Outlined.Event, "Book appointment", "I want to book an appointment"),
            ChatQuickAction(Icons.Outlined.Medication, "Medicine info", "I need information about medicines"),
            ChatQuickAction(Icons.Outlined.Description, "View reports", "I want to see my medical reports"),
            ChatQuickAction(Icons.Outlined.LocalHospital, "Find hospital", "Help me find a nearby hospital")
        )
    }

    fun sendMessage(text: String, messageType: String = "text") {
        if (text.isBlank()) return
        viewModel.sendMessage(text, messageType)
        inputText = ""
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(SwastikPurple, Color(0xFF9C27B0))
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) { Text("\uD83E\uDD16", fontSize = 20.sp) }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("Health Assistant", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(8.dp).background(Color(0xFF4CAF50), CircleShape))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("AI \u2022 Voice \u2022 Vision \u2022 ${selectedLanguage.nativeLabel}", fontSize = 12.sp, color = Color(0xFF4CAF50))
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    // Language toggle chip
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = SwastikPurple.copy(alpha = 0.12f),
                        modifier = Modifier.clickable { viewModel.toggleLanguage() }
                    ) {
                        Text(
                            text = if (selectedLanguage == ChatLanguage.ENGLISH) "EN \uD83C\uDDEC\uD83C\uDDE7" else "HI \uD83C\uDDEE\uD83C\uDDF3",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = SwastikPurple,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                    // TTS toggle
                    IconButton(onClick = { viewModel.toggleTts() }) {
                        Icon(
                            imageVector = if (uiState.ttsEnabled) Icons.AutoMirrored.Filled.VolumeUp else Icons.Filled.VolumeOff,
                            contentDescription = "Toggle voice output",
                            tint = if (uiState.ttsEnabled) SwastikPurple else Color.Gray
                        )
                    }
                    // Clear chat
                    IconButton(onClick = { viewModel.clearChat() }) {
                        Icon(Icons.Outlined.DeleteSweep, contentDescription = "Clear chat")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        bottomBar = {
            Column {
                // Voice listening indicator
                AnimatedVisibility(
                    visible = isListening,
                    enter = fadeIn() + scaleIn(),
                    exit = fadeOut() + scaleOut()
                ) {
                    VoiceListeningBar(
                        partialResult = voicePartialResult,
                        language = selectedLanguage,
                        onStop = {
                            speechRecognizer.stopListening()
                            isListening = false
                            voicePartialResult = ""
                        }
                    )
                }

                ChatInputBar(
                    value = inputText,
                    onValueChange = { inputText = it },
                    onSend = { sendMessage(inputText) },
                    onVoiceClick = {
                        if (isListening) {
                            speechRecognizer.stopListening()
                            isListening = false
                            voicePartialResult = ""
                        } else {
                            // Stop any TTS first
                            tts?.stop()
                            isSpeaking = false
                            val hasPermission = ContextCompat.checkSelfPermission(
                                context, Manifest.permission.RECORD_AUDIO
                            ) == PackageManager.PERMISSION_GRANTED
                            if (hasPermission) {
                                if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                                    val msg = if (selectedLanguage == ChatLanguage.HINDI) {
                                        "इस डिवाइस पर वॉइस रिकग्निशन उपलब्ध नहीं है"
                                    } else {
                                        "Voice recognition is not available on this device"
                                    }
                                    voiceErrorMessage = msg
                                    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                                } else {
                                    try {
                                        startVoiceRecognition(speechRecognizer, context, selectedLanguage)
                                        isListening = true
                                    } catch (e: Exception) {
                                        val msg = if (selectedLanguage == ChatLanguage.HINDI) {
                                            "माइक शुरू नहीं हो सका। फिर से प्रयास करें।"
                                        } else {
                                            "Could not start microphone. Please try again."
                                        }
                                        voiceErrorMessage = msg
                                        Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                                    }
                                }
                            } else {
                                micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                            }
                        }
                    },
                    onAttachClick = { showAttachMenu = true },
                    isLoading = isSending,
                    isListening = isListening,
                    language = selectedLanguage
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF5F5F5))
                .padding(paddingValues)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Rate limit warning
                if (uiState.rateLimited) {
                    Surface(modifier = Modifier.fillMaxWidth(), color = Color(0xFFFFF3E0)) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Warning, contentDescription = null, tint = Color(0xFFFF9800), modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Message limit reached. Start a new session or try again later.", fontSize = 12.sp, color = Color(0xFFE65100))
                        }
                    }
                }

                // Voice recognition warning
                if (!voiceErrorMessage.isNullOrBlank()) {
                    Surface(modifier = Modifier.fillMaxWidth(), color = Color(0xFFFFEBEE)) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Warning, contentDescription = null, tint = Color(0xFFD32F2F), modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(voiceErrorMessage!!, fontSize = 12.sp, color = Color(0xFFD32F2F))
                        }
                    }
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                    state = listState,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(vertical = 16.dp)
                ) {
                    items(messages, key = { it.id }) { message ->
                        ChatBubble(
                            message = message,
                            onSpeakClick = { msgId ->
                                if (ttsReady && tts != null) {
                                    val msg = messages.find { it.id == msgId }
                                    if (msg != null) {
                                        tts.stop()
                                        tts.speak(msg.content, TextToSpeech.QUEUE_FLUSH, null, msgId)
                                        isSpeaking = true
                                    }
                                }
                            }
                        )
                    }
                    if (messages.size == 1) {
                        item {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Quick Actions", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Gray, modifier = Modifier.padding(vertical = 8.dp))
                            QuickActionsGrid(actions = quickActions, onActionClick = { action -> sendMessage(action.query) })
                        }
                    }
                    if (isSending || isLoading) {
                        item { TypingIndicator() }
                    }
                }
            }

            // Attachment bottom sheet
            if (showAttachMenu) {
                AttachmentMenu(
                    onDismiss = { showAttachMenu = false },
                    onCameraClick = {
                        showAttachMenu = false
                        val hasPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                        if (hasPermission) {
                            val file = File(context.cacheDir, "camera_photo_${System.currentTimeMillis()}.jpg")
                            val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
                            cameraImageUri = uri
                            cameraLauncher.launch(uri)
                        } else {
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    },
                    onGalleryClick = {
                        showAttachMenu = false
                        galleryLauncher.launch("image/*")
                    }
                )
            }

            // Image preview dialog
            if (showImagePreview && selectedImageUri != null) {
                ImagePreviewDialog(
                    description = imageDescription,
                    onDescriptionChange = { imageDescription = it },
                    onSend = {
                        viewModel.sendImage(selectedImageUri!!, imageDescription)
                        showImagePreview = false
                        selectedImageUri = null
                        imageDescription = ""
                    },
                    onDismiss = {
                        showImagePreview = false
                        selectedImageUri = null
                        imageDescription = ""
                    }
                )
            }
        }
    }
}

// ==================== VOICE LISTENING BAR ====================

@Composable
private fun VoiceListeningBar(partialResult: String, language: ChatLanguage, onStop: () -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth(), color = Color(0xFFE8F5E9)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val infiniteTransition = rememberInfiniteTransition(label = "pulse")
            val scale by infiniteTransition.animateFloat(
                initialValue = 0.8f, targetValue = 1.2f,
                animationSpec = infiniteRepeatable(animation = tween(600), repeatMode = RepeatMode.Reverse),
                label = "scale"
            )
            Box(modifier = Modifier.size((12 * scale).dp).background(Color(0xFFD32F2F), CircleShape))
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = partialResult.ifBlank {
                        if (language == ChatLanguage.HINDI) "\uD83C\uDFA4 सुन रहा हूँ..." else "\uD83C\uDFA4 Listening..."
                    },
                    fontSize = 14.sp, color = Color(0xFF2E7D32), maxLines = 2
                )
                Text(
                    text = if (language == ChatLanguage.HINDI) "हिन्दी में बोलें" else "Speak in English",
                    fontSize = 11.sp, color = Color(0xFF66BB6A)
                )
            }
            IconButton(
                onClick = onStop,
                modifier = Modifier.size(36.dp).clip(CircleShape).background(Color(0xFFD32F2F))
            ) {
                Icon(Icons.Filled.Stop, contentDescription = "Stop listening", tint = Color.White, modifier = Modifier.size(18.dp))
            }
        }
    }
}

// ==================== ATTACHMENT MENU ====================

@Composable
private fun AttachmentMenu(onDismiss: () -> Unit, onCameraClick: () -> Unit, onGalleryClick: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.3f)).clickable { onDismiss() })
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        Surface(
            modifier = Modifier.fillMaxWidth().clickable { },
            shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
            color = Color.White, shadowElevation = 16.dp
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Box(modifier = Modifier.align(Alignment.CenterHorizontally).width(40.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color.LightGray))
                Spacer(modifier = Modifier.height(20.dp))
                Text("Share for Analysis", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Take a photo or choose from gallery for AI diagnosis", fontSize = 13.sp, color = Color.Gray)
                Spacer(modifier = Modifier.height(20.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    AttachmentOption(Icons.Outlined.CameraAlt, "Camera", "Take photo", Color(0xFF2196F3), onCameraClick)
                    AttachmentOption(Icons.Outlined.PhotoLibrary, "Gallery", "Choose photo", Color(0xFF4CAF50), onGalleryClick)
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun AttachmentOption(icon: ImageVector, label: String, subtitle: String, color: Color, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clip(RoundedCornerShape(16.dp)).clickable { onClick() }.padding(16.dp)
    ) {
        Box(modifier = Modifier.size(60.dp).clip(CircleShape).background(color.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = label, tint = color, modifier = Modifier.size(28.dp))
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium)
        Text(subtitle, fontSize = 11.sp, color = Color.Gray)
    }
}

// ==================== IMAGE PREVIEW DIALOG ====================

@Composable
private fun ImagePreviewDialog(
    description: String,
    onDescriptionChange: (String) -> Unit,
    onSend: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("\uD83D\uDCF7 Analyze Image", fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Filled.Close, contentDescription = "Close", modifier = Modifier.size(20.dp))
                }
            }
        },
        text = {
            Column {
                Surface(
                    modifier = Modifier.fillMaxWidth().height(160.dp),
                    shape = RoundedCornerShape(12.dp), color = Color(0xFFF0F0F0)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("\uD83D\uDCF7", fontSize = 40.sp)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Image selected", fontSize = 12.sp, color = Color.Gray)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text("Add a description (optional)", fontSize = 12.sp, color = Color.Gray)
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = description, onValueChange = onDescriptionChange,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Describe symptoms or concern", fontSize = 13.sp) },
                    textStyle = TextStyle(fontSize = 14.sp),
                    shape = RoundedCornerShape(12.dp), maxLines = 3
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text("\u2695\uFE0F AI will analyze for skin conditions, wounds, or abnormalities. Always consult a doctor.", fontSize = 11.sp, color = Color.Gray, lineHeight = 16.sp)
            }
        },
        confirmButton = {
            Button(onClick = onSend, colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple), shape = RoundedCornerShape(12.dp)) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Analyze")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        shape = RoundedCornerShape(20.dp)
    )
}

// ==================== SEVERITY BADGE ====================

@Composable
private fun SeverityBadge(severity: String) {
    val (color, label) = when (severity.lowercase()) {
        "critical" -> Color(0xFFD32F2F) to "\uD83D\uDEA8 Critical"
        "high" -> Color(0xFFFF5722) to "\u26A0\uFE0F High"
        "medium" -> Color(0xFFFF9800) to "\uD83D\uDFE1 Medium"
        else -> Color(0xFF4CAF50) to "\uD83D\uDFE2 Low"
    }
    Surface(shape = RoundedCornerShape(12.dp), color = color.copy(alpha = 0.1f), modifier = Modifier.padding(top = 8.dp)) {
        Text(text = label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = color, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
    }
}

// ==================== SPECIALIST CHIP ====================

@Composable
private fun SpecialistChip(specialist: String) {
    Surface(shape = RoundedCornerShape(12.dp), color = SwastikPurple.copy(alpha = 0.1f), modifier = Modifier.padding(top = 4.dp)) {
        Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("\uD83E\uDE7A", fontSize = 11.sp)
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = specialist, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = SwastikPurple)
        }
    }
}

@Composable
private fun ChatBubble(message: ChatUiMessage, onSpeakClick: (String) -> Unit = {}) {
    val alignment = if (message.isUser) Alignment.CenterEnd else Alignment.CenterStart

    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = alignment) {
        Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.widthIn(max = 300.dp)) {
            if (!message.isUser) {
                Box(
                    modifier = Modifier.size(32.dp).clip(CircleShape).background(
                        if (message.isEmergency) Color(0xFFD32F2F).copy(alpha = 0.1f)
                        else SwastikPurple.copy(alpha = 0.1f)
                    ),
                    contentAlignment = Alignment.Center
                ) { Text(if (message.isEmergency) "\uD83D\uDEA8" else "\uD83E\uDD16", fontSize = 16.sp) }
                Spacer(modifier = Modifier.width(8.dp))
            }

            Card(
                shape = RoundedCornerShape(
                    topStart = 16.dp, topEnd = 16.dp,
                    bottomStart = if (message.isUser) 16.dp else 4.dp,
                    bottomEnd = if (message.isUser) 4.dp else 16.dp
                ),
                colors = CardDefaults.cardColors(
                    containerColor = when {
                        message.isUser -> SwastikPurple
                        message.isEmergency -> Color(0xFFFFEBEE)
                        else -> Color.White
                    }
                ),
                elevation = CardDefaults.cardElevation(2.dp),
                modifier = if (message.isEmergency) {
                    Modifier.border(1.dp, Color(0xFFD32F2F).copy(alpha = 0.3f),
                        RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 4.dp, bottomEnd = 16.dp))
                } else Modifier
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    // Show image indicator for user image messages
                    if (message.isUser && message.imageUri != null) {
                        Surface(
                            modifier = Modifier.fillMaxWidth().height(100.dp),
                            shape = RoundedCornerShape(8.dp),
                            color = Color.White.copy(alpha = 0.2f)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("\uD83D\uDCF7", fontSize = 36.sp)
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                    }

                    Text(text = message.content, fontSize = 14.sp, color = if (message.isUser) Color.White else Color.Black, lineHeight = 20.sp)

                    if (!message.isUser) {
                        if (message.severity != null && message.severity != "low") { SeverityBadge(severity = message.severity) }
                        if (message.recommendedSpecialist != null && message.recommendedSpecialist != "General Physician") { SpecialistChip(specialist = message.recommendedSpecialist) }
                        if (!message.possibleConditions.isNullOrEmpty()) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                message.possibleConditions.take(3).forEach { condition ->
                                    Surface(shape = RoundedCornerShape(8.dp), color = Color(0xFFF5F5F5)) {
                                        Text(text = condition, fontSize = 10.sp, color = Color.Gray, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                    }
                                }
                            }
                        }
                        if (message.followUpQuestion != null) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(text = message.followUpQuestion, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = SwastikPurple)
                        }
                        // Speaker button on AI messages
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End
                        ) {
                            Surface(
                                shape = CircleShape,
                                color = SwastikPurple.copy(alpha = 0.08f),
                                modifier = Modifier.size(28.dp).clickable { onSpeakClick(message.id) }
                            ) {
                                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                                    Icon(
                                        Icons.AutoMirrored.Filled.VolumeUp,
                                        contentDescription = "Read aloud",
                                        tint = SwastikPurple,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            if (message.isUser) {
                Spacer(modifier = Modifier.width(8.dp))
                Box(modifier = Modifier.size(32.dp).clip(CircleShape).background(SwastikPurple.copy(alpha = 0.2f)), contentAlignment = Alignment.Center) {
                    Text("\uD83D\uDC64", fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun QuickActionsGrid(actions: List<ChatQuickAction>, onActionClick: (ChatQuickAction) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        actions.chunked(2).forEach { rowActions ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                rowActions.forEach { action ->
                    QuickActionCard(action = action, onClick = { onActionClick(action) }, modifier = Modifier.weight(1f))
                }
                if (rowActions.size == 1) { Spacer(modifier = Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun QuickActionCard(action: ChatQuickAction, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(SwastikPurple.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
                Icon(action.icon, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = action.label, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color.Black)
        }
    }
}

@Composable
private fun TypingIndicator() {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 40.dp)) {
        Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                repeat(3) { index -> TypingDot(delay = index * 200) }
            }
        }
    }
}

@Composable
private fun TypingDot(delay: Int) {
    val infiniteTransition = rememberInfiniteTransition(label = "typing")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.3f, targetValue = 1f,
        animationSpec = infiniteRepeatable(animation = tween(600, delayMillis = delay), repeatMode = RepeatMode.Reverse),
        label = "alpha"
    )
    Box(modifier = Modifier.size(8.dp).background(SwastikPurple.copy(alpha = alpha), CircleShape))
}

@Composable
private fun ChatInputBar(
    value: String, onValueChange: (String) -> Unit,
    onSend: () -> Unit, onVoiceClick: () -> Unit,
    onAttachClick: () -> Unit, isLoading: Boolean, isListening: Boolean,
    language: ChatLanguage = ChatLanguage.ENGLISH
) {
    Surface(modifier = Modifier.fillMaxWidth(), shadowElevation = 8.dp, color = Color.White) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            // Camera/attach button
            IconButton(onClick = onAttachClick, enabled = !isLoading, modifier = Modifier.size(40.dp)) {
                Icon(Icons.Outlined.CameraAlt, contentDescription = "Attach image", tint = if (!isLoading) SwastikPurple else Color.LightGray)
            }
            // Input field
            Box(
                modifier = Modifier.weight(1f).clip(RoundedCornerShape(24.dp))
                    .background(Color(0xFFF5F5F5)).padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                BasicTextField(
                    value = value, onValueChange = onValueChange,
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = TextStyle(fontSize = 14.sp, color = Color.Black),
                    decorationBox = { innerTextField ->
                        if (value.isEmpty()) {
                            Text(
                                text = if (language == ChatLanguage.HINDI) "टाइप करें, बोलें या फ़ोटो भेजें..." else "Type, speak, or send a photo...",
                                fontSize = 14.sp, color = Color.Gray
                            )
                        }
                        innerTextField()
                    }
                )
            }
            Spacer(modifier = Modifier.width(4.dp))
            // Voice / Send button
            if (value.isBlank()) {
                IconButton(
                    onClick = onVoiceClick, enabled = !isLoading,
                    modifier = Modifier.size(44.dp).clip(CircleShape).background(
                        when {
                            isListening -> Color(0xFFD32F2F)
                            !isLoading -> Color(0xFF4CAF50)
                            else -> Color.LightGray
                        }
                    )
                ) {
                    Icon(
                        if (isListening) Icons.Filled.Stop else Icons.Filled.Mic,
                        contentDescription = if (isListening) "Stop listening" else "Voice input",
                        tint = Color.White, modifier = Modifier.size(22.dp)
                    )
                }
            } else {
                IconButton(
                    onClick = onSend, enabled = value.isNotBlank() && !isLoading,
                    modifier = Modifier.size(44.dp).clip(CircleShape).background(
                        if (value.isNotBlank() && !isLoading) SwastikPurple else Color.LightGray
                    )
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", tint = Color.White, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

// ==================== HELPER ====================

private fun startVoiceRecognition(
    speechRecognizer: SpeechRecognizer,
    context: android.content.Context,
    language: ChatLanguage = ChatLanguage.ENGLISH
) {
    val speechCode = language.speechCode // "en-IN" or "hi-IN"
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, speechCode)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, speechCode)
        putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, speechCode)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }
    speechRecognizer.startListening(intent)
}
