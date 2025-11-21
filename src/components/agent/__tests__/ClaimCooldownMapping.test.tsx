import { describe, it, expect } from 'vitest';
import { mapBackendAgentToAgentData } from '@/services/agent/agent-service';

const baseRow = {
  id: 1,
  amount: 100,
  created_at: new Date().toISOString(),
  activated_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  total_earned: 0,
  reward_cap_bp: 20000,
  yield_cap_progress_pct: 0,
  yield_cap_reached: false,
  metadata: { tier_name: 'NOVA' }
} as any;

describe('Claim cooldown mapping', () => {
  it('uses claimed_at to set lastRoiWithdrawal and nextWithdrawalAt', async () => {
    const claimedAt = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const row = { ...baseRow, claimed_at: claimedAt, remaining_ms: 60 * 60 * 1000, can_claim: false };
    const agent = await mapBackendAgentToAgentData(row, null);
    expect(agent.lastRoiWithdrawal?.toISOString()).toBe(new Date(claimedAt).toISOString());
    expect(agent.canWithdraw).toBe(false);
    expect(agent.nextWithdrawalAt).not.toBeNull();
  });

  it('allows claim when remaining_ms is 0 and not at cap', async () => {
    const row = { ...baseRow, claimed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), remaining_ms: 0, can_claim: true };
    const agent = await mapBackendAgentToAgentData(row, null);
    expect(agent.canWithdraw).toBe(true);
  });
});