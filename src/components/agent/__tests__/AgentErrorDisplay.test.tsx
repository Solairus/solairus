/**
 * Tests for AgentErrorDisplay Component
 * 
 * This test suite validates the enhanced error display component that provides
 * user-friendly error messages with context-aware styling and retry mechanisms.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentErrorDisplay, useAgentErrorDisplay } from '../AgentErrorDisplay';
import { AgentData } from '@/services/agent/agent-service';
import { AGENT_ERROR_CODES } from '@/utils/agent-error-handler';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe('AgentErrorDisplay', () => {
  let mockAgent: AgentData;
  let mockOnRetry: ReturnType<typeof vi.fn>;
  let mockOnDismiss: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnRetry = vi.fn();
    mockOnDismiss = vi.fn();
    
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
      pda: {} as any,
      accountData: {} as unknown
    };
  });

  describe('Error Display', () => {
    it('should display timing error with countdown', () => {
      const error = new Error('WithdrawalTooEarly - 24 hour cooldown required');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="ROI withdrawal"
          agent={mockAgent}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Timing Restriction')).toBeInTheDocument();
      expect(screen.getByText(/24-hour cooldown/)).toBeInTheDocument();
    });

    it('should display agent retired error with context', () => {
      const retiredAgent = {
        ...mockAgent,
        yieldCapReached: true,
        yieldCapProgress: 100
      };
      
      const error = new Error('AgentRetired - yield cap reached');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="ROI withdrawal"
          agent={retiredAgent}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Limit Exceeded')).toBeInTheDocument();
      expect(screen.getByText(/200% yield cap/)).toBeInTheDocument();
    });

    it('should display network error with retry button', () => {
      const error = new Error('Network connection failed');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="ROI withdrawal"
          agent={mockAgent}
          onRetry={mockOnRetry}
          showRetryButton={true}
        />
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should display global withdrawal limit error', () => {
      const error = new Error('GlobalWithdrawalLimitReached - 200x deposits exceeded');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="ROI withdrawal"
          agent={mockAgent}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Limit Exceeded')).toBeInTheDocument();
      expect(screen.getByText(/200x your total deposits/)).toBeInTheDocument();
    });

    it('should display insufficient system reserve error', () => {
      const error = new Error('InsufficientSystemReserve');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="ROI withdrawal"
          agent={mockAgent}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Smart Contract Error')).toBeInTheDocument();
      expect(screen.getByText(/high withdrawal volume/)).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should render in compact mode', () => {
      const error = new Error('Network error');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="test"
          compact={true}
          onRetry={mockOnRetry}
        />
      );

      // Should have compact styling
      const container = screen.getByTestId('error-display-compact');
      expect(container).toHaveClass('flex', 'items-center', 'gap-2', 'p-2');
    });

    it('should show retry button in compact mode', () => {
      const error = new Error('Network error');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="test"
          compact={true}
          showRetryButton={true}
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveClass('h-6', 'px-2', 'text-xs');
    });
  });

  describe('Retry Functionality', () => {
    it('should call onRetry when retry button is clicked', async () => {
      const error = new Error('Network error');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="test"
          onRetry={mockOnRetry}
          showRetryButton={true}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockOnRetry).toHaveBeenCalledTimes(1);
      });
    });

    it('should disable retry button during retry', async () => {
      const error = new Error('Network error');
      const slowRetry = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(
        <AgentErrorDisplay
          error={error}
          context="test"
          onRetry={slowRetry}
          showRetryButton={true}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Button should be disabled during retry
      expect(retryButton).toBeDisabled();
      
      await waitFor(() => {
        expect(retryButton).not.toBeDisabled();
      });
    });

    it('should show countdown for timing errors', () => {
      // Mock agent with future withdrawal time
      const agentWithDelay = {
        ...mockAgent,
        nextWithdrawalAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };
      
      const error = new Error('WithdrawalTooEarly');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="withdrawal"
          agent={agentWithDelay}
          autoRetryCountdown={true}
        />
      );

      expect(screen.getByText(/Next attempt available in/)).toBeInTheDocument();
    });
  });

  describe('Dismiss Functionality', () => {
    it('should call onDismiss when dismiss button is clicked', () => {
      const error = new Error('Test error');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="test"
          onDismiss={mockOnDismiss}
        />
      );

      const dismissButton = screen.getByRole('button', { name: '' }); // X button
      fireEvent.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Agent Context', () => {
    it('should display agent information when provided', () => {
      const error = new Error('Test error');
      
      render(
        <AgentErrorDisplay
          error={error}
          context="test"
          agent={mockAgent}
        />
      );

      expect(screen.getByText(/Agent #1/)).toBeInTheDocument();
      expect(screen.getByText(/VEGA Tier/)).toBeInTheDocument();
      expect(screen.getByText(/\$100\.00 Investment/)).toBeInTheDocument();
    });
  });

  describe('Error Severity', () => {
    it('should show appropriate severity badges', () => {
      const criticalError = new Error('Unknown critical error');
      
      render(
        <AgentErrorDisplay
          error={criticalError}
          context="test"
        />
      );

      expect(screen.getByText(/🚨 Critical/)).toBeInTheDocument();
    });

    it('should show low severity for timing errors', () => {
      const timingError = new Error('WithdrawalTooEarly');
      
      render(
        <AgentErrorDisplay
          error={timingError}
          context="test"
        />
      );

      expect(screen.getByText(/ℹ️ Information/)).toBeInTheDocument();
    });
  });
});

describe('useAgentErrorDisplay hook', () => {
  it('should manage error display state', () => {
    const TestComponent = () => {
      const { error, isVisible, showError, hideError, clearError } = useAgentErrorDisplay();
      
      return (
        <div>
          <div data-testid="error-state">
            {error ? 'Has Error' : 'No Error'}
          </div>
          <div data-testid="visibility-state">
            {isVisible ? 'Visible' : 'Hidden'}
          </div>
          <button onClick={() => showError('Test error', 'test context')}>
            Show Error
          </button>
          <button onClick={hideError}>Hide Error</button>
          <button onClick={clearError}>Clear Error</button>
        </div>
      );
    };

    render(<TestComponent />);

    // Initial state
    expect(screen.getByTestId('error-state')).toHaveTextContent('No Error');
    expect(screen.getByTestId('visibility-state')).toHaveTextContent('Hidden');

    // Show error
    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByTestId('error-state')).toHaveTextContent('Has Error');
    expect(screen.getByTestId('visibility-state')).toHaveTextContent('Visible');

    // Hide error
    fireEvent.click(screen.getByText('Hide Error'));
    expect(screen.getByTestId('visibility-state')).toHaveTextContent('Hidden');

    // Clear error
    fireEvent.click(screen.getByText('Clear Error'));
    expect(screen.getByTestId('error-state')).toHaveTextContent('No Error');
  });
});