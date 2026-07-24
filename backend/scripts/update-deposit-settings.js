// Update deposit distribution settings
// Purpose: Upsert admin/dev/marketer_1/marketer_2/trader percentages into the settings
// table for depositDistribution() (backend/services/buckets.ts). `reserve` is not a
// setting — it always takes the remainder so rounding never leaks.
// Inputs: DATABASE_URL from backend/.env (and root .env as fallback)
// Outputs: Ensures settings keys exist with numeric JSON values
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') })
} catch (_) {}

const { Client } = require('pg')

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const client = new Client({ connectionString })
  await client.connect()

  const settings = [
    { key: 'distribution.deposit.admin', type: 'number', value: 0.10, description: 'Deposit distribution: admin bucket percentage' },
    { key: 'distribution.deposit.dev', type: 'number', value: 0.10, description: 'Deposit distribution: dev bucket percentage' },
    { key: 'distribution.deposit.marketer_1', type: 'number', value: 0.05, description: 'Deposit distribution: marketer_1 bucket percentage' },
    { key: 'distribution.deposit.marketer_2', type: 'number', value: 0.05, description: 'Deposit distribution: marketer_2 bucket percentage' },
    { key: 'distribution.deposit.trader', type: 'number', value: 0.15, description: 'Deposit distribution: trader bucket percentage' },
  ]

  const upsertSql = `
    INSERT INTO settings (key, value, type, description)
    VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type, description = COALESCE(EXCLUDED.description, settings.description)
  `

  for (const s of settings) {
    await client.query(upsertSql, [s.key, JSON.stringify(s.value), s.type, s.description || null])
    console.log(`[deposit-settings] upserted ${s.key}=${s.value}`)
  }

  const verifySql = `SELECT key, value, type FROM settings WHERE key LIKE 'distribution.deposit.%' ORDER BY key ASC`
  const { rows } = await client.query(verifySql)
  console.log('[deposit-settings] verification rows:')
  for (const r of rows) {
    console.log(` - ${r.key}: value=${typeof r.value === 'object' ? JSON.stringify(r.value) : r.value} type=${r.type}`)
  }

  await client.end()
}

main().catch((err) => {
  console.error('[deposit-settings] failed:', err)
  process.exit(1)
})
