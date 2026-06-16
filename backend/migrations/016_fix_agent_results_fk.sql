BEGIN;

-- Ensure correct foreign key to agents(id)
ALTER TABLE IF EXISTS agent_results
  DROP CONSTRAINT IF EXISTS agent_results_agent_id_fkey;

ALTER TABLE IF EXISTS agent_results
  ADD CONSTRAINT agent_results_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

COMMIT;

