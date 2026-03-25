package com.example.swastik.data.repository

import android.net.Uri
import android.content.Context
import com.example.swastik.data.remote.dto.ChatMessage
import com.example.swastik.data.remote.dto.ChatMessageRequest
import com.example.swastik.data.remote.dto.ChatSession
import com.example.swastik.data.remote.dto.ChatbotMessageResult
import com.example.swastik.data.remote.dto.SymptomAnalysis
import com.example.swastik.data.remote.dto.SymptomAnalysisRequest
import com.example.swastik.data.remote.dto.HealthTip
import com.example.swastik.data.remote.dto.AiProviderStatus
import com.example.swastik.data.remote.ApiService
import com.example.swastik.data.remote.dto.ApiResponse
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import com.example.swastik.utils.ImageCompressor
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

@Singleton
class ChatbotRepository @Inject constructor(
    private val apiService: ApiService,
    @ApplicationContext private val context: Context
) {
    
    private var currentSessionId: String? = null

    suspend fun startSession(): Result<ChatSession> {
        return try {
            val response = apiService.startChatSession()
            if (response.isSuccessful && response.body()?.success == true) {
                val session = response.body()?.data ?: return Result.Error("Data was null")
                currentSessionId = session.sessionId
                Result.Success(session)
            } else {
                Result.Error("Failed to start session")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Send a message to the AI chatbot.
     * Returns the full structured response including AI analysis,
     * severity, specialist recommendation, and emergency detection.
     *
     * @param message The user's message text
     * @param messageType "text" (routes to HuggingFace) or "voice" (routes to Groq)
     * @param language "en" (English) or "hi" (Hindi) — controls AI response language
     */
    suspend fun sendMessage(message: String, messageType: String = "text", language: String = "en"): Result<ChatbotMessageResult> {
        if (currentSessionId == null) {
            val sessionResult = startSession()
            if (sessionResult is Result.Error) {
                return Result.Error("Could not establish chat session")
            }
        }

        return try {
            val sessionId = currentSessionId
                ?: return Result.Error("No active session")
            val request = ChatMessageRequest(
                sessionId = sessionId,
                message = message,
                messageType = messageType,
                language = language
            )
            val response = apiService.sendChatMessage(request)
            
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: return Result.Error("Data was null"))
            } else {
                Result.Error(response.body()?.message ?: "Failed to send message")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Send an image for AI analysis.
     * Uses multipart upload to POST /api/chatbot/analyze-image
     *
     * @param imageUri URI of the image from gallery or camera
     * @param description Optional text description from the user
     */
    suspend fun sendImage(imageUri: Uri, description: String = ""): Result<ChatbotMessageResult> {
        if (currentSessionId == null) {
            val sessionResult = startSession()
            if (sessionResult is Result.Error) {
                return Result.Error("Could not establish chat session")
            }
        }

        return try {
            val sessionId = currentSessionId
                ?: return Result.Error("No active session")

            // Read image bytes from URI
            val inputStream = context.contentResolver.openInputStream(imageUri)
                ?: return Result.Error("Could not read image")
            val originalBytes = inputStream.readBytes()
            inputStream.close()

            // Compress image before upload to save bandwidth
            val compressed = ImageCompressor.compress(originalBytes)
            val imageBytes = compressed?.bytes ?: originalBytes
            val mimeType = compressed?.mimeType ?: (context.contentResolver.getType(imageUri) ?: "image/jpeg")

            // Build multipart request
            val imagePart = MultipartBody.Part.createFormData(
                "image",
                "image.${if (mimeType.contains("png")) "png" else "jpg"}",
                imageBytes.toRequestBody(mimeType.toMediaTypeOrNull())
            )
            val sessionIdBody = sessionId.toRequestBody("text/plain".toMediaTypeOrNull())
            val descriptionBody = description.toRequestBody("text/plain".toMediaTypeOrNull())

            val response = apiService.analyzeImage(imagePart, sessionIdBody, descriptionBody)

            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: return Result.Error("Data was null"))
            } else {
                Result.Error(response.body()?.message ?: "Failed to analyze image")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Analyze symptoms using AI chatbot.
     * POST /api/chatbot/analyze-symptoms
     */
    suspend fun analyzeSymptoms(
        symptoms: List<String>,
        duration: String? = null,
        severity: String? = null
    ): Result<SymptomAnalysis> {
        if (currentSessionId == null) {
            val sessionResult = startSession()
            if (sessionResult is Result.Error) {
                return Result.Error("Could not establish chat session")
            }
        }

        return try {
            val sessionId = currentSessionId
                ?: return Result.Error("No active session")
            val request = SymptomAnalysisRequest(
                sessionId = sessionId,
                symptoms = symptoms,
                duration = duration,
                severity = severity
            )
            val response = apiService.analyzeSymptoms(request)

            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: return Result.Error("Data was null"))
            } else {
                Result.Error(response.body()?.message ?: "Failed to analyze symptoms")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get health tips by category.
     * GET /api/chatbot/health-tips?category=...
     */
    suspend fun getHealthTips(category: String? = null): Result<List<HealthTip>> {
        return try {
            val response = apiService.getHealthTips(category)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error(response.body()?.message ?: "Failed to load health tips")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get AI provider status for monitoring.
     */
    suspend fun getProviderStatus(): Result<List<AiProviderStatus>> {
        return try {
            val response = apiService.getAiProviderStatus()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error("Failed to get provider status")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get the current session ID (for external use).
     */
    fun getCurrentSessionId(): String? = currentSessionId

    /**
     * Clear the current session — must be called on logout so the next login
     * starts a fresh chat session instead of reusing the old one.
     */
    fun clearSession() {
        currentSessionId = null
    }

    /**
     * Get chat history for a specific session.
     * GET /api/chatbot/session/:sessionId
     */
    suspend fun getChatHistory(sessionId: String): Result<List<ChatMessage>> {
        return try {
            val response = apiService.getChatHistory(sessionId)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error(response.body()?.message ?: "Failed to load chat history")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get all past chat sessions for the current patient.
     * GET /api/chatbot/sessions
     */
    suspend fun getChatSessions(): Result<List<ChatSession>> {
        return try {
            val response = apiService.getChatSessions()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error(response.body()?.message ?: "Failed to load sessions")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * End a chat session explicitly.
     * POST /api/chatbot/session/:sessionId/end
     */
    suspend fun endChatSession(sessionId: String): Result<Unit> {
        return try {
            val response = apiService.endChatSession(sessionId)
            if (response.isSuccessful && response.body()?.success == true) {
                if (sessionId == currentSessionId) currentSessionId = null
                Result.Success(Unit)
            } else {
                Result.Error(response.body()?.message ?: "Failed to end session")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
}
