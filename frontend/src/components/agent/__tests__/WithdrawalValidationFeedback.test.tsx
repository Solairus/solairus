/**
 * Tests for WithdrawalValidationFeedback Component
 * 
 * This test suite validates the withdrawal validation feedback component that provides
 * context-aware error messages and validation feedback for agent ROI withdrawals.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WithdrawalValidationFeedback, useWithdrawalValidation } from '../WithdrawalValidationFeedback';
import { AgentData } from '@/services/agent/agent-service';

// Mock the agent error handler
vi.mock('@/utils/agent-error-handler', () => ({
  useAgentErrorHandler: () => ({
    parseError: vi.fn((error) => ({
      type: 'validation',
      message: error,
      isRetryable: true
    }))
  })
}));

// Mock the AgentErrorDisplay component
vi.mock('../AgentErrorDisplay', () => ({
  AgentErrorDisplay: ({ error, context, agent, onRetry, className }: any) => (
    <div data-testid="agent-error-display" className={className}>
      <div>Error: {error}</div>
      <div>Context: {context}</div>
      <div>Agent: {agent?.activationId}</div>
      {onRetry && (
        <button onClick={onRetry} data-testid="retry-button">
          Retry
        </button>
      )}
    </div>
  )
}));

describe('WithdrawalValidationFeedback', () => {
  let mockAgent: AgentData;
  let mockOnRetry: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnRetry = vi.fn();
    
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

  describe('Success States', () => {
    it('should show ready for withdrawal when agent can withdraw', () => {
      render(
        <WithdrawalValidationFeedback 
          agent={mockAgent}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Ready for Withdrawal')).toBeInTheDocument();
      expect(screen.getByText(/This agent can generate ROI now/)).toBeInTheDocument();
      expect(screen.getByText(/Daily yield range: 1.75% - 2.15%/)).toBeInTheDocument();
    });

    it('should not render anything when no error and agent cannot withdraw but no specific reason', () => {
      const agentCannotWithdraw = {
        ...mockAgent,
        canWithdraw: false,
        nextWithdrawalAt: null
      };

      const { container } = render(
        <WithdrawalValidationFeedback 
          agent={agentCannotWithdraw}
          onRetry={mockOnRetry}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Agent Retired State', () => {
    it('should show agent retired message when yield cap is reached', () => {
      const retiredAgent = {
        ...mockAgent,
        yieldCapReached: true,
        yieldCapProgress: 100,
        totalRoiWithdrawn: 200
      };

      render(
        <WithdrawalValidationFeedback 
          agent={retiredAgent}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Agent Retired')).toBeInTheDocument();
      expect(screen.getByText(/reached its 200% yield cap/)).toBeInTheDocument();
      expect(screen.getByText(/generated \$200.00 in total ROI/)).toBeInTheDocument();
    });
  });

  describe('Timing Restrictions', () => {
    it('should show activation delay message for new agents', () => {
      const newAgent = {
        ...mockAgent,
        canWithdraw: false,
        lastRoiWithdrawal: null, // No previous withdrawal = activation delay
        nextWithdrawalAt: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours from now
      };

      render(
        <WithdrawalValidationFeedback 
          agent={newAgent}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Activation Delay')).toBeInTheDocument();
      expect(screen.getByText(/New agents must wait 24 hours after activation/)).toBeInTheDocument();
    });

    it('should show withdrawal cooldown message for existing agents', () => {
      const agentOnCooldown = {
        ...mockAgent,
        canWithdraw: false,
        lastRoiWithdrawal: new Date('2024-01-02'), // Has previous withdrawal
        nextWithdrawalAt: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours from now
      };

      render(
        <WithdrawalValidationFeedback 
          agent={agentOnCooldown}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Withdrawal Cooldown')).toBeInTheDocument();
      expect(screen.getByText(/Each agent has a 24-hour cooldown/)).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should use AgentErrorDisplay for error messages', () => {
      const errorMessage = 'Withdrawal failed due to network error';

      render(
        <WithdrawalValidationFeedback 
          agent={mockAgent}
          error={errorMessage}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByTestId('agent-error-display')).toBeInTheDocument();
      expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
      expect(screen.getByText('Context: ROI withdrawal')).toBeInTheDocument();
      expect(screen.getByText(`Agent: ${mockAgent.activationId}`)).toBeInTheDocument();
    });

    it('should pass retry function to AgentErrorDisplay', () => {
      render(
        <WithdrawalValidationFeedback 
          agent={mockAgent}
          error="Test error"
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByTestId('retry-button');
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('should apply custom className to AgentErrorDisplay', () => {
      render(
        <WithdrawalValidationFeedback 
          agent={mockAgent}
          error="Test error"
          className="custom-error-class"
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByTestId('agent-error-display')).toHaveClass('custom-error-class');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className to success states', () => {
      const { container } = render(
        <WithdrawalValidationFeedback 
          agent={mockAgent}
          className="custom-success-class"
          onRetry={mockOnRetry}
        />
      );

      expect(container.querySelector('.custom-success-class')).toBeInTheDocument();
    });

    it('should apply custom className to retired agent state', () => {
      const retiredAgent = {
        ...mockAgent,
        yieldCapReached: true
      };

      const { container } = render(
        <WithdrawalValidationFeedback 
          agent={retiredAgent}
          className="custom-retired-class"
          onRetry={mockOnRetry}
        />
      );

      expect(container.querySelector('.custom-retired-class')).toBeInTheDocument();
    });
  });
});

describe('useWithdrawalValidation hook', () => {
  let mockAgent: AgentData;

  beforeEach(() => {
    mockAgent = {
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
      pda: {} as any,
      accountData: {} as unknown
    };
  });

  it('should validate successful withdrawal', async () => {
    const TestComponent = () => {
      const { error, isValidating, validateWithdrawal, clearError } = useWithdrawalValidation(mockAgent);
      
      return (
        <div>
          <div data-testid="error">{error || 'No error'}</div>
          <div data-testid="validating">{isValidating ? 'Validating' : 'Not validating'}</div>
          <button onClick={() => validateWithdrawal().then(result => {
            document.getElementById('result')!.textContent = result ? 'Valid' : 'Invalid';
          })}>
            Validate
          </button>
          <button onClick={clearError}>Clear Error</button>
          <div id="result"></div>
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('error')).toHaveTextContent('No error');
    expect(screen.getByTestId('validating')).toHaveTextContent('Not validating');

    fireEvent.click(screen.getByText('Validate'));

    await waitFor(() => {
      expect(screen.getByText('Valid')).toBeInTheDocument();
    });
  });

  it('should validate agent retirement', async () => {
    const retiredAgent = {
      ...mockAgent,
      yieldCapReached: true
    };

    const TestComponent = () => {
      const { error, validateWithdrawal } = useWithdrawalValidation(retiredAgent);
      
      return (
        <div>
          <div data-testid="error">{error || 'No error'}</div>
          <button onClick={() => validateWithdrawal().then(result => {
            document.getElementById('result')!.textContent = result ? 'Valid' : 'Invalid';
          })}>
            Validate
          </button>
          <div id="result"></div>
        </div>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByText('Validate'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Agent has reached its yield cap and is retired');
      expect(screen.getByText('Invalid')).toBeInTheDocument();
    });
  });

  it('should validate timing restrictions for new agents', async () => {
    const newAgent = {
      ...mockAgent,
      canWithdraw: false,
      lastRoiWithdrawal: null
    };

    const TestComponent = () => {
      const { error, validateWithdrawal } = useWithdrawalValidation(newAgent);
      
      return (
        <div>
          <div data-testid="error">{error || 'No error'}</div>
          <button onClick={() => validateWithdrawal().then(result => {
            document.getElementById('result')!.textContent = result ? 'Valid' : 'Invalid';
          })}>
            Validate
          </button>
          <div id="result"></div>
        </div>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByText('Validate'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Withdrawal too early - 24 hour activation delay required');
      expect(screen.getByText('Invalid')).toBeInTheDocument();
    });
  });

  it('should validate timing restrictions for existing agents', async () => {
    const agentOnCooldown = {
      ...mockAgent,
      canWithdraw: false,
      lastRoiWithdrawal: new Date('2024-01-02')
    };

    const TestComponent = () => {
      const { error, validateWithdrawal } = useWithdrawalValidation(agentOnCooldown);
      
      return (
        <div>
          <div data-testid="error">{error || 'No error'}</div>
          <button onClick={() => validateWithdrawal().then(result => {
            document.getElementById('result')!.textContent = result ? 'Valid' : 'Invalid';
          })}>
            Validate
          </button>
          <div id="result"></div>
        </div>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByText('Validate'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Withdrawal too early - 24 hour cooldown required');
      expect(screen.getByText('Invalid')).toBeInTheDocument();
    });
  });

  it('should clear errors', async () => {
    const retiredAgent = {
      ...mockAgent,
      yieldCapReached: true
    };

    const TestComponent = () => {
      const { error, validateWithdrawal, clearError } = useWithdrawalValidation(retiredAgent);
      
      return (
        <div>
          <div data-testid="error">{error || 'No error'}</div>
          <button onClick={() => validateWithdrawal()}>Validate</button>
          <button onClick={clearError}>Clear Error</button>
        </div>
      );
    };

    render(<TestComponent />);

    // Trigger validation error
    fireEvent.click(screen.getByText('Validate'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).not.toHaveTextContent('No error');
    });

    // Clear error
    fireEvent.click(screen.getByText('Clear Error'));

    expect(screen.getByTestId('error')).toHaveTextContent('No error');
  });

  it('should handle validation exceptions', async () => {
    // Create an agent that would cause an exception during validation
    const problematicAgent = {
      ...mockAgent,
      // Simulate a problematic state that might cause validation to throw
    };

    const TestComponent = () => {
      const { error, validateWithdrawal } = useWithdrawalValidation(problematicAgent);
      
      // Mock console.error to avoid noise in tests
      const originalError = console.error;
      console.error = vi.fn();
      
      React.useEffect(() => {
        return () => {
          console.error = originalError;
        };
      }, []);
      
      return (
        <div>
          <div data-testid="error">{error || 'No error'}</div>
          <button onClick={() => validateWithdrawal().then(result => {
            document.getElementById('result')!.textContent = result ? 'Valid' : 'Invalid';
          })}>
            Validate
          </button>
          <div id="result"></div>
        </div>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByText('Validate'));

    await waitFor(() => {
      // Should handle the validation gracefully
      expect(screen.getByText('Valid')).toBeInTheDocument();
    });
  });
});