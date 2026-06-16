// Minimal, idempotent seeder for the settings the payment flow needs.
// Safe to run repeatedly. Does NOT touch demo users/transactions (unlike seed.js).
//
// Run from host against local Docker Postgres (port 5432 is exposed):
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/solairus \
//   LICENSE_FEE_USDT=25 LICENSE_TERM_DAYS=365 node scripts/seed-settings.js
//
// LICENSE_FEE_USDT is in WHOLE USDT (e.g. 25). It is stored as micro-USDT (×1e6),
// which is how the backend reads license.fee_usdt.
require('dotenv').config()
const { Client } = require('pg')

async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const client = new Client({ connectionString })
  await client.connect()

  const feeWhole = Number(process.env.LICENSE_FEE_USDT ?? 25)
  const feeMicro = Math.round(feeWhole * 1_000_000)
  const termDays = Number(process.env.LICENSE_TERM_DAYS ?? 365)

  const settings = [
    ['license.fee_usdt', feeMicro, 'number', 'License activation cost in micro-USDT (6 decimals)'],
    ['license.term_days', termDays, 'number', 'License expiration term in days'],
  ]

  for (const [key, value, type, description] of settings) {
    await client.query(
      `INSERT INTO settings (key, value, type, description)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type`,
      [key, JSON.stringify(value), type, description]
    )
    console.log(`[seed-settings] ${key} = ${JSON.stringify(value)}`)
  }

  await client.end()
  console.log(`[seed-settings] done — license fee = $${feeWhole} (${feeMicro} micro), term = ${termDays} days`)
}

run().catch((err) => { console.error(err); process.exit(1) })
