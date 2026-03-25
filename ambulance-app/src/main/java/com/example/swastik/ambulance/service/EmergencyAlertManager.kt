package com.example.swastik.ambulance.service

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Plays urgent alert sound + vibration pattern when an incoming SOS
 * emergency request is received. Life-critical — a Snackbar alone
 * is too subtle for ambulance drivers.
 */
@Singleton
class EmergencyAlertManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private var mediaPlayer: MediaPlayer? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private val autoStopRunnable = Runnable { stopAlert() }

    /** Vibration pattern: wait 0ms, vibrate 400ms, pause 200ms, vibrate 400ms, pause 200ms, vibrate 400ms */
    private val vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)

    /**
     * Trigger an urgent alert: vibration + alarm sound.
     * Safe to call from any thread.
     */
    fun triggerEmergencyAlert() {
        try {
            vibrate()
            playAlertSound()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to trigger alert", e)
        }
    }

    /**
     * Stop any playing alert (e.g., when user taps Accept or Reject).
     */
    fun stopAlert() {
        // Fix #8: Cancel the auto-stop callback FIRST to prevent double-release crash
        handler.removeCallbacks(autoStopRunnable)
        try {
            mediaPlayer?.apply {
                if (isPlaying) stop()
                release()
            }
            mediaPlayer = null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop alert", e)
        }
    }

    private fun vibrate() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            vibrator?.let { v ->
                v.vibrate(VibrationEffect.createWaveform(vibrationPattern, -1))
            }
        } catch (e: Exception) {
            Log.w(TAG, "Vibration failed", e)
        }
    }

    private fun playAlertSound() {
        try {
            // Stop any previously playing alert
            stopAlert()

            // Use the device's default alarm ringtone for urgency
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build()
                )
                setDataSource(context, alarmUri)
                isLooping = false
                prepare()
                start()
            }

            // Auto-stop after 5 seconds to avoid indefinite ringing
            // Cancel any previous auto-stop so a rapid re-trigger doesn't kill the new alert
            handler.removeCallbacks(autoStopRunnable)
            handler.postDelayed(autoStopRunnable, 5_000)
        } catch (e: Exception) {
            Log.w(TAG, "Alert sound failed", e)
        }
    }

    companion object {
        private const val TAG = "EmergencyAlert"
    }
}
