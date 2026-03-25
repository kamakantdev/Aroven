package com.example.swastik.ui.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.remote.dto.ChatMessage
import com.example.swastik.data.remote.dto.ChatbotMessageResult
import com.example.swastik.data.remote.dto.StructuredAiResponse
import com.example.swastik.data.remote.dto.SymptomAnalysis
import com.example.swastik.data.remote.dto.HealthTip
import com.example.swastik.data.repository.ChatbotRepository
import com.example.swastik.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI model for a chat message displayed in the chatbot screen.
 */
data class ChatUiMessage(
    val id: String,
    val content: String,
    val isUser: Boolean,
    val timestamp: Long = System.currentTimeMillis(),
    // Structured AI response data (only for assistant messages)
    val severity: String? = null,
    val possibleConditions: List<String>? = null,
    val recommendedSpecialist: String? = null,
    val requiresEmergency: Boolean = false,
    val isEmergency: Boolean = false,
    val confidenceScore: Float? = null,
    val followUpQuestion: String? = null,
    val provider: String? = null,
    // Image support
    val imageUri: Uri? = null
)

/**
 * Supported chatbot languages.
 */
enum class ChatLanguage(val code: String, val label: String, val nativeLabel: String, val speechCode: String) {
    ENGLISH("en", "English", "English", "en-IN"),
    HINDI("hi", "Hindi", "हिन्दी", "hi-IN")
}

/**
 * UI State for the chatbot screen.
 */
data class ChatbotUiState(
    val messages: List<ChatUiMessage> = emptyList(),
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val error: String? = null,
    val sessionStarted: Boolean = false,
    val symptomAnalysis: SymptomAnalysis? = null,
    val healthTips: List<HealthTip> = emptyList(),
    // Emergency trigger — when true, UI should navigate to emergency screen
    val emergencyTriggered: Boolean = false,
    val rateLimited: Boolean = false,
    // Language selection for bilingual support
    val selectedLanguage: ChatLanguage = ChatLanguage.ENGLISH,
    // TTS auto-speak toggle
    val ttsEnabled: Boolean = true,
    // ID of last AI message that should be spoken
    val lastAiMessageToSpeak: String? = null
)

/**
 * Chatbot ViewModel - manages AI chat interactions.
 * Handles structured responses, emergency detection, and voice/text routing.
 */
@HiltViewModel
class ChatbotViewModel @Inject constructor(
    private val chatbotRepository: ChatbotRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatbotUiState())
    val uiState: StateFlow<ChatbotUiState> = _uiState.asStateFlow()

    init {
        startSession()
    }

    /**
     * Start a new chat session with the AI.
     */
    private fun startSession() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            when (val result = chatbotRepository.startSession()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        sessionStarted = true,
                        messages = listOf(
                            ChatUiMessage(
                                id = "welcome",
                                content = "Namaste! 🙏 I'm your Swastik Health Assistant.\n\nI can help you with:\n• Understanding your symptoms\n• Finding the right specialist\n• Health & wellness tips\n• First aid guidance\n\nHow can I help you today?\n\n⚠️ For emergencies, call 102/108 immediately.",
                                isUser = false
                            )
                        )
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message,
                        messages = listOf(
                            ChatUiMessage(
                                id = "welcome",
                                content = "Hello! I'm your health assistant. I'm having trouble connecting right now, but feel free to try sending a message.",
                                isUser = false
                            )
                        )
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    /**
     * Send a message to the AI chatbot.
     * @param content The message text
     * @param messageType "text" (routes to HuggingFace) or "voice" (routes to Groq)
     */
    fun sendMessage(content: String, messageType: String = "text") {
        if (content.isBlank()) return

        val userMessage = ChatUiMessage(
            id = "user_${System.currentTimeMillis()}",
            content = content,
            isUser = true
        )

        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + userMessage,
            isSending = true,
            error = null
        )

        val language = _uiState.value.selectedLanguage.code

        viewModelScope.launch {
            when (val result = chatbotRepository.sendMessage(content, messageType, language)) {
                is Result.Success -> {
                    val data = result.data
                    val response = data.response
                    val aiMsgId = "ai_${System.currentTimeMillis()}"

                    val aiMessage = ChatUiMessage(
                        id = aiMsgId,
                        content = response.summary,
                        isUser = false,
                        severity = response.severity,
                        possibleConditions = response.possibleConditions,
                        recommendedSpecialist = response.recommendedSpecialist,
                        requiresEmergency = response.requiresEmergency,
                        isEmergency = data.isEmergency == true,
                        confidenceScore = response.confidenceScore,
                        followUpQuestion = response.followUpQuestion,
                        provider = data.provider
                    )

                    _uiState.value = _uiState.value.copy(
                        messages = _uiState.value.messages + aiMessage,
                        isSending = false,
                        emergencyTriggered = response.requiresEmergency,
                        rateLimited = data.rateLimited == true,
                        lastAiMessageToSpeak = if (_uiState.value.ttsEnabled) aiMsgId else null
                    )
                }
                is Result.Error -> {
                    val errorMessage = ChatUiMessage(
                        id = "error_${System.currentTimeMillis()}",
                        content = "Sorry, I couldn't process your message. Please try again.",
                        isUser = false
                    )
                    _uiState.value = _uiState.value.copy(
                        messages = _uiState.value.messages + errorMessage,
                        isSending = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    /**
     * Clear the chat and start a new session.
     */
    fun clearChat() {
        _uiState.value = ChatbotUiState()
        startSession()
    }

    /**
     * Send an image for AI-powered medical analysis.
     * @param imageUri URI of the image from gallery or camera
     * @param description Optional text description
     */
    fun sendImage(imageUri: Uri, description: String = "") {
        val userMessage = ChatUiMessage(
            id = "user_img_${System.currentTimeMillis()}",
            content = if (description.isNotBlank()) "📷 $description" else "📷 Image for analysis",
            isUser = true,
            imageUri = imageUri
        )

        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + userMessage,
            isSending = true,
            error = null
        )

        viewModelScope.launch {
            when (val result = chatbotRepository.sendImage(imageUri, description)) {
                is Result.Success -> {
                    val data = result.data
                    val response = data.response
                    val aiImgMsgId = "ai_img_${System.currentTimeMillis()}"

                    val aiMessage = ChatUiMessage(
                        id = aiImgMsgId,
                        content = response.summary,
                        isUser = false,
                        severity = response.severity,
                        possibleConditions = response.possibleConditions,
                        recommendedSpecialist = response.recommendedSpecialist,
                        requiresEmergency = response.requiresEmergency,
                        isEmergency = false,
                        confidenceScore = response.confidenceScore,
                        followUpQuestion = response.followUpQuestion,
                        provider = data.provider
                    )

                    _uiState.value = _uiState.value.copy(
                        messages = _uiState.value.messages + aiMessage,
                        isSending = false,
                        emergencyTriggered = response.requiresEmergency,
                        lastAiMessageToSpeak = if (_uiState.value.ttsEnabled) aiImgMsgId else null
                    )
                }
                is Result.Error -> {
                    val errorMessage = ChatUiMessage(
                        id = "error_${System.currentTimeMillis()}",
                        content = "Sorry, I couldn't analyze the image. Please try again or describe your symptoms in text.",
                        isUser = false
                    )
                    _uiState.value = _uiState.value.copy(
                        messages = _uiState.value.messages + errorMessage,
                        isSending = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    /**
     * Acknowledge emergency trigger (reset flag after navigation).
     */
    fun acknowledgeEmergency() {
        _uiState.value = _uiState.value.copy(emergencyTriggered = false)
    }

    /**
     * Analyze symptoms using the AI chatbot.
     */
    fun analyzeSymptoms(symptoms: List<String>, duration: String? = null, severity: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSending = true, error = null)

            when (val result = chatbotRepository.analyzeSymptoms(symptoms, duration, severity)) {
                is Result.Success -> {
                    val analysis = result.data
                    val summaryMessage = buildString {
                        append("🔍 **Symptom Analysis**\n\n")
                        if (analysis.possibleConditions.isNotEmpty()) {
                            append("Possible conditions:\n")
                            analysis.possibleConditions.forEach { condition ->
                                append("• ${condition.name} (${condition.probability})\n")
                            }
                        }
                        append("\nSeverity: ${analysis.severity}")
                        if (analysis.recommendedSpecialties.isNotEmpty()) {
                            append("\nRecommended specialists: ${analysis.recommendedSpecialties.joinToString(", ")}")
                        }
                        if (analysis.seekImmediateCare) {
                            append("\n\n⚠️ Please seek immediate medical attention!")
                        }
                    }
                    val aiMessage = ChatUiMessage(
                        id = "analysis_${System.currentTimeMillis()}",
                        content = summaryMessage,
                        isUser = false
                    )
                    _uiState.value = _uiState.value.copy(
                        messages = _uiState.value.messages + aiMessage,
                        isSending = false,
                        symptomAnalysis = analysis
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isSending = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    /**
     * Get health tips by category.
     */
    fun getHealthTips(category: String? = null) {
        viewModelScope.launch {
            when (val result = chatbotRepository.getHealthTips(category)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(healthTips = result.data)
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(error = result.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    /**
     * Toggle chatbot language between English and Hindi.
     */
    fun toggleLanguage() {
        val newLang = if (_uiState.value.selectedLanguage == ChatLanguage.ENGLISH)
            ChatLanguage.HINDI else ChatLanguage.ENGLISH
        _uiState.value = _uiState.value.copy(selectedLanguage = newLang)
    }

    /**
     * Set a specific language.
     */
    fun setLanguage(language: ChatLanguage) {
        _uiState.value = _uiState.value.copy(selectedLanguage = language)
    }

    /**
     * Toggle TTS auto-speak on/off.
     */
    fun toggleTts() {
        _uiState.value = _uiState.value.copy(ttsEnabled = !_uiState.value.ttsEnabled)
    }

    /**
     * Clear the TTS speak flag after the screen has consumed it.
     */
    fun clearSpeakFlag() {
        _uiState.value = _uiState.value.copy(lastAiMessageToSpeak = null)
    }

    /**
     * Manually trigger TTS for a specific message.
     */
    fun speakMessage(messageId: String) {
        _uiState.value = _uiState.value.copy(lastAiMessageToSpeak = messageId)
    }
}
