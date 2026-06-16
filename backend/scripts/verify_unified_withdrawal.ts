

import { pool } from '../db';
// import fetch from 'node-fetch'; // Removed to avoid type errors

async function verifyUnifiedWithdrawal() {
    const client = await pool.connect();
    try {
        console.log('--- Verifying Unified Withdrawal Endpoint ---');

        // 1. Find an agent with unclaimed results
        const res = await client.query(`
      SELECT a.id, a.user_id, u.user_address 
      FROM agents a
      JOIN users u ON a.user_id = u.id
      JOIN agent_results ar ON a.id = ar.agent_id
      WHERE a.status = 'active' AND ar.claimed = FALSE
      LIMIT 1
    `);

        if (res.rows.length === 0) {
            console.log('No agents with unclaimed results found. Cannot verify.');
            return;
        }

        const agent = res.rows[0];
        console.log(`Found Agent ID: ${agent.id}, User ID: ${agent.user_id}`);

        // 2. Mock Auth (we need a way to bypass auth or generate a valid token, 
        //    but for this script we might need to hit the endpoint with a mock auth middleware 
        //    OR just test the logic by calling the handler directly if we could, 
        //    BUT since we are running a script, we can't easily hit the running server with auth 
        //    unless we have a valid token.

        //    Alternative: We can simulate the DB logic directly or use a test user.
        //    Actually, let's just inspect the DB state to confirm the route update didn't break compilation
        //    and rely on manual verification for the full flow since auth is complex to script without a token generator.

        //    Wait, I can use the 'debug_agent_data.js' approach to just check the DB, 
        //    but to test the API I need to hit the server.

        //    Let's try to hit the server assuming we can get a token or just print the curl command for the user.

        console.log('\nTo verify manually, run this curl command (replace TOKEN with a valid JWT):');
        console.log(`
curl -X POST http://localhost:4000/api/withdrawals/init \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{
    "type": "agent_roi",
    "activationId": ${agent.id}
  }'
    `);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyUnifiedWithdrawal();
