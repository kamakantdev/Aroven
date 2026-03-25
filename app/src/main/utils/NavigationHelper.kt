package com.example.swastik.utils

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import java.util.Locale
import kotlin.math.*

/**
 * Navigation Helper — Uses Android's Intent system to open ANY installed map app
 * (OsmAnd, Google Maps, Waze, etc.) for turn-by-turn navigation.
 * Falls back to OpenStreetMap in browser (no API key required).
 *
 * Also provides pure-math distance, ETA, and bearing calculations.
 */
object NavigationHelper {

    /**
     * Open any installed map app with directions to the given coordinates.
     * Tries generic geo: intent first (works with any map app), then OSM browser fallback.
     */
    fun openDirections(context: Context, destLat: Double, destLng: Double, label: String = "Destination") {
        try {
            // Try generic geo: URI first (works with OsmAnd, Google Maps, any map app)
            val geoUri = Uri.parse("geo:$destLat,$destLng?q=$destLat,$destLng(${Uri.encode(label)})")
            val geoIntent = Intent(Intent.ACTION_VIEW, geoUri)
            if (geoIntent.resolveActivity(context.packageManager) != null) {
                context.startActivity(geoIntent)
                return
            }
        } catch (_: Exception) { }

        // Fallback: open in browser using OpenStreetMap
        try {
            val browserUri = Uri.parse("https://www.openstreetmap.org/directions?route=;;$destLat,$destLng#map=15/$destLat/$destLng")
            context.startActivity(Intent(Intent.ACTION_VIEW, browserUri))
        } catch (_: Exception) {
            Toast.makeText(context, "No map app or browser found", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Open any installed map app showing a point-to-point route
     * (from origin to destination). Falls back to OpenStreetMap.
     */
    fun openDirectionsFromTo(
        context: Context,
        fromLat: Double, fromLng: Double,
        toLat: Double, toLng: Double,
        label: String = "Destination"
    ) {
        try {
            // Generic geo: intent first (OsmAnd, Google Maps, etc.)
            val geoUri = Uri.parse("geo:$toLat,$toLng?q=$toLat,$toLng(${Uri.encode(label)})")
            val geoIntent = Intent(Intent.ACTION_VIEW, geoUri)
            if (geoIntent.resolveActivity(context.packageManager) != null) {
                context.startActivity(geoIntent)
                return
            }
        } catch (_: Exception) { }

        try {
            // Fallback: OpenStreetMap directions in browser
            val url = "https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=$fromLat,$fromLng;$toLat,$toLng"
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            openDirections(context, toLat, toLng, label)
        }
    }

    /**
     * Open phone dialer with the given phone number.
     */
    fun openDialer(context: Context, phone: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))
            context.startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(context, "Could not open dialer", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Calculate distance between two coordinates in kilometers (Haversine formula).
     */
    fun calculateDistanceKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val earthRadiusKm = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return earthRadiusKm * c
    }

    /**
     * Format distance for display. Shows meters if < 1km, otherwise km.
     */
    fun formatDistance(distanceKm: Double): String {
        return if (distanceKm < 1.0) {
            "${(distanceKm * 1000).toInt()} m"
        } else {
            String.format(Locale.US, "%.1f km", distanceKm)
        }
    }

    /**
     * Estimate arrival time based on distance.
     * Uses average speed: 40 km/h in city, 60 km/h for ambulance.
     */
    fun estimateEtaMinutes(distanceKm: Double, avgSpeedKmh: Double = 40.0): Int {
        if (distanceKm <= 0 || avgSpeedKmh <= 0) return 0
        return ceil((distanceKm / avgSpeedKmh) * 60).toInt()
    }

    /**
     * Calculate bearing (compass direction) from one point to another.
     * Returns a cardinal direction string like "N", "NE", "E", etc.
     */
    fun getBearingDirection(fromLat: Double, fromLng: Double, toLat: Double, toLng: Double): String {
        val dLng = Math.toRadians(toLng - fromLng)
        val y = sin(dLng) * cos(Math.toRadians(toLat))
        val x = cos(Math.toRadians(fromLat)) * sin(Math.toRadians(toLat)) -
                sin(Math.toRadians(fromLat)) * cos(Math.toRadians(toLat)) * cos(dLng)
        val bearing = (Math.toDegrees(atan2(y, x)) + 360) % 360

        return when {
            bearing < 22.5 || bearing >= 337.5 -> "N"
            bearing < 67.5 -> "NE"
            bearing < 112.5 -> "E"
            bearing < 157.5 -> "SE"
            bearing < 202.5 -> "S"
            bearing < 247.5 -> "SW"
            bearing < 292.5 -> "W"
            else -> "NW"
        }
    }

    /**
     * Get a compass arrow emoji for the bearing direction.
     */
    fun getDirectionArrow(fromLat: Double, fromLng: Double, toLat: Double, toLng: Double): String {
        return when (getBearingDirection(fromLat, fromLng, toLat, toLng)) {
            "N" -> "⬆️"
            "NE" -> "↗️"
            "E" -> "➡️"
            "SE" -> "↘️"
            "S" -> "⬇️"
            "SW" -> "↙️"
            "W" -> "⬅️"
            "NW" -> "↖️"
            else -> "📍"
        }
    }
}
