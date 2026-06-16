BEGIN;

DROP TABLE IF EXISTS agent_results;

UPDATE agents SET total_earned = 0;

COMMIT;

