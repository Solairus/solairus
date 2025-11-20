/*
 * Apply migration 013 to extend transactions.type and status constraints
 */
require('dotenv/config')
const { readFileSync } = require('fs')
const path = require('path')
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. Please configure .env')
  process.exit(1)
}
const pool = new Pool({ connectionString })

async function main() {
  const sqlPath = path.resolve(__dirname, '../migrations/013_extend_transactions_types.sql')
  const sql = readFileSync(sqlPath, 'utf8')
  console.log(`[migrate] Applying 013_extend_transactions_types.sql`)
  await pool.query(sql)
  const check = await pool.query(
    `SELECT check_clause FROM information_schema.check_constraints WHERE constraint_name='transactions_type_check'`
  )
  console.log(`[migrate] transactions_type_check: ${check.rows[0]?.check_clause}`)
}

main()
  .then(() => {
    console.log('[migrate] Done')
    process.exit(0)
  })
  .catch((e) => {
    console.error('[migrate] Failed:', e)
    process.exit(1)
  })