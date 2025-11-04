// Test script: verify license distribution uses bucket helper and records histories
// Purpose: Create a transaction, run distributeLicense, then assert bucket_balances and bucket_histories
require('dotenv').config()
require('ts-node/register')
const { Client } = require('pg')
const { distributeLicense } = require('../src/services/buckets')

async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const client = new Client({ connectionString })
  await client.connect()

  // Create a test transaction row
  const amountMicro = 1_000_000 // 1.000000 USDT
  const txSql = `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata)
                 VALUES ($1::text, $2::text, $3::text, $4::text, NULL, NULL, $5::bigint, $6::text, $7::smallint, $8::jsonb)
                 RETURNING id`
  const txParams = [
    'license_activation',
    'confirmed',
    `TEST_SIG_${Date.now()}`,
    'TEST_WALLET_111111111111111111111111111111111',
    amountMicro,
    'USDT_DEVNET',
    6,
    JSON.stringify({ source: 'script', route: 'test-license-distribution' })
  ]
  const txRes = await client.query(txSql, txParams)
  const txId = txRes.rows[0]?.id
  if (!txId) throw new Error('Failed to create test transaction')

  const amountUsdt = amountMicro / 1_000_000

  // Capture pre balances for comparison
  const pre = await client.query('SELECT admin, dev, marketer_1, marketer_2, trader, reserve FROM bucket_balances ORDER BY id ASC LIMIT 1')
  const preRow = pre.rows[0] || { admin: 0, dev: 0, marketer_1: 0, marketer_2: 0, trader: 0, reserve: 0 }

  // Run distribution via service
  await distributeLicense(amountUsdt, txId)

  // Fetch post balances
  const post = await client.query('SELECT admin, dev, marketer_1, marketer_2, trader, reserve FROM bucket_balances ORDER BY id ASC LIMIT 1')
  const postRow = post.rows[0]
  if (!postRow) throw new Error('bucket_balances missing after distribution')

  // Expected deltas for license distribution (90% total)
  const expected = {
    admin: +(amountUsdt * 0.30).toFixed(6),
    dev: +(amountUsdt * 0.30).toFixed(6),
    marketer_1: +(amountUsdt * 0.05).toFixed(6),
    marketer_2: +(amountUsdt * 0.05).toFixed(6),
    reserve: +(amountUsdt * 0.20).toFixed(6),
    trader: 0,
  }

  const cols = ['admin', 'dev', 'marketer_1', 'marketer_2', 'trader', 'reserve']
  for (const c of cols) {
    const preVal = Number(preRow[c] || 0)
    const postVal = Number(postRow[c] || 0)
    const delta = +(postVal - preVal).toFixed(6)
    if (delta !== expected[c]) {
      throw new Error(`Delta mismatch for ${c}: expected ${expected[c]}, got ${delta}`)
    }
  }

  // Verify bucket_histories entries for this transaction
  const hist = await client.query(
    'SELECT bucket_ref, amount, bucket_balance, transaction_id FROM bucket_histories WHERE transaction_id = $1 ORDER BY id ASC',
    [txId]
  )
  if (hist.rowCount !== 5) {
    throw new Error(`Expected 5 bucket_histories rows, got ${hist.rowCount}`)
  }
  for (const row of hist.rows) {
    if (!row.transaction_id) throw new Error('History transaction_id is NULL')
    const amt = Number(row.amount)
    if (amt <= 0) throw new Error('History amount must be positive')
  }

  console.log('[test] license distribution verified successfully')
  await client.end()
}

run().catch((err) => {
  console.error('[test] failed:', err)
  process.exit(1)
})