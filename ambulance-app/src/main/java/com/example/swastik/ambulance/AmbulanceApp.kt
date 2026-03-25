package com.example.swastik.ambulance

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import org.osmdroid.config.Configuration

@HiltAndroidApp
class AmbulanceApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize osmdroid map configuration
        Configuration.getInstance().apply {
            userAgentValue = packageName
            osmdroidBasePath = cacheDir
            osmdroidTileCache = java.io.File(cacheDir, "osmdroid/tiles")
        }
    }
}
