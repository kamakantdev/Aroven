/**
 * Upload Middleware
 * Multer configurations for different file types
 * Security: validates both MIME type (client-provided) AND magic bytes (actual file content)
 */
const multer = require('multer');

let fileTypeFromBufferFn = null;

const detectFileType = async (buffer) => {
  if (!fileTypeFromBufferFn) {
    // file-type v21+ is ESM-only and exposes fileTypeFromBuffer
    const mod = await import('file-type');
    fileTypeFromBufferFn =
      mod.fileTypeFromBuffer ||
      mod.default?.fileTypeFromBuffer ||
      mod.fromBuffer ||
      mod.default?.fromBuffer;

    if (!fileTypeFromBufferFn) {
      throw new Error('file-type detector is unavailable');
    }
  }

  return fileTypeFromBufferFn(buffer);
};

// Memory storage (for MinIO upload)
const memoryStorage = multer.memoryStorage();

// File size limits
const FILE_LIMITS = {
  profileImage: 5 * 1024 * 1024,     // 5MB
  document: 25 * 1024 * 1024,        // 25MB
  medicalDocument: 50 * 1024 * 1024,  // 50MB
  video: 500 * 1024 * 1024,          // 500MB
};

/**
 * Magic byte validation middleware — runs AFTER multer to verify actual file content.
 * Prevents MIME type spoofing attacks where attacker sends .exe with image/jpeg header.
 * @param {string[]} allowedMimeTypes - Array of allowed MIME types
 */
const validateMagicBytes = (allowedMimeTypes) => {
  return async (req, res, next) => {
    try {
      const files = req.file ? [req.file] : (req.files || []);
      
      for (const file of files) {
        if (!file.buffer || file.buffer.length === 0) continue;
        
        const detected = await detectFileType(file.buffer);
        
        if (!detected) {
          // For text-based formats (PDF sometimes, plain text), file-type can't detect
          // Allow if it's a known text/document type and passes MIME check
          const textBasedTypes = ['application/pdf', 'text/plain', 'application/json'];
          if (textBasedTypes.includes(file.mimetype)) continue;
          
          return res.status(400).json({
            success: false,
            message: `File "${file.originalname}" has an unrecognized format. Please upload a valid file.`,
          });
        }
        
        // Check if the detected MIME matches allowed types
        if (!allowedMimeTypes.includes(detected.mime)) {
          return res.status(400).json({
            success: false,
            message: `File "${file.originalname}" content does not match its declared type. Detected: ${detected.mime}. Allowed: ${allowedMimeTypes.join(', ')}`,
          });
        }
        
        // Override the client-provided mimetype with the detected one
        file.mimetype = detected.mime;
      }
      
      next();
    } catch (err) {
      console.error('Magic byte validation error:', err.message);
      return res.status(400).json({
        success: false,
        message: 'File validation failed. Please try again with a valid file.',
      });
    }
  };
};

// Image filter
const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

// Document filter
const documentFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, JPEG, PNG, DOC, DOCX files are allowed'), false);
  }
};

// Medical document filter (PDF + images)
const medicalDocFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png',
    'image/dicom', 'application/dicom',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, JPEG, PNG, DICOM files are allowed'), false);
  }
};

// Upload instances
const uploadProfileImage = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_LIMITS.profileImage },
  fileFilter: imageFilter,
});

const uploadDocument = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_LIMITS.document },
  fileFilter: documentFilter,
});

const uploadMedicalDocument = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_LIMITS.medicalDocument },
  fileFilter: medicalDocFilter,
});

const uploadVideo = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_LIMITS.video },
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/avi', 'video/quicktime'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4, WebM, AVI, MOV video files are allowed'), false);
    }
  },
});

const uploadAny = multer({
  storage: memoryStorage,
  limits: { fileSize: FILE_LIMITS.medicalDocument },
});

/**
 * Wraps a multer upload middleware to catch MulterError (file too large, wrong type, etc.)
 * and return a 400 instead of letting it bubble up as a 500.
 * Usage: handleUpload(uploadProfileImage.single('image'))
 */
const handleUpload = (multerMiddleware) => {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer-specific error (file too large, too many files, etc.)
        const messages = {
          LIMIT_FILE_SIZE: 'File is too large. Please upload a smaller file.',
          LIMIT_FILE_COUNT: 'Too many files. Please reduce the number of files.',
          LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Please check the upload form.',
          LIMIT_PART_COUNT: 'Too many form parts.',
          LIMIT_FIELD_KEY: 'Field name is too long.',
          LIMIT_FIELD_VALUE: 'Field value is too long.',
          LIMIT_FIELD_COUNT: 'Too many fields.',
        };
        return res.status(400).json({
          success: false,
          message: messages[err.code] || `Upload error: ${err.message}`,
        });
      }
      if (err) {
        // Custom filter errors (wrong file type)
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed.',
        });
      }
      next();
    });
  };
};

module.exports = {
  uploadProfileImage,
  uploadDocument,
  uploadMedicalDocument,
  uploadVideo,
  uploadAny,
  handleUpload,
  validateMagicBytes,
  ALLOWED_IMAGE_MIMES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOC_MIMES: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ALLOWED_MEDICAL_MIMES: ['application/pdf', 'image/jpeg', 'image/png', 'application/dicom'],
  ALLOWED_VIDEO_MIMES: ['video/mp4', 'video/webm', 'video/quicktime'],
};
