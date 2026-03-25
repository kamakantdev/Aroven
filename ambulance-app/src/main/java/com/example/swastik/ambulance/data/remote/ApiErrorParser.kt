package com.example.swastik.ambulance.data.remote

import com.google.gson.JsonParser
import retrofit2.Response

/**
 * Extracts a user-friendly message from backend error responses.
 */
object ApiErrorParser {
    fun from(response: Response<*>, fallback: String): String {
        return try {
            val body = response.errorBody()?.string().orEmpty()
            if (body.isBlank()) return fallback

            val json = JsonParser.parseString(body).asJsonObject
            when {
                json.has("message") && json.get("message")?.asString?.isNotBlank() == true -> json.get("message").asString
                json.has("error") && json.get("error")?.asString?.isNotBlank() == true -> json.get("error").asString
                else -> fallback
            }
        } catch (_: Exception) {
            fallback
        }
    }
}
