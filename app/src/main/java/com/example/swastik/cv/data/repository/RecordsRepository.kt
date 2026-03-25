package com.example.swastik.data.repository

import android.content.Context
import android.net.Uri
import com.example.swastik.data.remote.ApiService
import com.example.swastik.data.remote.dto.ConsultationDto
import com.example.swastik.data.remote.dto.ReportDto
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import com.example.swastik.utils.ImageCompressor
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for patient medical records (consultations and reports).
 * Throws on API failures so ViewModel can display meaningful errors.
 */
@Singleton
class RecordsRepository @Inject constructor(
    private val apiService: ApiService,
    @ApplicationContext private val context: Context
) {

    /**
     * Fetch consultations from the API.
     * @throws Exception on network/API failure with descriptive message
     */
    suspend fun getConsultations(page: Int = 1): List<ConsultationDto> {
        val response = apiService.getConsultations(page = page)
        if (response.isSuccessful && response.body()?.success == true) {
            return response.body()?.data ?: emptyList()
        }
        val errorMsg = response.errorBody()?.string() ?: "Failed to load consultations"
        throw Exception(errorMsg)
    }

    /**
     * Fetch patient reports from the API.
     * @throws Exception on network/API failure with descriptive message
     */
    suspend fun getPatientReports(page: Int = 1): List<ReportDto> {
        val response = apiService.getPatientReports(page = page)
        if (response.isSuccessful && response.body()?.success == true) {
            return response.body()?.data ?: emptyList()
        }
        val errorMsg = response.errorBody()?.string() ?: "Failed to load reports"
        throw Exception(errorMsg)
    }

    /**
     * Upload a medical report file from a content URI.
     * Uses the uploads/report endpoint for MinIO file storage.
     */
    suspend fun uploadReport(uri: Uri, name: String, type: String) {
        val contentResolver = context.contentResolver
        val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
        val inputStream = contentResolver.openInputStream(uri)
            ?: throw Exception("Cannot read the selected file")
        val originalBytes = inputStream.use { it.readBytes() }

        // Compress images before upload to save bandwidth (60-80% savings)
        val (bytes, finalMimeType) = if (mimeType.startsWith("image/")) {
            val compressed = ImageCompressor.compress(originalBytes)
            if (compressed != null) Pair(compressed.bytes, compressed.mimeType)
            else Pair(originalBytes, mimeType)
        } else {
            Pair(originalBytes, mimeType)
        }

        val requestBody = bytes.toRequestBody(finalMimeType.toMediaTypeOrNull())
        val fileName = name.replace(" ", "_").lowercase() + when {
            mimeType.contains("pdf") -> ".pdf"
            mimeType.contains("image") -> ".jpg"
            else -> ""
        }
        val part = MultipartBody.Part.createFormData("file", fileName, requestBody)

        val response = apiService.uploadMedicalReport(part)
        if (!response.isSuccessful) {
            val errorMsg = response.errorBody()?.string() ?: "Upload failed"
            throw Exception(errorMsg)
        }
    }

    /**
     * Delete a patient report by ID.
     * Uses DELETE /api/reports/:id
     */
    suspend fun deleteReport(reportId: String) {
        val response = apiService.deleteReport(reportId)
        if (!response.isSuccessful) {
            val errorMsg = response.errorBody()?.string() ?: "Failed to delete report"
            throw Exception(errorMsg)
        }
    }
}
