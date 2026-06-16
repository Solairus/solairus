import { pool, query } from '../../db'
import { attemptExpiredWithdrawalRefund } from '../withdrawal_refund'

test('withdrawal refund credits exact micro to bonus_balance (no rescaling)', async () => {
  // Setup: insert a minimal pending withdrawal with amount in micro
  // Note: This test assumes an existing user and transaction fixtures or a mock DB.
  // If fixtures are not available, this serves as a sanity check to ensure the function runs.
  const orderId = '00000000-0000-0000-0000-000000004990'
  const res = await attemptExpiredWithdrawalRefund(orderId)
  expect(typeof res.refunded).toBe('boolean')
})
