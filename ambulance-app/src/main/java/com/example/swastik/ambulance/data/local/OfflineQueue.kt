package com.example.swastik.ambulance.data.local

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import org.json.JSONArray
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Simple offline queue for ambulance status updates.
 * If a status update or location push fails while offline,
 * it is persisted to SharedPreferences and replayed when
 * the socket reconnects.
 *
 * Each pending action is: { "type": "status_update"|"location", "payload": {...}, "timestamp": ... }
 */
@Singleton
class OfflineQueue @Inject constructor(
    @ApplicationContext context: Context
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val lock = Any()

    /** Enqueue a status update for later replay. */
    fun enqueueStatusUpdate(requestId: String, status: String) {
        val action = JSONObject().apply {
            put("type", TYPE_STATUS)
            put("requestId", requestId)
            put("status", status)
            put("timestamp", System.currentTimeMillis())
        }
        enqueue(action)
    }

    /** Enqueue a location update for later replay. */
    fun enqueueLocation(latitude: Double, longitude: Double, requestId: String?) {
        val action = JSONObject().apply {
            put("type", TYPE_LOCATION)
            put("latitude", latitude)
            put("longitude", longitude)
            if (requestId != null) put("requestId", requestId)
            put("timestamp", System.currentTimeMillis())
        }
        enqueue(action)
    }

    /**
     * Drain and return all queued actions, clearing the queue.
     * Returns list of JSONObjects, oldest first.
     */
    fun drain(): List<JSONObject> {
        synchronized(lock) {
            val raw = prefs.getString(KEY_QUEUE, null) ?: return emptyList()
            return try {
                val arr = JSONArray(raw)
                val now = System.currentTimeMillis()
                val result = mutableListOf<JSONObject>()
                var discarded = 0
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    val ts = obj.optLong("timestamp", 0L)
                    // Discard entries older than TTL (stale actions shouldn't be replayed)
                    if (ts > 0 && (now - ts) > TTL_MS) {
                        discarded++
                        continue
                    }
                    result.add(obj)
                }
                // Clear the queue
                prefs.edit().remove(KEY_QUEUE).apply()
                if (discarded > 0) Log.d(TAG, "Discarded $discarded stale action(s)")
                Log.d(TAG, "Drained ${result.size} queued action(s)")
                result
            } catch (e: Exception) {
                Log.e(TAG, "Failed to drain queue", e)
                prefs.edit().remove(KEY_QUEUE).apply()
                emptyList()
            }
        }
    }

    /** Number of pending actions. */
    val pendingCount: Int
        get() {
            val raw = prefs.getString(KEY_QUEUE, null) ?: return 0
            return try { JSONArray(raw).length() } catch (_: Exception) { 0 }
        }

    private fun enqueue(action: JSONObject) {
        synchronized(lock) {
            val raw = prefs.getString(KEY_QUEUE, null)
            val arr = if (raw != null) {
                try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
            } else {
                JSONArray()
            }
            // Cap queue at 100 items to avoid unbounded growth
            if (arr.length() >= MAX_QUEUE_SIZE) {
                Log.w(TAG, "Offline queue full ($MAX_QUEUE_SIZE), dropping oldest")
                val trimmed = JSONArray()
                for (i in 1 until arr.length()) trimmed.put(arr.get(i))
                trimmed.put(action)
                prefs.edit().putString(KEY_QUEUE, trimmed.toString()).apply()
            } else {
                arr.put(action)
                prefs.edit().putString(KEY_QUEUE, arr.toString()).apply()
            }
            Log.d(TAG, "Enqueued ${action.optString("type")}, queue size: ${arr.length()}")
        }
    }

    companion object {
        private const val TAG = "OfflineQueue"
        private const val PREFS_NAME = "ambulance_offline_queue"
        private const val KEY_QUEUE = "pending_actions"
        private const val MAX_QUEUE_SIZE = 100
        /** Time-to-live: discard queued actions older than 1 hour */
        private const val TTL_MS = 60 * 60 * 1000L
        const val TYPE_STATUS = "status_update"
        const val TYPE_LOCATION = "location"
    }
}
