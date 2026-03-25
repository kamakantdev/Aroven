package com.example.swastik.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swastik.data.model.Medicine
import com.example.swastik.data.model.MedicineCategory
import com.example.swastik.data.model.CartItem
import com.example.swastik.data.remote.dto.MedicineAvailabilityDto
import com.example.swastik.data.remote.dto.MedicineOrderRequest
import com.example.swastik.data.remote.dto.MedicineOrderDto
import com.example.swastik.data.remote.dto.NearbyMedicineDto
import com.example.swastik.data.remote.dto.OrderItemRequest
import com.example.swastik.data.repository.Result
import com.example.swastik.data.repository.MedicineRepository
import com.example.swastik.data.remote.OrderUpdate
import com.example.swastik.data.remote.SocketManager
import com.example.swastik.utils.LocationHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MedicineUiState(
    val medicines: List<Medicine> = emptyList(), // Popular/Global
    val nearbyMedicines: List<NearbyMedicineDto> = emptyList(), // Hybrid location-based
    val isLoading: Boolean = false,
    val error: String? = null,
    val searchQuery: String = "",
    val selectedCategory: MedicineCategory? = null
)

data class MedicineDetailUiState(
    val medicine: Medicine? = null,
    val availability: List<MedicineAvailabilityDto> = emptyList(),
    val alternatives: List<Medicine> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

data class PharmacyConflict(
    val newPharmacyId: String,
    val newPharmacyName: String?,
    val medicine: Medicine
)

data class CartUiState(
    val items: List<CartItem> = emptyList(),
    val selectedPharmacyId: String? = null,
    val selectedPharmacyName: String? = null,
    val deliveryAddress: String = "",
    val isOrdering: Boolean = false,
    val orderResult: MedicineOrderDto? = null,
    val orderError: String? = null,
    val orderSuccess: Boolean = false,
    val pharmacyConflict: PharmacyConflict? = null
) {
    val totalItems: Int get() = items.sumOf { it.quantity }
    val totalPrice: Float get() = items.sumOf { it.totalPrice.toDouble() }.toFloat()
}

data class OrderHistoryUiState(
    val isLoading: Boolean = false,
    val orders: List<MedicineOrderDto> = emptyList(),
    val selectedOrder: MedicineOrderDto? = null,
    val error: String? = null,
    val filterStatus: String? = null,
    val cancelSuccess: Boolean = false,
    val lastRealtimeUpdate: OrderUpdate? = null
)

@OptIn(FlowPreview::class)
@HiltViewModel
class MedicineViewModel @Inject constructor(
    private val medicineRepository: MedicineRepository,
    private val locationHelper: LocationHelper,
    private val socketManager: SocketManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(MedicineUiState())
    val uiState: StateFlow<MedicineUiState> = _uiState.asStateFlow()

    private val _detailState = MutableStateFlow(MedicineDetailUiState())
    val detailState: StateFlow<MedicineDetailUiState> = _detailState.asStateFlow()

    private val _cartState = MutableStateFlow(CartUiState())
    val cartState: StateFlow<CartUiState> = _cartState.asStateFlow()

    private val _orderHistoryState = MutableStateFlow(OrderHistoryUiState())
    val orderHistoryState: StateFlow<OrderHistoryUiState> = _orderHistoryState.asStateFlow()

    // Expose real-time order updates as a SharedFlow for snackbar/toast in UI
    private val _realtimeOrderEvent = MutableSharedFlow<OrderUpdate>(replay = 0)
    val realtimeOrderEvent: SharedFlow<OrderUpdate> = _realtimeOrderEvent.asSharedFlow()

    private var hasObservedSocketConnection = false

    init {
        loadPopularMedicines()
        collectRealtimeOrderUpdates()
        collectProviderCatalogUpdates()
        observeSocketReconnects()
    }

    /**
     * Collect real-time order status updates from SocketManager.
     * Auto-refreshes the order history list and emits an event for UI notification.
     */
    private fun collectRealtimeOrderUpdates() {
        viewModelScope.launch {
            socketManager.orderUpdates.collect { update ->
                // Update the last realtime update in state
                _orderHistoryState.value = _orderHistoryState.value.copy(
                    lastRealtimeUpdate = update
                )
                // Auto-refresh the order list so status changes appear instantly
                loadOrderHistory(_orderHistoryState.value.filterStatus)
                // Emit event for UI snackbar notification
                _realtimeOrderEvent.emit(update)
            }
        }
    }

    private fun collectProviderCatalogUpdates() {
        viewModelScope.launch {
            socketManager.providerCatalogUpdates.collect {
                refreshMedicineDiscovery()
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
                    refreshMedicineDiscovery()
                }
            }
        }
    }

    private fun refreshMedicineDiscovery() {
        val currentQuery = _uiState.value.searchQuery
        if (currentQuery.isBlank()) {
            loadPopularMedicines()
        } else {
            searchMedicines(currentQuery)
        }

        val detailMedicineId = _detailState.value.medicine?.id
        if (!detailMedicineId.isNullOrBlank()) {
            viewModelScope.launch {
                loadAvailability(detailMedicineId)
            }
        }
    }

    fun loadPopularMedicines() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            // 1. Fetch Global Popular
            var globalMedicines: List<Medicine>? = null
            var errorMsg: String? = null
            when (val result = medicineRepository.getPopularMedicines()) {
                is Result.Success -> globalMedicines = result.data
                is Result.Error -> errorMsg = result.message
                else -> {}
            }

            // 2. Fetch Nearby Inventory (Hybrid)
            var nearbyItems: List<NearbyMedicineDto>? = null
            try {
                val location = locationHelper.getLastLocation()
                if (location != null) {
                    when (val result = medicineRepository.getNearbyMedicines(location.latitude, location.longitude)) {
                        is Result.Success -> nearbyItems = result.data
                        else -> {}
                    }
                }
            } catch (e: Exception) {
                // Ignore location errors
            }

            _uiState.value = _uiState.value.copy(
                medicines = globalMedicines ?: _uiState.value.medicines,
                nearbyMedicines = nearbyItems ?: _uiState.value.nearbyMedicines,
                isLoading = false,
                error = errorMsg
            )
        }
    }

    fun searchMedicines(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
        if (query.isBlank()) {
            searchJob?.cancel()
            loadPopularMedicines()
            return
        }
        // Cancel previous search and debounce by 350ms
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            kotlinx.coroutines.delay(350)
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = medicineRepository.searchMedicines(query)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        medicines = result.data,
                        isLoading = false
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    private var searchJob: Job? = null

    fun setCategory(category: MedicineCategory?) {
        _uiState.value = _uiState.value.copy(selectedCategory = category)
    }

    fun loadMedicineDetail(medicineId: String) {
        viewModelScope.launch {
            _detailState.value = MedicineDetailUiState(isLoading = true)
            when (val result = medicineRepository.getMedicineById(medicineId)) {
                is Result.Success -> {
                    _detailState.value = _detailState.value.copy(
                        medicine = result.data,
                        isLoading = false
                    )
                    // Load availability and alternatives in parallel
                    launch { loadAvailability(medicineId) }
                    launch { loadAlternatives(medicineId) }
                }
                is Result.Error -> {
                    _detailState.value = _detailState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    private suspend fun loadAvailability(medicineId: String) {
        // Get user's actual location for nearby pharmacy search
        val location = try { locationHelper.getLastLocation() } catch (_: Exception) { null }
        val lat = location?.latitude ?: return  // Skip availability if no location permission
        val lng = location?.longitude ?: return

        when (val result = medicineRepository.getMedicineAvailability(medicineId, lat, lng)) {
            is Result.Success -> {
                _detailState.value = _detailState.value.copy(availability = result.data)
            }
            is Result.Error -> { /* Silently handle — non-critical */ }
            is Result.Loading -> {}
        }
    }

    private suspend fun loadAlternatives(medicineId: String) {
        when (val result = medicineRepository.getAlternatives(medicineId)) {
            is Result.Success -> {
                _detailState.value = _detailState.value.copy(alternatives = result.data)
            }
            is Result.Error -> { /* Silently handle — non-critical */ }
            is Result.Loading -> {}
        }
    }

    /**
     * Get filtered medicines based on current state
     */
    fun getFilteredMedicines(): List<Medicine> {
        val state = _uiState.value
        return state.medicines.filter { medicine ->
            val categoryMatch = state.selectedCategory == null || medicine.category == state.selectedCategory
            categoryMatch
        }
    }

    // ==================== CART & ORDER ====================

    fun addToCart(medicine: Medicine, pharmacyId: String? = null, pharmacyName: String? = null) {
        val cart = _cartState.value
        if (!cart.selectedPharmacyId.isNullOrBlank() && pharmacyId != null && pharmacyId != cart.selectedPharmacyId) {
            _cartState.value = cart.copy(
                pharmacyConflict = PharmacyConflict(pharmacyId, pharmacyName, medicine)
            )
            return
        }

        val currentItems = cart.items.toMutableList()
        val existingIndex = currentItems.indexOfFirst { it.medicine.id == medicine.id }
        if (existingIndex >= 0) {
            currentItems[existingIndex] = currentItems[existingIndex].copy(
                quantity = currentItems[existingIndex].quantity + 1
            )
        } else {
            currentItems.add(CartItem(medicine = medicine, quantity = 1))
        }
        _cartState.value = cart.copy(
            items = currentItems,
            selectedPharmacyId = pharmacyId ?: cart.selectedPharmacyId,
            selectedPharmacyName = pharmacyName ?: cart.selectedPharmacyName,
            pharmacyConflict = null
        )
    }

    fun resolvePharmacyConflict(clearCartAndAdd: Boolean) {
        val conflict = _cartState.value.pharmacyConflict ?: return
        if (clearCartAndAdd) {
            _cartState.value = CartUiState(
                selectedPharmacyId = conflict.newPharmacyId,
                selectedPharmacyName = conflict.newPharmacyName,
                deliveryAddress = _cartState.value.deliveryAddress
            )
            addToCart(conflict.medicine, conflict.newPharmacyId, conflict.newPharmacyName)
        } else {
            _cartState.value = _cartState.value.copy(pharmacyConflict = null)
        }
    }

    fun removeFromCart(medicineId: String) {
        _cartState.value = _cartState.value.copy(
            items = _cartState.value.items.filter { it.medicine.id != medicineId }
        )
    }

    fun updateCartQuantity(medicineId: String, quantity: Int) {
        if (quantity <= 0) {
            removeFromCart(medicineId)
            return
        }
        _cartState.value = _cartState.value.copy(
            items = _cartState.value.items.map {
                if (it.medicine.id == medicineId) it.copy(quantity = quantity) else it
            }
        )
    }

    fun setDeliveryAddress(address: String) {
        _cartState.value = _cartState.value.copy(deliveryAddress = address)
    }

    fun setPharmacy(pharmacyId: String, pharmacyName: String) {
        _cartState.value = _cartState.value.copy(
            selectedPharmacyId = pharmacyId,
            selectedPharmacyName = pharmacyName
        )
    }

    fun placeOrder() {
        val cart = _cartState.value
        if (cart.selectedPharmacyId.isNullOrBlank() || cart.items.isEmpty() || cart.deliveryAddress.isBlank()) {
            _cartState.value = cart.copy(orderError = "Please fill in all order details")
            return
        }

        _cartState.value = cart.copy(isOrdering = true, orderError = null, orderSuccess = false)
        viewModelScope.launch {
            val request = MedicineOrderRequest(
                pharmacyId = cart.selectedPharmacyId,
                items = cart.items.map { OrderItemRequest(medicineId = it.medicine.id, quantity = it.quantity) },
                deliveryAddress = cart.deliveryAddress
            )
            when (val result = medicineRepository.createOrder(request)) {
                is Result.Success -> {
                    _cartState.value = _cartState.value.copy(
                        isOrdering = false,
                        orderResult = result.data,
                        orderSuccess = true,
                        items = emptyList() // Clear cart
                    )
                }
                is Result.Error -> {
                    _cartState.value = _cartState.value.copy(
                        isOrdering = false,
                        orderError = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearCart() {
        _cartState.value = CartUiState()
    }

    fun clearOrderError() {
        _cartState.value = _cartState.value.copy(orderError = null)
    }

    fun resetOrderSuccess() {
        _cartState.value = _cartState.value.copy(orderSuccess = false, orderResult = null)
    }

    // ==================== ORDER HISTORY ====================

    fun loadOrderHistory(status: String? = null) {
        _orderHistoryState.value = _orderHistoryState.value.copy(isLoading = true, error = null, filterStatus = status)
        viewModelScope.launch {
            when (val result = medicineRepository.getMyOrders(status = status)) {
                is Result.Success -> {
                    _orderHistoryState.value = _orderHistoryState.value.copy(
                        isLoading = false,
                        orders = result.data
                    )
                }
                is Result.Error -> {
                    _orderHistoryState.value = _orderHistoryState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    fun cancelOrder(orderId: String) {
        _orderHistoryState.value = _orderHistoryState.value.copy(isLoading = true, error = null, cancelSuccess = false)
        viewModelScope.launch {
            when (val result = medicineRepository.cancelOrder(orderId)) {
                is Result.Success -> {
                    _orderHistoryState.value = _orderHistoryState.value.copy(
                        isLoading = false,
                        cancelSuccess = true
                    )
                    loadOrderHistory(_orderHistoryState.value.filterStatus) // Refresh
                }
                is Result.Error -> {
                    _orderHistoryState.value = _orderHistoryState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearOrderHistoryError() {
        _orderHistoryState.value = _orderHistoryState.value.copy(error = null, cancelSuccess = false)
    }
}
