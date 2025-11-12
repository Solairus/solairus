// Diagnostic script: Inspect marketer bucket history and current balances
// Purpose: Help verify whether marketer_1 and marketer_2 buckets have ever been updated
// Inputs: DATABASE_URL from .env
// Outputs: Prints recent bucket_histories entries and bucket_balances schema/row

import 'dotenv/config';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Please configure .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    const hist = await client.query(
      "SELECT bucket_ref, amount, bucket_balance, transaction_id, created_at FROM bucket_histories WHERE bucket_ref IN ('marketer_1','marketer_2') ORDER BY id DESC LIMIT 50"
    );
    console.log('bucket_histories marketer entries count:', hist.rowCount);
    console.log(JSON.stringify(hist.rows, null, 2));

    const bal = await client.query('SELECT * FROM bucket_balances ORDER BY id ASC LIMIT 1');
    console.log('bucket_balances row:', JSON.stringify(bal.rows[0], null, 2));

    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='bucket_balances' ORDER BY ordinal_position"
    );
    console.log('bucket_balances columns:', cols.rows.map((r) => r.column_name));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});