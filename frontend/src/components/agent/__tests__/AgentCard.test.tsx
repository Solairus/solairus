/**
 * Tests for AgentCard Component
 * 
 * This test suite validates the individual agent card component that displays
 * agent information, status, and provides ROI withdrawal functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AgentCard } from '../AgentCard';
import { AgentData } from '@/services/agent/agent-service';

// Mock child components and hooks
vi.mock('../WithdrawalTimer', () => ({
  WithdrawalTimer: ({ agent, compact }: { agent: AgentData; compact: boolean }) => (
    <div data-testid="withdrawal-timer">
      Timer for agent {agent.activationId} (compact: {compact.toString()})
    </div>
  )
}));

vi.mock('../WithdrawalValidationFeedback', () => ({
  WithdrawalValidationFeedback: ({ agent, error, onRetry }: any) => (
    <div data-testid="withdrawal-validation-feedback">
      <div>Agent: {agent.activationId}</div>
      {error && <div>Error: {error}</div>}
      {onRetry && (
        <button onClick={onRetry} data-testid="validation-retry-button">
          Retry
        </button>
      )}
    </div>
  ),
  useWithdrawalValidation: () => ({
    error: null,
    validateWithdrawal: vi.fn().mockResolvedValue(true),
    clearError: vi.fn(),
    setError: vi.fn()
  })
}));

vi.mock('../AgentErrorDisplay', () => ({
  AgentErrorDisplay: ({ error, context, agent, onRetry }: any) => (
    <div data-testid="agent-error-display">
      <div>Error: {error?.message || error}</div>
      <div>Context: {context}</div>
      <div>Agent: {agent?.activationId}</div>
      {onRetry && (
        <button onClick={onRetry} data-testid="error-retry-button">
          Retry
        </button>
      )}
    </div>
  )
}));

// Mock error handler and retry mechanism
vi.mock('@/utils/agent-error-handler', () => ({
  useAgentErrorHandler: () => ({
    showError: vi.fn((error) => ({
      type: 'network',
      message: error?.message || error,
      isRetryable: true
    })),
    showSuccess: vi.fn(),
    formatErrorForUI: vi.fn((error) => ({
      type: 'network',
      message: error?.message || error,
      isRetryable: true
    }))
  })
}));

vi.mock('@/utils/agent-retry-mechanism', () => ({
  useAgentRetryMechanism: () => ({
    executeWithRetry: vi.fn((fn) => fn().then(result => ({ success: true, data: result })).catch(error => ({ success: false, error })))
  })
}));

describe('AgentCard', () => {
  let mockAgent: AgentData;
  let mockOnWithdraw: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnWithdraw = vi.fn().mockResolvedValue(undefined);
    
    mockAgent = {
      activationId: 1,
      tier: 1, // VEGA
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
  });

  describe('Basic Information Display', () => {
    it('should display agent tier information', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('🔮')).toBeInTheDocument();
      expect(screen.getByText('VEGA')).toBeInTheDocument();
      expect(screen.getByText('Balanced risk and return')).toBeInTheDocument();
    });

    it('should display agent status badge', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should display retired status for yield cap reached agents', () => {
      const retiredAgent = {
        ...mockAgent,
        yieldCapReached: true
      };

      render(<AgentCard agent={retiredAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Retired')).toBeInTheDocument();
    });

    it('should display investment amount', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Investment')).toBeInTheDocument();
      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });

    it('should display activation date', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Activated')).toBeInTheDocument();
      expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument();
    });

    it('should display target monthly return range', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Monthly Target')).toBeInTheDocument();
      expect(screen.getByText('1.75% - 2.15%')).toBeInTheDocument();
    });
  });

  describe('ROI Progress Display', () => {
    it('should display ROI progress information', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('ROI Progress')).toBeInTheDocument();
      expect(screen.getByText('25.0% / 200%')).toBeInTheDocument();
    });

    it('should display total withdrawn amount', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Withdrawn: $50.00')).toBeInTheDocument();
    });

    it('should show cap reached indicator when yield cap is reached', () => {
      const cappedAgent = {
        ...mockAgent,
        yieldCapReached: true,
        yieldCapProgress: 100
      };

      render(<AgentCard agent={cappedAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Cap Reached')).toBeInTheDocument();
    });

    it('should display progress bar', () => {
      const { container } = render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      // Check for progress bar element
      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Withdrawal Timer', () => {
    it('should display withdrawal timer component', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByTestId('withdrawal-timer')).toBeInTheDocument();
      expect(screen.getByText('Timer for agent 1 (compact: true)')).toBeInTheDocument();
    });
  });

  describe('Withdrawal Button States', () => {
    it('should show withdraw ROI button when agent can withdraw', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      const withdrawButton = screen.getByText('Withdraw ROI');
      expect(withdrawButton).toBeInTheDocument();
      expect(withdrawButton).not.toBeDisabled();
    });

    it('should show waiting for cooldown when agent cannot withdraw', () => {
      const cooldownAgent = {
        ...mockAgent,
        canWithdraw: false
      };

      render(<AgentCard agent={cooldownAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Waiting for Cooldown')).toBeInTheDocument();
    });

    it('should show agent retired button when yield cap is reached', () => {
      const retiredAgent = {
        ...mockAgent,
        yieldCapReached: true
      };

      render(<AgentCard agent={retiredAgent} onWithdraw={mockOnWithdraw} />);

      const retiredButton = screen.getByText('Agent Retired');
      expect(retiredButton).toBeInTheDocument();
      expect(retiredButton).toBeDisabled();
    });

    it('should show withdrawing state during withdrawal', async () => {
      // Mock a slow withdrawal
      mockOnWithdraw.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      const withdrawButton = screen.getByText('Withdraw ROI');
      fireEvent.click(withdrawButton);

      expect(screen.getByText('Withdrawing...')).toBeInTheDocument();
      
      // Wait for withdrawal to complete
      await waitFor(() => {
        expect(screen.getByText('Withdraw ROI')).toBeInTheDocument();
      });
    });
  });

  describe('Withdrawal Functionality', () => {
    it('should call onWithdraw when withdraw button is clicked', async () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      const withdrawButton = screen.getByText('Withdraw ROI');
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        expect(mockOnWithdraw).toHaveBeenCalledWith(1);
      });
    });

    it('should not allow multiple simultaneous withdrawals', async () => {
      mockOnWithdraw.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      const withdrawButton = screen.getByText('Withdraw ROI');
      
      // Click multiple times rapidly
      fireEvent.click(withdrawButton);
      fireEvent.click(withdrawButton);
      fireEvent.click(withdrawButton);

      // Should only be called once
      expect(mockOnWithdraw).toHaveBeenCalledTimes(1);
    });

    it('should handle withdrawal errors gracefully', async () => {
      mockOnWithdraw.mockRejectedValue(new Error('Network error'));

      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      const withdrawButton = screen.getByText('Withdraw ROI');
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        expect(screen.getByTestId('agent-error-display')).toBeInTheDocument();
        expect(screen.getByText('Error: Network error')).toBeInTheDocument();
      });
    });

    it('should allow retry after withdrawal error', async () => {
      mockOnWithdraw.mockRejectedValueOnce(new Error('Network error'));
      mockOnWithdraw.mockResolvedValue(undefined);

      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      // Initial withdrawal fails
      const withdrawButton = screen.getByText('Withdraw ROI');
      fireEvent.click(withdrawButton);

      await waitFor(() => {
        const retryButton = screen.getByTestId('error-retry-button');
        fireEvent.click(retryButton);
      });

      // Should be called twice (initial + retry)
      expect(mockOnWithdraw).toHaveBeenCalledTimes(2);
    });
  });

  describe('Tier-Specific Styling', () => {
    it('should apply NOVA tier styling', () => {
      const novaAgent = {
        ...mockAgent,
        tier: 0,
        tierConfig: {
          name: 'NOVA',
          emoji: '🪶',
          description: 'Entry-level agent',
          dailyRange: '1.00% - 1.75%',
          yieldCapPct: 175
        }
      };

      const { container } = render(<AgentCard agent={novaAgent} onWithdraw={mockOnWithdraw} />);

      // Should have cyan styling for NOVA
      expect(container.querySelector('.from-cyan-500\\/20')).toBeInTheDocument();
    });

    it('should apply VEGA tier styling', () => {
      const { container } = render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      // Should have emerald styling for VEGA
      expect(container.querySelector('.from-emerald-500\\/20')).toBeInTheDocument();
    });

    it('should apply ORION tier styling', () => {
      const orionAgent = {
        ...mockAgent,
        tier: 2,
        tierConfig: {
          name: 'ORION',
          emoji: '⚡',
          description: 'Aggressive agent',
          dailyRange: '2.15% - 3.00%',
          yieldCapPct: 220
        }
      };

      const { container } = render(<AgentCard agent={orionAgent} onWithdraw={mockOnWithdraw} />);

      // Should have indigo styling for ORION
      expect(container.querySelector('.from-indigo-500\\/20')).toBeInTheDocument();
    });

    it('should apply PRIME tier styling', () => {
      const primeAgent = {
        ...mockAgent,
        tier: 3,
        tierConfig: {
          name: 'PRIME',
          emoji: '🧠',
          description: 'Elite agent',
          dailyRange: '3.00% - 5.00%',
          yieldCapPct: 250
        }
      };

      const { container } = render(<AgentCard agent={primeAgent} onWithdraw={mockOnWithdraw} />);

      // Should have amber styling for PRIME
      expect(container.querySelector('.from-amber-500\\/20')).toBeInTheDocument();
    });
  });

  describe('Last Withdrawal Information', () => {
    it('should display last withdrawal date when available', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Last withdrawal:')).toBeInTheDocument();
      expect(screen.getByText('Jan 2, 2024')).toBeInTheDocument();
    });

    it('should not display last withdrawal section for new agents', () => {
      const newAgent = {
        ...mockAgent,
        lastRoiWithdrawal: null
      };

      render(<AgentCard agent={newAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.queryByText('Last withdrawal:')).not.toBeInTheDocument();
    });
  });

  describe('Validation Feedback', () => {
    it('should display withdrawal validation feedback', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByTestId('withdrawal-validation-feedback')).toBeInTheDocument();
    });

    it('should show validation feedback for agents that cannot withdraw', () => {
      const cooldownAgent = {
        ...mockAgent,
        canWithdraw: false
      };

      render(<AgentCard agent={cooldownAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByTestId('withdrawal-validation-feedback')).toBeInTheDocument();
      expect(screen.getByText('Agent: 1')).toBeInTheDocument();
    });
  });

  describe('Hover Effects', () => {
    it('should have hover scale effect', () => {
      const { container } = render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      // Should have hover:scale-[1.02] class
      expect(container.querySelector('.hover\\:scale-\\[1\\.02\\]')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button accessibility', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      const withdrawButton = screen.getByRole('button', { name: /withdraw roi/i });
      expect(withdrawButton).toBeInTheDocument();
    });

    it('should have proper progress bar accessibility', () => {
      const { container } = render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should have descriptive text for screen readers', () => {
      render(<AgentCard agent={mockAgent} onWithdraw={mockOnWithdraw} />);

      // Should have descriptive labels
      expect(screen.getByText('Investment')).toBeInTheDocument();
      expect(screen.getByText('Activated')).toBeInTheDocument();
      expect(screen.getByText('Daily Range')).toBeInTheDocument();
      expect(screen.getByText('ROI Progress')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero withdrawal amount', () => {
      const zeroWithdrawalAgent = {
        ...mockAgent,
        totalRoiWithdrawn: 0,
        yieldCapProgress: 0
      };

      render(<AgentCard agent={zeroWithdrawalAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Withdrawn: $0.00')).toBeInTheDocument();
      expect(screen.getByText('0.0% / 200%')).toBeInTheDocument();
    });

    it('should handle large withdrawal amounts', () => {
      const largeWithdrawalAgent = {
        ...mockAgent,
        totalRoiWithdrawn: 1234567.89,
        activationAmount: 1000000
      };

      render(<AgentCard agent={largeWithdrawalAgent} onWithdraw={mockOnWithdraw} />);

      expect(screen.getByText('Withdrawn: $1,234,567.89')).toBeInTheDocument();
      expect(screen.getByText('$1,000,000.00')).toBeInTheDocument();
    });

    it('should handle progress over 100%', () => {
      const overProgressAgent = {
        ...mockAgent,
        yieldCapProgress: 150 // Should be capped at 100% in display
      };

      const { container } = render(<AgentCard agent={overProgressAgent} onWithdraw={mockOnWithdraw} />);

      // Progress bar should not exceed 100%
      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });
  });
});