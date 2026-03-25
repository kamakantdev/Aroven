#!/usr/bin/env node
/**
 * One-time Geocoding Maintenance Script
 * ------------------------------------
 * Finds all facilities (hospitals, clinics, pharmacies, diagnostic_centers)
 * that have a text address but NULL latitude/longitude, then geocodes them
 * via Nominatim (free OpenStreetMap service).
 *
 * Usage:
 *   node scripts/geocode-facilities.js            # dry-run (default)
 *   node scripts/geocode-facilities.js --apply     # actually update the DB
 *   node scripts/geocode-facilities.js --table hospitals  # only one table
 *
 * Rate limit: 1 request per second (Nominatim policy).
 */

require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const { geocodeAddress } = require('../utils/geocoding');

// ── Config ──
const RATE_LIMIT_MS = 1100; // slightly over 1s to be polite

const FACILITY_TABLES = [
    { table: 'hospitals', addressCols: ['address', 'city', 'state', 'pincode'], label: 'Hospitals' },
    { table: 'clinics', addressCols: ['address', 'city', 'state', 'pincode'], label: 'Clinics' },
    { table: 'pharmacies', addressCols: ['address', 'city', 'state', 'pincode'], label: 'Pharmacies' },
    {
        table: 'diagnostic_centers',
        addressCols: ['address', 'city', 'state', 'pincode'],
        label: 'Diagnostic Centers',
    },
];

// ── Helpers ──

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Geocode an address string via Nominatim.
 * Returns { lat, lon } or null if not found.
 */
async function geocode(address) {
    try {
        const result = await geocodeAddress(address);
        if (!result) return null;
        return {
            lat: result.latitude,
            lon: result.longitude,
            display: result.displayName,
        };
    } catch (err) {
        console.warn(`  ⚠ Geocode error: ${err.message}`);
        return null;
    }
}

/**
 * Build a full address string from a row and its addressCols.
 */
function buildAddress(row, addressCols) {
    return addressCols
        .map((col) => row[col])
        .filter(Boolean)
        .join(', ')
        .trim();
}

// ── Main ──

async function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--apply');
    const tableFilter = args.includes('--table')
        ? args[args.indexOf('--table') + 1]
        : null;

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║     SWASTIK — Facility Geocoding Script         ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN (use --apply to write)' : '✏️  APPLY MODE — will update DB'}`);
    if (tableFilter) console.log(`Table filter: ${tableFilter}`);
    console.log('');

    const tables = tableFilter
        ? FACILITY_TABLES.filter((t) => t.table === tableFilter)
        : FACILITY_TABLES;

    if (tables.length === 0) {
        console.error(`❌ Unknown table: ${tableFilter}`);
        console.log(`   Valid tables: ${FACILITY_TABLES.map((t) => t.table).join(', ')}`);
        process.exit(1);
    }

    let totalFound = 0;
    let totalGeocoded = 0;
    let totalFailed = 0;

    for (const { table, addressCols, label } of tables) {
        console.log(`\n── ${label} (${table}) ──`);

        // Fetch rows with NULL lat/lng but at least one non-null address col
        const { data: rows, error } = await supabaseAdmin
            .from(table)
            .select(`id, name, ${addressCols.join(', ')}, latitude, longitude`)
            .is('latitude', null);

        if (error) {
            console.error(`  ❌ Query error: ${error.message}`);
            continue;
        }

        // Filter out rows where ALL address cols are empty strings
        const candidates = (rows || []).filter((row) => {
            const addr = buildAddress(row, addressCols);
            return addr.length >= 5; // need at least a few chars to geocode
        });

        console.log(`  Found ${candidates.length} facilities with address but no coordinates.`);
        totalFound += candidates.length;

        if (candidates.length === 0) continue;

        for (const row of candidates) {
            const addr = buildAddress(row, addressCols);
            process.stdout.write(`  📍 ${row.name || row.id}: "${addr}" → `);

            const result = await geocode(addr);

            if (result) {
                console.log(`✅ (${result.lat}, ${result.lon})`);
                totalGeocoded++;

                if (!dryRun) {
                    const { error: updateError } = await supabaseAdmin
                        .from(table)
                        .update({
                            latitude: result.lat,
                            longitude: result.lon,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', row.id);

                    if (updateError) {
                        console.warn(`     ⚠ DB update failed: ${updateError.message}`);
                        totalFailed++;
                        totalGeocoded--;
                    }
                }
            } else {
                console.log('❌ Not found');
                totalFailed++;
            }

            // Respect Nominatim rate limit
            await sleep(RATE_LIMIT_MS);
        }
    }

    console.log('\n══════════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`   Total facilities missing coordinates: ${totalFound}`);
    console.log(`   Successfully geocoded:                ${totalGeocoded}`);
    console.log(`   Failed / not found:                   ${totalFailed}`);
    if (dryRun && totalGeocoded > 0) {
        console.log(`\n   ℹ️  This was a dry run. Run with --apply to update the database.`);
    }
    console.log('══════════════════════════════════════\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
