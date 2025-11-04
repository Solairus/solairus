-- Migration: Create agent_tiers and seed default tiers
-- Purpose: Store tier definitions with min/max amount ranges and reward parameters.
-- Notes:
--  - Amounts are stored in micro-USDT (decimals = 6)
--  - Reward rates/caps are stored in basis points (1% = 100 bp)

CREATE TABLE IF NOT EXISTS agent_tiers (
  id SERIAL PRIMARY KEY,
  tier_name TEXT NOT NULL UNIQUE,
  min_amount BIGINT NOT NULL,
  max_amount BIGINT NOT NULL,
  daily_reward_min_bp SMALLINT NOT NULL,
  daily_reward_max_bp SMALLINT NOT NULL,
  reward_cap_bp INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (min_amount >= 0 AND max_amount > min_amount),
  CHECK (daily_reward_min_bp > 0 AND daily_reward_max_bp >= daily_reward_min_bp),
  CHECK (reward_cap_bp >= 10000) -- at least 100%
);

-- Trigger to keep updated_at current (reuses touch_updated_at if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'touch_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_agent_tiers_updated_at ON agent_tiers;
    CREATE TRIGGER trg_agent_tiers_updated_at
    BEFORE UPDATE ON agent_tiers
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- Seed default tiers (idempotent upserts)
-- Tier 1 [NOVA]: Min 50, Max 999.99 | daily 1.00% - 1.95% | Cap 175%
INSERT INTO agent_tiers (tier_name, min_amount, max_amount, daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp)
VALUES ('NOVA', 50000000, 999990000, 100, 195, 17500)
ON CONFLICT (tier_name) DO UPDATE SET
  min_amount = EXCLUDED.min_amount,
  max_amount = EXCLUDED.max_amount,
  daily_reward_min_bp = EXCLUDED.daily_reward_min_bp,
  daily_reward_max_bp = EXCLUDED.daily_reward_max_bp,
  reward_cap_bp = EXCLUDED.reward_cap_bp;

-- Tier 2 [VEGA]: Min 1000, Max 4999.99 | daily 1.85% - 2.45% | Cap 200%
INSERT INTO agent_tiers (tier_name, min_amount, max_amount, daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp)
VALUES ('VEGA', 1000000000, 4999990000, 185, 245, 20000)
ON CONFLICT (tier_name) DO UPDATE SET
  min_amount = EXCLUDED.min_amount,
  max_amount = EXCLUDED.max_amount,
  daily_reward_min_bp = EXCLUDED.daily_reward_min_bp,
  daily_reward_max_bp = EXCLUDED.daily_reward_max_bp,
  reward_cap_bp = EXCLUDED.reward_cap_bp;

-- Tier 3 [ORION]: Min 5000, Max 9999.99 | daily 1.85% - 3.20% | Cap 220%
INSERT INTO agent_tiers (tier_name, min_amount, max_amount, daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp)
VALUES ('ORION', 5000000000, 9999990000, 185, 320, 22000)
ON CONFLICT (tier_name) DO UPDATE SET
  min_amount = EXCLUDED.min_amount,
  max_amount = EXCLUDED.max_amount,
  daily_reward_min_bp = EXCLUDED.daily_reward_min_bp,
  daily_reward_max_bp = EXCLUDED.daily_reward_max_bp,
  reward_cap_bp = EXCLUDED.reward_cap_bp;

-- Tier 4 [PRIME]: Min 10000, Max 1000000 | daily 1.75% - 5.00% | Cap 250%
INSERT INTO agent_tiers (tier_name, min_amount, max_amount, daily_reward_min_bp, daily_reward_max_bp, reward_cap_bp)
VALUES ('PRIME', 10000000000, 1000000000000, 175, 500, 25000)
ON CONFLICT (tier_name) DO UPDATE SET
  min_amount = EXCLUDED.min_amount,
  max_amount = EXCLUDED.max_amount,
  daily_reward_min_bp = EXCLUDED.daily_reward_min_bp,
  daily_reward_max_bp = EXCLUDED.daily_reward_max_bp,
  reward_cap_bp = EXCLUDED.reward_cap_bp;