/**
 * MinIO Bucket Setup Script
 * 
 * Creates the required folder structure and policies for the SWASTIK platform.
 * Run: node scripts/setup-minio.js
 */

require('dotenv').config();
const Minio = require('minio');
const config = require('../config');

const minioClient = new Minio.Client({
    endPoint: config.minio.endPoint,
    port: config.minio.port,
    useSSL: config.minio.useSSL,
    accessKey: config.minio.accessKey,
    secretKey: config.minio.secretKey,
});

const BUCKET_NAME = config.minio.bucketName || 'swastik-health';

// Bucket folder structure
const FOLDERS = [
    'profiles/',           // User profile images
    'reports/',            // Medical reports and lab results
    'prescriptions/',      // Prescription PDFs
    'consultation-files/', // Files shared during consultations
    'hospital-logos/',     // Hospital and clinic logos
    'doctor-photos/',      // Doctor profile photos
    'medicine-images/',    // Medicine product images
    'documents/',          // ID documents for verification
    'chat-attachments/',   // Chat file attachments
    'temp/',               // Temporary uploads (cleaned periodically)
];

async function setupMinIO() {
    console.log('🚀 Starting MinIO bucket setup...\n');
    console.log(`   Endpoint: ${config.minio.endPoint}:${config.minio.port}`);
    console.log(`   Bucket: ${BUCKET_NAME}\n`);

    try {
        // 1. Check/Create bucket
        const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
        if (!bucketExists) {
            await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
            console.log(`✅ Bucket '${BUCKET_NAME}' created`);
        } else {
            console.log(`✅ Bucket '${BUCKET_NAME}' exists`);
        }

        // 2. Set bucket policy (public read for specific folders)
        const policy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: { AWS: ['*'] },
                    Action: ['s3:GetObject'],
                    Resource: [
                        `arn:aws:s3:::${BUCKET_NAME}/profiles/*`,
                        `arn:aws:s3:::${BUCKET_NAME}/hospital-logos/*`,
                        `arn:aws:s3:::${BUCKET_NAME}/doctor-photos/*`,
                        `arn:aws:s3:::${BUCKET_NAME}/medicine-images/*`,
                    ],
                },
            ],
        };

        await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
        console.log('✅ Bucket policy set (public read for profiles, logos, photos)');

        // 3. Create folder placeholders
        console.log('\n📁 Creating folder structure...');
        for (const folder of FOLDERS) {
            try {
                await minioClient.putObject(BUCKET_NAME, `${folder}.keep`, Buffer.from(''));
                console.log(`   ✓ ${folder}`);
            } catch (e) {
                console.log(`   ⚠ ${folder} (may already exist)`);
            }
        }

        // 4. Set lifecycle rules to auto-delete temp files after 24 hours
        const lifecycleConfig = {
            Rule: [
                {
                    ID: 'DeleteTempFiles',
                    Status: 'Enabled',
                    Filter: { Prefix: 'temp/' },
                    Expiration: { Days: 1 },
                },
            ],
        };

        try {
            await minioClient.setBucketLifecycle(BUCKET_NAME, lifecycleConfig);
            console.log('\n✅ Lifecycle rules set (temp files expire in 24h)');
        } catch (e) {
            console.log('\n⚠ Could not set lifecycle rules:', e.message);
        }

        console.log('\n✅ MinIO setup completed successfully!');
        console.log('\n📋 Folder Structure:');
        FOLDERS.forEach(f => console.log(`   • ${f}`));

        console.log('\n🔗 Access URLs:');
        const protocol = config.minio.useSSL ? 'https' : 'http';
        const port = config.minio.port !== 80 && config.minio.port !== 443 ? `:${config.minio.port}` : '';
        console.log(`   ${protocol}://${config.minio.endPoint}${port}/${BUCKET_NAME}/`);

    } catch (error) {
        console.error('\n❌ MinIO setup failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('  1. Ensure MinIO server is running');
        console.log('  2. Check MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY in .env');
        console.log('  3. Verify network connectivity to MinIO server');
        process.exit(1);
    }
}

// Run setup
setupMinIO();
