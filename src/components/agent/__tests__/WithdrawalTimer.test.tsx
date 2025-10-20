import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WithdrawalTimer, MultiAgentTimer } from '../WithdrawalTimer';
import { AgentData } from '@/services/agent/agent-service';
import { AgentTier } from '@/lib/solairus-main';
import { PublicKey } from '@solana/web3.js';

// Mock agent data for testing
const createMockAgent = (overrides: Partial<AgentData> = {}): AgentData => ({
  activationId: 1,
  tier: AgentTier.NOVA,
  tierConfig: {
    name: 'NOVA',
    emoji: '🪶',
    description: 'Entry-level agent',
    dailyRange: '1.00% - 1.75%',
    yieldCapPct: 175
  },
  activationAmount: 100,
  activatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago (ready)
  lastRoiWithdrawal: null,
  totalRoiWithdrawn: 0,
  yieldCapReached: false,
  yieldCapProgress: 0,
  canWithdraw: true,
  nextWithdrawalAt: null,
  withdrawalStatus: {
    canWithdraw: true
  },
  pda: new PublicKey('11111111111111111111111111111111'),
  accountData: {} as any,
  ...overrides
});

describe('WithdrawalTimer', () => {
  beforeEach(() => {
    // Mock Date.now to have consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows ready status for agent that can withdraw', () => {
    const agent = createMockAgent({
      canWithdraw: true,
      activatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
    });

    render(<WithdrawalTimer agent={agent} compact={true} />);
    
    expect(screen.getByText('Ready to withdraw')).toBeInTheDocument();
  });

  it('shows activation delay countdown for newly activated agent', () => {
    const agent = createMockAgent({
      canWithdraw: false,
      activatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      lastRoiWithdrawal: null
    });

    render(<WithdrawalTimer agent={agent} compact={true} />);
    
    expect(screen.getByText(/22h/)).toBeInTheDocument(); // Should show ~22 hours remaining
  });

  it('shows withdrawal cooldown for agent with recent withdrawal', () => {
    const agent = createMockAgent({
      canWithdraw: false,
      activatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
      lastRoiWithdrawal: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    });

    render(<WithdrawalTimer agent={agent} compact={true} />);
    
    expect(screen.getByText(/22h/)).toBeInTheDocument(); // Should show ~22 hours remaining
  });

  it('shows retired status for agent that reached yield cap', () => {
    const agent = createMockAgent({
      yieldCapReached: true,
      canWithdraw: false
    });

    render(<WithdrawalTimer agent={agent} compact={true} />);
    
    expect(screen.getByText('Agent retired')).toBeInTheDocument();
  });

  it('renders full version with detailed information', () => {
    const agent = createMockAgent({
      canWithdraw: true
    });

    render(<WithdrawalTimer agent={agent} compact={false} />);
    
    expect(screen.getByText('Withdrawal Status')).toBeInTheDocument();
    expect(screen.getByText('You can withdraw ROI from this agent now')).toBeInTheDocument();
  });

  it('shows correct countdown format', () => {
    const agent = createMockAgent({
      canWithdraw: false,
      activatedAt: new Date(Date.now() - 23 * 60 * 60 * 1000 - 30 * 60 * 1000), // 23.5 hours ago
      lastRoiWithdrawal: null
    });

    render(<WithdrawalTimer agent={agent} compact={true} />);
    
    // Should show 30 minutes remaining in correct format
    expect(screen.getByText(/30m \d+s/)).toBeInTheDocument();
  });
});

describe('MultiAgentTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows ready agents count when agents are available', () => {
    const agents = [
      createMockAgent({ activationId: 1, canWithdraw: true }),
      createMockAgent({ activationId: 2, canWithdraw: true }),
      createMockAgent({ activationId: 3, canWithdraw: false, yieldCapReached: true })
    ];

    render(<MultiAgentTimer agents={agents} />);
    
    expect(screen.getByText('2 agents ready for withdrawal')).toBeInTheDocument();
  });

  it('shows next available withdrawal time when no agents are ready', () => {
    const agents = [
      createMockAgent({
        activationId: 1,
        canWithdraw: false,
        activatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }),
      createMockAgent({
        activationId: 2,
        canWithdraw: false,
        activatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
      })
    ];

    render(<MultiAgentTimer agents={agents} />);
    
    expect(screen.getByText('Next Available Withdrawal')).toBeInTheDocument();
    expect(screen.getByText('Agent #2 (NOVA)')).toBeInTheDocument(); // Agent 2 is next (4h vs 2h ago)
  });

  it('shows no agents message when all are retired', () => {
    const agents = [
      createMockAgent({ activationId: 1, yieldCapReached: true, canWithdraw: false }),
      createMockAgent({ activationId: 2, yieldCapReached: true, canWithdraw: false })
    ];

    render(<MultiAgentTimer agents={agents} />);
    
    expect(screen.getByText('No agents available for withdrawal')).toBeInTheDocument();
  });

  it('handles empty agents array', () => {
    render(<MultiAgentTimer agents={[]} />);
    
    expect(screen.getByText('No agents available for withdrawal')).toBeInTheDocument();
  });
});