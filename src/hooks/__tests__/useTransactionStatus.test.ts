/**
 * Transaction Status Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTransactionStatus } from '../useTransactionStatus';

describe('useTransactionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useTransactionStatus());

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('should execute transaction successfully', async () => {
    const onSuccess = vi.fn();
    const mockTransaction = vi.fn().mockResolvedValue('tx-signature-123456789012345678901234567890123456789012345');

    const { result } = renderHook(() => 
      useTransactionStatus({ onSuccess })
    );

    await act(async () => {
      await result.current.executeTransaction(mockTransaction, 'Test transaction');
    });

    expect(result.current.state.status).toBe('success');
    expect(result.current.state.signature).toBe('tx-signature-123456789012345678901234567890123456789012345');
    expect(onSuccess).toHaveBeenCalledWith('tx-signature-123456789012345678901234567890123456789012345');
  });

  it('should handle transaction errors', async () => {
    const onError = vi.fn();
    const mockError = new Error('Transaction failed');
    const mockTransaction = vi.fn().mockRejectedValue(mockError);

    const { result } = renderHook(() => 
      useTransactionStatus({ onError })
    );

    await act(async () => {
      await result.current.executeTransaction(mockTransaction, 'Test transaction');
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBeDefined();
    expect(onError).toHaveBeenCalled();
  });

  it('should update progress during transaction', async () => {
    const onProgress = vi.fn();
    const mockTransaction = vi.fn().mockResolvedValue('tx-signature-123');

    const { result } = renderHook(() => 
      useTransactionStatus({ onProgress })
    );

    await act(async () => {
      await result.current.executeTransaction(mockTransaction, 'Test transaction');
    });

    expect(onProgress).toHaveBeenCalledWith(expect.any(Number), expect.any(String));
  });

  it('should reset state correctly', () => {
    const { result } = renderHook(() => useTransactionStatus());

    act(() => {
      result.current.setError(new Error('Test error'));
    });

    expect(result.current.state.status).toBe('error');

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.error).toBeUndefined();
  });

  it('should update step status', () => {
    const { result } = renderHook(() => useTransactionStatus({
      steps: [
        { id: 'step1', label: 'Step 1' },
        { id: 'step2', label: 'Step 2' },
      ]
    }));

    act(() => {
      result.current.updateStep('step1', 'active', 'Processing step 1');
    });

    const step1 = result.current.state.steps.find(s => s.id === 'step1');
    expect(step1?.status).toBe('active');
    expect(step1?.message).toBe('Processing step 1');
  });

  it('should handle retry functionality', async () => {
    const mockTransaction = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('tx-signature-123');

    const { result } = renderHook(() => 
      useTransactionStatus({ maxRetries: 2 })
    );

    // First attempt should fail
    await act(async () => {
      await result.current.executeTransaction(mockTransaction, 'Test transaction');
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.canRetry).toBe(true);

    // Retry should succeed
    await act(async () => {
      await result.current.retry(mockTransaction, 'Test transaction');
    });

    expect(result.current.state.status).toBe('success');
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });
});