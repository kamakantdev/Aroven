/**
 * File Upload Routes
 * Handles file uploads to MinIO storage
 * Security: magic byte validation on all file uploads
 */
const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate: authenticateToken } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');
const { ApiError } = require('../middleware/errorHandler');
const { supabaseAdmin } = require('../config/supabase');
const {
    validateMagicBytes,
    ALLOWED_IMAGE_MIMES,
    ALLOWED_DOC_MIMES,
    ALLOWED_MEDICAL_MIMES,
    ALLOWED_VIDEO_MIMES,
} = require('../middleware/upload');
const {
    isStorageAvailable,
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
    getImageVariants,
    STORAGE_FOLDERS,
} = require('../config/minio');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // Fix #9: 50MB max (reduced from 500MB to prevent DoS)
    },
});

// Global upload availability guard
router.use((req, res, next) => {
    if (!isStorageAvailable()) {
        return res.status(503).json({
            success: false,
            message: 'File storage is temporarily unavailable. Please try again shortly.',
            code: 'STORAGE_UNAVAILABLE',
        });
    }
    return next();
});

// ==================== PROFILE IMAGES ====================

/**
 * @route POST /api/uploads/profile
 * @desc Upload profile image
 * @access Private
 */
router.post('/profile', authenticateToken, upload.single('file'), validateMagicBytes(ALLOWED_IMAGE_MIMES), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ApiError(400, 'No file uploaded');
        }

        const result = await uploadProfileImage(req.file, req.user.id);

        // Include thumbnail + medium variant URLs for bandwidth optimization
        const variants = result.objectName ? getImageVariants(result.objectName) : {};

        res.json({
            success: true,
            data: { ...result, variants },
        });
    } catch (error) {
        next(error);
    }
});

// ==================== DOCUMENTS ====================

/**
 * @route POST /api/uploads/document
 * @desc Upload general document
 * @access Private
 */
router.post('/document', authenticateToken, upload.single('file'), validateMagicBytes(ALLOWED_DOC_MIMES), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ApiError(400, 'No file uploaded');
        }

        const docType = req.body.type || 'general';
        const result = await uploadDocument(req.file, req.user.id, docType);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

// ==================== MEDICAL REPORTS ====================

/**
 * @route POST /api/uploads/report
 * @desc Upload medical report
 * @access Private
 */
router.post('/report', authenticateToken, upload.single('file'), validateMagicBytes(ALLOWED_MEDICAL_MIMES), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ApiError(400, 'No file uploaded');
        }

        const result = await uploadReport(req.file, req.user.id);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

// ==================== PRESCRIPTIONS ====================

/**
 * @route POST /api/uploads/prescription
 * @desc Upload prescription document
 * @access Private (Doctor only)
 */
router.post('/prescription', authenticateToken, requireRole(ROLES.DOCTOR), upload.single('file'), validateMagicBytes(ALLOWED_MEDICAL_MIMES), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ApiError(400, 'No file uploaded');
        }

        // Optionally associate with patient
        const patientId = req.body.patientId || req.user.id;
        const result = await uploadPrescription(req.file, patientId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

// ==================== VIDEOS ====================

/**
 * @route POST /api/uploads/video
 * @desc Upload video file
 * @access Private
 */
router.post('/video', authenticateToken, upload.single('file'), validateMagicBytes(ALLOWED_VIDEO_MIMES), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ApiError(400, 'No file uploaded');
        }

        const result = await uploadVideo(req.file, req.user.id);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

// ==================== LICENSE DOCUMENTS ====================

/**
 * @route POST /api/uploads/license
 * @desc Upload license/verification document
 * @access Private (Providers only)
 */
router.post('/license', authenticateToken, upload.single('file'), validateMagicBytes(ALLOWED_DOC_MIMES), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ApiError(400, 'No file uploaded');
        }

        const providerType = req.body.providerType || 'general';
        const result = await uploadLicenseDocument(req.file, req.user.id, providerType);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

// ==================== ENTITY IMAGES ====================

/**
 * @route POST /api/uploads/entity
 * @desc Upload entity image (hospital, clinic, pharmacy)
 * @access Private (Entity owners)
 */
router.post('/entity', authenticateToken, requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER, ROLES.CLINIC_OWNER, ROLES.PHARMACY_OWNER, ROLES.DIAGNOSTIC_CENTER_OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN), upload.single('file'), validateMagicBytes(ALLOWED_IMAGE_MIMES), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ApiError(400, 'No file uploaded');
        }

        const { entityId, entityType } = req.body;
        if (!entityId || !entityType) {
            throw new ApiError(400, 'Entity ID and type are required');
        }

        // Fix #22: Verify user owns this entity before allowing upload
        const entityTableMap = {
            hospital: { table: 'hospitals', ownerCol: 'owner_id' },
            clinic: { table: 'clinics', ownerCol: 'owner_id' },
            pharmacy: { table: 'pharmacies', ownerCol: 'owner_id' },
            diagnostic_center: { table: 'diagnostic_centers', ownerCol: 'owner_id' },
        };
        const entityConfig = entityTableMap[entityType];
        if (entityConfig && !['admin', 'super_admin'].includes(req.user.role)) {
            const { data: entity } = await supabaseAdmin
                .from(entityConfig.table)
                .select('id')
                .eq('id', entityId)
                .eq(entityConfig.ownerCol, req.user.id)
                .single();
            if (!entity) {
                throw new ApiError(403, 'You do not own this entity');
            }
        }

        const result = await uploadEntityImage(req.file, entityId, entityType);

        // Include thumbnail + medium variant URLs for bandwidth optimization
        const variants = result.objectName ? getImageVariants(result.objectName) : {};

        res.json({
            success: true,
            data: { ...result, variants },
        });
    } catch (error) {
        next(error);
    }
});

// ==================== MULTIPLE FILES ====================

/**
 * @route POST /api/uploads/multiple
 * @desc Upload multiple files
 * @access Private
 */
router.post('/multiple', authenticateToken, upload.array('files', 10), validateMagicBytes(ALLOWED_DOC_MIMES), async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new ApiError(400, 'No files uploaded');
        }

        const folder = req.body.folder || STORAGE_FOLDERS.DOCUMENTS;
        const results = await Promise.all(
            req.files.map(file => uploadDocument(file, req.user.id, folder))
        );

        res.json({
            success: true,
            data: results,
            count: results.length,
        });
    } catch (error) {
        next(error);
    }
});

// ==================== PRESIGNED URLS ====================

/**
 * @route GET /api/uploads/presigned-download
 * @desc Get presigned URL for file download
 * @access Private
 */
router.get('/presigned-download', authenticateToken, async (req, res, next) => {
    try {
        const { fileName, expiry } = req.query;

        if (!fileName) {
            throw new ApiError(400, 'File name is required');
        }

        // Security: Verify user has access to this file
        // 1. File belongs to the user (file path contains their user ID)
        // 2. User is an admin
        // 3. User is a doctor with an active/completed consultation with the file's patient
        const isOwner = fileName.includes(req.user.id);
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

        if (!isOwner && !isAdmin) {
            // Check if the user is a doctor who has consulted with this patient
            let hasAccess = false;
            if (req.user.role === 'doctor') {
                try {
                    const { data: doctor } = await supabaseAdmin
                        .from('doctors')
                        .select('id')
                        .eq('user_id', req.user.id)
                        .single();

                    if (doctor) {
                        // Fix #7: Extract patient ID from the file path and verify specific access
                        const pathParts = fileName.split('/');
                        const patientIdFromPath = pathParts.find(part => 
                            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)
                        );

                        if (patientIdFromPath) {
                            // Check if doctor has explicit share for a report belonging to this patient
                            const { data: shares } = await supabaseAdmin
                                .from('report_shares')
                                .select('id, report:reports!inner(patient_id)')
                                .eq('doctor_id', doctor.id)
                                .limit(1);

                            if (shares && shares.length > 0) {
                                // Verify the share is for a report of the patient whose file is being accessed
                                const patientIds = shares.map(s => s.report?.patient_id).filter(Boolean);
                                const { data: patients } = await supabaseAdmin
                                    .from('patients').select('user_id').in('id', patientIds);
                                hasAccess = (patients || []).some(p => p.user_id === patientIdFromPath);
                            }

                            if (!hasAccess) {
                                // Check if doctor has consultation with this specific patient
                                const { data: patient } = await supabaseAdmin
                                    .from('patients').select('id').eq('user_id', patientIdFromPath).single();
                                if (patient) {
                                    const { data: consultations } = await supabaseAdmin
                                        .from('consultations')
                                        .select('id')
                                        .eq('doctor_id', doctor.id)
                                        .eq('patient_id', patient.id)
                                        .in('status', ['in_progress', 'completed'])
                                        .limit(1);
                                    hasAccess = consultations && consultations.length > 0;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Swallow lookup errors — deny access by default
                }
            }

            if (!hasAccess) {
                throw new ApiError(403, 'You do not have permission to access this file');
            }
        }

        const url = await getPresignedUrl(fileName, parseInt(expiry) || 3600);

        res.json({
            success: true,
            data: { url, expiresIn: parseInt(expiry) || 3600 },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/uploads/presigned-upload
 * @desc Get presigned URL for client-side upload
 * @access Private
 */
router.post('/presigned-upload', authenticateToken, async (req, res, next) => {
    try {
        const { fileName, folder, mimeType } = req.body;

        if (!fileName) {
            throw new ApiError(400, 'File name is required');
        }

        // Fix #10: Sanitize fileName to prevent path traversal
        const sanitizedFileName = fileName.replace(/[\/\\]/g, '_').replace(/\.\./g, '_');

        const folderPath = folder || STORAGE_FOLDERS.DOCUMENTS;
        const objectName = `${folderPath}/${req.user.id}/${Date.now()}-${sanitizedFileName}`;

        const url = await getPresignedUploadUrl(objectName);

        res.json({
            success: true,
            data: {
                uploadUrl: url,
                objectName,
                publicUrl: `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET_NAME}/${objectName}`,
            },
        });
    } catch (error) {
        next(error);
    }
});

// ==================== FILE MANAGEMENT ====================

/**
 * @route GET /api/uploads/list
 * @desc List files in a folder for current user
 * @access Private
 */
router.get('/list', authenticateToken, async (req, res, next) => {
    try {
        const folder = req.query.folder || STORAGE_FOLDERS.DOCUMENTS;
        const files = await listFiles(folder, req.user.id);

        res.json({
            success: true,
            data: files,
            count: files.length,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/uploads/:fileName
 * @desc Delete a file
 * @access Private
 */
router.delete('/:fileName(*)', authenticateToken, async (req, res, next) => {
    try {
        const { fileName } = req.params;

        // Fix #8: Verify user owns this file using path prefix match (not includes)
        // Prevent path traversal attacks where attacker crafts a filename containing the user's ID
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        const normalizedPath = fileName.replace(/\.\./g, '');
        const userPathSegment = `/${req.user.id}/`;
        if (!isAdmin && !normalizedPath.includes(userPathSegment)) {
            throw new ApiError(403, 'You do not have permission to delete this file');
        }

        await deleteFile(fileName);

        res.json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
