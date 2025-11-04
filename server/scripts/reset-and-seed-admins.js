#!/usr/bin/env node
/**
 * Orchestrates a safe DB reset (preserving settings and agent_tiers)
 * and seeds default admin/dev/marketer users using the existing seed script.
 *
 * Inputs:
 * - Environment variable `DATABASE_URL` for Postgres connection.
 * - Admin/dev/marketer addresses read by existing seed script from root `.env` or CLI args.
 *
 * Outputs:
 * - Truncated runtime tables (agents, balances, histories, transactions, users) with identities reset.
 * - Admin/dev/marketer users upserted with non-expiring active license.
 * - Console summary of preserved table counts and seeded users.
 *
 * Core logic:
 * 1) Run `scripts/reset-db.js` to truncate non-preserved tables.
 * 2) Run `scripts/seed.js --admins-only` to insert admin/dev/marketer users.
 * 3) Verify and print a concise summary of resulting users and preserved table rows.
 */

require('dotenv/config');
const path = require('path');
const { spawnSync } = require('child_process');

const backendDir = path.resolve(__dirname, '..');

/**
 * Run a Node script with inherited stdio for clear logging.
 * Exits the process if the child fails.
 */
function runNodeScript(scriptRelPath, args = []) {
  const scriptPath = path.join(backendDir, scriptRelPath);
  const res = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (res.status !== 0) {
    console.error(`[reset-seed] Command failed: node ${scriptRelPath} ${args.join(' ')}`);
    process.exit(res.status || 1);
  }
}

console.log('[reset-seed] Starting DB reset (preserve settings, agent_tiers, schema_migrations)...');
runNodeScript('scripts/reset-db.js');

console.log('[reset-seed] Seeding admins/dev/marketers (admins-only)...');
runNodeScript('scripts/seed.js', ['--admins-only']);

// Verification: print users and preserved tables counts
(async () => {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const users = await pool.query('SELECT id, user_address, license_status FROM users ORDER BY id');
    console.log(`[reset-seed] Seeded users: ${users.rows.length}`);
    for (const u of users.rows) {
      console.log(`[reset-seed] - ${u.user_address} (${u.license_status})`);
    }

    const tiersCount = await pool.query('SELECT COUNT(*)::int AS c FROM agent_tiers');
    const settingsCount = await pool.query('SELECT COUNT(*)::int AS c FROM settings');
    console.log(`[reset-seed] Preserved tables: agent_tiers=${tiersCount.rows[0].c}, settings=${settingsCount.rows[0].c}`);
  } catch (err) {
    console.error('[reset-seed] Verification error:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }

  console.log('[reset-seed] Done.');
})();