-- 008_settings.sql
-- Purpose: Store configurable admin-managed settings
-- Structure: Typed key-value storage to avoid schema changes for new settings

BEGIN;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('string','number','boolean','object')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at fresh on update
CREATE TRIGGER trg_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;