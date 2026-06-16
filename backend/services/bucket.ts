import type { PoolClient } from 'pg';

/**
 * getBucketRowId
 * Purpose: Resolve the singleton row id in bucket_balances, creating one if empty.
 * Inputs:
 *  - client: pg PoolClient within an active transaction
 * Output:
 *  - id of the bucket_balances singleton row
 */
export async function getBucketRowId(client: PoolClient): Promise<number> {
  const sel = await client.query('SELECT id FROM bucket_balances ORDER BY id ASC LIMIT 1 FOR UPDATE');
  if (sel.rowCount === 1) return Number(sel.rows[0].id);
  const ins = await client.query(
    'INSERT INTO bucket_balances (admin, dev, marketer_1, marketer_2, trader, reserve) VALUES (0,0,0,0,0,0) RETURNING id'
  );
  return Number(ins.rows[0].id);
}

/**
 * applyBucketIncrement
 * Purpose: Explicitly update a global bucket in `bucket_balances`, then write a snapshot into `bucket_histories`.
 * Inputs:
 *  - client: pg PoolClient (transactional)
 *  - bucketRef: one of the allowed global buckets ('admin','dev','marketer_1','marketer_2','trader','reserve')
 *  - amountUsdt: decimal string with 6 fractional digits (NUMERIC(20,6))
 *  - transactionId: associated transaction id (required)
 * Output:
 *  - Returns the post-change bucket balance as a decimal string
 * Core Logic:
 *  - Validate bucketRef against allowlist
 *  - UPDATE bucket_balances SET <bucketRef> = <bucketRef> + amount RETURNING <bucketRef>
 *  - INSERT INTO bucket_histories (bucket_ref, amount, bucket_balance, transaction_id)
 */
export type BucketRef = 'admin' | 'dev' | 'marketer_1' | 'marketer_2' | 'trader' | 'reserve';

export async function applyBucketChange(
  client: PoolClient,
  bucketRef: BucketRef,
  action: 'credit' | 'debit',
  amountUsdt: string,
  transactionId: number
): Promise<string> {
  const allowed = new Set(['admin', 'dev', 'marketer_1', 'marketer_2', 'trader', 'reserve']);
  if (!allowed.has(bucketRef)) {
    throw new Error(`Invalid bucketRef: ${bucketRef}`);
  }

  // Basic validation for NUMERIC(20,6) formatted strings
  if (!/^\d+(?:\.\d{1,6})?$/.test(amountUsdt) && !/^-\d+(?:\.\d{1,6})?$/.test(amountUsdt)) {
    throw new Error(`amountUsdt must be a decimal string with up to 6 fractional digits`);
  }

  const rowId = await getBucketRowId(client);

  const updateSql = action === 'credit'
    ? `UPDATE bucket_balances SET ${bucketRef} = ${bucketRef} + $1 WHERE id = $2 RETURNING ${bucketRef} AS post_balance`
    : `UPDATE bucket_balances SET ${bucketRef} = ${bucketRef} - $1 WHERE id = $2 AND ${bucketRef} >= $1 RETURNING ${bucketRef} AS post_balance`;
  const updateRes = await client.query(updateSql, [amountUsdt, rowId]);
  if (updateRes.rowCount !== 1) {
    throw new Error(action === 'debit'
      ? `Insufficient ${bucketRef} to debit ${amountUsdt}`
      : `Failed to update bucket_balances for ${bucketRef}`);
  }
  const postBalance = updateRes.rows[0].post_balance as string;

  const insertSql = `
    INSERT INTO bucket_histories (bucket_ref, amount, bucket_balance, transaction_id)
    VALUES ($1, $2, $3, $4)
  `;
  await client.query(insertSql, [bucketRef, amountUsdt, postBalance, transactionId]);

  return postBalance;
}