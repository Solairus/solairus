/**
 * Order fulfillment (idempotent). Called by the order monitor after a payment is
 * detected and swept. Settles the core effect in one DB transaction, then runs
 * post-commit distributions (matching the existing license route's behavior).
 *
 * Idempotency: payment_orders.tx_signature UNIQUE + row-lock status guard — a second
 * call for the same order is a no-op.
 */
import type { PoolClient } from 'pg'
import { pool, query } from '../db'
import { applyBalanceBucketChange, getOrCreateBalanceId } from './balance'
import { distributeLicense } from './buckets'
import { distributeAffiliateBonuses } from './affiliate'
import type { OrderRow } from './orders'

const DEFAULT_TERM_DAYS = 365

const USDT_MINT_LABEL = (): string => process.env.USDT_MINT_ADDRESS || 'USDT'

async function getTermDays(client: PoolClient): Promise<number> {
  const r = await client.query<{ value: unknown }>(
    "SELECT value FROM settings WHERE key = 'license.term_days' LIMIT 1"
  )
  const v = r.rows[0]?.value
  if (typeof v === 'number') return v
  if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : DEFAULT_TERM_DAYS }
  if (typeof v === 'object' && v !== null) {
    const inner = (v as Record<string, unknown>).value
    const n = typeof inner === 'number' ? inner : Number(inner as string)
    if (Number.isFinite(n)) return n
  }
  return DEFAULT_TERM_DAYS
}

interface PostCommit { kind: 'license'; costUsdt: number; feeMicro: number; userId: number; txId: number }

/**
 * Fulfill a settled order. `capturedMicro` is the amount actually swept on-chain;
 * for license/agent the recorded/priced amount is the order's expected_micro.
 */
export async function fulfillOrder(
  order: OrderRow,
  capturedMicro: bigint,
  sweepSig: string,
  userAddress: string
): Promise<void> {
  const client = await pool.connect()
  let postCommit: PostCommit | null = null
  try {
    await client.query('BEGIN')

    // Lock the order; bail if already settled (idempotent).
    const cur = await client.query<{ status: string; tx_signature: string | null }>(
      'SELECT status, tx_signature FROM payment_orders WHERE id = $1 FOR UPDATE',
      [order.id]
    )
    const row = cur.rows[0]
    if (!row || row.tx_signature || row.status === 'completed') {
      await client.query('ROLLBACK')
      return
    }

    const expectedMicro = order.expected_micro ? BigInt(order.expected_micro) : 0n
    const mintLabel = USDT_MINT_LABEL()

    if (order.type === 'license') {
      const priceMicro = expectedMicro > 0n ? expectedMicro : capturedMicro
      const txRes = await client.query<{ id: number }>(
        `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata)
         VALUES ('license_activation','confirmed',$1,$2,NULL,NULL,$3::bigint,$4,6,$5::jsonb)
         RETURNING id`,
        [sweepSig, userAddress, priceMicro.toString(), mintLabel,
         JSON.stringify({ source: 'order', order_ref: order.order_ref, swept_micro: capturedMicro.toString() })]
      )
      const txId = txRes.rows[0].id

      const termDays = await getTermDays(client)
      const expiresAt = new Date(Date.now() + termDays * 86400000).toISOString()
      await client.query('UPDATE users SET license_status=$1, license_expiration=$2 WHERE id=$3', ['active', expiresAt, order.user_id])

      await client.query(
        "UPDATE payment_orders SET status='completed', tx_signature=$1, transaction_id=$2, updated_at=NOW() WHERE id=$3",
        [sweepSig, txId, order.id]
      )

      postCommit = { kind: 'license', costUsdt: Number(priceMicro) / 1_000_000, feeMicro: Number(priceMicro), userId: order.user_id, txId }
    } else if (order.type === 'agent') {
      const priceMicro = expectedMicro > 0n ? expectedMicro : capturedMicro
      // Resolve tier by amount (mirrors /agents/activate)
      const tRes = await client.query<{ id: number; tier_name: string }>(
        'SELECT id, tier_name FROM agent_tiers WHERE $1::bigint BETWEEN min_amount AND max_amount LIMIT 1',
        [priceMicro.toString()]
      )
      const tierId = order.tier_id ?? tRes.rows[0]?.id ?? null
      const tierName = tRes.rows[0]?.tier_name ?? null

      const txRes = await client.query<{ id: number }>(
        `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata)
         VALUES ('agent_activation','confirmed',$1,$2,NULL,NULL,$3::bigint,$4,6,$5::jsonb)
         RETURNING id`,
        [sweepSig, userAddress, priceMicro.toString(), mintLabel,
         JSON.stringify({ source: 'order', order_ref: order.order_ref, tier_id: tierId, tier_name: tierName, swept_micro: capturedMicro.toString() })]
      )
      const txId = txRes.rows[0].id

      const agentLabel = tierName ? `Agent ${tierName}` : 'Agent'
      const agentIns = await client.query<{ id: number }>(
        `INSERT INTO agents (user_id, agent_label, status, activation_signature, amount, tier_id, metadata)
         VALUES ($1,$2,'active',$3,$4,$5,$6::jsonb) RETURNING id`,
        [order.user_id, agentLabel, sweepSig, priceMicro.toString(), tierId,
         JSON.stringify({ transaction_id: txId, tier_id: tierId, tier_name: tierName, order_ref: order.order_ref })]
      )
      await client.query('UPDATE transactions SET metadata = metadata || $1::jsonb WHERE id = $2',
        [JSON.stringify({ agent_id: agentIns.rows[0]?.id }), txId])

      await client.query(
        "UPDATE payment_orders SET status='completed', tx_signature=$1, transaction_id=$2, updated_at=NOW() WHERE id=$3",
        [sweepSig, txId, order.id]
      )
    } else {
      // deposit / top-up → credit the user's credit_balance with the captured amount
      const txRes = await client.query<{ id: number }>(
        `INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata)
         VALUES ('deposit','confirmed',$1,$2,NULL,NULL,$3::bigint,$4,6,$5::jsonb)
         RETURNING id`,
        [sweepSig, userAddress, capturedMicro.toString(), mintLabel,
         JSON.stringify({ source: 'order', order_ref: order.order_ref })]
      )
      const txId = txRes.rows[0].id

      const balanceId = await getOrCreateBalanceId(client, order.user_id)
      await applyBalanceBucketChange(
        client, balanceId, 'credit_balance', 'credit', capturedMicro, txId, { source: 'deposit', order_ref: order.order_ref }
      )

      await client.query(
        "UPDATE payment_orders SET status='completed', tx_signature=$1, transaction_id=$2, updated_at=NOW() WHERE id=$3",
        [sweepSig, txId, order.id]
      )
    }

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  // Post-commit distributions (license only), matching routes/license.ts. Non-fatal on failure.
  if (postCommit && postCommit.kind === 'license') {
    try {
      await distributeLicense(postCommit.costUsdt, postCommit.txId)
      await distributeAffiliateBonuses(postCommit.userId, postCommit.feeMicro, postCommit.txId)
    } catch (e) {
      console.error('[fulfillment] license distribution failed (order settled, retry manually)', {
        order_ref: order.order_ref, txId: postCommit.txId, error: e instanceof Error ? e.message : e,
      })
    }
  }
}

/** Mark expired any pending order past its TTL (frees the index for reuse if unfunded). */
export async function expireStaleOrders(): Promise<number> {
  const res = await query(
    "UPDATE payment_orders SET status='expired', updated_at=NOW() WHERE status='pending' AND expires_at <= NOW()"
  )
  return res.rowCount ?? 0
}
