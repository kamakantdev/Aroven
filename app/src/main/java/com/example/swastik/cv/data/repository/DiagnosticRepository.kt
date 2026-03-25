package com.example.swastik.data.repository

import com.example.swastik.data.remote.ApiService
import com.example.swastik.data.remote.dto.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for Diagnostic Center operations — search, tests, booking.
 */
@Singleton
class DiagnosticRepository @Inject constructor(
    private val apiService: ApiService
) {

    /**
     * Search diagnostic centers by city/keyword/test type.
     */
    suspend fun searchCenters(
        city: String? = null,
        search: String? = null,
        testType: String? = null,
        page: Int = 1
    ): Result<List<DiagnosticCenterDto>> {
        return try {
            val response = apiService.searchDiagnosticCenters(city, search, testType, page)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error("Failed to search diagnostic centers")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Find nearby diagnostic centers by location.
     */
    suspend fun findNearby(
        latitude: Double,
        longitude: Double,
        radius: Int = 10
    ): Result<List<DiagnosticCenterDto>> {
        return try {
            val response = apiService.getNearbyDiagnosticCenters(latitude, longitude, radius)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error("Failed to find nearby centers")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get diagnostic center details by ID.
     */
    suspend fun getCenterById(centerId: String): Result<DiagnosticCenterDto> {
        return try {
            val response = apiService.getDiagnosticCenterById(centerId)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Error("Center not found")
            } else {
                Result.Error("Failed to load center details")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get available tests at a diagnostic center.
     */
    suspend fun getTests(
        centerId: String,
        search: String? = null,
        category: String? = null,
        page: Int = 1
    ): Result<List<DiagnosticTestDto>> {
        return try {
            val response = apiService.getDiagnosticTests(centerId, search, category, page)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error("Failed to load tests")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Book a diagnostic test.
     */
    suspend fun bookTest(request: DiagnosticBookingRequest): Result<DiagnosticBookingDto> {
        return try {
            val response = apiService.bookDiagnosticTest(request)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Error("Failed to create booking")
            } else {
                Result.Error(response.body()?.message ?: "Booking failed")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get patient's diagnostic booking history.
     */
    suspend fun getMyBookings(status: String? = null, page: Int = 1): Result<List<DiagnosticBookingDto>> {
        return try {
            val response = apiService.getMyDiagnosticBookings(status = status, page = page)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error("Failed to load bookings")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get single diagnostic booking details.
     */
    suspend fun getBookingById(bookingId: String): Result<DiagnosticBookingDto> {
        return try {
            val response = apiService.getDiagnosticBookingById(bookingId)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Error("Booking not found")
            } else {
                Result.Error("Failed to load booking")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Cancel a diagnostic booking.
     */
    suspend fun cancelBooking(bookingId: String): Result<DiagnosticBookingDto> {
        return try {
            val response = apiService.cancelDiagnosticBooking(bookingId)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Error("Failed to cancel booking")
            } else {
                Result.Error(response.body()?.message ?: "Cannot cancel booking")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
}
