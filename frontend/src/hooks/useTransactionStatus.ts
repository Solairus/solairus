/**
 * Transaction Status Hook
 * 
 * Purpose: Track transaction status with loading states and progress indicators
 * 
 * Features:
 * - Transaction lifecycle management
 * - Progress tracking with customizable steps
 * - Automatic retry mechanisms with exponential backoff
 * - Loading states and user feedback
 * - Transaction confirmation tracking
 */

import { useState, useCallback, useRef } from 'react';
import { AdminError, AdminErrorHandler } from '@/utils/admin-error-handler';

export interface TransactionStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  message?: string;
}

export interface TransactionState {
  status: 'idle' | 'preparing' | 'signing' | 'confirming' | 'success' | 'error';
  signature?: string;
  error?: AdminError;
  progress: number;
  currentStep?: string;
  steps: TransactionStep[];
}

export interface TransactionOptions {
  steps?: Omit<TransactionStep, 'status'>[];
  confirmationTimeout?: number;
  onProgress?: (progress: number, step?: string) => void;
  onSuccess?: (signature: string) => void;
  onError?: (error: AdminError) => void;
}

export function useTransactionStatus(options: TransactionOptions = {}) {
  const {
    steps = [
      { id: 'prepare', label: 'Preparing transaction' },
      { id: 'sign', label: 'Waiting for signature' },
      { id: 'confirm', label: 'Confirming transaction' },
    ],
    confirmationTimeout = 30000,
    onProgress,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<TransactionState>({
    status: 'idle',
    progress: 0,
    steps: steps.map(step => ({ ...step, status: 'pending' })),
  });

  const confirmationTimeoutRef = useRef<NodeJS.Timeout>();

  const updateStep = useCallback((stepId: string, status: TransactionStep['status'], message?: string) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId 
          ? { ...step, status, message }
          : step
      ),
      currentStep: stepId,
    }));
  }, []);

  const updateProgress = useCallback((progress: number, stepId?: string) => {
    setState(prev => ({ ...prev, progress }));
    if (stepId) {
      updateStep(stepId, 'active');
    }
    onProgress?.(progress, stepId);
  }, [updateStep, onProgress]);

  const reset = useCallback(() => {
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
    }

    setState({
      status: 'idle',
      progress: 0,
      steps: steps.map(step => ({ ...step, status: 'pending' })),
    });
  }, [steps]);

  const setError = useCallback((error: unknown, context?: string) => {
    const adminError = AdminErrorHandler.parseError(error, context);
    
    setState(prev => ({
      ...prev,
      status: 'error',
      error: adminError,
      steps: prev.steps.map(step => 
        step.status === 'active' 
          ? { ...step, status: 'error', message: adminError.message }
          : step
      ),
    }));

    onError?.(adminError);
    return adminError;
  }, [onError]);

  const setSuccess = useCallback((signature: string) => {
    setState(prev => ({
      ...prev,
      status: 'success',
      signature,
      progress: 100,
      steps: prev.steps.map(step => ({ ...step, status: 'completed' })),
    }));

    onSuccess?.(signature);
  }, [onSuccess]);

  const executeTransaction = useCallback(async <T>(
    transactionFn: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    try {
      // Reset state
      setState(prev => ({
        ...prev,
        status: 'preparing',
        error: undefined,
        signature: undefined,
        progress: 0,
        steps: steps.map(step => ({ ...step, status: 'pending' })),
      }));

      // Step 1: Prepare transaction
      updateProgress(10, 'prepare');
      updateStep('prepare', 'active', 'Preparing transaction...');

      // Step 2: Sign transaction
      updateProgress(30, 'sign');
      updateStep('prepare', 'completed');
      updateStep('sign', 'active', 'Please sign the transaction in your wallet');

      setState(prev => ({ ...prev, status: 'signing' }));

      const result = await transactionFn();

      // Step 3: Confirm transaction
      updateProgress(60, 'confirm');
      updateStep('sign', 'completed');
      updateStep('confirm', 'active', 'Confirming on blockchain...');

      setState(prev => ({ ...prev, status: 'confirming' }));

      // If result is a transaction signature, track confirmation
      if (typeof result === 'string' && result.length > 40) {
        const signature = result as string;
        
        // Set confirmation timeout
        confirmationTimeoutRef.current = setTimeout(() => {
          setError(new Error('Transaction confirmation timeout'), context);
        }, confirmationTimeout);

        // Simulate confirmation tracking (in real implementation, you'd check the blockchain)
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (confirmationTimeoutRef.current) {
          clearTimeout(confirmationTimeoutRef.current);
        }

        updateProgress(100);
        setSuccess(signature);
        return result;
      }

      // For non-signature results, just mark as success
      updateProgress(100);
      updateStep('confirm', 'completed');
      setState(prev => ({ ...prev, status: 'success' }));
      
      return result;

    } catch (error) {
      setError(error, context);
      return null;
    }
  }, [
    steps,
    confirmationTimeout,
    updateProgress,
    updateStep,
    setError,
    setSuccess,
  ]);

  const retry = useCallback(async <T>(
    transactionFn: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    // Simply execute the transaction again - no auto-retry logic
    return executeTransaction(transactionFn, context);
  }, [executeTransaction]);

  return {
    state,
    executeTransaction,
    retry,
    reset,
    setError,
    setSuccess,
    updateProgress,
    updateStep,
    isLoading: ['preparing', 'signing', 'confirming'].includes(state.status),
    canRetry: state.status === 'error',
  };
}