import 'dotenv/config'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Please configure .env')
}

const pool = new Pool({ connectionString })

async function resetBuckets() {
    console.log('🚀 Starting bucket reset script...')

    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        // Lock the row to prevent concurrent updates
        console.log('🔒 Locking bucket_balances table...')
        const res = await client.query('SELECT * FROM bucket_balances WHERE id = 1 FOR UPDATE')

        if (res.rows.length === 0) {
            throw new Error('No bucket_balances row found with id=1')
        }

        const row = res.rows[0]
        const buckets = ['admin', 'dev', 'marketer_1', 'marketer_2', 'trader', 'reserve']
        const programId = process.env.SOLAIRUS_PAY_PROGRAM_ID || 'BCTElgzhQd4yGkE962fa3f7I2f0a1e3d5c7b9a2c4e6' // Fallback or env

        let totalReset = 0

        for (const bucket of buckets) {
            const balance = parseFloat(row[bucket] || '0')

            if (balance > 0) {
                console.log(`📉 Resetting ${bucket}: ${balance} -> 0`)
                const amountMicro = Math.floor(balance * 1_000_000)
                const orderId = randomUUID()

                // 1. Create transaction record for accountability
                const txRes = await client.query(`
          INSERT INTO transactions (
            type, status, signature, initiator_wallet, recipient_wallet, 
            program_id, amount, mint_address, decimals, metadata, order_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
                    'role_withdrawal',           // type
                    'confirmed',                 // status
                    null,                        // signature (internal system op)
                    'SYSTEM_RESET',             // initiator
                    'SYSTEM_BURN',              // recipient
                    programId,                  // program_id
                    amountMicro,                // amount
                    'USDT_MINT_PLACEHOLDER',    // mint_address
                    6,                          // decimals
                    JSON.stringify({            // metadata
                        description: 'Manual system reset to 0',
                        original_balance: balance,
                        bucket: bucket,
                        timestamp: new Date().toISOString()
                    }),
                    orderId // order_id
                ])

                const txId = txRes.rows[0].id

                // 2. Log to bucket history
                await client.query(`
          INSERT INTO bucket_histories (bucket_ref, amount, bucket_balance, transaction_id, created_at)
          VALUES ($1, $2::numeric, $3::numeric, $4, NOW())
        `, [
                    bucket,       // bucket_ref
                    -balance,     // amount (negative for debit)
                    0,            // new balance
                    txId          // transaction_id
                ])

                // 3. Update the actual balance to 0
                await client.query(`UPDATE bucket_balances SET ${bucket} = 0 WHERE id = 1`)

                totalReset += balance
            } else {
                console.log(`ℹ️  Skipping ${bucket}: balance is already 0`)
            }
        }

        await client.query('COMMIT')
        console.log(`✅ Success! Total reset amount: ${totalReset}`)
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('❌ Error during reset:', error)
        process.exit(1)
    } finally {
        client.release()
        await pool.end()
    }
}

resetBuckets()
