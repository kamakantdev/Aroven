package com.example.swastik.ambulance.data.remote

import com.example.swastik.ambulance.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ==================== Auth ====================

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiResponse<RegistrationResult>>

    @POST("auth/refresh-token")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<AuthResponse>

    @POST("auth/logout")
    suspend fun logout(@Body request: LogoutRequest): Response<ApiResponse<Any>>

    // ==================== Ambulance Dashboard ====================

    @GET("ambulances/dashboard")
    suspend fun getDashboard(): Response<DashboardResponse>

    // ==================== Vehicles ====================

    @GET("ambulances/vehicles")
    suspend fun getVehicles(): Response<VehiclesResponse>

    // ==================== Emergency Requests ====================

    @GET("ambulances/history")
    suspend fun getRequestHistory(
        @Query("status") status: String? = null
    ): Response<HistoryResponse>

    @GET("ambulances/request/{requestId}")
    suspend fun getRequestById(
        @Path("requestId") requestId: String
    ): Response<ApiResponse<EmergencyDto>>

    @PUT("ambulances/request/{requestId}/status")
    suspend fun updateRequestStatus(
        @Path("requestId") requestId: String,
        @Body request: StatusUpdateRequest
    ): Response<ApiResponse<Any>>

    /** Accept an SOS broadcast / hospital-assigned emergency */
    @POST("ambulances/{requestId}/accept")
    suspend fun acceptRequest(
        @Path("requestId") requestId: String
    ): Response<ApiResponse<Any>>

    /** Reject an SOS broadcast emergency */
    @POST("ambulances/{requestId}/reject")
    suspend fun rejectRequest(
        @Path("requestId") requestId: String
    ): Response<ApiResponse<Any>>

    // ==================== Location ====================

    @PUT("ambulances/location")
    suspend fun updateLocation(
        @Body request: LocationUpdateRequest
    ): Response<ApiResponse<Any>>

    // ==================== Profile ====================

    @GET("auth/me")
    suspend fun getProfile(): Response<ApiResponse<UserDto>>

    @POST("auth/change-password")
    suspend fun changePassword(
        @Body request: ChangePasswordRequest
    ): Response<ApiResponse<Any>>
}
