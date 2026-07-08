/**
 * Tests for AgentDashboard Component
 * 
 * This test suite validates the main agent dashboard component that displays
 * user's agent portfolio, withdrawal limits, and provides agent management functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PublicKey, Connection } from '@solana/web3.js';
import { AgentDashboard } from '../AgentDashboard';
import { AgentData } from '@/services/agent/agent-service';

// Mock the services
const mockGetUserAgents = vi.fn();
const mockGetWithdrawalLimitDisplay = vi.fn();

vi.mock('@/services/agent/agent-service', () => ({
  getUserAgents: mockGetUserAgents
}));

vi.mock('@/services/agent/withdrawal-limit-service', () => ({
  getWithdrawalLimitDisplay: mockGetWithdrawalLimitDisplay
}));

// Mock child components
vi.mock('../AgentCard', () => ({
  AgentCard: ({ agent, onWithdraw }: { agent: AgentData; onWithdraw: (id: number) => void }) => (
    <div data-testid={`agent-card-${agent.activationId}`}>
      <div>Agent #{agent.activationId}</div>
      <div>{agent.tierConfig.name}</div>
      <div>${agent.activationAmount}</div>
      <button onClick={() => onWithdraw(agent.activationId)}>
        Withdraw ROI
      </button>
    </div>
  )
}));

vi.mock('../WithdrawalLimitDisplay', () => ({
  WithdrawalLimitDisplay: ({ status }: any) => (
    <div data-testid="withdrawal-limit-display">
      <div>Status: {status.statusMessage}</div>
      <div>Usage: {status.usagePercentage}%</div>
    </div>
  )
}));

vi.mock('../WithdrawalTimer', () => ({
  MultiAgentTimer: ({ agents }: { agents: AgentData[] }) => (
    <div data-testid="multi-agent-timer">
      Timer for {agents.length} agents
    </div>
  )
}));

describe('AgentDashboard', () => {
  const mockConnection = {} as Connection;
  const mockUserPublicKey = new PublicKey('11111111111111111111111111111111');
  
  const mockWithdrawalLimitStatus = {
    totalDeposits: '1,000.00',
    totalWithdrawn: '500.00',
    maxWithdrawable: '200,000.00',
    remainingWithdrawable: '199,500.00',
    usagePercentage: 0.25,
    limitReached: false,
    isPrivileged: false,
    warningLevel: 'none' as const,
    statusMessage: 'Withdrawal limit healthy'
  };

  const mockAgent: AgentData = {
    activationId: 1,
    tier: 1,
    activationAmount: 100,
    activatedAt: new Date('2024-01-01'),
    lastRoiWithdrawal: new Date('2024-01-02'),
    totalRoiWithdrawn: 50,
    yieldCapReached: false,
    canWithdraw: true,
    nextWithdrawalAt: null,
    yieldCapProgress: 25,
    withdrawalStatus: { canWithdraw: true },
    tierConfig: {
      name: 'VEGA',
      emoji: '🔮',
      description: 'Balanced risk and return',
      dailyRange: '1.75% - 2.15%',
      yieldCapPct: 200
    },
    pda: {} as unknown,
    accountData: {} as unknown
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockGetUserAgents.mockResolvedValue({
      agents: [],
      totalCount: 0,
      hasMore: false
    });
    
    mockGetWithdrawalLimitDisplay.mockResolvedValue(mockWithdrawalLimitStatus);
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      expect(screen.getByText('Loading your AI trading agents...')).toBeInTheDocument();
    });

    it('should show loading spinner', () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      // Check for loading spinner (Loader2 component)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no agents', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No Agents Yet')).toBeInTheDocument();
        expect(screen.getByText('Activate your first AI trading agent to start targeting monthly returns')).toBeInTheDocument();
      });
    });

    it('should show withdrawal limit display in empty state', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('withdrawal-limit-display')).toBeInTheDocument();
        expect(screen.getByText('Status: Withdrawal limit healthy')).toBeInTheDocument();
      });
    });

    it('should show activate first agent button', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Activate First Agent')).toBeInTheDocument();
      });
    });

    it('should show tier information in empty state', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('🪶 NOVA • 🔮 VEGA • ⚡ ORION • 🧠 PRIME')).toBeInTheDocument();
      });
    });
  });

  describe('Agent Portfolio Display', () => {
    beforeEach(() => {
      mockGetUserAgents.mockResolvedValue({
        agents: [mockAgent],
        totalCount: 1,
        hasMore: false
      });
    });

    it('should display agent portfolio when agents exist', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Agent Portfolio')).toBeInTheDocument();
        expect(screen.getByText('1 agent activated')).toBeInTheDocument();
      });
    });

    it('should display agent cards', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('agent-card-1')).toBeInTheDocument();
        expect(screen.getByText('Agent #1')).toBeInTheDocument();
        expect(screen.getByText('VEGA')).toBeInTheDocument();
        expect(screen.getByText('$100')).toBeInTheDocument();
      });
    });

    it('should show multi-agent timer when agents exist', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('multi-agent-timer')).toBeInTheDocument();
        expect(screen.getByText('Timer for 1 agents')).toBeInTheDocument();
      });
    });

    it('should display correct plural form for multiple agents', async () => {
      const multipleAgents = [
        mockAgent,
        { ...mockAgent, activationId: 2 }
      ];

      mockGetUserAgents.mockResolvedValue({
        agents: multipleAgents,
        totalCount: 2,
        hasMore: false
      });

      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('2 agents activated')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting Functionality', () => {
    beforeEach(() => {
      mockGetUserAgents.mockResolvedValue({
        agents: [mockAgent],
        totalCount: 1,
        hasMore: false
      });
    });

    it('should display sort controls', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Sort by:')).toBeInTheDocument();
        expect(screen.getByText(/Date/)).toBeInTheDocument();
        expect(screen.getByText(/Tier/)).toBeInTheDocument();
        expect(screen.getByText(/Amount/)).toBeInTheDocument();
      });
    });

    it('should call getUserAgents with sort parameters when sort is changed', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        const tierSortButton = screen.getByText(/Tier/);
        fireEvent.click(tierSortButton);
      });

      // Should be called twice: once for initial load, once for sort change
      expect(mockGetUserAgents).toHaveBeenCalledTimes(2);
      expect(mockGetUserAgents).toHaveBeenLastCalledWith(
        mockConnection,
        mockUserPublicKey,
        expect.objectContaining({
          sortBy: 'tier',
          sortOrder: 'desc'
        })
      );
    });
  });

  describe('Refresh Functionality', () => {
    beforeEach(() => {
      mockGetUserAgents.mockResolvedValue({
        agents: [mockAgent],
        totalCount: 1,
        hasMore: false
      });
    });

    it('should show refresh button', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        const refreshButton = document.querySelector('.lucide-refresh-cw');
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it('should refresh data when refresh button is clicked', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        const refreshButton = document.querySelector('.lucide-refresh-cw')?.closest('button');
        if (refreshButton) {
          fireEvent.click(refreshButton);
        }
      });

      // Should be called twice: initial load + refresh
      expect(mockGetUserAgents).toHaveBeenCalledTimes(2);
      expect(mockGetWithdrawalLimitDisplay).toHaveBeenCalledTimes(2);
    });
  });

  describe('Agent Activation', () => {
    it('should navigate to /dapp/hire when no onActivateAgent callback is provided', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' }
      });

      render(
        <AgentDashboard
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        const activateButton = screen.getByText('Activate First Agent');
        fireEvent.click(activateButton);
      });

      expect(window.location.href).toBe('/dapp/hire');

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation
      });
    });

    it('should call external onActivateAgent callback when provided', async () => {
      const mockOnActivate = vi.fn();

      render(
        <AgentDashboard
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onActivateAgent={mockOnActivate}
        />
      );

      await waitFor(() => {
        const activateButton = screen.getByText('Activate First Agent');
        fireEvent.click(activateButton);
      });

      expect(mockOnActivate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Agent ROI Withdrawal', () => {
    beforeEach(() => {
      mockGetUserAgents.mockResolvedValue({
        agents: [mockAgent],
        totalCount: 1,
        hasMore: false
      });
    });

    it('should handle agent ROI withdrawal', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        const withdrawButton = screen.getByText('Withdraw ROI');
        fireEvent.click(withdrawButton);
      });

      // Should refresh data after withdrawal attempt
      await waitFor(() => {
        expect(mockGetUserAgents).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error state when data loading fails', async () => {
      const errorMessage = 'Failed to load agents';
      mockGetUserAgents.mockRejectedValue(new Error(errorMessage));

      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading your agents')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should show try again button in error state', async () => {
      mockGetUserAgents.mockRejectedValue(new Error('Network error'));

      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should retry loading when try again button is clicked', async () => {
      mockGetUserAgents.mockRejectedValueOnce(new Error('Network error'));
      mockGetUserAgents.mockResolvedValue({
        agents: [],
        totalCount: 0,
        hasMore: false
      });

      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        const tryAgainButton = screen.getByText('Try Again');
        fireEvent.click(tryAgainButton);
      });

      await waitFor(() => {
        expect(screen.getByText('No Agents Yet')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should show load more button when hasMore is true', async () => {
      mockGetUserAgents.mockResolvedValue({
        agents: [mockAgent],
        totalCount: 10,
        hasMore: true
      });

      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Showing 1 of 10 agents')).toBeInTheDocument();
        expect(screen.getByText('Load More')).toBeInTheDocument();
      });
    });

    it('should not show load more button when hasMore is false', async () => {
      mockGetUserAgents.mockResolvedValue({
        agents: [mockAgent],
        totalCount: 1,
        hasMore: false
      });

      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Load More')).not.toBeInTheDocument();
      });
    });
  });

  describe('Additional Actions', () => {
    beforeEach(() => {
      mockGetUserAgents.mockResolvedValue({
        agents: [mockAgent],
        totalCount: 1,
        hasMore: false
      });
    });

    it('should show activate another agent button when agents exist', async () => {
      render(
        <AgentDashboard 
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Activate Another Agent')).toBeInTheDocument();
      });
    });
  });
});