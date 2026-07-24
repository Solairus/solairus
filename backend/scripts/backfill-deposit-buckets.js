// Backfill ("pay-back") bucket distribution for past blockchain deposits.
//
// Context: depositDistribution()/distributeDeposit() (backend/services/buckets.ts)
// only started running going forward once fulfillment.ts was wired to call it.
// Real deposits swept before that change never got mirrored into bucket_balances.
// This script finds those and runs distributeDeposit() for each one.
//
// Scope: ONLY real, sweep-confirmed blockchain deposits — i.e. payment_orders rows
// (type='deposit', status='completed'). Admin manual credits/debits never create a
// payment_orders row (see routes/admin.ts POST /users/:address/credit|debit), so they
// are naturally excluded — nothing to filter out explicitly.
//
// distributeDeposit() is itself idempotent (skips if bucket_histories already has a
// row for that transaction_id), so this script is safe to re-run.
//
// SAFETY: default mode is DRY RUN — prints what would be distributed, changes nothing.
// Only mutates when CONFIRM_BACKFILL=YES is set.
//
// Usage:
//   DATABASE_URL=... node scripts/backfill-deposit-buckets.js                    # dry run
//   DATABASE_URL=... CONFIRM_BACKFILL=YES node scripts/backfill-deposit-buckets.js # execute
require('dotenv').config()
require('ts-node/register')
const { Client } = require('pg')
const { distributeDeposit } = require('../src/services/buckets')

async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const execute = process.env.CONFIRM_BACKFILL === 'YES'
  const client = new Client({ connectionString })
  await client.connect()

  const { rows } = await client.query(`
    SELECT po.id AS order_id, po.order_ref, po.transaction_id, t.amount AS amount_micro
    FROM payment_orders po
    JOIN transactions t ON t.id = po.transaction_id
    WHERE po.type = 'deposit' AND po.status = 'completed' AND po.transaction_id IS NOT NULL
    ORDER BY po.id ASC
  `)

  console.log(`[backfill] found ${rows.length} completed blockchain deposit order(s)`)

  const alreadyDone = await client.query(`
    SELECT DISTINCT transaction_id FROM bucket_histories WHERE transaction_id = ANY($1::bigint[])
  `, [rows.map(r => r.transaction_id)])
  const doneSet = new Set(alreadyDone.rows.map(r => Number(r.transaction_id)))

  const pending = rows.filter(r => !doneSet.has(Number(r.transaction_id)))
  console.log(`[backfill] already distributed: ${rows.length - pending.length}, pending: ${pending.length}`)

  let totalUsdt = 0
  for (const r of pending) {
    const amountUsdt = Number(r.amount_micro) / 1_000_000
    totalUsdt += amountUsdt
    console.log(`  - order ${r.order_ref} (tx ${r.transaction_id}): ${amountUsdt} USDT`)
  }
  console.log(`[backfill] total pending deposit amount: ${totalUsdt.toFixed(6)} USDT`)

  if (!execute) {
    console.log('\n[backfill] DRY RUN — no changes made. Re-run with CONFIRM_BACKFILL=YES to apply.')
    await client.end()
    return
  }

  console.log('\n[backfill] EXECUTING (CONFIRM_BACKFILL=YES)...')
  let done = 0
  for (const r of pending) {
    const amountUsdt = Number(r.amount_micro) / 1_000_000
    await distributeDeposit(amountUsdt, Number(r.transaction_id))
    done++
    console.log(`  [${done}/${pending.length}] distributed order ${r.order_ref}`)
  }
  console.log(`[backfill] done — distributed ${done} deposit(s).`)

  await client.end()
}

run().catch((err) => {
  console.error('[backfill] failed:', err)
  process.exit(1)
})
