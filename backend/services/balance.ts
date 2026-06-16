import type { PoolClient } from 'pg';

/**
 * applyBalanceBucketIncrement
 * Purpose: Explicitly update a user's bucket in `balances`, optionally increment `total_earnings`,
 *          then write a snapshot row to `balance_history` with the post-change balance.
 * Inputs:
 *  - client: pg PoolClient within an active transaction
 *  - balanceId: target `balances.id`
 *  - bucketField: which bucket column to update ('bonus_balance' | 'reward_balance' | 'credit_balance')
 *  - amountMicro: amount in micro units (BIGINT) to add (can be negative for adjustments)
 *  - transactionId: associated transaction id (required; ensures 1 update = 1 history)
 *  - metadata: JSON metadata (record-only; not interpreted by DB)
 * Output:
 *  - Returns the post-change bucket balance (micro units) as a bigint-like string (from PG numeric/bigint)
 * Core Logic:
 *  - Validate bucketField against an allowlist (prevents SQL injection via column names)
 *  - UPDATE balances SET bucketField = bucketField + amount,
 *                       total_earnings += amount (for non-credit buckets, if amount > 0)
 *    RETURNING bucketField as postBalance
 *  - INSERT into balance_history (balance_id, amount, balance, transaction_id, metadata) in the canonical column order
 */
export async function applyBalanceBucketChange(
  client: PoolClient,
  balanceId: number,
  bucketField: 'bonus_balance' | 'reward_balance' | 'credit_balance',
  action: 'credit' | 'debit',
  amountMicro: bigint,
  transactionId: number,
  metadata: Record<string, unknown>
): Promise<bigint> {
  const allowed = new Set(['bonus_balance', 'reward_balance', 'credit_balance']);
  if (!allowed.has(bucketField)) {
    throw new Error(`Invalid bucketField: ${bucketField}`);
  }

  // Build dynamic SQL safely by constraining the column name
  const amountAbs = amountMicro < 0n ? -amountMicro : amountMicro;
  const incTotalEarnings = action === 'credit' && bucketField !== 'credit_balance';

  // Apply credit or debit while preventing negative balances
  const updateSql = action === 'credit'
    ? `UPDATE balances
         SET ${bucketField} = ${bucketField} + $1,
             ${incTotalEarnings ? 'total_earnings = total_earnings + $1,' : ''}
             updated_at = NOW()
       WHERE id = $2
       RETURNING ${bucketField} AS post_balance`
    : `UPDATE balances
         SET ${bucketField} = ${bucketField} - $1,
             updated_at = NOW()
       WHERE id = $2 AND ${bucketField} >= $1
       RETURNING ${bucketField} AS post_balance`;

  const updateRes = await client.query(updateSql, [amountAbs.toString(), balanceId]);
  if (updateRes.rowCount !== 1) {
    throw new Error(action === 'debit'
      ? `Insufficient ${bucketField} to debit ${amountAbs} for balance_id=${balanceId}`
      : `Balance row not found for id=${balanceId}`);
  }
  const postBalanceStr = updateRes.rows[0].post_balance as string;
  const postBalance = BigInt(postBalanceStr);

  const insertSql = `
    INSERT INTO balance_history (balance_id, amount, balance, transaction_id, metadata)
    VALUES ($1, $2, $3, $4, $5)
  `;

  await client.query(insertSql, [
    balanceId,
    amountAbs.toString(),
    postBalance.toString(),
    transactionId,
    JSON.stringify({
      ...(metadata ?? {}),
      action,
      bucket: bucketField === 'bonus_balance' ? 'bonus'
            : bucketField === 'reward_balance' ? 'reward'
            : 'credit'
    })
  ]);

  return postBalance;
}

/**
 * getOrCreateBalanceId
 * Purpose: Resolve `balances.id` for a given `user_id`, creating a new row if missing.
 * Inputs:
 *  - client: pg PoolClient within an active transaction
 *  - userId: target user id
 * Output:
 *  - balances.id (number)
 */
export async function getOrCreateBalanceId(client: PoolClient, userId: number): Promise<number> {
  const selectRes = await client.query('SELECT id FROM balances WHERE user_id = $1 FOR UPDATE', [userId]);
  if (selectRes.rowCount === 1) {
    return Number(selectRes.rows[0].id);
  }

  const insertRes = await client.query(
    'INSERT INTO balances (user_id, bonus_balance, reward_balance, credit_balance, total_earnings) VALUES ($1, 0, 0, 0, 0) RETURNING id',
    [userId]
  );
  return Number(insertRes.rows[0].id);
}