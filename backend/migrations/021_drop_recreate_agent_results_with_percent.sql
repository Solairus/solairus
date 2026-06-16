BEGIN;

DROP TABLE IF EXISTS agent_results;

UPDATE agents SET total_earned = 0;

CREATE TABLE agent_results (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  result_micro BIGINT NOT NULL,
  percent_bp INTEGER NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_results_agent_id ON agent_results(agent_id);

CREATE UNIQUE INDEX uniq_agent_results_per_day
  ON agent_results (
    agent_id,
    (timezone('UTC', created_at)::date)
  );

COMMIT;

