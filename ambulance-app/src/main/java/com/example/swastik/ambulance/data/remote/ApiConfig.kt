package com.example.swastik.ambulance.data.remote

import android.net.Uri
import android.os.Build
import com.example.swastik.ambulance.BuildConfig

object ApiConfig {
    private const val EMULATOR_BASE_URL = "http://10.0.2.2:5001/api/"

    private fun isProbablyEmulator(): Boolean {
        return Build.FINGERPRINT.startsWith("generic") ||
            Build.FINGERPRINT.lowercase().contains("emulator") ||
            Build.MODEL.contains("Emulator") ||
            Build.MODEL.contains("Android SDK built for") ||
            Build.MANUFACTURER.contains("Genymotion") ||
            Build.HARDWARE.contains("goldfish") ||
            Build.HARDWARE.contains("ranchu") ||
            Build.PRODUCT.contains("sdk")
    }

    val BASE_URL: String = if (isProbablyEmulator()) EMULATOR_BASE_URL else BuildConfig.API_BASE_URL

    /** Socket URL is the server root (scheme + host + port, without /api path). */
    val SOCKET_URL: String = run {
        val uri = Uri.parse(BASE_URL)
        val port = if (uri.port > 0) ":${uri.port}" else ""
        "${uri.scheme}://${uri.host}$port"
    }
}
