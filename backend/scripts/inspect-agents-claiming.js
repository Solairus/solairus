require('dotenv').config();
const { Client } = require('pg');

function toIso(ts) {
  try {
    return new Date(ts).toISOString();
  } catch {
    return String(ts);
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const now = Date.now();
    const res = await client.query(`
      SELECT 
        a.id,
        a.user_id,
        a.status,
        a.amount,
        a.activated_at,
        a.created_at,
        a.claimed_at
      FROM agents a
      ORDER BY a.id ASC
    `);

    console.log(`[inspect] Agents found: ${res.rowCount}`);
    let missingClaimed = 0;
    let readyCount = 0;
    let cooldownCount = 0;

    for (const row of res.rows) {
      const id = row.id;
      const activatedAt = row.activated_at ? new Date(row.activated_at).getTime() : null;
      const createdAt = new Date(row.created_at).getTime();
      const claimedAt = row.claimed_at ? new Date(row.claimed_at).getTime() : null;

      if (!claimedAt) missingClaimed++;

      const refTs = claimedAt ?? activatedAt ?? createdAt;
      const nextTs = refTs + 24 * 60 * 60 * 1000; // 24h in ms
      const remainingMs = Math.max(0, nextTs - now);
      const canClaim = remainingMs === 0;

      if (canClaim) readyCount++; else cooldownCount++;

      console.log(
        JSON.stringify(
          {
            id,
            status: row.status,
            user_id: row.user_id,
            amount_micro: String(row.amount),
            activated_at: row.activated_at ? toIso(row.activated_at) : null,
            created_at: toIso(row.created_at),
            claimed_at: row.claimed_at ? toIso(row.claimed_at) : null,
            next_claim_at_expected: new Date(nextTs).toISOString(),
            remaining_ms_expected: remainingMs,
            can_claim_expected: canClaim
          },
          null,
          2
        )
      );
    }

    console.log(`[inspect] missing claimed_at: ${missingClaimed}`);
    console.log(`[inspect] cooldown agents: ${cooldownCount}`);
    console.log(`[inspect] ready agents: ${readyCount}`);
  } catch (e) {
    console.error('[inspect] Error:', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();