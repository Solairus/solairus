/**
 * Admin Error Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminErrorHandler, useAdminErrorHandler } from '../admin-error-handler';
import { renderHook } from '@testing-library/react';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('AdminErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseError', () => {
    it('should parse network errors correctly', () => {
      const error = new Error('Network connection failed');
      const result = AdminErrorHandler.parseError(error);

      expect(result.type).toBe('network');
      expect(result.isRetryable).toBe(true);
      expect(result.message).toContain('Network connection error');
    });

    it('should parse authorization errors correctly', () => {
      const error = new Error('Error Number: 6000');
      const result = AdminErrorHandler.parseError(error);

      expect(result.type).toBe('authorization');
      expect(result.code).toBe(6000);
      expect(result.isRetryable).toBe(false);
      expect(result.message).toContain('permission');
    });

    it('should parse validation errors correctly', () => {
      const error = new Error('Invalid amount');
      const result = AdminErrorHandler.parseError(error);

      expect(result.type).toBe('validation');
      expect(result.isRetryable).toBe(false);
    });

    it('should parse transaction errors correctly', () => {
      const error = new Error('Transaction failed');
      const result = AdminErrorHandler.parseError(error);

      expect(result.type).toBe('transaction');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle unknown errors', () => {
      const error = new Error('Some unknown error');
      const result = AdminErrorHandler.parseError(error);

      expect(result.type).toBe('unknown');
      expect(result.isRetryable).toBe(true);
    });

    it('should extract error codes from messages', () => {
      const error = new Error('Anchor error: Error Number: 6001');
      const result = AdminErrorHandler.parseError(error);

      expect(result.code).toBe(6001);
      expect(result.type).toBe('validation');
    });

    it('should include context in error', () => {
      const error = new Error('Test error');
      const context = 'Bucket withdrawal';
      const result = AdminErrorHandler.parseError(error, context);

      expect(result.context).toBe(context);
    });
  });

  describe('isRetryable', () => {
    it('should return false for authorization errors', () => {
      const error = AdminErrorHandler.parseError(new Error('Unauthorized'));
      expect(AdminErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return false for validation errors', () => {
      const error = AdminErrorHandler.parseError(new Error('Invalid amount'));
      expect(AdminErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return true for network errors', () => {
      const error = AdminErrorHandler.parseError(new Error('Network timeout'));
      expect(AdminErrorHandler.isRetryable(error)).toBe(true);
    });
  });

  describe('getDisplayMessage', () => {
    it('should include context in display message', () => {
      const error = AdminErrorHandler.parseError(new Error('Test error'), 'Test context');
      const message = AdminErrorHandler.getDisplayMessage(error);

      expect(message).toBe('Test context: Test error');
    });

    it('should return message without context when not provided', () => {
      const error = AdminErrorHandler.parseError(new Error('Test error'));
      const message = AdminErrorHandler.getDisplayMessage(error);

      expect(message).toBe('Test error');
    });
  });
});

describe('useAdminErrorHandler', () => {
  it('should provide error handling functions', () => {
    const { result } = renderHook(() => useAdminErrorHandler());

    expect(result.current.handleError).toBeDefined();
    expect(result.current.showError).toBeDefined();
    expect(result.current.showSuccess).toBeDefined();
    expect(result.current.getErrorMessage).toBeDefined();
    expect(result.current.isRetryable).toBeDefined();
    expect(result.current.getRetryGuidance).toBeDefined();
  });

  it('should handle errors and return parsed error', () => {
    const { result } = renderHook(() => useAdminErrorHandler());
    const error = new Error('Test error');
    
    const adminError = result.current.handleError(error, 'Test context');

    expect(adminError.type).toBe('unknown');
    expect(adminError.context).toBe('Test context');
    expect(adminError.originalError).toBe(error);
  });
});