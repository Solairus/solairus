-- Up: create agent_results with single timestamp and per-UTC-day uniqueness
BEGIN;

CREATE TABLE IF NOT EXISTS agent_results (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result_micro BIGINT NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_results_agent_id ON agent_results(agent_id);

-- One result per agent per UTC day
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_results_per_day
  ON agent_results (
    agent_id,
    (timezone('UTC', created_at)::date)
  );

COMMIT;

-- Down: drop table and index
-- (Transactional drop covered by CASCADE of index)
BEGIN;
DROP INDEX IF EXISTS uniq_agent_results_per_day;
DROP INDEX IF EXISTS idx_agent_results_agent_id;
DROP TABLE IF EXISTS agent_results;
COMMIT;

