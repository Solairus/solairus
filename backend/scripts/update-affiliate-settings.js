// Update affiliate commission settings
// Purpose: Upsert L1/L2/L3 percentages into the settings table
// Inputs: DATABASE_URL from backend/.env (and root .env as fallback)
// Outputs: Ensures settings keys exist with numeric JSON values
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
// Also try loading root .env in case it's used for local dev
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
    { key: 'affiliate.l1_pct', type: 'number', value: 0.05, description: 'Direct (L1) affiliate percentage' },
    { key: 'affiliate.l2_pct', type: 'number', value: 0.03, description: 'Second-level (L2) affiliate percentage' },
    { key: 'affiliate.l3_pct', type: 'number', value: 0.02, description: 'Third-level (L3) affiliate percentage' },
  ]

  const upsertSql = `
    INSERT INTO settings (key, value, type, description)
    VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type, description = COALESCE(EXCLUDED.description, settings.description)
  `

  for (const s of settings) {
    await client.query(upsertSql, [s.key, JSON.stringify(s.value), s.type, s.description || null])
    console.log(`[affiliate-settings] upserted ${s.key}=${s.value}`)
  }

  const verifySql = `SELECT key, value, type FROM settings WHERE key LIKE 'affiliate.%' ORDER BY key ASC`
  const { rows } = await client.query(verifySql)
  console.log('[affiliate-settings] verification rows:')
  for (const r of rows) {
    console.log(` - ${r.key}: value=${typeof r.value === 'object' ? JSON.stringify(r.value) : r.value} type=${r.type}`)
  }

  await client.end()
}

main().catch((err) => {
  console.error('[affiliate-settings] failed:', err)
  process.exit(1)
})