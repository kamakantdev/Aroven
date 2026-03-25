package com.example.swastik.data.local.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Room Database for offline caching of healthcare data.
 * Caches doctors, appointments, notifications, prescriptions, medicines, and hospitals
 * for offline access and faster loading.
 * v2: Added PendingSyncAction for offline write queue.
 * v3: Added CachedHospital entity.
 */
@Database(
    entities = [
        CachedDoctor::class,
        CachedAppointment::class,
        CachedNotification::class,
        CachedPrescription::class,
        CachedMedicine::class,
        CachedHospital::class,
        PendingSyncAction::class
    ],
    version = 3,
    exportSchema = false
)
abstract class SwastikDatabase : RoomDatabase() {

    abstract fun doctorDao(): DoctorDao
    abstract fun appointmentDao(): AppointmentDao
    abstract fun notificationDao(): NotificationDao
    abstract fun prescriptionDao(): PrescriptionDao
    abstract fun medicineDao(): MedicineDao
    abstract fun hospitalDao(): HospitalDao
    abstract fun syncQueueDao(): SyncQueueDao

    companion object {
        @Volatile
        private var INSTANCE: SwastikDatabase? = null

        /**
         * Migration from v1 to v2: adds pending_sync_actions table.
         * Fix #5: This was missing, causing crashes for users upgrading from v1.
         */
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `pending_sync_actions` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `action` TEXT NOT NULL,
                        `endpoint` TEXT NOT NULL,
                        `payload` TEXT NOT NULL,
                        `createdAt` INTEGER NOT NULL DEFAULT 0,
                        `retryCount` INTEGER NOT NULL DEFAULT 0,
                        `status` TEXT NOT NULL DEFAULT 'pending'
                    )
                """.trimIndent())
            }
        }

        /**
         * Migration from v2 to v3: adds cached_hospitals table.
         * Uses addMigrations() instead of fallbackToDestructiveMigration()
         * to preserve the offline sync queue (PendingSyncAction) across upgrades.
         */
        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `cached_hospitals` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `name` TEXT NOT NULL,
                        `address` TEXT NOT NULL,
                        `phone` TEXT,
                        `imageUrl` TEXT,
                        `latitude` REAL,
                        `longitude` REAL,
                        `emergencyServices` INTEGER,
                        `ambulanceService` INTEGER,
                        `rating` REAL NOT NULL DEFAULT 0,
                        `reviewCount` INTEGER NOT NULL DEFAULT 0,
                        `specializations` TEXT,
                        `hospitalType` TEXT,
                        `cachedAt` INTEGER NOT NULL DEFAULT 0
                    )
                """.trimIndent())
            }
        }

        fun getDatabase(context: Context): SwastikDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    SwastikDatabase::class.java,
                    "swastik_cache_db"
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    .fallbackToDestructiveMigrationOnDowngrade()
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
