// Simple migration runner: executes SQL files in migrations/ directory.
// Purpose: Apply schema changes to Postgres without external tools.
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const client = new Client({ connectionString })
  await client.connect()

  // Ensure migrations tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const dir = path.resolve(__dirname, '../migrations')
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))

  // Bootstrap: if schema_migrations is empty but the DB already has prior schema
  // (a production DB created before this runner existed), mark older migrations
  // (<= 004_) as applied to avoid re-running incompatible files.
  //
  // This MUST NOT fire on a fresh/empty database (e.g. the local Docker Postgres),
  // otherwise the table-creating migrations get skipped and later ALTERs fail. We
  // gate it on whether any application table already exists.
  const migCount = await client.query('SELECT COUNT(*)::int AS c FROM schema_migrations')
  if ((migCount.rows[0]?.c ?? 0) === 0) {
    const existingSchema = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> 'schema_migrations'
      LIMIT 1
    `)
    if (existingSchema.rows.length) {
      const baseline = files.filter((f) => {
        const n = parseInt(f.split('_')[0], 10)
        return Number.isFinite(n) && n <= 4
      })
      if (baseline.length) {
        console.log(`[migrate] existing schema detected — bootstrapping schema_migrations with: ${baseline.join(', ')}`)
        await client.query('BEGIN')
        for (const f of baseline) {
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [f])
        }
        await client.query('COMMIT')
      }
    }
  }

  // Detect existing schema to safely skip incompatible older migrations
  const hasBalances = await client.query(`
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='balances'
  `)
  if (hasBalances.rows.length) {
    await client.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
      ['003_balances.sql']
    )
    // If bucketed columns already exist, mark 004 as applied
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='balances' 
        AND column_name IN ('bonus_balance','reward_balance','credit_balance')
    `)
    if (colCheck.rows.length >= 3) {
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
        ['004_balances_per_user.sql']
      )
    }
  }

  for (const file of files) {
    const already = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1', [file])
    if (already.rows.length) {
      console.log(`[migrate] skipping ${file} (already applied)`) 
      continue
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8')
    console.log(`[migrate] applying ${file}...`)
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
  }

  await client.end()
  console.log('[migrate] done')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})