-- Add claimed_at to agents and initialize for active agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

UPDATE agents
SET claimed_at = COALESCE(activated_at, created_at)
WHERE status = 'active' AND claimed_at IS NULL;

-- Optional index to aid queries that compute cooldowns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_agents_claimed_at' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_agents_claimed_at ON agents (claimed_at);
  END IF;
END$$;