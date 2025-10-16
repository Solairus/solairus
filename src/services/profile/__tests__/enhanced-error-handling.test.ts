/**
 * Enhanced Error Handling Tests
 * 
 * Tests for the enhanced error types, diagnostics, and integration utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { 
  ProfileErrorFactory, 
  ProfileErrorFormatter,
  ProfileErrorUtils,
  ProfileErrorType,
  EnhancedProfileError 
} from '../profile-error-types';

describe('Enhanced Profile Error Handling', () => {
  describe('ProfileErrorFactory', () => {
    it('should create standardized profile errors', () => {
      const error = ProfileErrorFactory.createError('account_not_found', {
        accountAddress: 'test-address',
        suggestedFix: 'Complete registration',
      });

      expect(error.type).toBe('account_not_found');
      expect(error.code).toBe('PROFILE_001');
      expect(error.isRecoverable).toBe(true);
      expect(error.retryable).toBe(false);
      expect(error.severity).toBe('low');
      expect(error.technicalDetails.accountAddress).toBe('test-address');
      expect(error.suggestedActions.primary).toBe('Complete user registration to create profile account');
    });

    it('should create errors from exceptions', () => {
      const testError = new Error('Account does not exist');
      const profileError = ProfileErrorFactory.fromException(testError);

      expect(profileError.type).toBe('account_not_found');
      expect(profileError.message).toContain('User profile account does not exist');
      expect(profileError.technicalDetails.stackTrace).toBeDefined();
    });

    it('should create account-specific errors', () => {
      const userPubkey = new PublicKey('11111111111111111111111111111112');
      const error = ProfileErrorFactory.createAccountError(
        'deserialization_failed',
        'test-account-address',
        userPubkey
      );

      expect(error.type).toBe('deserialization_failed');
      expect(error.technicalDetails.accountAddress).toBe('test-account-address');
      expect(error.context?.userPubkey).toBe(userPubkey.toString());
    });
  });

  describe('ProfileErrorFormatter', () => {
    let testError: EnhancedProfileError;

    beforeEach(() => {
      testError = ProfileErrorFactory.createError('size_mismatch', {
        accountAddress: 'test-address',
      });
    });

    it('should format errors for user display', () => {
      const formatted = ProfileErrorFormatter.formatForUser(testError);

      expect(formatted.title).toBe('Profile Update Required');
      expect(formatted.message).toBe('Your profile needs to be updated for the latest version.');
      expect(formatted.actions).toContain('Close existing account and recreate with correct size');
      expect(formatted.severity).toBe('high');
    });

    it('should format errors for technical logging', () => {
      const formatted = ProfileErrorFormatter.formatForLogging(testError);

      expect(formatted.level).toBe('error');
      expect(formatted.message).toContain('PROFILE_003');
      expect(formatted.details.type).toBe('size_mismatch');
      expect(formatted.details.isRecoverable).toBe(true);
    });
  });

  describe('ProfileErrorUtils', () => {
    let recoverableError: EnhancedProfileError;
    let nonRecoverableError: EnhancedProfileError;

    beforeEach(() => {
      recoverableError = ProfileErrorFactory.createError('deserialization_failed');
      nonRecoverableError = ProfileErrorFactory.createError('owner_mismatch');
    });

    it('should correctly identify retryable errors', () => {
      expect(ProfileErrorUtils.isRetryable(recoverableError)).toBe(false);
      expect(ProfileErrorUtils.isRetryable(nonRecoverableError)).toBe(false);
    });

    it('should correctly identify recoverable errors', () => {
      expect(ProfileErrorUtils.isRecoverable(recoverableError)).toBe(true);
      expect(ProfileErrorUtils.isRecoverable(nonRecoverableError)).toBe(false);
    });

    it('should calculate retry delays with exponential backoff', () => {
      const delay1 = ProfileErrorUtils.getRetryDelay(recoverableError, 1);
      const delay2 = ProfileErrorUtils.getRetryDelay(recoverableError, 2);
      const delay3 = ProfileErrorUtils.getRetryDelay(recoverableError, 3);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay3).toBeLessThanOrEqual(30000); // Max delay
    });

    it('should identify errors requiring user attention', () => {
      expect(ProfileErrorUtils.requiresUserAttention(nonRecoverableError)).toBe(true);
      expect(ProfileErrorUtils.requiresUserAttention(recoverableError)).toBe(false);
    });

    it('should calculate error priorities correctly', () => {
      const criticalPriority = ProfileErrorUtils.getErrorPriority(nonRecoverableError);
      const highPriority = ProfileErrorUtils.getErrorPriority(recoverableError);

      expect(criticalPriority).toBeGreaterThan(highPriority);
    });
  });

  describe('Error Classification', () => {
    it('should classify different error types correctly', () => {
      const errorTypes: ProfileErrorType[] = [
        'account_not_found',
        'deserialization_failed',
        'size_mismatch',
        'data_corruption',
        'owner_mismatch',
        'invalid_structure',
        'pda_derivation_failed',
        'network_error',
        'insufficient_funds',
        'program_error',
        'validation_failed',
        'recovery_failed',
        'timeout_error',
        'unknown_error',
      ];

      errorTypes.forEach(type => {
        const error = ProfileErrorFactory.createError(type);
        
        expect(error.type).toBe(type);
        expect(error.code).toMatch(/^PROFILE_\d+$/);
        expect(error.message).toBeTruthy();
        expect(error.userMessage).toBeTruthy();
        expect(error.technicalDetails.suggestedFix).toBeTruthy();
        expect(error.classification).toBeDefined();
        expect(error.suggestedActions).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(error.severity);
      });
    });

    it('should have consistent error classifications', () => {
      const accountError = ProfileErrorFactory.createError('account_not_found');
      const networkError = ProfileErrorFactory.createError('network_error');
      const programError = ProfileErrorFactory.createError('program_error');

      expect(accountError.classification.category).toBe('account');
      expect(networkError.classification.category).toBe('network');
      expect(programError.classification.category).toBe('program');

      expect(accountError.classification.canAutoRecover).toBe(true);
      expect(networkError.classification.canAutoRecover).toBe(false);
    });
  });

  describe('Error Context', () => {
    it('should include proper context information', () => {
      const context = {
        userPubkey: 'test-user',
        operation: 'test-operation',
        attemptCount: 2,
        environment: 'development' as const,
        walletType: 'Phantom',
      };

      const error = ProfileErrorFactory.createError('network_error', {}, context);

      expect(error.context?.userPubkey).toBe('test-user');
      expect(error.context?.operation).toBe('test-operation');
      expect(error.context?.attemptCount).toBe(2);
      expect(error.context?.environment).toBe('development');
      expect(error.context?.walletType).toBe('Phantom');
    });
  });
});