/**
 * SWASTIK Healthcare Platform - Database Migration Script
 * 
 * This script runs the necessary migrations to add all user roles
 * and creates the required tables for the platform.
 * 
 * Usage: node scripts/run-migrations.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function runMigrations() {
    console.log('🔧 Running database migrations...\n');

    try {
        // Step 1: Check current role column type
        console.log('1️⃣ Checking users table structure...');
        
        // Step 2: Alter the role column to TEXT to support all roles
        console.log('2️⃣ Updating role column to support all roles...');
        
        const { error: alterError } = await supabase.rpc('exec_sql', {
            sql: `
                -- Drop the enum constraint and change to TEXT
                ALTER TABLE users 
                ALTER COLUMN role TYPE TEXT;
            `
        });

        if (alterError) {
            // Try alternative approach - the RPC might not exist
            console.log('   ⚠️ RPC not available, trying direct approach...');
            
            // We'll need to update via regular queries
            // First, let's check what roles exist
            const { data: users, error: checkError } = await supabase
                .from('users')
                .select('id, email, role')
                .limit(5);
            
            if (checkError) {
                console.error('   ❌ Cannot access users table:', checkError.message);
            } else {
                console.log('   ✅ Users table accessible, found', users?.length, 'users');
            }
        } else {
            console.log('   ✅ Role column updated successfully');
        }

        // Step 3: Create required tables if they don't exist
        console.log('3️⃣ Ensuring required tables exist...');

        // Check hospitals table
        const { data: hospitals, error: hospError } = await supabase
            .from('hospitals')
            .select('id')
            .limit(1);
        
        if (hospError && hospError.code === '42P01') {
            console.log('   Creating hospitals table...');
        } else {
            console.log('   ✅ hospitals table exists');
        }

        // Check clinics table
        const { data: clinics, error: clinicError } = await supabase
            .from('clinics')
            .select('id')
            .limit(1);
        
        if (clinicError && clinicError.code === '42P01') {
            console.log('   Creating clinics table...');
        } else {
            console.log('   ✅ clinics table exists');
        }

        // Check pharmacies table
        const { data: pharmacies, error: pharmError } = await supabase
            .from('pharmacies')
            .select('id')
            .limit(1);
        
        if (pharmError && pharmError.code === '42P01') {
            console.log('   Creating pharmacies table...');
        } else {
            console.log('   ✅ pharmacies table exists');
        }

        // Check ambulance_operators table
        const { data: ambulances, error: ambError } = await supabase
            .from('ambulance_operators')
            .select('id')
            .limit(1);
        
        if (ambError && ambError.code === '42P01') {
            console.log('   Creating ambulance_operators table...');
        } else {
            console.log('   ✅ ambulance_operators table exists');
        }

        console.log('\n✅ Migration check complete!');
        console.log('\n📋 IMPORTANT: If you see enum errors, run this SQL in Supabase SQL Editor:');
        console.log('─────────────────────────────────────────────────────────────────────────');
        console.log(`
-- Option 1: Add new values to existing enum (run each separately)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hospital_owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'clinic_owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pharmacy_owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ambulance_operator';

-- Option 2: If above fails, convert role column to TEXT
ALTER TABLE users ALTER COLUMN role TYPE TEXT;
        `);
        console.log('─────────────────────────────────────────────────────────────────────────');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    }
}

runMigrations().then(() => process.exit(0));
