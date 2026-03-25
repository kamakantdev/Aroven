package com.example.swastik.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.remote.SocketManager
import com.example.swastik.data.remote.dto.*
import com.example.swastik.data.repository.DiagnosticRepository
import com.example.swastik.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DiagnosticUiState(
    val isLoading: Boolean = false,
    val centers: List<DiagnosticCenterDto> = emptyList(),
    val selectedCenter: DiagnosticCenterDto? = null,
    val tests: List<DiagnosticTestDto> = emptyList(),
    val selectedTest: DiagnosticTestDto? = null,
    val bookingResult: DiagnosticBookingDto? = null,
    val error: String? = null,
    val searchQuery: String = "",
    val bookingSuccess: Boolean = false
)

data class BookingHistoryUiState(
    val isLoading: Boolean = false,
    val bookings: List<DiagnosticBookingDto> = emptyList(),
    val error: String? = null,
    val filterStatus: String? = null,
    val cancelSuccess: Boolean = false
)

@HiltViewModel
class DiagnosticViewModel @Inject constructor(
    private val repository: DiagnosticRepository,
    private val socketManager: SocketManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(DiagnosticUiState())
    val uiState: StateFlow<DiagnosticUiState> = _uiState.asStateFlow()

    private val _bookingHistoryState = MutableStateFlow(BookingHistoryUiState())
    val bookingHistoryState: StateFlow<BookingHistoryUiState> = _bookingHistoryState.asStateFlow()

    private var lastSearchQuery: String = ""
    private var lastSearchCity: String? = null
    private var lastNearbyLocation: Pair<Double, Double>? = null
    private var hasObservedSocketConnection = false

    init {
        collectProviderCatalogUpdates()
        observeSocketReconnects()
    }

    fun searchCenters(query: String = "", city: String? = null) {
        lastSearchQuery = query
        lastSearchCity = city
        lastNearbyLocation = null
        _uiState.value = _uiState.value.copy(isLoading = true, error = null, searchQuery = query)
        viewModelScope.launch {
            when (val result = repository.searchCenters(city = city, search = query.ifBlank { null })) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        centers = result.data
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> { }
            }
        }
    }

    fun findNearbyCenters(latitude: Double, longitude: Double) {
        lastNearbyLocation = latitude to longitude
        lastSearchQuery = ""
        lastSearchCity = null
        _uiState.value = _uiState.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            when (val result = repository.findNearby(latitude, longitude)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        centers = result.data
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> { }
            }
        }
    }

    fun selectCenter(center: DiagnosticCenterDto) {
        _uiState.value = _uiState.value.copy(selectedCenter = center, tests = emptyList())
        loadTests(center.id)
    }

    fun loadTests(centerId: String, search: String? = null) {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            when (val result = repository.getTests(centerId, search)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        tests = result.data
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> { }
            }
        }
    }

    private fun collectProviderCatalogUpdates() {
        viewModelScope.launch {
            socketManager.providerCatalogUpdates.collect {
                refreshDiscovery()
            }
        }
    }

    private fun observeSocketReconnects() {
        viewModelScope.launch {
            socketManager.connectionState.collect { connected ->
                if (!hasObservedSocketConnection) {
                    hasObservedSocketConnection = true
                    return@collect
                }
                if (connected) {
                    refreshDiscovery()
                }
            }
        }
    }

    private fun refreshDiscovery() {
        val nearby = lastNearbyLocation
        if (nearby != null) {
            findNearbyCenters(nearby.first, nearby.second)
        } else {
            searchCenters(lastSearchQuery, lastSearchCity)
        }

        _uiState.value.selectedCenter?.id?.let { centerId ->
            loadTests(centerId)
        }
    }

    fun selectTest(test: DiagnosticTestDto) {
        _uiState.value = _uiState.value.copy(selectedTest = test)
    }

    fun bookTest(
        bookingDate: String,
        bookingTime: String? = null,
        collectionType: String? = "walk_in",
        collectionAddress: String? = null,
        notes: String? = null
    ) {
        val center = _uiState.value.selectedCenter ?: return
        val test = _uiState.value.selectedTest ?: return

        _uiState.value = _uiState.value.copy(isLoading = true, error = null, bookingSuccess = false)
        viewModelScope.launch {
            val request = DiagnosticBookingRequest(
                centerId = center.id,
                testId = test.id,
                bookingDate = bookingDate,
                bookingTime = bookingTime,
                collectionType = collectionType,
                collectionAddress = collectionAddress,
                notes = notes
            )
            when (val result = repository.bookTest(request)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        bookingResult = result.data,
                        bookingSuccess = true
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> { }
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun resetBooking() {
        _uiState.value = _uiState.value.copy(
            selectedTest = null,
            bookingResult = null,
            bookingSuccess = false
        )
    }

    // ==================== BOOKING HISTORY ====================

    fun loadBookingHistory(status: String? = null) {
        _bookingHistoryState.value = _bookingHistoryState.value.copy(isLoading = true, error = null, filterStatus = status)
        viewModelScope.launch {
            when (val result = repository.getMyBookings(status = status)) {
                is Result.Success -> {
                    _bookingHistoryState.value = _bookingHistoryState.value.copy(
                        isLoading = false,
                        bookings = result.data
                    )
                }
                is Result.Error -> {
                    _bookingHistoryState.value = _bookingHistoryState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> { }
            }
        }
    }

    fun cancelBooking(bookingId: String) {
        _bookingHistoryState.value = _bookingHistoryState.value.copy(isLoading = true, error = null, cancelSuccess = false)
        viewModelScope.launch {
            when (val result = repository.cancelBooking(bookingId)) {
                is Result.Success -> {
                    _bookingHistoryState.value = _bookingHistoryState.value.copy(
                        isLoading = false,
                        cancelSuccess = true
                    )
                    loadBookingHistory(_bookingHistoryState.value.filterStatus) // Refresh
                }
                is Result.Error -> {
                    _bookingHistoryState.value = _bookingHistoryState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> { }
            }
        }
    }

    fun clearBookingHistoryError() {
        _bookingHistoryState.value = _bookingHistoryState.value.copy(error = null, cancelSuccess = false)
    }
}
