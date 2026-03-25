#!/usr/bin/env node
/**
 * Verify approved providers are discoverable on patient map/cards.
 * Fails if any approved+active provider is missing phone (including owner fallback)
 * or coordinates required for map visibility.
 */
const { supabaseAdmin } = require('../config/supabase');

const PROVIDER_CONFIG = [
  { type: 'hospital', table: 'hospitals', userField: 'owner_id', needsLocation: true },
  { type: 'clinic', table: 'clinics', userField: 'owner_id', needsLocation: true },
  { type: 'pharmacy', table: 'pharmacies', userField: 'owner_id', needsLocation: true },
  { type: 'diagnostic_center', table: 'diagnostic_centers', userField: 'owner_id', needsLocation: true },
];

async function fetchUsersByIds(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, phone')
    .in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((u) => [u.id, u.phone || null]));
}

async function verifyType(cfg) {
  const { data, error } = await supabaseAdmin
    .from(cfg.table)
    .select(`id, name, phone, latitude, longitude, ${cfg.userField}`)
    .eq('is_approved', true)
    .eq('is_active', true);

  if (error) throw error;
  const rows = data || [];

  const missingPhoneRows = rows.filter((r) => !r.phone && r[cfg.userField]);
  const ownerIds = [...new Set(missingPhoneRows.map((r) => r[cfg.userField]).filter(Boolean))];
  const userPhoneById = await fetchUsersByIds(ownerIds);

  const issues = [];
  for (const row of rows) {
    const fallbackPhone = row.phone || userPhoneById.get(row[cfg.userField]) || null;
    const hasCoords =
      typeof row.latitude === 'number' && !Number.isNaN(row.latitude) &&
      typeof row.longitude === 'number' && !Number.isNaN(row.longitude);

    if (!fallbackPhone) {
      issues.push({ type: 'missing_phone', id: row.id, name: row.name });
    }
    if (cfg.needsLocation && !hasCoords) {
      issues.push({ type: 'missing_coordinates', id: row.id, name: row.name });
    }
  }

  return {
    type: cfg.type,
    totalApprovedActive: rows.length,
    issueCount: issues.length,
    issues,
  };
}

(async () => {
  try {
    const results = [];
    for (const cfg of PROVIDER_CONFIG) {
      results.push(await verifyType(cfg));
    }

    const totalIssues = results.reduce((sum, r) => sum + r.issueCount, 0);
    console.log('Provider discovery verification summary:');
    for (const r of results) {
      console.log(`- ${r.type}: ${r.totalApprovedActive} approved+active, issues=${r.issueCount}`);
    }

    if (totalIssues > 0) {
      console.error('\nIssues found:');
      for (const r of results) {
        for (const issue of r.issues) {
          console.error(`[${r.type}] ${issue.type}: ${issue.id} (${issue.name || 'Unnamed'})`);
        }
      }
      process.exit(1);
    }

    console.log('\nAll approved providers are discoverable for patient map/cards.');
    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
  }
})();
