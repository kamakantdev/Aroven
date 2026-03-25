package com.example.swastik.utils

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * LocationHelper — wraps FusedLocationProviderClient for the entire patient app.
 *
 * Usage:
 *   1. Check `hasLocationPermission()` from the UI
 *   2. If false → launch permission request (ActivityResultContracts)
 *   3. If true  → call `getLastLocation()` (one-shot) or `requestLocationUpdates()` (stream)
 */
@Singleton
class LocationHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    /** Quick check — both FINE and COARSE are declared in the manifest. */
    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * One-shot: returns the device's last-known location, or actively requests one
     * if the cache is empty.  Returns null only when permission is missing.
     */
    @Suppress("MissingPermission")
    suspend fun getLastLocation(): Location? {
        if (!hasLocationPermission()) return null

        // Timeout after 15s to avoid indefinite hang if GPS is disabled
        return withTimeoutOrNull(15_000L) {
            suspendCancellableCoroutine { cont ->
            fusedClient.lastLocation
                .addOnSuccessListener { location ->
                    if (location != null) {
                        cont.resume(location)
                    } else {
                        // Cache empty → request a fresh fix
                        val request = LocationRequest.Builder(
                            Priority.PRIORITY_HIGH_ACCURACY, 1_000L
                        ).setMaxUpdates(1).build()

                        val callback = object : LocationCallback() {
                            override fun onLocationResult(result: LocationResult) {
                                fusedClient.removeLocationUpdates(this)
                                cont.resume(result.lastLocation)
                            }
                        }
                        fusedClient.requestLocationUpdates(request, callback, Looper.getMainLooper())
                        cont.invokeOnCancellation { fusedClient.removeLocationUpdates(callback) }
                    }
                }
                .addOnFailureListener {
                    cont.resume(null)
                }
        }
        }
    }

    /**
     * Continuous stream of location updates (for ambulance tracking, live map, etc.).
     * Emits every [intervalMs]. Caller collects in a coroutine scope.
     */
    @Suppress("MissingPermission")
    fun requestLocationUpdates(
        intervalMs: Long = 5_000L,
        priority: Int = Priority.PRIORITY_HIGH_ACCURACY
    ): Flow<Location> = callbackFlow {
        if (!hasLocationPermission()) {
            close(SecurityException("Location permission not granted"))
            return@callbackFlow
        }

        val request = LocationRequest.Builder(priority, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .build()

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { trySend(it) }
            }
        }

        fusedClient.requestLocationUpdates(request, callback, Looper.getMainLooper())

        awaitClose { fusedClient.removeLocationUpdates(callback) }
    }
}
