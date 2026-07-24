// Backfill ("pay-back") bucket + affiliate distribution for past blockchain orders.
//
// Context: bucket distribution for deposit and agent orders was never wired into the
// order-monitor path (fulfillment.ts) — deposits credited credit_balance only, and
// agent activations distributed nothing at all (distributeAgent was dead code). Once
// fulfillment.ts was fixed to call distributeDeposit()/distributeAgent(), this script
// pays back the orders that settled before the fix.
//
// Scope: real, sweep-confirmed blockchain orders only — payment_orders rows with
// type IN ('deposit','agent') and status='completed'. Admin manual credits/debits never
// create a payment_orders row (routes/admin.ts), so they are naturally excluded.
//
//   - deposit → distributeDeposit(amount, txId)            (100% to buckets, no affiliate)
//   - agent   → distributeAgent(amount, txId)              (90% to buckets)
//               + distributeAffiliateBonuses(userId, ...)  (10% affiliate L1/L2/L3)
//
// License orders are intentionally NOT touched here — they already distribute via
// fulfillment.ts / routes/license.ts.
//
// All three distribution fns are idempotent (skip if transaction_id already processed),
// so this script is safe to re-run.
//
// SAFETY: default mode is DRY RUN — prints what would be distributed, changes nothing.
// Only mutates when CONFIRM_BACKFILL=YES is set.
//
// Usage:
//   DATABASE_URL=... node scripts/backfill-order-buckets.js                     # dry run
//   DATABASE_URL=... CONFIRM_BACKFILL=YES node scripts/backfill-order-buckets.js  # execute
require('dotenv').config()
require('ts-node/register')
const { Client } = require('pg')
const { distributeDeposit, distributeAgent } = require('../services/buckets')
const { distributeAffiliateBonuses } = require('../services/affiliate')

async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const execute = process.env.CONFIRM_BACKFILL === 'YES'
  const client = new Client({ connectionString })
  await client.connect()

  const { rows } = await client.query(`
    SELECT po.id AS order_id, po.order_ref, po.type, po.user_id, po.transaction_id, t.amount AS amount_micro
    FROM payment_orders po
    JOIN transactions t ON t.id = po.transaction_id
    WHERE po.type IN ('deposit','agent') AND po.status = 'completed' AND po.transaction_id IS NOT NULL
    ORDER BY po.id ASC
  `)

  console.log(`[backfill] found ${rows.length} completed deposit/agent order(s)`)

  const txIds = rows.map(r => Number(r.transaction_id))
  const alreadyDone = txIds.length
    ? await client.query(`SELECT DISTINCT transaction_id FROM bucket_histories WHERE transaction_id = ANY($1::bigint[])`, [txIds])
    : { rows: [] }
  const doneSet = new Set(alreadyDone.rows.map(r => Number(r.transaction_id)))

  const pending = rows.filter(r => !doneSet.has(Number(r.transaction_id)))
  console.log(`[backfill] already bucket-distributed: ${rows.length - pending.length}, pending: ${pending.length}`)

  for (const r of pending) {
    const amountUsdt = Number(r.amount_micro) / 1_000_000
    const extra = r.type === 'agent' ? ' (+ affiliate)' : ''
    console.log(`  - ${r.type} order ${r.order_ref} (tx ${r.transaction_id}, user ${r.user_id}): ${amountUsdt} USDT${extra}`)
  }

  if (!execute) {
    console.log('\n[backfill] DRY RUN — no changes made. Re-run with CONFIRM_BACKFILL=YES to apply.')
    await client.end()
    return
  }

  console.log('\n[backfill] EXECUTING (CONFIRM_BACKFILL=YES)...')
  let done = 0
  for (const r of pending) {
    const amountUsdt = Number(r.amount_micro) / 1_000_000
    const txId = Number(r.transaction_id)
    if (r.type === 'deposit') {
      await distributeDeposit(amountUsdt, txId)
    } else if (r.type === 'agent') {
      await distributeAgent(amountUsdt, txId)
      // 10% affiliate carve-out; idempotent on its own ledger.
      await distributeAffiliateBonuses(Number(r.user_id), Number(r.amount_micro), txId)
    }
    done++
    console.log(`  [${done}/${pending.length}] distributed ${r.type} order ${r.order_ref}`)
  }
  console.log(`[backfill] done — distributed ${done} order(s).`)

  await client.end()
}

run().catch((err) => {
  console.error('[backfill] failed:', err)
  process.exit(1)
})
