package com.example.swastik.data.local.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * DAO for managing offline write queue (pending sync actions).
 */
@Dao
interface SyncQueueDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(action: PendingSyncAction): Long

    @Query("SELECT * FROM pending_sync_actions WHERE status = 'pending' ORDER BY createdAt ASC")
    suspend fun getPendingActions(): List<PendingSyncAction>

    @Query("SELECT COUNT(*) FROM pending_sync_actions WHERE status = 'pending'")
    fun getPendingCount(): Flow<Int>

    @Update
    suspend fun update(action: PendingSyncAction)

    @Query("UPDATE pending_sync_actions SET status = 'in_progress' WHERE id = :id")
    suspend fun markInProgress(id: Long)

    @Query("UPDATE pending_sync_actions SET status = 'completed' WHERE id = :id")
    suspend fun markCompleted(id: Long)

    @Query("UPDATE pending_sync_actions SET status = 'failed', retryCount = retryCount + 1, lastError = :error WHERE id = :id")
    suspend fun markFailed(id: Long, error: String)

    @Query("DELETE FROM pending_sync_actions WHERE status = 'completed'")
    suspend fun clearCompleted()

    @Query("DELETE FROM pending_sync_actions WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM pending_sync_actions")
    suspend fun clearAll()

    /** Actions that have failed too many times (> maxRetries) */
    @Query("SELECT * FROM pending_sync_actions WHERE status = 'failed' AND retryCount > :maxRetries")
    suspend fun getExhaustedActions(maxRetries: Int = 5): List<PendingSyncAction>

    /** Reset orphaned in_progress actions back to pending (e.g., after app crash during sync) */
    @Query("UPDATE pending_sync_actions SET status = 'pending' WHERE status = 'in_progress'")
    suspend fun resetStuckInProgress()
}
