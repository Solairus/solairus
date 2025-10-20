/**
 * Tests for Agent Error Handler
 * 
 * This test suite validates the comprehensive error handling system for AI agent operations.
 * It covers error parsing, categorization, user-friendly messaging, and retry logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentErrorHandler, AGENT_ERROR_CODES, useAgentErrorHandler } from '../agent-error-handler';
import { AgentData } from '@/services/agent/agent-service';
import { renderHook } from '@testing-library/react';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe('AgentErrorHandler', () => {
  let mockAgent: AgentData;

  beforeEach(() => {
    vi.clearAllMocks();
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
      tierConfig: {
        name: 'VEGA',
        emoji: '🔮',
        dailyRange: '1.75% - 2.15%',
        yieldCapPct: 200,
        minYieldBps: 175,
        maxYieldBps: 215
      },
      accountData: {} as any
    };
  });

  describe('parseError', () => {
    it('should parse network errors correctly', () => {
      const error = new Error('Network connection failed');
      const result = AgentErrorHandler.parseError(error, 'test context');

      expect(result.type).toBe('network');
      expect(result.message).toContain('Network connection error');
      expect(result.isRetryable).toBe(true);
      expect(result.context).toBe('test context');
    });

    it('should parse RPC rate limiting errors', () => {
      const error = new Error('429 Too Many Requests');
      const result = AgentErrorHandler.parseError(error);

      expect(result.type).toBe('network');
      expect(result.code).toBe(429);
      expect(result.message).toContain('Network is busy');
      expect(result.retryDelay).toBe(30);
      expect(result.isRetryable).toBe(true);
    });

    it('should parse invalid tier errors', () => {
      const error = new Error('Error Number: 6015');
      const result = AgentErrorHandler.parseError(error, 'activation', mockAgent);

      expect(result.type).toBe('validation');
      expect(result.code).toBe(AGENT_ERROR_CODES.INVALID_TIER);
      expect(result.message).toContain('Invalid agent tier');
      expect(result.isRetryable).toBe(false);
    });

    it('should parse agent retired errors with agent context', () => {
      const error = new Error('Agent retired - yield cap reached');
      const result = AgentErrorHandler.parseError(error, 'withdrawal', mockAgent);

      expect(result.type).toBe('limits');
      expect(result.message).toContain('VEGA agent has reached its 200% yield cap');
      expect(result.isRetryable).toBe(false);
      expect(result.agent).toBe(mockAgent);
    });

    it('should parse withdrawal timing errors with retry delay', () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const agentWithTiming = {
        ...mockAgent,
        nextWithdrawalAt: futureDate
      };

      const error = new Error('WithdrawalTooEarly - 24 hour cooldown required');
      const result = AgentErrorHandler.parseError(error, 'withdrawal', agentWithTiming);

      expect(result.type).toBe('timing');
      expect(result.isRetryable).toBe(true);
      expect(result.retryDelay).toBeGreaterThan(0);
    });

    it('should parse global withdrawal limit errors', () => {
      const error = new Error('GlobalWithdrawalLimitReached - 200x deposits exceeded');
      const result = AgentErrorHandler.parseError(error);

      expect(result.type).toBe('limits');
      expect(result.message).toContain('200x your total deposits');
      expect(result.isRetryable).toBe(false);
    });

    it('should parse insufficient system reserve errors', () => {
      const error = new Error('InsufficientSystemReserve');
      const result = AgentErrorHandler.parseError(error);

      expect(result.type).toBe('contract');
      expect(result.message).toContain('System reserves are temporarily low');
      expect(result.isRetryable).toBe(true);
      expect(result.retryDelay).toBe(300); // 5 minutes
    });

    it('should parse user rejection errors', () => {
      const error = new Error('User rejected the transaction');
      const result = AgentErrorHandler.parseError(error);

      expect(result.type).toBe('transaction');
      expect(result.message).toContain('cancelled by user');
      expect(result.isRetryable).toBe(true);
    });

    it('should parse seeds constraint errors', () => {
      const error = new Error('ConstraintSeeds violation - error number: 2006');
      const result = AgentErrorHandler.parseError(error);

      expect(result.type).toBe('contract');
      expect(result.code).toBe(AGENT_ERROR_CODES.SEEDS_CONSTRAINT);
      expect(result.message).toContain('Account verification failed');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle unknown errors gracefully', () => {
      const error = new Error('Some unexpected error');
      const result = AgentErrorHandler.parseError(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Some unexpected error');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('extractErrorCode', () => {
    it('should extract decimal error codes', () => {
      const error = 'Error Number: 6015';
      const result = AgentErrorHandler.parseError(error);
      expect(result.code).toBe(6015);
    });

    it('should extract hex error codes', () => {
      const error = 'Program error: 0x177f';
      const result = AgentErrorHandler.parseError(error);
      expect(result.code).toBe(6015); // 0x177f = 6015
    });

    it('should handle missing error codes', () => {
      const error = 'Generic error message';
      const result = AgentErrorHandler.parseError(error);
      expect(result.code).toBeUndefined();
    });
  });

  describe('getDisplayMessage', () => {
    it('should format message with context', () => {
      const error = AgentErrorHandler.parseError('Test error', 'ROI withdrawal');
      const message = AgentErrorHandler.getDisplayMessage(error);
      expect(message).toBe('ROI withdrawal: Test error');
    });

    it('should format message without context', () => {
      const error = AgentErrorHandler.parseError('Test error');
      const message = AgentErrorHandler.getDisplayMessage(error);
      expect(message).toBe('Test error');
    });
  });

  describe('getRetryGuidance', () => {
    it('should provide timing-specific guidance', () => {
      const error = AgentErrorHandler.parseError('WithdrawalTooEarly', 'withdrawal', {
        ...mockAgent,
        nextWithdrawalAt: new Date(Date.now() + 30 * 60 * 1000)
      });
      const guidance = AgentErrorHandler.getRetryGuidance(error);
      expect(guidance).toContain('Wait 30 minutes');
    });

    it('should indicate non-retryable errors', () => {
      const error = AgentErrorHandler.parseError('AgentRetired');
      const guidance = AgentErrorHandler.getRetryGuidance(error);
      expect(guidance).toContain('Consider activating a new agent');
    });
  });

  describe('getRetryButtonText', () => {
    it('should show timing for timing errors', () => {
      const error = AgentErrorHandler.parseError('WithdrawalTooEarly', 'withdrawal', {
        ...mockAgent,
        nextWithdrawalAt: new Date(Date.now() + 30 * 60 * 1000)
      });
      const buttonText = AgentErrorHandler.getRetryButtonText(error);
      expect(buttonText).toContain('Retry in');
    });

    it('should show appropriate text for network errors', () => {
      const error = AgentErrorHandler.parseError('Network error');
      const buttonText = AgentErrorHandler.getRetryButtonText(error);
      expect(buttonText).toBe('Retry');
    });

    it('should show cannot retry for non-retryable errors', () => {
      const error = AgentErrorHandler.parseError('AgentRetired');
      const buttonText = AgentErrorHandler.getRetryButtonText(error);
      expect(buttonText).toBe('Cannot retry');
    });
  });

  describe('showErrorToast', () => {
    it('should call toast.error with correct parameters', async () => {
      const { toast } = await import('sonner');
      const error = AgentErrorHandler.parseError('Test error', 'test context');
      
      AgentErrorHandler.showErrorToast(error, {
        showRetry: true,
        onRetry: vi.fn(),
        duration: 5000
      });

      expect(toast.error).toHaveBeenCalledWith(
        'test context: Test error',
        expect.objectContaining({
          description: expect.any(String),
          duration: 5000,
          action: expect.objectContaining({
            label: expect.any(String),
            onClick: expect.any(Function)
          })
        })
      );
    });

    it('should use appropriate duration for different error types', async () => {
      const { toast } = await import('sonner');
      
      // Timing error should have longer duration
      const timingError = AgentErrorHandler.parseError('WithdrawalTooEarly');
      AgentErrorHandler.showErrorToast(timingError);
      expect(toast.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ duration: 8000 })
      );

      // Limit error should have longer duration
      const limitError = AgentErrorHandler.parseError('GlobalWithdrawalLimitReached');
      AgentErrorHandler.showErrorToast(limitError);
      expect(toast.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ duration: 10000 })
      );
    });
  });

  describe('showSuccessToast', () => {
    it('should call toast.success with agent context', async () => {
      const { toast } = await import('sonner');
      
      AgentErrorHandler.showSuccessToast('Operation successful', {
        agent: mockAgent
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Operation successful',
        expect.objectContaining({
          description: 'VEGA agent operation completed successfully',
          duration: 4000
        })
      );
    });
  });
});

describe('useAgentErrorHandler hook', () => {
  let mockAgent: AgentData;

  beforeEach(() => {
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
      tierConfig: {
        name: 'VEGA',
        emoji: '🔮',
        dailyRange: '1.75% - 2.15%',
        yieldCapPct: 200,
        minYieldBps: 175,
        maxYieldBps: 215
      },
      accountData: {} as any
    };
  });

  it('should provide error handling functions', () => {
    const { result } = renderHook(() => useAgentErrorHandler());

    expect(result.current.handleError).toBeInstanceOf(Function);
    expect(result.current.showError).toBeInstanceOf(Function);
    expect(result.current.showSuccess).toBeInstanceOf(Function);
    expect(result.current.getErrorMessage).toBeInstanceOf(Function);
    expect(result.current.getRetryGuidance).toBeInstanceOf(Function);
    expect(result.current.isRetryable).toBeInstanceOf(Function);
    expect(result.current.getRetryDelay).toBeInstanceOf(Function);
  });

  it('should handle errors and return parsed error', () => {
    const { result } = renderHook(() => useAgentErrorHandler());
    const error = new Error('Test error');
    
    const parsedError = result.current.handleError(error, 'test context');
    
    expect(parsedError.type).toBe('unknown');
    expect(parsedError.message).toBe('Test error');
    expect(parsedError.context).toBe('test context');
  });

  it('should determine if error is retryable', () => {
    const { result } = renderHook(() => useAgentErrorHandler());
    
    const retryableError = new Error('Network error');
    const nonRetryableError = new Error('AgentRetired');
    
    expect(result.current.isRetryable(retryableError)).toBe(true);
    expect(result.current.isRetryable(nonRetryableError)).toBe(false);
  });

  it('should get retry delay for timing errors', () => {
    const { result } = renderHook(() => useAgentErrorHandler());
    
    const agentWithDelay = {
      ...mockAgent,
      nextWithdrawalAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    };
    
    const timingError = new Error('WithdrawalTooEarly');
    const delay = result.current.getRetryDelay(timingError, agentWithDelay);
    
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(30 * 60); // Should be around 30 minutes in seconds
  });
});

describe('Error Code Constants', () => {
  it('should have all required agent error codes', () => {
    expect(AGENT_ERROR_CODES.INVALID_TIER).toBe(6015);
    expect(AGENT_ERROR_CODES.AGENT_RETIRED).toBe(6016);
    expect(AGENT_ERROR_CODES.WITHDRAWAL_TOO_EARLY).toBe(6017);
    expect(AGENT_ERROR_CODES.GLOBAL_WITHDRAWAL_LIMIT_REACHED).toBe(6018);
    expect(AGENT_ERROR_CODES.AGENT_NOT_FOUND).toBe(6019);
    expect(AGENT_ERROR_CODES.INSUFFICIENT_SYSTEM_RESERVE).toBe(6020);
    expect(AGENT_ERROR_CODES.UNAUTHORIZED).toBe(6000);
    expect(AGENT_ERROR_CODES.MATH_OVERFLOW).toBe(6003);
    expect(AGENT_ERROR_CODES.INVALID_AMOUNT).toBe(6004);
    expect(AGENT_ERROR_CODES.INSUFFICIENT_FUNDS).toBe(6006);
    expect(AGENT_ERROR_CODES.SEEDS_CONSTRAINT).toBe(2006);
  });
});

describe('Integration with Agent Context', () => {
  let mockAgent: AgentData;

  beforeEach(() => {
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
      tierConfig: {
        name: 'VEGA',
        emoji: '🔮',
        dailyRange: '1.75% - 2.15%',
        yieldCapPct: 200,
        minYieldBps: 175,
        maxYieldBps: 215
      },
      accountData: {} as unknown
    };
  });

  it('should provide agent-specific error messages', () => {
    const primeAgent = {
      ...mockAgent,
      tier: 3, // PRIME
      tierConfig: {
        ...mockAgent.tierConfig,
        name: 'PRIME',
        yieldCapPct: 250
      }
    };

    const error = new Error('AgentRetired');
    const result = AgentErrorHandler.parseError(error, 'withdrawal', primeAgent);

    expect(result.message).toContain('PRIME agent has reached its 250% yield cap');
  });

  it('should handle first withdrawal timing differently', () => {
    const newAgent = {
      ...mockAgent,
      lastRoiWithdrawal: null // No previous withdrawal
    };

    const error = new Error('WithdrawalTooEarly');
    const result = AgentErrorHandler.parseError(error, 'withdrawal', newAgent);

    expect(result.message).toContain('New agents must wait 24 hours after activation');
  });

  it('should handle subsequent withdrawal timing', () => {
    const error = new Error('WithdrawalTooEarly');
    const result = AgentErrorHandler.parseError(error, 'withdrawal', mockAgent);

    expect(result.message).toContain('Each agent has a 24-hour cooldown');
  });
});