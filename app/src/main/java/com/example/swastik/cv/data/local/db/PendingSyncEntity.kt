package com.example.swastik.data.local.db

import androidx.room.*

/**
 * Room entity for queuing write operations that failed due to no connectivity.
 * When the device comes back online, SyncManager replays these in order.
 */
@Entity(tableName = "pending_sync_actions")
data class PendingSyncAction(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** The action type: "book_appointment", "cancel_appointment", "reschedule_appointment" */
    val actionType: String,
    /** JSON-serialized payload for the request */
    val payload: String,
    /** Timestamp when the action was queued */
    val createdAt: Long = System.currentTimeMillis(),
    /** Number of retry attempts so far */
    val retryCount: Int = 0,
    /** Last error message if any */
    val lastError: String? = null,
    /** Status: "pending", "in_progress", "failed", "completed" */
    val status: String = "pending"
)
