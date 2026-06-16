/**
 * Loading State Hook
 * 
 * Purpose: Manage loading states with progress indicators and user feedback
 * 
 * Features:
 * - Multiple concurrent loading operations
 * - Progress tracking with customizable messages
 * - Automatic timeout handling
 * - Loading state composition for complex operations
 * - User-friendly loading messages
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface LoadingOperation {
  id: string;
  message: string;
  progress?: number;
  startTime: number;
  timeout?: number;
}

export interface LoadingState {
  isLoading: boolean;
  operations: Record<string, LoadingOperation>;
  globalMessage?: string;
  globalProgress?: number;
}

export interface LoadingOptions {
  message?: string;
  timeout?: number;
  showProgress?: boolean;
  onTimeout?: (operationId: string) => void;
}

export function useLoadingState() {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    operations: {},
  });

  const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  const startLoading = useCallback((
    operationId: string, 
    options: LoadingOptions = {}
  ) => {
    const {
      message = 'Loading...',
      timeout = 30000, // 30 seconds default
      onTimeout,
    } = options;

    // Clear existing timeout for this operation
    if (timeoutsRef.current[operationId]) {
      clearTimeout(timeoutsRef.current[operationId]);
    }

    const operation: LoadingOperation = {
      id: operationId,
      message,
      startTime: Date.now(),
      timeout,
    };

    setState(prev => ({
      ...prev,
      isLoading: true,
      operations: {
        ...prev.operations,
        [operationId]: operation,
      },
    }));

    // Set timeout if specified
    if (timeout > 0) {
      timeoutsRef.current[operationId] = setTimeout(() => {
        stopLoading(operationId);
        onTimeout?.(operationId);
      }, timeout);
    }
  }, []);

  const stopLoading = useCallback((operationId: string) => {
    // Clear timeout
    if (timeoutsRef.current[operationId]) {
      clearTimeout(timeoutsRef.current[operationId]);
      delete timeoutsRef.current[operationId];
    }

    setState(prev => {
      const newOperations = { ...prev.operations };
      delete newOperations[operationId];

      return {
        ...prev,
        operations: newOperations,
        isLoading: Object.keys(newOperations).length > 0,
      };
    });
  }, []);

  const updateProgress = useCallback((
    operationId: string, 
    progress: number, 
    message?: string
  ) => {
    setState(prev => {
      const operation = prev.operations[operationId];
      if (!operation) return prev;

      return {
        ...prev,
        operations: {
          ...prev.operations,
          [operationId]: {
            ...operation,
            progress: Math.max(0, Math.min(100, progress)),
            message: message || operation.message,
          },
        },
      };
    });
  }, []);

  const setGlobalMessage = useCallback((message?: string) => {
    setState(prev => ({ ...prev, globalMessage: message }));
  }, []);

  const setGlobalProgress = useCallback((progress?: number) => {
    setState(prev => ({ 
      ...prev, 
      globalProgress: progress !== undefined ? Math.max(0, Math.min(100, progress)) : undefined 
    }));
  }, []);

  const clearAll = useCallback(() => {
    // Clear all timeouts
    Object.values(timeoutsRef.current).forEach(timeout => {
      clearTimeout(timeout);
    });
    timeoutsRef.current = {};

    setState({
      isLoading: false,
      operations: {},
      globalMessage: undefined,
      globalProgress: undefined,
    });
  }, []);

  const withLoading = useCallback(async <T>(
    operationId: string,
    asyncFn: () => Promise<T>,
    options: LoadingOptions = {}
  ): Promise<T> => {
    startLoading(operationId, options);
    
    try {
      const result = await asyncFn();
      stopLoading(operationId);
      return result;
    } catch (error) {
      stopLoading(operationId);
      throw error;
    }
  }, [startLoading, stopLoading]);

  // Computed values
  const currentOperations = Object.values(state.operations);
  const primaryOperation = currentOperations[0]; // Most recent operation
  const totalProgress = state.globalProgress ?? (
    currentOperations.length > 0
      ? currentOperations.reduce((sum, op) => sum + (op.progress || 0), 0) / currentOperations.length
      : 0
  );

  const currentMessage = state.globalMessage ?? primaryOperation?.message ?? 'Loading...';

  return {
    // State
    isLoading: state.isLoading,
    operations: currentOperations,
    currentMessage,
    totalProgress,
    operationCount: currentOperations.length,

    // Actions
    startLoading,
    stopLoading,
    updateProgress,
    setGlobalMessage,
    setGlobalProgress,
    clearAll,
    withLoading,

    // Utilities
    isOperationActive: (operationId: string) => operationId in state.operations,
    getOperation: (operationId: string) => state.operations[operationId],
    getElapsedTime: (operationId: string) => {
      const operation = state.operations[operationId];
      return operation ? Date.now() - operation.startTime : 0;
    },
  };
}

/**
 * Specialized hook for form loading states
 */
export function useFormLoadingState() {
  const loading = useLoadingState();

  const submitWithLoading = useCallback(async <T>(
    formId: string,
    submitFn: () => Promise<T>,
    options: LoadingOptions = {}
  ): Promise<T> => {
    const defaultOptions: LoadingOptions = {
      message: 'Submitting form...',
      timeout: 60000, // 1 minute for form submissions
      ...options,
    };

    return loading.withLoading(formId, submitFn, defaultOptions);
  }, [loading]);

  return {
    ...loading,
    submitWithLoading,
    isSubmitting: loading.isLoading,
  };
}

/**
 * Specialized hook for data fetching loading states
 */
export function useDataLoadingState() {
  const loading = useLoadingState();

  const fetchWithLoading = useCallback(async <T>(
    dataId: string,
    fetchFn: () => Promise<T>,
    options: LoadingOptions = {}
  ): Promise<T> => {
    const defaultOptions: LoadingOptions = {
      message: 'Loading data...',
      timeout: 30000, // 30 seconds for data fetching
      ...options,
    };

    return loading.withLoading(dataId, fetchFn, defaultOptions);
  }, [loading]);

  const refreshWithLoading = useCallback(async <T>(
    dataId: string,
    refreshFn: () => Promise<T>,
    options: LoadingOptions = {}
  ): Promise<T> => {
    const defaultOptions: LoadingOptions = {
      message: 'Refreshing data...',
      timeout: 15000, // 15 seconds for refresh
      ...options,
    };

    return loading.withLoading(`refresh-${dataId}`, refreshFn, defaultOptions);
  }, [loading]);

  return {
    ...loading,
    fetchWithLoading,
    refreshWithLoading,
    isFetching: loading.isLoading,
  };
}