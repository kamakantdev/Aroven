package com.example.swastik.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min

/**
 * Client-Side Image Compression for Android
 *
 * Compresses images BEFORE uploading to save bandwidth.
 * Critical for users on 2G/3G mobile data.
 *
 * Pipeline:
 *   1. Decode image with inSampleSize downsampling (memory-efficient)
 *   2. Scale to max 2560px (maintains aspect ratio)
 *   3. Re-encode as JPEG at 90% quality
 *   4. Returns compressed byte array
 *
 * Typical savings: 60-80% for phone camera photos (4-8MB → 200-600KB)
 */
object ImageCompressor {

    private const val MAX_DIMENSION = 2560
    private const val QUALITY = 90
    private const val THRESHOLD_BYTES = 1024 * 1024 // 1MB

    /**
     * Compresses an image from a URI. Returns the compressed bytes and MIME type.
     * If the image is already small enough, returns the original bytes.
     */
    fun compressFromUri(context: Context, uri: Uri): CompressedImage? {
        return try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return null
            val originalBytes = inputStream.readBytes()
            inputStream.close()

            // Skip if already small
            if (originalBytes.size <= THRESHOLD_BYTES) {
                return CompressedImage(
                    bytes = originalBytes,
                    mimeType = "image/jpeg",
                    originalSize = originalBytes.size,
                    compressedSize = originalBytes.size,
                )
            }

            compress(originalBytes)
        } catch (e: Exception) {
            android.util.Log.w("ImageCompressor", "Compression failed", e)
            null
        }
    }

    /**
     * Compresses raw image bytes.
     */
    fun compress(imageBytes: ByteArray): CompressedImage? {
        return try {
            // Step 1: Determine dimensions without loading full bitmap
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, options)

            val originalWidth = options.outWidth
            val originalHeight = options.outHeight

            if (originalWidth <= 0 || originalHeight <= 0) return null

            // Step 2: Calculate inSampleSize for memory-efficient decoding
            options.inSampleSize = calculateInSampleSize(originalWidth, originalHeight, MAX_DIMENSION)
            options.inJustDecodeBounds = false
            options.inPreferredConfig = Bitmap.Config.ARGB_8888

            // Step 3: Decode with downsampling
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, options) ?: return null

            // Step 4: Scale to exact max dimension if still too large
            val scaledBitmap = scaleBitmap(bitmap, MAX_DIMENSION)
            if (scaledBitmap != bitmap) {
                bitmap.recycle()
            }

            // Step 5: Compress to JPEG
            val outputStream = ByteArrayOutputStream()
            scaledBitmap.compress(Bitmap.CompressFormat.JPEG, QUALITY, outputStream)
            scaledBitmap.recycle()

            val compressedBytes = outputStream.toByteArray()

            // If compression made it larger, return original
            val finalBytes = if (compressedBytes.size >= imageBytes.size) imageBytes else compressedBytes

            android.util.Log.d(
                "ImageCompressor",
                "Compressed: ${imageBytes.size / 1024}KB → ${finalBytes.size / 1024}KB " +
                        "(${((1.0 - finalBytes.size.toDouble() / imageBytes.size) * 100).toInt()}% saved)"
            )

            CompressedImage(
                bytes = finalBytes,
                mimeType = "image/jpeg",
                originalSize = imageBytes.size,
                compressedSize = finalBytes.size,
            )
        } catch (e: Exception) {
            android.util.Log.w("ImageCompressor", "Compression failed", e)
            null
        }
    }

    /**
     * Calculates optimal inSampleSize for BitmapFactory.
     * Uses power-of-2 downsampling for maximum memory efficiency.
     */
    private fun calculateInSampleSize(width: Int, height: Int, maxDim: Int): Int {
        var inSampleSize = 1
        val largerDim = max(width, height)
        if (largerDim > maxDim) {
            val halfLarger = largerDim / 2
            while (halfLarger / inSampleSize >= maxDim) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }

    /**
     * Scales bitmap to fit within maxDimension, maintaining aspect ratio.
     */
    private fun scaleBitmap(bitmap: Bitmap, maxDim: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        if (width <= maxDim && height <= maxDim) return bitmap

        val ratio = min(maxDim.toFloat() / width, maxDim.toFloat() / height)
        val newWidth = (width * ratio).toInt()
        val newHeight = (height * ratio).toInt()

        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    }

    data class CompressedImage(
        val bytes: ByteArray,
        val mimeType: String,
        val originalSize: Int,
        val compressedSize: Int,
    ) {
        val savingsPercent: Int
            get() = if (originalSize > 0) ((1.0 - compressedSize.toDouble() / originalSize) * 100).toInt() else 0
    }
}
