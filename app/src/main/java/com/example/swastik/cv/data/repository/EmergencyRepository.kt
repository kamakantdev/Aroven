package com.example.swastik.data.repository

import com.example.swastik.data.remote.dto.EmergencyRequest
import com.example.swastik.data.model.*
import com.example.swastik.data.remote.dto.*
import com.example.swastik.data.remote.ApiService
import org.json.JSONObject
import javax.inject.Inject

/**
 * Emergency Repository Interface - for ambulance and emergency requests
 */
interface EmergencyRepository {
    suspend fun requestEmergency(request: EmergencyRequest): Result<EmergencyResponse>
    suspend fun getActiveEmergency(): Result<EmergencyResponse?>
    suspend fun cancelEmergency(id: String, reason: String): Result<EmergencyResponse>
    suspend fun getNearbyAmbulances(latitude: Double, longitude: Double, radius: Int): Result<List<AmbulanceDto>>
    suspend fun trackAmbulance(requestId: String): Result<AmbulanceTrack>
}

/**
 * Emergency Repository Implementation
 */
class EmergencyRepositoryImpl @Inject constructor(
    private val apiService: ApiService
) : EmergencyRepository {

    /** Extract meaningful error message from Retrofit error response body */
    private fun <T> retrofit2.Response<T>.apiError(fallback: String): String {
        return try {
            val body = errorBody()?.string()
            if (body != null) JSONObject(body).optString("message", fallback) else fallback
        } catch (_: Exception) { fallback }
    }

    override suspend fun requestEmergency(request: EmergencyRequest): Result<EmergencyResponse> {
        return try {
            val response = apiService.requestEmergency(request)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it) // Assuming response data is Domain EmergencyResponse (or mapped implicitly if matching)
                } ?: Result.Error("No data received")
            } else {
                Result.Error(response.apiError("Failed to request emergency"))
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    override suspend fun getActiveEmergency(): Result<EmergencyResponse?> {
        return try {
            val response = apiService.getActiveEmergency()
            if (response.isSuccessful) {
                if (response.body()?.success == true) {
                    Result.Success(response.body()?.data)
                } else {
                    // No active emergency is not an error
                    Result.Success(null)
                }
            } else {
                if (response.code() == 404) {
                    Result.Success(null)
                } else {
                    Result.Error(response.apiError("Failed to fetch emergency status"))
                }
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    override suspend fun cancelEmergency(id: String, reason: String): Result<EmergencyResponse> {
        return try {
            val response = apiService.cancelEmergency(id, CancelRequest(reason))
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Error("No data received")
            } else {
                // 404 means the emergency was already resolved/cancelled
                if (response.code() == 404) {
                    Result.Error("Emergency request not found or already resolved")
                } else {
                    Result.Error(response.apiError("Failed to cancel emergency"))
                }
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    override suspend fun getNearbyAmbulances(
        latitude: Double,
        longitude: Double,
        radius: Int
    ): Result<List<AmbulanceDto>> {
        return try {
            val response = apiService.getNearbyAmbulances(latitude, longitude, radius)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Success(emptyList())
            } else {
                Result.Error(response.apiError("Failed to fetch nearby ambulances"))
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    override suspend fun trackAmbulance(requestId: String): Result<AmbulanceTrack> {
        return try {
            val response = apiService.trackAmbulance(requestId)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Error("No tracking data received")
            } else {
                Result.Error(response.apiError("Failed to track ambulance"))
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
}
