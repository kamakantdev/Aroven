package com.example.swastik.ui.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.model.ConsultationRecord
import com.example.swastik.data.model.MedicalDocument
import com.example.swastik.data.model.DocumentType
import com.example.swastik.data.model.PrescriptionItem
import com.example.swastik.data.repository.RecordsRepository
import com.example.swastik.data.remote.dto.ConsultationDto
import com.example.swastik.data.remote.dto.ReportDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RecordsUiState(
    val consultations: List<ConsultationRecord> = emptyList(),
    val documents: List<MedicalDocument> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val uploadState: UploadState = UploadState.Idle
)

sealed class UploadState {
    data object Idle : UploadState()
    data object Uploading : UploadState()
    data class Success(val message: String) : UploadState()
    data class Error(val message: String) : UploadState()
}

@HiltViewModel
class RecordsViewModel @Inject constructor(
    private val recordsRepository: RecordsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(RecordsUiState())
    val uiState: StateFlow<RecordsUiState> = _uiState.asStateFlow()

    init {
        loadRecords()
    }

    fun loadRecords() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            // supervisorScope: one child failure doesn't cancel the other
            supervisorScope {
                launch {
                    try { loadConsultations() }
                    catch (e: Exception) {
                        _uiState.update { it.copy(error = e.message ?: "Failed to load consultations") }
                    }
                }
                launch {
                    try { loadReports() }
                    catch (e: Exception) {
                        _uiState.update { it.copy(error = e.message ?: "Failed to load reports") }
                    }
                }
            }
            _uiState.update { it.copy(isLoading = false) }
        }
    }

    private suspend fun loadConsultations() {
        val dtos = recordsRepository.getConsultations(page = 1)
        val consultations = dtos.map { it.toConsultationRecord() }
        // Thread-safe update using update {} to prevent race condition
        _uiState.update { it.copy(consultations = consultations) }
    }

    private suspend fun loadReports() {
        val dtos = recordsRepository.getPatientReports(page = 1)
        val documents = dtos.map { it.toMedicalDocument() }
        // Thread-safe update using update {} to prevent race condition
        _uiState.update { it.copy(documents = documents) }
    }

    fun uploadReport(uri: Uri, name: String, type: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(uploadState = UploadState.Uploading) }
            try {
                recordsRepository.uploadReport(uri, name, type)
                _uiState.update { it.copy(uploadState = UploadState.Success("Report uploaded successfully")) }
                // Reload records to show new report
                loadRecords()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(uploadState = UploadState.Error(e.message ?: "Upload failed"))
                }
            }
        }
    }

    fun deleteReport(reportId: String) {
        viewModelScope.launch {
            try {
                recordsRepository.deleteReport(reportId)
                // Remove from local state immediately
                _uiState.update { state ->
                    state.copy(documents = state.documents.filter { it.id != reportId })
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "Failed to delete report")
                }
            }
        }
    }

    fun clearUploadState() {
        _uiState.update { it.copy(uploadState = UploadState.Idle) }
    }
}

private fun ConsultationDto.toConsultationRecord(): ConsultationRecord {
    return ConsultationRecord(
        id = id,
        doctorName = doctorName,
        doctorSpecialty = doctorSpecialty,
        date = date,
        diagnosis = diagnosis ?: "No diagnosis recorded",
        prescriptions = prescriptions?.flatMap { p ->
            // Each PrescriptionDto has a list of medicines (PrescriptionItemDto)
            // which contain the actual medicine details
            p.allMedicines.map { item ->
                PrescriptionItem(
                    medicineName = item.medicineName,
                    dosage = item.dosage,
                    frequency = item.frequency,
                    duration = item.duration
                )
            }
        } ?: emptyList(),
        notes = notes ?: "",
        followUpDate = followUpDate
    )
}

/**
 * Maps DB report type values to Android DocumentType enum.
 * DB CHECK: 'blood_test', 'urine_test', 'x_ray', 'mri', 'ct_scan', 'ecg', 'ultrasound', 'other'
 */
private fun ReportDto.toMedicalDocument(): MedicalDocument {
    val docType = when (type.lowercase()) {
        "blood_test", "urine_test", "ecg" -> DocumentType.LAB_REPORT
        "x_ray", "mri", "ct_scan", "ultrasound" -> DocumentType.SCAN
        "prescription", "rx" -> DocumentType.PRESCRIPTION
        "discharge", "discharge_summary" -> DocumentType.DISCHARGE_SUMMARY
        "vaccination", "vaccine" -> DocumentType.VACCINATION
        else -> DocumentType.REPORT
    }
    return MedicalDocument(
        id = id,
        name = name,
        type = docType,
        date = displayDate,
        doctorName = labName,
        fileUrl = fileUrl ?: "",
        size = fileSize
    )
}
