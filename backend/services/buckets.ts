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
/**
 * Compute license activation distribution (90% total)
 * Fetches percentages from settings table
 */
async function licenseDistribution(amountUsdt: number): Promise<DistributionMap> {
  const settingsSql = `
    SELECT key, value FROM settings 
    WHERE key IN ('distribution.license.admin', 'distribution.license.dev', 'distribution.license.marketer_1', 'distribution.license.marketer_2', 'distribution.license.reserve')
  `
  const { rows } = await pool.query<{ key: string; value: unknown }>(settingsSql)

  // Default values if settings missing (fallback to old hardcoded for safety only if DB empty)
  const defaults: AppDistribution = {
    admin: 0.30,
    dev: 0.30,
    marketer_1: 0.05,
    marketer_2: 0.05,
    reserve: 0.20,
  }

  const result: DistributionMap = {}

  // Helper to parse setting value
  const parsePct = (val: unknown): number => {
    if (typeof val === 'number') return val
    if (typeof val === 'string') return Number(val)
    if (typeof val === 'object' && val !== null) {
      const v = (val as { value?: unknown }).value
      return Number(v)
    }
    return 0
  }

  // Map settings keys to simple keys
  const keyMap: Record<string, keyof AppDistribution> = {
    'distribution.license.admin': 'admin',
    'distribution.license.dev': 'dev',
    'distribution.license.marketer_1': 'marketer_1',
    'distribution.license.marketer_2': 'marketer_2',
    'distribution.license.reserve': 'reserve'
  }

  // Populate from DB
  for (const row of rows) {
    const field = keyMap[row.key]
    if (field) {
      result[field] = round6(amountUsdt * parsePct(row.value))
    }
  }

  // Fill gaps with defaults * amount
  for (const [k, v] of Object.entries(defaults)) {
    if (result[k] === undefined) {
      result[k] = round6(amountUsdt * v)
    }
  }

  return result
}

type AppDistribution = {
  admin: number
  dev: number
  marketer_1: number
  marketer_2: number
  reserve: number
}

/**
 * Compute deposit distribution (100% total). Unlike license/agent, this does not
 * reduce the depositor's credit_balance — it mirrors the deposit into the internal
 * role buckets in parallel. `reserve` takes the remainder so rounding never leaks.
 */
async function depositDistribution(amountUsdt: number): Promise<DistributionMap> {
  const settingsSql = `
    SELECT key, value FROM settings
    WHERE key IN ('distribution.deposit.admin', 'distribution.deposit.dev', 'distribution.deposit.marketer_1', 'distribution.deposit.marketer_2', 'distribution.deposit.trader')
  `
  const { rows } = await pool.query<{ key: string; value: unknown }>(settingsSql)

  const defaults: Record<'admin' | 'dev' | 'marketer_1' | 'marketer_2' | 'trader', number> = {
    admin: 0.10,
    dev: 0.10,
    marketer_1: 0.05,
    marketer_2: 0.05,
    trader: 0.15,
  }

  const parsePct = (val: unknown): number => {
    if (typeof val === 'number') return val
    if (typeof val === 'string') return Number(val)
    if (typeof val === 'object' && val !== null) {
      const v = (val as { value?: unknown }).value
      return Number(v)
    }
    return 0
  }

  const keyMap: Record<string, keyof typeof defaults> = {
    'distribution.deposit.admin': 'admin',
    'distribution.deposit.dev': 'dev',
    'distribution.deposit.marketer_1': 'marketer_1',
    'distribution.deposit.marketer_2': 'marketer_2',
    'distribution.deposit.trader': 'trader',
  }

  const pct: Record<string, number> = {}
  for (const row of rows) {
    const field = keyMap[row.key]
    if (field) pct[field] = parsePct(row.value)
  }
  for (const [k, v] of Object.entries(defaults)) {
    if (pct[k] === undefined) pct[k] = v
  }

  const result: DistributionMap = {}
  let allocated = 0
  for (const k of ['admin', 'dev', 'marketer_1', 'marketer_2', 'trader']) {
    const amt = round6(amountUsdt * pct[k])
    result[k] = amt
    allocated += amt
  }
  result.reserve = round6(amountUsdt - allocated)

  return result
}

/**
 * Compute agent activation distribution. Buckets take 90% of the amount (the other
 * 10% is affiliate L1/L2/L3 commission, distributed separately). Same fixed splits as
 * deposit; `reserve` takes the remainder of the 90% pool (~45%) so rounding never leaks.
 */
function agentDistribution(amountUsdt: number): DistributionMap {
  const pct = {
    admin: 0.10,
    dev: 0.10,
    marketer_1: 0.05,
    marketer_2: 0.05,
    trader: 0.15,
  }
  const bucketPool = round6(amountUsdt * 0.90) // 90%; remaining 10% → affiliate
  const result: DistributionMap = {}
  let allocated = 0
  for (const [k, v] of Object.entries(pct)) {
    const amt = round6(amountUsdt * v)
    result[k] = amt
    allocated += amt
  }
  result.reserve = round6(bucketPool - allocated)
  return result
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
 * Idempotent: Checks if transactionId has already been processed for buckets
 */
export async function distributeLicense(amountUsdt: number, transactionId: number) {
  // 1. Idempotency Check
  const checkRes = await pool.query('SELECT 1 FROM bucket_histories WHERE transaction_id = $1 LIMIT 1', [transactionId])
  if ((checkRes.rowCount ?? 0) > 0) {
    console.warn(`[distributeLicense] Skipping: Transaction ${transactionId} already processed in bucket_histories`)
    return
  }

  // 2. Compute Distribution
  const dist = await licenseDistribution(amountUsdt)

  // 3. Apply
  await applyDistribution(dist, transactionId)
}

/**
 * Distribute agent activation amount into buckets (USDT).
 * Idempotent: skips if transactionId has already been processed for buckets.
 */
export async function distributeAgent(amountUsdt: number, transactionId: number) {
  const checkRes = await pool.query('SELECT 1 FROM bucket_histories WHERE transaction_id = $1 LIMIT 1', [transactionId])
  if ((checkRes.rowCount ?? 0) > 0) {
    console.warn(`[distributeAgent] Skipping: Transaction ${transactionId} already processed in bucket_histories`)
    return
  }

  const dist = agentDistribution(amountUsdt)
  await applyDistribution(dist, transactionId)
}

/**
 * Distribute a deposit amount into buckets (USDT). Additive only — the depositor's
 * credit_balance already holds 100% of the deposit; this does not touch it.
 * Idempotent: skips if transactionId has already been processed for buckets.
 */
export async function distributeDeposit(amountUsdt: number, transactionId: number) {
  const checkRes = await pool.query('SELECT 1 FROM bucket_histories WHERE transaction_id = $1 LIMIT 1', [transactionId])
  if ((checkRes.rowCount ?? 0) > 0) {
    console.warn(`[distributeDeposit] Skipping: Transaction ${transactionId} already processed in bucket_histories`)
    return
  }

  const dist = await depositDistribution(amountUsdt)
  await applyDistribution(dist, transactionId)
}