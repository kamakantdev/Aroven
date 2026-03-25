package com.example.swastik.ambulance.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.Looper
import android.util.Log
import com.example.swastik.ambulance.data.local.TokenManager
import com.example.swastik.ambulance.data.remote.SocketManager
import com.example.swastik.ambulance.data.repository.AmbulanceRepository
import com.google.android.gms.location.*
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Foreground service that continuously sends the ambulance's GPS location
 * to the backend via Socket.IO so the patient app can track it in real time.
 *
 * Falls back to REST API when Socket.IO is disconnected.
 *
 * Started/stopped from the Dashboard GPS toggle button.
 */
@AndroidEntryPoint
class LocationTrackingService : Service() {

    @Inject lateinit var socketManager: SocketManager
    @Inject lateinit var tokenManager: TokenManager
    @Inject lateinit var ambulanceRepository: AmbulanceRepository

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var isTracking = false
    /** The active emergency requestId so the backend can route location to the right room */
    private var activeRequestId: String? = null
    /** Timestamp of last REST API location update — throttle to avoid hammering */
    private var lastRestUpdateMs: Long = 0L

    /** Service-scoped coroutine scope for REST fallback calls. */
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    // Fix #27: Skip low-accuracy GPS fixes to avoid showing wrong ambulance position
                    if (location.accuracy > 100f) {
                        Log.d(TAG, "Skipping low-accuracy fix: ${location.accuracy}m")
                        return
                    }

                    Log.d(TAG, "Location update: ${location.latitude}, ${location.longitude} (accuracy: ${location.accuracy}m)")

                    // Use activeRequestId from Intent extra OR from SocketManager (set on accept/status change)
                    val effectiveRequestId = activeRequestId ?: socketManager.activeRequestId

                    // Primary: Send via Socket.IO for real-time tracking
                    // Include heading, speed, and active requestId so backend
                    // can broadcast to the correct ambulance:{requestId} room
                    if (socketManager.isConnected) {
                        socketManager.sendLocationUpdate(
                            latitude = location.latitude,
                            longitude = location.longitude,
                            heading = location.bearing,
                            speed = location.speed,
                            requestId = effectiveRequestId
                        )
                    }

                    // Always also send via REST API as reliable fallback/persistence
                    // Throttled to every 30 seconds to avoid hammering the server
                    val now = System.currentTimeMillis()
                    if (now - lastRestUpdateMs >= REST_THROTTLE_MS) {
                        lastRestUpdateMs = now
                        serviceScope.launch {
                            try {
                                ambulanceRepository.updateLocationViaApi(
                                    latitude = location.latitude,
                                    longitude = location.longitude
                                )
                            } catch (e: Exception) {
                                Log.w(TAG, "REST location fallback failed: ${e.message}")
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Accept an optional requestId so location updates route to the correct room
        intent?.getStringExtra(EXTRA_REQUEST_ID)?.let { activeRequestId = it }

        when (intent?.action) {
            ACTION_START -> startTracking()
            ACTION_STOP -> stopTracking()
            // Fix #4: Handle null intent (system restart with START_STICKY).
            // When OS kills and restarts the service, intent is null.
            // Resume tracking so the patient doesn't lose sight of the ambulance.
            null -> {
                if (!isTracking) {
                    Log.w(TAG, "Service restarted by system (null intent) — resuming tracking")
                    startTracking()
                }
            }
        }
        return START_STICKY
    }

    private fun startTracking() {
        if (isTracking) return
        isTracking = true

        // Ensure socket is connected before starting location updates
        val token = tokenManager.getAccessToken()
        val userId = tokenManager.getUserId()
        if (token != null && userId != null && !socketManager.isConnected) {
            socketManager.connect(token, userId)
        }

        // Start foreground notification
        val notification = buildNotification("Tracking active — sharing your location")
        startForeground(NOTIFICATION_ID, notification)

        // Small delay to allow socket connection to establish before GPS pings start
        serviceScope.launch {
            kotlinx.coroutines.delay(1500)
            startLocationUpdates()
        }
    }

    private fun startLocationUpdates() {
        // GPS power optimization: use high-accuracy, fast polling when there's an
        // active emergency request; use balanced power with slower polling when idle.
        val effectiveRequestId = activeRequestId ?: socketManager.activeRequestId
        val hasActiveRequest = !effectiveRequestId.isNullOrBlank()

        val priority = if (hasActiveRequest) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY
        val interval = if (hasActiveRequest) LOCATION_INTERVAL_MS else IDLE_LOCATION_INTERVAL_MS
        val fastestInterval = if (hasActiveRequest) FASTEST_INTERVAL_MS else IDLE_FASTEST_INTERVAL_MS
        val minDistance = if (hasActiveRequest) MIN_DISTANCE_METERS else IDLE_MIN_DISTANCE_METERS

        val locationRequest = LocationRequest.Builder(
            priority,
            interval
        ).apply {
            setMinUpdateIntervalMillis(fastestInterval)
            setMinUpdateDistanceMeters(minDistance)
            setWaitForAccurateLocation(false)
        }.build()

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            Log.d(TAG, "Location tracking started")
        } catch (e: SecurityException) {
            Log.e(TAG, "Missing location permission", e)
            stopSelf()
        }
    }

    private fun stopTracking() {
        if (!isTracking) return
        isTracking = false

        fusedLocationClient.removeLocationUpdates(locationCallback)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        Log.d(TAG, "Location tracking stopped")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        if (isTracking) {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }
        serviceScope.cancel()
    }

    // ==================== Notification ====================

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Ambulance Location Tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows when your location is being shared with patients"
            setShowBadge(false)
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        // Tapping notification opens the app
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Stop tracking action
        val stopIntent = Intent(this, LocationTrackingService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = Notification.Builder(this, CHANNEL_ID)

        return builder
            .setContentTitle("Swastik Ambulance")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .addAction(
                Notification.Action.Builder(
                    null, "Stop Tracking", stopPendingIntent
                ).build()
            )
            .build()
    }

    companion object {
        const val ACTION_START = "ACTION_START_TRACKING"
        const val ACTION_STOP = "ACTION_STOP_TRACKING"
        /** Pass emergency request ID so location updates route to the correct Socket.IO room */
        const val EXTRA_REQUEST_ID = "EXTRA_REQUEST_ID"

        private const val TAG = "LocationService"
        private const val CHANNEL_ID = "ambulance_location_channel"
        private const val NOTIFICATION_ID = 1001

        /** Location update interval in milliseconds (5 seconds) — active emergency */
        private const val LOCATION_INTERVAL_MS = 5000L

        /** Fastest allowed interval (3 seconds) — active emergency */
        private const val FASTEST_INTERVAL_MS = 3000L

        /** Minimum distance change to trigger update (5 meters) — active emergency */
        private const val MIN_DISTANCE_METERS = 5f

        /** Location update interval when idle (30 seconds) — no active emergency */
        private const val IDLE_LOCATION_INTERVAL_MS = 30_000L

        /** Fastest allowed interval when idle (15 seconds) */
        private const val IDLE_FASTEST_INTERVAL_MS = 15_000L

        /** Minimum distance change when idle (50 meters) */
        private const val IDLE_MIN_DISTANCE_METERS = 50f

        /** REST API fallback throttle interval (30 seconds) */
        private const val REST_THROTTLE_MS = 30_000L
    }
}
