BEGIN;

-- Recreate original agent_results schema (unchanged): no bp_used column
CREATE TABLE IF NOT EXISTS agent_results (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
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

