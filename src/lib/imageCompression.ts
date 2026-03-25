/**
 * Client-Side Image Compression
 * Compresses images BEFORE uploading to server to save bandwidth.
 * Critical for users on 2G/3G connections.
 *
 * Pipeline:
 *   1. Read file as HTMLImageElement
 *   2. Downscale to max 2560px (maintains aspect ratio)
 *   3. Re-encode as WebP (or JPEG fallback) at quality 0.88
 *   4. Returns a new File object ready for upload
 *
 * Typical savings: 60-80% reduction for phone camera photos (4-8MB → 200-600KB)
 */

interface CompressOptions {
    /** Max width/height in pixels. Default: 2560 */
    maxDimension?: number;
    /** Quality 0-1. Default: 0.88 */
    quality?: number;
    /** Max file size in bytes before compression kicks in. Default: 1MB */
    threshold?: number;
}

/**
 * Compresses an image File on the client side using Canvas API.
 * If the file is below the threshold or not an image, returns it unchanged.
 */
export async function compressImage(
    file: File,
    options: CompressOptions = {}
): Promise<File> {
    const {
        maxDimension = 2560,
        quality = 0.88,
        threshold = 1024 * 1024, // 1MB
    } = options;

    // Skip non-images
    if (!file.type.startsWith('image/')) return file;

    // Skip small files (already optimized)
    if (file.size <= threshold) return file;

    // Skip GIFs (lossy re-encode would break animation)
    if (file.type === 'image/gif') return file;

    try {
        const bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;

        // Calculate new dimensions (maintain aspect ratio)
        let newWidth = width;
        let newHeight = height;
        if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            newWidth = Math.round(width * ratio);
            newHeight = Math.round(height * ratio);
        }

        // Draw onto canvas
        const canvas = new OffscreenCanvas(newWidth, newHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;

        ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
        bitmap.close();

        // Try WebP first (best compression), fallback to JPEG
        let blob: Blob;
        try {
            blob = await canvas.convertToBlob({ type: 'image/webp', quality });
        } catch {
            blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
        }

        // If compression made it larger somehow, return original
        if (blob.size >= file.size) return file;

        const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
        const compressedName = file.name.replace(/\.[^.]+$/, ext);

        console.log(
            `[ImageCompression] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB (${Math.round((1 - blob.size / file.size) * 100)}% saved)`
        );

        return new File([blob], compressedName, { type: blob.type });
    } catch (err) {
        console.warn('[ImageCompression] Compression failed, using original:', err);
        return file;
    }
}
