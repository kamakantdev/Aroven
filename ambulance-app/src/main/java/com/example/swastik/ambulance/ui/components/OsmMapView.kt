package com.example.swastik.ambulance.ui.components

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.Drawable
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

/**
 * Data class for map markers.
 */
data class MapMarkerData(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val title: String,
    val snippet: String = "",
    val markerColor: Int = android.graphics.Color.RED,
    val onClick: (() -> Unit)? = null
)

/**
 * Reusable OpenStreetMap composable for the Ambulance app.
 * Uses osmdroid — no API key required.
 */
@Composable
fun OsmMapView(
    modifier: Modifier = Modifier,
    center: GeoPoint = GeoPoint(20.5937, 78.9629),
    zoom: Double = 14.0,
    markers: List<MapMarkerData> = emptyList(),
    showUserLocation: Boolean = false,
    userLatitude: Double = 0.0,
    userLongitude: Double = 0.0
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val mapViewRef = remember { mutableStateOf<MapView?>(null) }
    // Track whether the user has manually interacted with the map
    val userHasInteracted = remember { mutableStateOf(false) }

    // Manage MapView lifecycle so tiles load correctly and memory is released
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapViewRef.value?.onResume()
                Lifecycle.Event.ON_PAUSE -> mapViewRef.value?.onPause()
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            mapViewRef.value?.onDetach()
        }
    }

    LaunchedEffect(Unit) {
        Configuration.getInstance().apply {
            userAgentValue = context.packageName
            osmdroidBasePath = context.cacheDir
            osmdroidTileCache = java.io.File(context.cacheDir, "osmdroid/tiles")
        }
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            MapView(ctx).apply {
                setTileSource(TileSourceFactory.MAPNIK)
                setMultiTouchControls(true)
                controller.setZoom(zoom)
                controller.setCenter(center)
                setOnTouchListener { v, event ->
                    v.parent?.requestDisallowInterceptTouchEvent(true)
                    // Mark that user has manually interacted — stop overriding zoom/center
                    if (event.action == android.view.MotionEvent.ACTION_MOVE) {
                        userHasInteracted.value = true
                    }
                    if (event.action == android.view.MotionEvent.ACTION_UP) {
                        v.performClick()
                    }
                    false
                }
                mapViewRef.value = this
            }
        },
        update = { mapView ->
            mapView.overlays.clear()

            if (showUserLocation && userLatitude != 0.0 && userLongitude != 0.0) {
                val userMarker = Marker(mapView).apply {
                    position = GeoPoint(userLatitude, userLongitude)
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    title = "Your Location"
                    icon = createCircleDrawable(context, android.graphics.Color.parseColor("#1976D2"), 20)
                }
                mapView.overlays.add(userMarker)
            }

            markers.forEach { markerData ->
                val marker = Marker(mapView).apply {
                    position = GeoPoint(markerData.latitude, markerData.longitude)
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                    title = markerData.title
                    snippet = markerData.snippet
                    icon = createCircleDrawable(context, markerData.markerColor, 28)
                    if (markerData.onClick != null) {
                        setOnMarkerClickListener { _, _ ->
                            markerData.onClick.invoke()
                            true
                        }
                    }
                }
                mapView.overlays.add(marker)
            }

            // Only update center/zoom if user hasn't manually panned/zoomed
            if (!userHasInteracted.value) {
                val currentCenter = mapView.mapCenter as? GeoPoint
                if (currentCenter == null || currentCenter.latitude != center.latitude || currentCenter.longitude != center.longitude) {
                    mapView.controller.animateTo(center)
                }
                mapView.controller.setZoom(zoom)
            }
            mapView.invalidate()
        }
    )
}

private fun createCircleDrawable(context: Context, color: Int, sizeDp: Int): Drawable {
    val density = context.resources.displayMetrics.density
    val sizePx = (sizeDp * density).toInt()

    return object : Drawable() {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.FILL
        }
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = android.graphics.Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = 3f * density
        }

        override fun draw(canvas: Canvas) {
            val cx = bounds.centerX().toFloat()
            val cy = bounds.centerY().toFloat()
            val radius = (bounds.width() / 2f) - (2f * density)
            canvas.drawCircle(cx, cy, radius, paint)
            canvas.drawCircle(cx, cy, radius, borderPaint)
        }

        override fun getIntrinsicWidth() = sizePx
        override fun getIntrinsicHeight() = sizePx
        override fun setAlpha(alpha: Int) { paint.alpha = alpha }
        override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) { paint.colorFilter = colorFilter }
        @Deprecated("Deprecated in Java")
        override fun getOpacity() = android.graphics.PixelFormat.TRANSLUCENT
    }.also {
        it.setBounds(0, 0, sizePx, sizePx)
    }
}
