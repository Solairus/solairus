// Clear seeded data while preserving required tables
// Preserves: settings, agent_tiers
// Clears: transactions, balances, balance_history, agents, users (as instructed)
// Safe, idempotent, logs before/after counts.

require('dotenv').config()
const { Client } = require('pg')

async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const client = new Client({ connectionString })
  await client.connect()

  const tables = {
    preserve: ['settings', 'agent_tiers', 'schema_migrations'],
    clear: ['transactions', 'balance_history', 'balances', 'agents', 'users'],
  }

  const getCount = async (table) => {
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS c FROM ${table}`)
      return r.rows[0]?.c ?? 0
    } catch (_) {
      return null // table may not exist; ignore
    }
  }

  console.log('[clear] starting...')
  const before = {}
  for (const t of [...tables.preserve, ...tables.clear]) {
    before[t] = await getCount(t)
  }
  console.table(before)

  try {
    await client.query('BEGIN')

    // Clear in dependency-safe order
    // 1) transactions (no FK dependencies outbound)
    await client.query('DELETE FROM transactions').catch(() => {})

    // 2) balance_history then balances (FK cascade exists, but explicit clear is fine)
    await client.query('DELETE FROM balance_history').catch(() => {})
    await client.query('DELETE FROM balances').catch(() => {})

    // 3) agents then users (agents references users ON DELETE CASCADE; clearing agents first avoids cascades)
    await client.query('DELETE FROM agents').catch(() => {})
    await client.query('DELETE FROM users').catch(() => {})

    // settings and agent_tiers are preserved by design

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }

  const after = {}
  for (const t of [...tables.preserve, ...tables.clear]) {
    after[t] = await getCount(t)
  }
  console.log('[clear] done. After counts:')
  console.table(after)

  await client.end()
}

run().catch((err) => {
  console.error('[clear] failed:', err)
  process.exit(1)
})