
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function debugAgentData() {
    const client = await pool.connect();
    try {
        console.log('--- Debugging Agent Data ---');

        // Check Agent ID 6 (from user's example)
        const agentId = 6;
        console.log(`\nChecking Agent ID: ${agentId}`);

        // 1. Get Agent Row
        const agentRes = await client.query('SELECT * FROM agents WHERE id = $1', [agentId]);
        if (agentRes.rows.length === 0) {
            console.log('Agent not found!');
            return;
        }
        const agent = agentRes.rows[0];
        console.log('Agent Row:', {
            id: agent.id,
            user_id: agent.user_id,
            status: agent.status,
            amount: agent.amount,
            total_earned: agent.total_earned,
            claimed_at: agent.claimed_at
        });

        // 2. Get Agent Results
        const resultsRes = await client.query('SELECT * FROM agent_results WHERE agent_id = $1', [agentId]);
        console.log(`\nFound ${resultsRes.rows.length} agent_results rows.`);

        if (resultsRes.rows.length > 0) {
            console.log('First 5 results:', resultsRes.rows.slice(0, 5));

            const sumRes = await client.query(`
        SELECT 
          COALESCE(SUM(result_micro), 0) as total_sum,
          COALESCE(SUM(CASE WHEN claimed = TRUE THEN result_micro ELSE 0 END), 0) as claimed_sum,
          COALESCE(SUM(CASE WHEN claimed = FALSE THEN result_micro ELSE 0 END), 0) as unclaimed_sum
        FROM agent_results WHERE agent_id = $1
      `, [agentId]);
            console.log('\nAggregates from DB:', sumRes.rows[0]);
        }

        // 3. Global Check
        const globalRes = await client.query('SELECT COUNT(*) FROM agent_results');
        console.log(`\nTotal rows in agent_results table: ${globalRes.rows[0].count}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

debugAgentData();
