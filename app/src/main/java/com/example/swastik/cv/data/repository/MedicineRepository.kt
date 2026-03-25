package com.example.swastik.data.repository

import android.util.Log
import com.example.swastik.data.model.Medicine
import com.example.swastik.data.model.MedicineCategory
import com.example.swastik.data.remote.ApiService
import com.example.swastik.data.remote.dto.*
import com.example.swastik.data.local.db.MedicineDao
import com.example.swastik.data.local.db.CachedMedicine
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for Medicine data with Room caching.
 * Network-first for searches, cache fallback on failure.
 * Popular medicines and search results are cached for 30 min.
 */
@Singleton
class MedicineRepository @Inject constructor(
    private val apiService: ApiService,
    private val medicineDao: MedicineDao
) {

    companion object {
        private const val TAG = "MedicineRepository"
        private const val CACHE_DURATION_MS = 30 * 60 * 1000L // 30 minutes
    }

    /**
     * Search medicines — network-first with cache fallback.
     */
    suspend fun searchMedicines(query: String, page: Int = 1): Result<List<Medicine>> {
        // Try network first
        try {
            val response = apiService.searchMedicines(query = query, page = page)
            if (response.isSuccessful && response.body()?.success == true) {
                val medicines = response.body()?.data ?: emptyList()
                // Cache search results (page 1)
                if (page == 1 && medicines.isNotEmpty()) {
                    try {
                        val cached = medicines.map { it.toCachedMedicine() }
                        medicineDao.deleteStaleCache(System.currentTimeMillis() - CACHE_DURATION_MS)
                        medicineDao.insertMedicines(cached)
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to cache medicines: ${e.message}")
                    }
                }
                return Result.Success(medicines)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Network error, falling back to cache: ${e.message}")
        }

        // Fallback to cache
        return try {
            val cached = if (query.isNotBlank()) {
                medicineDao.searchMedicinesSync(query)
            } else {
                medicineDao.getAllMedicinesSync()
            }
            if (cached.isNotEmpty()) {
                Result.Success(cached.map { it.toDomainMedicine() })
            } else {
                Result.Error("No internet connection and no cached medicines")
            }
        } catch (e: Exception) {
            Result.Error("Network error and cache unavailable")
        }
    }

    /**
     * Get medicine categories from backend.
     */
    suspend fun getCategories(): Result<List<MedicineCategoryDto>> {
        return try {
            val response = apiService.getMedicineCategories()
            if (response.isSuccessful && response.body()?.success == true) {
                val categories = response.body()?.data ?: emptyList()
                Result.Success(categories)
            } else {
                Result.Error("Failed to load categories")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get popular medicines — network-first with cache fallback.
     */
    suspend fun getPopularMedicines(): Result<List<Medicine>> {
        // Try network first
        try {
            val response = apiService.getPopularMedicines()
            if (response.isSuccessful && response.body()?.success == true) {
                val medicines = response.body()?.data ?: emptyList()
                // Cache popular medicines
                if (medicines.isNotEmpty()) {
                    try {
                        medicineDao.deleteStaleCache(System.currentTimeMillis() - CACHE_DURATION_MS)
                        val cached = medicines.map { it.toCachedMedicine() }
                        medicineDao.insertMedicines(cached)
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to cache popular medicines: ${e.message}")
                    }
                }
                return Result.Success(medicines)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Popular medicines network failed, using cache: ${e.message}")
        }

        // Fallback to cache
        return try {
            val cached = medicineDao.getAllMedicinesSync()
            if (cached.isNotEmpty()) {
                Result.Success(cached.map { it.toDomainMedicine() })
            } else {
                Result.Error("No internet and no cached medicines")
            }
        } catch (e: Exception) {
            Result.Error("Failed to load popular medicines")
        }
    }

    /**
     * Get nearby medicines from local pharmacies based on geolocation.
     */
    suspend fun getNearbyMedicines(latitude: Double, longitude: Double): Result<List<NearbyMedicineDto>> {
        return try {
            val response = apiService.getNearbyMedicines(latitude = latitude, longitude = longitude)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error("Failed to load nearby medicines")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get medicine details by ID — network-first with cache fallback.
     */
    suspend fun getMedicineById(id: String): Result<Medicine> {
        // Try network first
        try {
            val response = apiService.getMedicineDetails(id)
            if (response.isSuccessful && response.body()?.success == true) {
                return response.body()?.data?.let {
                    // Cache this medicine
                    try { medicineDao.insertMedicines(listOf(it.toCachedMedicine())) } catch (_: Exception) {}
                    Result.Success(it)
                } ?: Result.Error("Medicine not found")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Medicine detail network failed, using cache: ${e.message}")
        }

        // Fallback to cache
        return try {
            val cached = medicineDao.getMedicineById(id)
            if (cached != null) {
                Result.Success(cached.toDomainMedicine())
            } else {
                Result.Error("Medicine not found offline")
            }
        } catch (e: Exception) {
            Result.Error("Failed to load medicine details")
        }
    }

    /**
     * Get medicine availability at nearby pharmacies — always network (real-time).
     */
    suspend fun getMedicineAvailability(medicineId: String, latitude: Double = 0.0, longitude: Double = 0.0): Result<List<MedicineAvailabilityDto>> {
        return try {
            val response = apiService.getMedicineAvailability(medicineId, latitude, longitude)
            if (response.isSuccessful && response.body()?.success == true) {
                val availability = response.body()?.data ?: emptyList()
                Result.Success(availability)
            } else {
                Result.Error("Failed to load availability")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get alternative medicines.
     */
    suspend fun getAlternatives(medicineId: String): Result<List<Medicine>> {
        return try {
            val response = apiService.getMedicineAlternatives(medicineId)
            if (response.isSuccessful && response.body()?.success == true) {
                val alternatives = response.body()?.data ?: emptyList()
                // Cache alternatives too
                if (alternatives.isNotEmpty()) {
                    try { medicineDao.insertMedicines(alternatives.map { it.toCachedMedicine() }) } catch (_: Exception) {}
                }
                Result.Success(alternatives)
            } else {
                Result.Error("Failed to load alternatives")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Create a medicine order at a pharmacy — always network.
     */
    suspend fun createOrder(request: MedicineOrderRequest): Result<MedicineOrderDto> {
        return try {
            val response = apiService.createMedicineOrder(request)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Error("Failed to create order")
            } else {
                Result.Error(response.body()?.message ?: "Order failed")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get patient's order history — always network (orders change frequently).
     */
    suspend fun getMyOrders(status: String? = null, page: Int = 1): Result<List<MedicineOrderDto>> {
        return try {
            val response = apiService.getMyOrders(status = status, page = page)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error("Failed to load orders")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get single order details.
     */
    suspend fun getOrderById(orderId: String): Result<MedicineOrderDto> {
        return try {
            val response = apiService.getOrderById(orderId)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Error("Order not found")
            } else {
                Result.Error("Failed to load order")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Cancel an order.
     */
    suspend fun cancelOrder(orderId: String): Result<MedicineOrderDto> {
        return try {
            val response = apiService.cancelOrder(orderId)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let {
                    Result.Success(it)
                } ?: Result.Error("Failed to cancel order")
            } else {
                Result.Error(response.body()?.message ?: "Cannot cancel order")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    // ==================== Cache Mapping Extensions ====================

    private fun Medicine.toCachedMedicine() = CachedMedicine(
        id = id,
        name = name,
        genericName = genericName,
        manufacturer = manufacturer,
        price = price?.toDouble(),
        category = category.name,
        description = description,
        requiresPrescription = requiresPrescription
    )

    private fun CachedMedicine.toDomainMedicine() = Medicine(
        id = id,
        name = name,
        genericName = genericName,
        manufacturer = manufacturer,
        price = price?.toFloat(),
        requiresPrescription = requiresPrescription,
        category = try { MedicineCategory.valueOf(category) } catch (_: Exception) { MedicineCategory.TABLET },
        description = description,
        inStock = true,
        stockCount = 0,
        nearbyPharmacy = null,
        pharmacyDistance = null
    )
}
