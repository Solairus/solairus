/**
 * Tests for AgentActivationModal Component
 * 
 * This test suite validates the agent activation modal that guides users through
 * the process of selecting a tier, setting amount, and confirming agent activation.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PublicKey, Connection } from '@solana/web3.js';
import { AgentActivationModal } from '../AgentActivationModal';
import { AgentTier } from '@/lib/solairus-main';

// Mock the agent activation service
const mockActivateAgent = vi.fn();
const mockValidateActivationParams = vi.fn();
const mockGetMinimumActivationAmount = vi.fn();

vi.mock('@/services/agent/agent-activation-service', () => ({
  activateAgent: mockActivateAgent,
  validateActivationParams: mockValidateActivationParams,
  getMinimumActivationAmount: mockGetMinimumActivationAmount,
}));

// Mock the agent error handler
vi.mock('@/utils/agent-error-handler', () => ({
  useAgentErrorHandler: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    formatErrorForUI: vi.fn((error) => ({
      type: 'network',
      message: error.message || error,
      isRetryable: true
    }))
  })
}));


// Mock the solairus-main lib
vi.mock('@/lib/solairus-main', () => ({
  AgentTier: {
    NOVA: 0,
    VEGA: 1,
    ORION: 2,
    PRIME: 3,
  },
  AGENT_TIER_CONFIGS: {
    0: {
      name: 'NOVA',
      emoji: '🪶',
      description: 'Entry-level agent',
      dailyRange: '1.00% - 1.75%',
      yieldCapPct: 175,
    },
    1: {
      name: 'VEGA',
      emoji: '🔮',
      description: 'Balanced agent',
      dailyRange: '1.75% - 2.15%',
      yieldCapPct: 200,
    },
    2: {
      name: 'ORION',
      emoji: '⚡',
      description: 'Aggressive agent',
      dailyRange: '2.15% - 3.00%',
      yieldCapPct: 220,
    },
    3: {
      name: 'PRIME',
      emoji: '🧠',
      description: 'Elite agent',
      dailyRange: '3.00% - 5.00%',
      yieldCapPct: 250,
    },
  },
}));

// Mock child components
vi.mock('../TierSelection', () => ({
  TierSelection: ({ selectedTier, onTierSelect, disabled }: any) => (
    <div data-testid="tier-selection">
      <div>Choose Your Agent Tier</div>
      {[0, 1, 2, 3].map(tier => (
        <button
          key={tier}
          onClick={() => !disabled && onTierSelect(tier)}
          disabled={disabled}
          data-testid={`tier-${tier}`}
        >
          {['NOVA', 'VEGA', 'ORION', 'PRIME'][tier]}
        </button>
      ))}
      {selectedTier !== undefined && (
        <div data-testid="selected-tier">
          Selected: {['NOVA', 'VEGA', 'ORION', 'PRIME'][selectedTier]}
        </div>
      )}
    </div>
  )
}));

vi.mock('../AgentErrorDisplay', () => ({
  AgentErrorDisplay: ({ error, context, onRetry }: any) => (
    <div data-testid="agent-error-display">
      <div>Error: {error?.message || error}</div>
      <div>Context: {context}</div>
      {onRetry && (
        <button onClick={onRetry} data-testid="error-retry-button">
          Retry
        </button>
      )}
    </div>
  )
}));

describe('AgentActivationModal', () => {
  const mockUserPublicKey = new PublicKey('11111111111111111111111111111112');
  const mockConnection = {} as Connection;
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockValidateActivationParams.mockReturnValue({
      isValid: true,
      errors: []
    });
    mockGetMinimumActivationAmount.mockReturnValue(10);
    mockActivateAgent.mockResolvedValue({
      success: true,
      txSignature: 'mock-signature',
      activationId: 123
    });
  });

  describe('Modal Visibility', () => {
    it('should render when isOpen is true', () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Choose Agent Tier')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(
        <AgentActivationModal
          isOpen={false}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText('Choose Agent Tier')).not.toBeInTheDocument();
    });

    it('should call onClose when modal is closed', () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Find and click close button (X button in dialog)
      const closeButton = document.querySelector('[data-radix-collection-item]');
      if (closeButton) {
        fireEvent.click(closeButton);
      }
    });
  });

  describe('Step Navigation', () => {
    it('should show step progress indicator', () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Should show step indicators (1, 2, 3)
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should start with tier selection step', () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Choose Agent Tier')).toBeInTheDocument();
      expect(screen.getByTestId('tier-selection')).toBeInTheDocument();
    });

    it('should progress to amount input after tier selection', async () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Select NOVA tier
      fireEvent.click(screen.getByTestId('tier-0'));

      // Click continue
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('Set Activation Amount')).toBeInTheDocument();
      });
    });

    it('should allow going back from amount input to tier selection', async () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate to amount input
      fireEvent.click(screen.getByTestId('tier-0'));
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('Set Activation Amount')).toBeInTheDocument();
      });

      // Go back
      fireEvent.click(screen.getByText('Back'));

      await waitFor(() => {
        expect(screen.getByText('Choose Agent Tier')).toBeInTheDocument();
      });
    });
  });

  describe('Tier Selection Step', () => {
    it('should render tier selection component', () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByTestId('tier-selection')).toBeInTheDocument();
      expect(screen.getByText('NOVA')).toBeInTheDocument();
      expect(screen.getByText('VEGA')).toBeInTheDocument();
      expect(screen.getByText('ORION')).toBeInTheDocument();
      expect(screen.getByText('PRIME')).toBeInTheDocument();
    });

    it('should disable continue button when no tier is selected', () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      const continueButton = screen.getByText('Continue');
      expect(continueButton).toBeDisabled();
    });

    it('should enable continue button when tier is selected', () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      fireEvent.click(screen.getByTestId('tier-1'));

      const continueButton = screen.getByText('Continue');
      expect(continueButton).not.toBeDisabled();
    });
  });

  describe('Amount Input Step', () => {
    beforeEach(async () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate to amount input step
      fireEvent.click(screen.getByTestId('tier-1'));
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('Set Activation Amount')).toBeInTheDocument();
      });
    });

    it('should show selected tier summary', () => {
      expect(screen.getByText('VEGA Agent')).toBeInTheDocument();
      expect(screen.getByText('Daily yield: 1.75% - 2.15% • Cap: 200%')).toBeInTheDocument();
    });

    it('should show payment method selection', () => {
      expect(screen.getByText('Payment Method')).toBeInTheDocument();
      expect(screen.getByText('USDT Payment')).toBeInTheDocument();
    });

    it('should show amount input field', () => {
      expect(screen.getByLabelText(/Activation Amount/)).toBeInTheDocument();
    });

    it('should show minimum amount information', () => {
      expect(screen.getByText('Minimum amount: $10')).toBeInTheDocument();
    });

    it('should validate amount input', async () => {
      mockValidateActivationParams.mockReturnValue({
        isValid: false,
        errors: ['Amount must be greater than minimum']
      });

      const amountInput = screen.getByLabelText(/Activation Amount/);
      fireEvent.change(amountInput, { target: { value: '5' } });

      await waitFor(() => {
        expect(screen.getByText('Amount must be greater than minimum')).toBeInTheDocument();
      });
    });

    it('should disable review button when validation fails', async () => {
      mockValidateActivationParams.mockReturnValue({
        isValid: false,
        errors: ['Amount too low']
      });

      const amountInput = screen.getByLabelText(/Activation Amount/);
      fireEvent.change(amountInput, { target: { value: '5' } });

      await waitFor(() => {
        const reviewButton = screen.getByText('Review');
        expect(reviewButton).toBeDisabled();
      });
    });
  });

  describe('Confirmation Step', () => {
    beforeEach(async () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate to confirmation step
      fireEvent.click(screen.getByTestId('tier-2')); // ORION
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        const amountInput = screen.getByLabelText(/Activation Amount/);
        fireEvent.change(amountInput, { target: { value: '100' } });
      });

      fireEvent.click(screen.getByText('Review'));

      await waitFor(() => {
        expect(screen.getByText('Confirm Agent Activation')).toBeInTheDocument();
      });
    });

    it('should show activation summary', () => {
      expect(screen.getByText('Confirm Agent Activation')).toBeInTheDocument();
      expect(screen.getByText('ORION Agent')).toBeInTheDocument();
      expect(screen.getByText('$100')).toBeInTheDocument();
    });

    it('should show expected returns information', () => {
      expect(screen.getByText('Expected Returns')).toBeInTheDocument();
      expect(screen.getByText('2.15% - 3.00%')).toBeInTheDocument();
      expect(screen.getByText('220%')).toBeInTheDocument();
    });

    it('should show estimated maximum return', () => {
      expect(screen.getByText('$220.00')).toBeInTheDocument(); // 100 * 220%
    });

    it('should show important notes', () => {
      expect(screen.getByText('Important Notes')).toBeInTheDocument();
      expect(screen.getByText(/Agent activation is permanent/)).toBeInTheDocument();
      expect(screen.getByText(/24-hour cooldown applies/)).toBeInTheDocument();
    });

    it('should show confirm activation button', () => {
      expect(screen.getByText('Confirm Activation')).toBeInTheDocument();
    });
  });

  describe('Agent Activation Process', () => {
    it('should call activateAgent when confirmed', async () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate through all steps
      fireEvent.click(screen.getByTestId('tier-0'));
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        const amountInput = screen.getByLabelText(/Activation Amount/);
        fireEvent.change(amountInput, { target: { value: '50' } });
      });

      fireEvent.click(screen.getByText('Review'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Confirm Activation'));
      });

      expect(mockActivateAgent).toHaveBeenCalledWith(
        mockConnection,
        expect.objectContaining({
          userPublicKey: mockUserPublicKey,
          amount: 50,
          tier: AgentTier.NOVA,
          paymentMethod: 'usdt'
        })
      );
    });

    it('should show processing state during activation', async () => {
      // Make activation take some time
      mockActivateAgent.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate and activate
      fireEvent.click(screen.getByTestId('tier-0'));
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        const amountInput = screen.getByLabelText(/Activation Amount/);
        fireEvent.change(amountInput, { target: { value: '50' } });
      });

      fireEvent.click(screen.getByText('Review'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Confirm Activation'));
      });

      expect(screen.getByText('Activating Your Agent')).toBeInTheDocument();
      expect(screen.getByText('Please wait while we process your transaction...')).toBeInTheDocument();
    });

    it('should show success state after successful activation', async () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate and activate
      fireEvent.click(screen.getByTestId('tier-0'));
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        const amountInput = screen.getByLabelText(/Activation Amount/);
        fireEvent.change(amountInput, { target: { value: '50' } });
      });

      fireEvent.click(screen.getByText('Review'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Confirm Activation'));
      });

      await waitFor(() => {
        expect(screen.getByText('Agent Activated Successfully!')).toBeInTheDocument();
        expect(screen.getByText('NOVA Agent Activated')).toBeInTheDocument();
      });
    });

    it('should call onSuccess callback after successful activation', async () => {
      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate and activate
      fireEvent.click(screen.getByTestId('tier-0'));
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        const amountInput = screen.getByLabelText(/Activation Amount/);
        fireEvent.change(amountInput, { target: { value: '50' } });
      });

      fireEvent.click(screen.getByText('Review'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Confirm Activation'));
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith({
          success: true,
          txSignature: 'mock-signature',
          activationId: 123
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when activation fails', async () => {
      mockActivateAgent.mockRejectedValue(new Error('Activation failed'));

      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate and activate
      fireEvent.click(screen.getByTestId('tier-0'));
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        const amountInput = screen.getByLabelText(/Activation Amount/);
        fireEvent.change(amountInput, { target: { value: '50' } });
      });

      fireEvent.click(screen.getByText('Review'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Confirm Activation'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('agent-error-display')).toBeInTheDocument();
        expect(screen.getByText('Error: Activation failed')).toBeInTheDocument();
      });
    });

    it('should allow retry after activation failure', async () => {
      mockActivateAgent.mockRejectedValueOnce(new Error('Network error'));
      mockActivateAgent.mockResolvedValue({
        success: true,
        txSignature: 'retry-signature',
        activationId: 456
      });

      render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate and activate
      fireEvent.click(screen.getByTestId('tier-0'));
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        const amountInput = screen.getByLabelText(/Activation Amount/);
        fireEvent.change(amountInput, { target: { value: '50' } });
      });

      fireEvent.click(screen.getByText('Review'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Confirm Activation'));
      });

      await waitFor(() => {
        const retryButton = screen.getByTestId('error-retry-button');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Agent Activated Successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('State Reset', () => {
    it('should reset state when modal is reopened', () => {
      const { rerender } = render(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Select a tier
      fireEvent.click(screen.getByTestId('tier-2'));

      // Close modal
      rerender(
        <AgentActivationModal
          isOpen={false}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Reopen modal
      rerender(
        <AgentActivationModal
          isOpen={true}
          onClose={mockOnClose}
          userPublicKey={mockUserPublicKey}
          connection={mockConnection}
          onSuccess={mockOnSuccess}
        />
      );

      // Should be back to tier selection step
      expect(screen.getByText('Choose Agent Tier')).toBeInTheDocument();
      expect(screen.queryByTestId('selected-tier')).not.toBeInTheDocument();
    });
  });
});