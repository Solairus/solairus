/**
 * Buckets service
 * Purpose: Distribute amounts into global role buckets and record bucket histories
 * Inputs: amount in USDT (number, 6-decimal precision); optional transactionId
 * Outputs: Updates bucket_balances and inserts rows into bucket_histories within a DB transaction
 */
import { pool } from '../db'
import { applyBucketChange } from './bucket'

type DistributionMap = Record<string, number>

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

/**
 * Compute license activation distribution (90% total)
 */
function licenseDistribution(amountUsdt: number): DistributionMap {
  const pct = {
    admin: 0.30,
    dev: 0.30,
    marketer_1: 0.05,
    marketer_2: 0.05,
    reserve: 0.20,
  }
  return Object.fromEntries(
    Object.entries(pct).map(([k, v]) => [k, round6(amountUsdt * v)])
  )
}

/**
 * Compute agent activation distribution (90% total)
 */
function agentDistribution(amountUsdt: number): DistributionMap {
  const pct = {
    admin: 0.10,
    dev: 0.10,
    marketer_1: 0.05,
    marketer_2: 0.05,
    trader: 0.15,
    reserve: 0.45,
  }
  return Object.fromEntries(
    Object.entries(pct).map(([k, v]) => [k, round6(amountUsdt * v)])
  )
}

/**
 * Apply a distribution using the explicit bucket helper
 * Ensures atomicity via a single transaction; records histories per bucket
 */
async function applyDistribution(dist: DistributionMap, transactionId: number) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Apply credits per bucket via helper; skip zero amounts
    for (const [bucket, amtNum] of Object.entries(dist)) {
      const amount = Number(amtNum || 0)
      if (!amount) continue
      await applyBucketChange(
        client,
        bucket as 'admin' | 'dev' | 'marketer_1' | 'marketer_2' | 'trader' | 'reserve',
        'credit',
        amount.toFixed(6),
        transactionId
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Distribute license activation amount into buckets (USDT)
 */
export async function distributeLicense(amountUsdt: number, transactionId: number) {
  const dist = licenseDistribution(amountUsdt)
  await applyDistribution(dist, transactionId)
}

/**
 * Distribute agent activation amount into buckets (USDT)
 */
export async function distributeAgent(amountUsdt: number, transactionId: number) {
  const dist = agentDistribution(amountUsdt)
  await applyDistribution(dist, transactionId)
}