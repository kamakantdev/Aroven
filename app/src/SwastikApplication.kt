package com.example.swastik

import android.app.Application
import com.example.swastik.data.local.AppSettingsStore
import com.example.swastik.data.sync.SyncManager
import dagger.hilt.android.HiltAndroidApp
import org.osmdroid.config.Configuration
import javax.inject.Inject

/**
 * Application class with Hilt dependency injection
 */
@HiltAndroidApp
class SwastikApplication : Application() {

    @Inject
    lateinit var syncManager: SyncManager
    
    override fun onCreate() {
        super.onCreate()
        AppSettingsStore.init(this)
        // Initialize osmdroid map configuration
        Configuration.getInstance().apply {
            userAgentValue = packageName
            osmdroidBasePath = cacheDir
            osmdroidTileCache = java.io.File(cacheDir, "osmdroid/tiles")
        }

        // Start SyncManager to drain offline queue when network restores
        syncManager.startObserving()
    }
}
