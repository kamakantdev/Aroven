/**
 * MinIO Configuration (Object Storage)
 * Used for file uploads: profile images, documents, reports, prescriptions, videos
 * 
 * Bandwidth Optimization Pipeline:
 *   1. Originals compressed & converted to WebP (quality 88, progressive)
 *   2. Medium variant generated (1024px wide) for cards/lists
 *   3. Thumbnail variant generated (300px wide) for avatars/previews
 *   4. Cache-Control headers set on all objects (30 days)
 *   5. All image variants stored as WebP for ~30-50% size reduction
 */
const Minio = require('minio');
const { v4: uuidv4 } = require('uuid');
const config = require('./index');

// Try to load sharp for image processing
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.warn('[MinIO] sharp not installed — image optimization disabled. Run: npm install sharp');
}

// Storage folder structure
const STORAGE_FOLDERS = {
  PROFILES: 'profiles',
  DOCUMENTS: 'documents',
  REPORTS: 'reports',
  PRESCRIPTIONS: 'prescriptions',
  VIDEOS: 'videos',
  LICENSES: 'licenses',
  ENTITIES: 'entities',
  THUMBNAILS: 'thumbnails',
  MEDIUM: 'medium',
};

// Image processing constants
const IMAGE_SIZES = {
  THUMBNAIL: { width: 320, quality: 78 },
  MEDIUM: { width: 1024, quality: 82 },
  ORIGINAL: { maxWidth: 2560, quality: 88 },
};

// Cache duration: 30 days
const CACHE_MAX_AGE = 30 * 24 * 60 * 60;

let minioClient = null;
let isBucketReady = false;

// Initialize MinIO client
try {
  minioClient = new Minio.Client({
    endPoint: config.minio.endpoint,
    port: config.minio.port,
    useSSL: config.minio.useSSL,
    accessKey: config.minio.accessKey,
    secretKey: config.minio.secretKey,
  });
} catch (error) {
  console.warn('⚠️  MinIO client initialization failed:', error.message);
}

// Initialize bucket
const initializeBucket = async () => {
  if (!minioClient) {
    console.warn('⚠️  MinIO not available. File uploads will be unavailable.');
    isBucketReady = false;
    return false;
  }

  try {
    const exists = await minioClient.bucketExists(config.minio.bucketName);
    if (!exists) {
      await minioClient.makeBucket(config.minio.bucketName);
      console.log(`✅ MinIO bucket "${config.minio.bucketName}" created`);
    } else {
      console.log(`✅ MinIO bucket "${config.minio.bucketName}" exists`);
    }
    isBucketReady = true;
    return true;
  } catch (error) {
    isBucketReady = false;
    const endpoint = `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endpoint}:${config.minio.port}`;
    console.warn('⚠️  MinIO bucket initialization failed:', error.message || '(no message)');
    console.warn(`⚠️  MinIO target: ${endpoint} (bucket: ${config.minio.bucketName})`);
    console.warn(`⚠️  MinIO public URL: ${config.minio.publicUrl}`);
    console.warn('⚠️  File uploads will be unavailable. Start MinIO with: docker compose up -d minio');
    return false;
  }
};

const isStorageAvailable = () => Boolean(minioClient && isBucketReady);

// Helper: generate unique object name
const generateObjectName = (folder, userId, originalName) => {
  const ext = originalName.split('.').pop();
  return `${folder}/${userId}/${uuidv4()}.${ext}`;
};

// ==================== Image Optimization Pipeline ====================

/**
 * Compresses and converts an image to WebP with progressive rendering.
 * Also resizes if larger than maxWidth to prevent storing 4K+ images.
 * @returns {{ buffer: Buffer, contentType: string }}
 */
const optimizeOriginalImage = async (buffer) => {
  if (!sharp) return { buffer, contentType: null };
  try {
    const optimized = await sharp(buffer)
      .resize(IMAGE_SIZES.ORIGINAL.maxWidth, null, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: IMAGE_SIZES.ORIGINAL.quality, effort: 4 })
      .toBuffer();
    return { buffer: optimized, contentType: 'image/webp' };
  } catch (err) {
    console.warn('[MinIO] Image optimization failed, storing original:', err.message);
    return { buffer, contentType: null };
  }
};

/**
 * Generates a resized WebP variant of an image.
 */
const generateVariant = async (buffer, width, quality) => {
  if (!sharp) return null;
  try {
    return await sharp(buffer)
      .resize(width, null, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer();
  } catch (err) {
    console.warn(`[MinIO] Variant generation (${width}px) failed:`, err.message);
    return null;
  }
};

// Helper: upload file buffer with metadata + Cache-Control headers
const uploadBuffer = async (objectName, buffer, contentType) => {
  if (!minioClient || !isBucketReady) {
    throw new Error('File storage is not available');
  }

  const isImage = contentType && contentType.startsWith('image/');
  let finalBuffer = buffer;
  let finalContentType = contentType;
  let finalObjectName = objectName;

  // Optimize images: compress original + convert to WebP
  if (isImage && sharp) {
    const optimized = await optimizeOriginalImage(buffer);
    finalBuffer = optimized.buffer;
    if (optimized.contentType) {
      finalContentType = optimized.contentType;
      // Change extension to .webp
      finalObjectName = objectName.replace(/\.[^.]+$/, '.webp');
    }
  }

  // Upload with Cache-Control headers
  const metadata = {
    'Content-Type': finalContentType,
    'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
  };

  await minioClient.putObject(config.minio.bucketName, finalObjectName, finalBuffer, finalBuffer.length, metadata);

  const result = {
    objectName: finalObjectName,
    url: `${config.minio.publicUrl}/${config.minio.bucketName}/${finalObjectName}`,
    size: finalBuffer.length,
    originalSize: buffer.length,
    compressionRatio: isImage ? Math.round((1 - finalBuffer.length / buffer.length) * 100) : 0,
  };

  // Auto-generate thumbnail + medium variants for images (non-blocking)
  if (isImage) {
    generateImageVariants(finalObjectName, buffer).catch((err) => {
      console.warn(`[MinIO] Variant generation failed for ${finalObjectName}:`, err.message);
    });
  }

  return result;
};

// ==================== Multi-Size Image Variant Generation ====================
/**
 * Generates both thumbnail (300px) and medium (800px) WebP variants.
 * Stored under `thumbnails/` and `medium/` prefixes respectively.
 * Both have Cache-Control headers for browser caching.
 */
const generateImageVariants = async (objectName, originalBuffer) => {
  if (!sharp) return;

  const cacheHeaders = {
    'Content-Type': 'image/webp',
    'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
  };

  const baseName = objectName.replace(/\.[^.]+$/, '.webp');

  // Generate thumbnail (300px) and medium (800px) in parallel
  const [thumbBuffer, mediumBuffer] = await Promise.all([
    generateVariant(originalBuffer, IMAGE_SIZES.THUMBNAIL.width, IMAGE_SIZES.THUMBNAIL.quality),
    generateVariant(originalBuffer, IMAGE_SIZES.MEDIUM.width, IMAGE_SIZES.MEDIUM.quality),
  ]);

  const uploads = [];

  if (thumbBuffer) {
    const thumbObjectName = `thumbnails/${baseName}`;
    uploads.push(
      minioClient.putObject(config.minio.bucketName, thumbObjectName, thumbBuffer, thumbBuffer.length, cacheHeaders)
    );
  }

  if (mediumBuffer) {
    const mediumObjectName = `medium/${baseName}`;
    uploads.push(
      minioClient.putObject(config.minio.bucketName, mediumObjectName, mediumBuffer, mediumBuffer.length, cacheHeaders)
    );
  }

  await Promise.all(uploads);
};

/**
 * Get the thumbnail URL for a given object.
 */
const getThumbnailUrl = (objectName) => {
  const baseName = objectName.replace(/\.[^.]+$/, '.webp');
  return `${config.minio.publicUrl}/${config.minio.bucketName}/thumbnails/${baseName}`;
};

/**
 * Get the medium-size URL for a given object.
 */
const getMediumUrl = (objectName) => {
  const baseName = objectName.replace(/\.[^.]+$/, '.webp');
  return `${config.minio.publicUrl}/${config.minio.bucketName}/medium/${baseName}`;
};

/**
 * Get all variant URLs for an image object.
 * Returns { original, medium, thumbnail } URLs.
 */
const getImageVariants = (objectName) => {
  const baseName = objectName.replace(/\.[^.]+$/, '.webp');
  const baseUrl = `${config.minio.publicUrl}/${config.minio.bucketName}`;
  return {
    original: `${baseUrl}/${objectName}`,
    medium: `${baseUrl}/medium/${baseName}`,
    thumbnail: `${baseUrl}/thumbnails/${baseName}`,
  };
};

// Upload profile image
const uploadProfileImage = async (file, userId) => {
  const objectName = generateObjectName(STORAGE_FOLDERS.PROFILES, userId, file.originalname);
  return uploadBuffer(objectName, file.buffer, file.mimetype);
};

// Upload document
const uploadDocument = async (file, userId, docType = 'general') => {
  const objectName = generateObjectName(STORAGE_FOLDERS.DOCUMENTS, userId, file.originalname);
  return uploadBuffer(objectName, file.buffer, file.mimetype);
};

// Upload report
const uploadReport = async (file, userId) => {
  const objectName = generateObjectName(STORAGE_FOLDERS.REPORTS, userId, file.originalname);
  return uploadBuffer(objectName, file.buffer, file.mimetype);
};

// Upload prescription
const uploadPrescription = async (file, patientId) => {
  const objectName = generateObjectName(STORAGE_FOLDERS.PRESCRIPTIONS, patientId, file.originalname);
  return uploadBuffer(objectName, file.buffer, file.mimetype);
};

// Upload video
const uploadVideo = async (file, userId) => {
  const objectName = generateObjectName(STORAGE_FOLDERS.VIDEOS, userId, file.originalname);
  return uploadBuffer(objectName, file.buffer, file.mimetype);
};

// Upload license document
const uploadLicenseDocument = async (file, userId, providerType) => {
  const objectName = generateObjectName(STORAGE_FOLDERS.LICENSES, userId, file.originalname);
  return uploadBuffer(objectName, file.buffer, file.mimetype);
};

// Upload entity image
const uploadEntityImage = async (file, entityId, entityType) => {
  const objectName = generateObjectName(STORAGE_FOLDERS.ENTITIES, entityId, file.originalname);
  return uploadBuffer(objectName, file.buffer, file.mimetype);
};

// Get presigned URL for download
const getPresignedUrl = async (objectName, expiry = 3600) => {
  if (!minioClient) throw new Error('File storage is not available');
  return minioClient.presignedGetObject(config.minio.bucketName, objectName, expiry);
};

// Get presigned URL for upload
const getPresignedUploadUrl = async (objectName, expiry = 3600) => {
  if (!minioClient) throw new Error('File storage is not available');
  return minioClient.presignedPutObject(config.minio.bucketName, objectName, expiry);
};

// Delete file
const deleteFile = async (objectName) => {
  if (!minioClient) throw new Error('File storage is not available');
  await minioClient.removeObject(config.minio.bucketName, objectName);
};

// List files in a folder for a user
const listFiles = async (folder, userId) => {
  if (!minioClient) return [];
  const prefix = `${folder}/${userId}/`;
  const files = [];
  const stream = minioClient.listObjectsV2(config.minio.bucketName, prefix, true);
  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => {
      files.push({
        name: obj.name,
        size: obj.size,
        lastModified: obj.lastModified,
        url: `${config.minio.publicUrl}/${config.minio.bucketName}/${obj.name}`,
      });
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(files));
  });
};

module.exports = {
  minioClient,
  initializeBucket,
  isStorageAvailable,
  uploadBuffer,
  uploadProfileImage,
  uploadDocument,
  uploadReport,
  uploadPrescription,
  uploadVideo,
  uploadLicenseDocument,
  uploadEntityImage,
  getPresignedUrl,
  getPresignedUploadUrl,
  deleteFile,
  listFiles,
  generateImageVariants,
  getThumbnailUrl,
  getMediumUrl,
  getImageVariants,
  STORAGE_FOLDERS,
  IMAGE_SIZES,
};
