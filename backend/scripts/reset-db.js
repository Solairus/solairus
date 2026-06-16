// Reset DB: truncate application tables and reset sequences
// Purpose: Clear seeded/demo data and restart IDs at 1 without dropping tables
// Usage: node scripts/reset-db.js [--reset-preserved]
//  - By default, preserves data in 'settings' and 'agent_tiers' and does NOT reset their sequences
//  - Pass --reset-preserved to also reset sequences for preserved tables

require('dotenv').config()
const { Client } = require('pg')

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set (backend/.env)')

  const client = new Client({ connectionString })
  await client.connect()

  // Tables to always preserve (not truncated by default)
  const preserve = new Set(['settings', 'agent_tiers', 'schema_migrations'])
  const resetPreserved = process.argv.includes('--reset-preserved')

  // List base tables in public schema
  const tablesRes = await client.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema='public' AND table_type='BASE TABLE'
     ORDER BY table_name`
  )
  const allTables = tablesRes.rows.map((r) => r.table_name)

  const truncateTables = allTables.filter((t) => !preserve.has(t))

  console.log('[reset-db] found tables:', allTables.join(', ') || '(none)')
  console.log('[reset-db] will TRUNCATE:', truncateTables.join(', ') || '(none)')
  console.log('[reset-db] will PRESERVE:', Array.from(preserve).join(', '))

  if (truncateTables.length) {
    await client.query('BEGIN')
    try {
      const sql = `TRUNCATE TABLE ${truncateTables.map((t) => '"' + t + '"').join(', ')} RESTART IDENTITY CASCADE;`
      await client.query(sql)
      await client.query('COMMIT')
      console.log('[reset-db] truncated and reset identities for:', truncateTables.join(', '))
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  } else {
    console.log('[reset-db] no tables to truncate')
  }

  if (resetPreserved) {
    console.log('[reset-db] resetting sequences for preserved tables (excluding schema_migrations)')
    await client.query('BEGIN')
    try {
      for (const t of Array.from(preserve).filter((x) => x !== 'schema_migrations')) {
        const seqRes = await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [t])
        const seq = seqRes.rows[0]?.seq
        if (seq) {
          await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`)
          console.log(`[reset-db] sequence reset to 1 for ${t} (${seq})`)
        } else {
          console.log(`[reset-db] no serial sequence bound to ${t}. Skipped.`)
        }
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  }

  await client.end()
  console.log('[reset-db] done')
}

main().catch((err) => {
  console.error('[reset-db] error:', err)
  process.exit(1)
})