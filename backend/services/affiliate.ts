import { pool } from '../db';
import { applyBalanceBucketChange, getOrCreateBalanceId } from './balance';
import { applyBucketChange } from './bucket';

/**
 * distributeAffiliateBonuses
 * Purpose: Credit multi-level affiliate bonuses (L1→L3) to sponsors' `bonus_balance`.
 *          Missing L2 sponsor triggers dev fallback for both L2 and L3 commissions.
 *          Missing L3 sponsor triggers dev fallback for L3 only.
 * Inputs:
 *  - activatingUserId: id of the user who activated (source user for affiliate chain)
 *  - feeUsdtMicro: activation fee in micro USDT (integer, e.g., 1 USDT = 1_000_000)
 *  - transactionId: associated transaction id from `transactions`
 * Output:
 *  - void (writes to balances, balance_history, and bucket_balances/bucket_histories)
 * Core Logic:
 *  - Read affiliate percentages from `settings` (affiliate.l1_pct, affiliate.l2_pct, affiliate.l3_pct)
 *  - Resolve sponsor chain via `users.ref_by`: L1 = ref_by(user), L2 = ref_by(L1), L3 = ref_by(L2)
 *  - Credit found sponsors using `applyBalanceBucketChange(..., 'bonus_balance', 'credit', ...)`
 *  - Accumulate missing level commissions into dev fallback and credit the global `dev` bucket
 */
export async function distributeAffiliateBonuses(
  activatingUserId: number,
  feeUsdtMicro: number,
  transactionId: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Idempotency Check: Don't process if we've already distributed affiliate bonuses for this tx
    // We check for any history record with this transaction_id and metadata->>'source' = 'affiliate'
    // This covers L1, L2, L3 allocations.
    const checkSql = `
      SELECT 1 FROM balance_history 
      WHERE transaction_id = $1 
      AND metadata->>'source' = 'affiliate'
      LIMIT 1
    `;
    const checkRes = await client.query(checkSql, [transactionId]);
    if ((checkRes.rowCount ?? 0) > 0) {
      console.warn(`[distributeAffiliateBonuses] Skipping: Transaction ${transactionId} already processed`);
      await client.query('ROLLBACK');
      return;
    }

    // Load affiliate percentages in a single query
    const settingsSql = `
      SELECT key, value, type FROM settings
      WHERE key IN ('affiliate.l1_pct','affiliate.l2_pct','affiliate.l3_pct')
    `;
    const settingsRes = await client.query(settingsSql);
    let l1Pct = 0;
    let l2Pct = 0;
    let l3Pct = 0;

    for (const row of settingsRes.rows as Array<{ key: string; value: unknown; type: string }>) {
      const parseVal = (v: unknown): number => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return Number(v);
        if (typeof v === 'object' && v !== null) {
          const inner = (v as Record<string, unknown>).value;
          return typeof inner === 'number' ? inner : Number(inner as string);
        }
        return 0;
      };
      if (row.key === 'affiliate.l1_pct') l1Pct = parseVal(row.value) || 0;
      else if (row.key === 'affiliate.l2_pct') l2Pct = parseVal(row.value) || 0;
      else if (row.key === 'affiliate.l3_pct') l3Pct = parseVal(row.value) || 0;
    }

    // Compute commissions in micro units
    const l1Micro = Math.round(feeUsdtMicro * (l1Pct || 0));
    const l2Micro = Math.round(feeUsdtMicro * (l2Pct || 0));
    const l3Micro = Math.round(feeUsdtMicro * (l3Pct || 0));

    // Resolve sponsor chain: L1 -> L2 -> L3
    const l1Res = await client.query('SELECT ref_by FROM users WHERE id = $1 LIMIT 1', [activatingUserId]);
    const l1Id = (l1Res.rows[0]?.ref_by as number | null) ?? null;
    let l2Id: number | null = null;
    let l3Id: number | null = null;
    if (l1Id) {
      const l2Res = await client.query('SELECT ref_by FROM users WHERE id = $1 LIMIT 1', [l1Id]);
      l2Id = (l2Res.rows[0]?.ref_by as number | null) ?? null;
      if (l2Id) {
        const l3Res = await client.query('SELECT ref_by FROM users WHERE id = $1 LIMIT 1', [l2Id]);
        l3Id = (l3Res.rows[0]?.ref_by as number | null) ?? null;
      }
    }

    // Accumulate dev fallback in micro units (to be converted to USDT string later)
    let devFallbackMicro = 0;

    // L1: credit sponsor if exists, else dev fallback for L1 only
    if (l1Micro > 0) {
      if (l1Id) {
        const l1BalanceId = await getOrCreateBalanceId(client, l1Id);
        await applyBalanceBucketChange(
          client,
          l1BalanceId,
          'bonus_balance',
          'credit',
          BigInt(l1Micro),
          transactionId,
          { source: 'affiliate', level: 'L1', activating_user_id: activatingUserId }
        );
      } else {
        devFallbackMicro += l1Micro;
      }
    }

    // L2/L3: if L2 missing, both L2 and L3 go to dev; else process L2 and then L3
    if (l2Micro > 0 || l3Micro > 0) {
      if (!l1Id) {
        // No L1 means L2/L3 chain can't exist; dev gets all remaining levels
        devFallbackMicro += l2Micro + l3Micro;
      } else if (!l2Id) {
        // Per rule: missing L2 -> both L2 and L3 commissions to dev
        devFallbackMicro += l2Micro + l3Micro;
      } else {
        // L2 exists: credit L2, then decide L3
        if (l2Micro > 0) {
          const l2BalanceId = await getOrCreateBalanceId(client, l2Id);
          await applyBalanceBucketChange(
            client,
            l2BalanceId,
            'bonus_balance',
            'credit',
            BigInt(l2Micro),
            transactionId,
            { source: 'affiliate', level: 'L2', activating_user_id: activatingUserId }
          );
        }
        if (l3Micro > 0) {
          if (l3Id) {
            const l3BalanceId = await getOrCreateBalanceId(client, l3Id);
            await applyBalanceBucketChange(
              client,
              l3BalanceId,
              'bonus_balance',
              'credit',
              BigInt(l3Micro),
              transactionId,
              { source: 'affiliate', level: 'L3', activating_user_id: activatingUserId }
            );
          } else {
            devFallbackMicro += l3Micro;
          }
        }
      }
    }

    // Credit dev bucket for accumulated fallback
    if (devFallbackMicro > 0) {
      const devUsdt = (devFallbackMicro / 1_000_000).toFixed(6);
      await applyBucketChange(client, 'dev', 'credit', devUsdt, transactionId);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.warn('[affiliate] distribution failed:', e);
    throw e;
  } finally {
    client.release();
  }
}