require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('[claimed_at:+24h] Updating all agents claimed_at = NOW() + interval \"24 hours\"');
    const res = await client.query("UPDATE agents SET claimed_at = NOW() + interval '24 hours'");
    console.log(`[claimed_at:+24h] Rows updated: ${res.rowCount}`);

    const check = await client.query(
      `SELECT COUNT(*)::int AS total,
              MIN(claimed_at) AS min_claimed_at,
              MAX(claimed_at) AS max_claimed_at
       FROM agents`
    );
    const row = check.rows[0];
    console.log(`[claimed_at:+24h] Total agents: ${row.total}`);
    console.log(`[claimed_at:+24h] Min claimed_at: ${row.min_claimed_at}`);
    console.log(`[claimed_at:+24h] Max claimed_at: ${row.max_claimed_at}`);
  } catch (e) {
    console.error('[claimed_at:+24h] Error:', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();