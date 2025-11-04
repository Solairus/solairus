-- Migration: Add amount, tier_id, total_earned to agents
-- Purpose: Extend agents with tracking fields for balance and tiering
-- Notes:
--  - Follows existing schema style (snake_case, BIGINT for amounts)
--  - Uses safe IF NOT EXISTS guards for repeatable runs

-- Add numeric amount held by agent (e.g., staked/locked amount)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS amount BIGINT NOT NULL DEFAULT 0;

-- Add tier reference (nullable; foreign key can be added later if tiers table exists)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS tier_id INTEGER;

-- Add cumulative earnings for this agent
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS total_earned BIGINT NOT NULL DEFAULT 0;