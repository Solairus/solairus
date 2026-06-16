
import { distributeLicense } from '../services/buckets';
import { distributeAffiliateBonuses } from '../services/affiliate';
import { pool } from '../db';

async function runVerification() {
    const client = await pool.connect();
    try {
        console.log('--- Starting Verification (Real Data) ---');

        const txId = 135;

        // 1. Fetch Real Transaction Amount
        console.log(`\n[1] Fetching amount for transaction ${txId}...`);
        const txRes = await client.query('SELECT amount, decimals FROM transactions WHERE id = $1', [txId]);

        if (txRes.rowCount === 0) {
            throw new Error(`Transaction ${txId} not found in database!`);
        }

        const row = txRes.rows[0];
        const amountMicro = BigInt(row.amount);
        const decimals = row.decimals || 6;
        const amountUsdt = Number(amountMicro) / Math.pow(10, decimals);

        console.log(`Found Transaction ${txId}: Amount (Micro) = ${amountMicro}, Decimals = ${decimals}, Amount (USDT) = ${amountUsdt}`);

        // 2. Reset buckets to 0 AND clear history for test tx (to allow clean run)
        console.log('\n[2] Resetting buckets to 0 and clearing history...');
        await client.query('UPDATE bucket_balances SET admin=0, dev=0, marketer_1=0, marketer_2=0, reserve=0, trader=0');
        await client.query('DELETE FROM bucket_histories WHERE transaction_id = $1', [txId]);
        await client.query('DELETE FROM balance_history WHERE transaction_id = $1', [txId]);
        console.log('Buckets reset and history cleared.');

        // Setup dummy user for affiliate if needed, but we should probably use real user from tx if possible?
        // For distributeAffiliateBonuses, we need a userId. 
        // Let's assume the user associated with tx 135 exists or we pick one.
        // Actually distributeAffiliateBonuses takes (activatingUserId, ...).
        // Let's fetch the initiator wallet and find the user ID.
        const initiator = (await client.query('SELECT initiator_wallet FROM transactions WHERE id=$1', [txId])).rows[0].initiator_wallet;
        let userId = 0;
        const userRes = await client.query('SELECT id FROM users WHERE user_address = $1', [initiator]);
        if ((userRes.rowCount ?? 0) > 0) {
            userId = userRes.rows[0].id;
            console.log(`Resolved User ID ${userId} from wallet ${initiator}`);
        } else {
            console.log(`User for wallet ${initiator} not found, creating dummy for test...`);
            userId = 99999;
            const sponsorId = 99998;
            await client.query(`INSERT INTO users (id, user_address) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [userId, initiator]);
            await client.query(`INSERT INTO users (id, user_address, ref_by) VALUES ($1, 'sponsor_99998', NULL) ON CONFLICT (id) DO NOTHING`, [sponsorId]);
            await client.query(`UPDATE users SET ref_by = $1 WHERE id = $2`, [sponsorId, userId]);
        }

        // 3. First Distribution Call
        console.log(`\n[3] Calling distributeLicense (First Time) with amount=${amountUsdt}...`);
        await distributeLicense(amountUsdt, txId);

        // Check balances
        const res1 = await client.query('SELECT * FROM bucket_balances');
        console.log('Balances after 1st call:', res1.rows[0]);
        const admin1 = Number(res1.rows[0].admin);

        if (admin1 > 0) {
            console.log('✅ Success: Buckets increased.');
        } else {
            console.warn('⚠️ Warning: Buckets are 0 (Amount might be too small or % is 0).');
        }

        // 4. Second Distribution Call (Idempotency Test)
        console.log(`\n[4] Calling distributeLicense (Second Time)...`);
        await distributeLicense(amountUsdt, txId);

        // Check balances again
        const res2 = await client.query('SELECT * FROM bucket_balances');
        console.log('Balances after 2nd call:', res2.rows[0]);
        const admin2 = Number(res2.rows[0].admin);

        if (admin1 === admin2) {
            console.log('✅ Idempotency Verified: Balances did not change.');
        } else {
            console.error('❌ Error: Balances changed! Double distribution detected.');
        }

        // 5. Affiliate Idempotency Test
        console.log(`\n[5] Testing Affiliate Idempotency...`);
        console.log('Calling distributeAffiliateBonuses (First Time)...');
        // amountMicro needs to be number for logic, but BigInt for safety. 
        // The service takes `number` for feeUsdtMicro currently in `affiliate.ts`:
        // export async function distributeAffiliateBonuses(..., feeUsdtMicro: number, ...)
        // We should cast carefully.
        const microNum = Number(amountMicro);

        await distributeAffiliateBonuses(userId, microNum, txId);

        const hist1 = await client.query("SELECT COUNT(*) FROM balance_history WHERE transaction_id = $1 AND metadata->>'source'='affiliate'", [txId]);
        console.log(`History records after 1st call: ${hist1.rows[0].count}`);

        console.log('Calling distributeAffiliateBonuses (Second Time)...');
        await distributeAffiliateBonuses(userId, microNum, txId);

        const hist2 = await client.query("SELECT COUNT(*) FROM balance_history WHERE transaction_id = $1 AND metadata->>'source'='affiliate'", [txId]);
        console.log(`History records after 2nd call: ${hist2.rows[0].count}`);

        if (hist1.rows[0].count === hist2.rows[0].count) {
            console.log('✅ Affiliate Idempotency Verified: No new history records created.');
        } else {
            console.error('❌ Error: Affiliate history count increased!');
        }

    } catch (err) {
        console.error('Verification Failed:', err);
    } finally {
        client.release();
        process.exit();
    }
}

runVerification();
