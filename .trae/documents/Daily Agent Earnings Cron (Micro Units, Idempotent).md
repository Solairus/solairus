## Distribution
- Since every tier satisfies `daily_reward_min_bp < daily_reward_max_bp`, we’ll use:
  - `MAX_HIT_PROB = 0.10` (10%).
  - Draw `p = crypto.randomInt(0, 1000) / 1000`.
  - If `p < 0.10` → `bp = max_bp`.
  - Else → `bp = crypto.randomInt(min_bp, max_bp)` (upper bound exclusive), i.e. uniformly picks from `[min_bp, max_bp - 1]`.
- This yields ~10% max hits and a uniform spread across the remaining values.

## Data Model (Single Timestamp)
- Create `agent_results` with:
  - `id` BIGSERIAL PK
  - `agent_id` BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE
  - `result_micro` BIGINT NOT NULL
  - `claimed` BOOLEAN NOT NULL DEFAULT false
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- Idempotency: unique per UTC day
  - `CREATE UNIQUE INDEX uniq_agent_results_per_day ON agent_results (agent_id, (timezone('UTC', created_at)::date));`

## Cron Logic (Micro Units)
- For each agent:
  - Read tier `[min_bp, max_bp]`, compute `bp` per the skewed algorithm.
  - `result_micro = (BigInt(agent.amount) * BigInt(bp)) / 10000n`.
  - `INSERT INTO agent_results ...` (on conflict per-day, do nothing).
  - If insert succeeds, `UPDATE agents SET total_earned = total_earned + result_micro`.

## Implementation
- Migration `015_agent_results.sql` (with `down` dropping table and index).
- Service `runDailyAgentEarnings()` using `crypto.randomInt`.
- Script `cron-agent-earnings.ts` and NPM script `cron:agents`.
- Optional HTTP route `/api/cron/agents/daily` guarded by `CRON_SECRET`.

## Scheduling & Tests
- Railway scheduled job daily (UTC) for `yarn cron:agents`.
- Tests: Monte‑Carlo check (max ~10% across many draws), idempotency per day.

I’ll implement the migration, service, script, and schedule wiring with this distribution. Confirm to proceed.