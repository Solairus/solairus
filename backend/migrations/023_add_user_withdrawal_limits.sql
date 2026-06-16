-- Add withdrawal management columns to users table
ALTER TABLE users 
ADD COLUMN agent_pnl_withdrawal_limit BIGINT DEFAULT NULL, -- NULL means no limit
ADD COLUMN agent_pnl_withdrawal_enabled BOOLEAN DEFAULT TRUE;

-- Add comment for clarity
COMMENT ON COLUMN users.agent_pnl_withdrawal_limit IS 'Maximum total micro-USDT allowed to be withdrawn from Agent PnL. NULL = unlimited.';
COMMENT ON COLUMN users.agent_pnl_withdrawal_enabled IS 'Master switch to enable/disable Agent PnL withdrawals for this user.';
