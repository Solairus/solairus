import { describe, it, expect, beforeEach } from 'vitest';
import {
  IDLErrorFactory,
  UserFriendlyErrorConverter,
  ErrorDisplayManager,
  ErrorRecoverySystem,
  ERROR_CODES,
  type ErrorCode
} from '../solairus-core';

describe('Error Handling System', () => {
  describe('IDLErrorFactory', () => {
    it('should create specific error types with correct codes', () => {
      const missingAddressError = IDLErrorFactory.createError(ERROR_CODES.MISSING_ADDRESS_FIELD, {});
      expect(missingAddressError.code).toBe(ERROR_CODES.MISSING_ADDRESS_FIELD);
      expect(missingAddressError.name).toBe('IDLMissingAddressError');
      expect(missingAddressError.message).toContain('IDL missing address field');
    });

    it('should create method not found error with available methods', () => {
      const methodError = IDLErrorFactory.createError(ERROR_CODES.METHOD_NOT_FOUND, {
        methodName: 'deposit',
        availableMethods: ['initialize', 'claim', 'withdraw']
      });
      
      expect(methodError.code).toBe(ERROR_CODES.METHOD_NOT_FOUND);
      expect(methodError.name).toBe('MethodNotFoundError');
      expect(methodError.message).toContain('deposit');
    });

    it('should create account validation error with details', () => {
      const accountError = IDLErrorFactory.createError(ERROR_CODES.ACCOUNT_VALIDATION_FAILED, {
        accountName: 'userAta',
        issue: 'account does not exist',
        accountAddress: '11111111111111111111111111111111'
      });
      
      expect(accountError.code).toBe(ERROR_CODES.ACCOUNT_VALIDATION_FAILED);
      expect(accountError.name).toBe('AccountValidationError');
    });

    it('should provide suggested fixes for all error types', () => {
      const errorCodes = Object.values(ERROR_CODES);
      
      errorCodes.forEach(code => {
        const error = IDLErrorFactory.createError(code, {
          methodName: 'test',
          availableMethods: ['test1', 'test2'],
          accountName: 'testAccount',
          issue: 'test issue'
        });
        
        const suggestedFix = IDLErrorFactory.getSuggestedFix(error);
        expect(suggestedFix).toBeTruthy();
        expect(typeof suggestedFix).toBe('string');
        expect(suggestedFix.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Categorization', () => {
    it('should categorize IDL processing errors correctly', () => {
      const idlError = IDLErrorFactory.createError(ERROR_CODES.MISSING_ADDRESS_FIELD, {});
      const category = IDLErrorFactory.categorizeError(idlError);
      
      expect(category.category).toBe('IDL_PROCESSING');
      expect(category.severity).toBe('HIGH');
      expect(category.userActionRequired).toBe(false);
      expect(category.technicalDetails).toBe(true);
    });

    it('should categorize program initialization errors correctly', () => {
      const programError = IDLErrorFactory.createError(ERROR_CODES.PROGRAM_CREATION_FAILED, {
        message: 'Program creation failed'
      });
      const category = IDLErrorFactory.categorizeError(programError);
      
      expect(category.category).toBe('PROGRAM_INITIALIZATION');
      expect(category.severity).toBe('CRITICAL');
      expect(category.userActionRequired).toBe(false);
      expect(category.technicalDetails).toBe(true);
    });

    it('should categorize user-facing errors correctly', () => {
      const walletError = IDLErrorFactory.createError(ERROR_CODES.WALLET_CONNECTION_FAILED, {
        walletType: 'Phantom',
        issue: 'not connected'
      });
      const category = IDLErrorFactory.categorizeError(walletError);
      
      expect(category.category).toBe('WALLET_INTERACTION');
      expect(category.severity).toBe('MEDIUM');
      expect(category.userActionRequired).toBe(true);
      expect(category.technicalDetails).toBe(false);
    });

    it('should categorize balance errors as low severity', () => {
      const balanceError = IDLErrorFactory.createError(ERROR_CODES.INSUFFICIENT_BALANCE, {
        required: '1.0',
        available: '0.5',
        tokenType: 'SOL'
      });
      const category = IDLErrorFactory.categorizeError(balanceError);
      
      expect(category.category).toBe('BALANCE_INSUFFICIENT');
      expect(category.severity).toBe('LOW');
      expect(category.userActionRequired).toBe(true);
      expect(category.technicalDetails).toBe(false);
    });
  });  
describe('UserFriendlyErrorConverter', () => {
    it('should convert technical IDL errors to user-friendly messages', () => {
      const idlError = IDLErrorFactory.createError(ERROR_CODES.MISSING_ADDRESS_FIELD, {});
      const userMessage = UserFriendlyErrorConverter.convertToUserMessage(idlError);
      
      expect(userMessage.title).toBe('Program Configuration Issue');
      expect(userMessage.message).toContain('technical configuration issue');
      expect(userMessage.actionRequired).toContain('refresh the page');
      expect(userMessage.technicalDetails).toBeDefined();
    });

    it('should provide appropriate guidance for wallet errors', () => {
      const walletError = IDLErrorFactory.createError(ERROR_CODES.WALLET_CONNECTION_FAILED, {
        walletType: 'Phantom',
        issue: 'not connected'
      });
      const userMessage = UserFriendlyErrorConverter.convertToUserMessage(walletError);
      
      expect(userMessage.title).toBe('Wallet Connection Issue');
      expect(userMessage.message).toContain('Phantom wallet');
      expect(userMessage.actionRequired).toContain('installed, unlocked, and connected');
    });

    it('should provide specific balance information for insufficient balance errors', () => {
      const balanceError = IDLErrorFactory.createError(ERROR_CODES.INSUFFICIENT_BALANCE, {
        required: '1.5',
        available: '0.8',
        tokenType: 'USDT'
      });
      const userMessage = UserFriendlyErrorConverter.convertToUserMessage(balanceError);
      
      expect(userMessage.title).toBe('Insufficient Balance');
      expect(userMessage.message).toContain('1.5');
      expect(userMessage.message).toContain('0.8');
      expect(userMessage.message).toContain('USDT');
    });

    it('should provide common scenario guidance for program errors', () => {
      const guidance = UserFriendlyErrorConverter.getCommonScenarioGuidance(ERROR_CODES.PROGRAM_CREATION_FAILED);
      
      expect(guidance).toBeTruthy();
      expect(guidance!.scenario).toContain('Program initialization failure');
      expect(guidance!.steps).toContain('Refresh the browser page');
      expect(guidance!.steps.length).toBeGreaterThan(3);
    });

    it('should provide troubleshooting steps for all error types', () => {
      const errorCodes = Object.values(ERROR_CODES);
      
      errorCodes.forEach(code => {
        const error = IDLErrorFactory.createError(code, {
          methodName: 'test',
          availableMethods: ['test1'],
          accountName: 'testAccount',
          issue: 'test issue'
        });
        
        const steps = UserFriendlyErrorConverter.getTroubleshootingSteps(error);
        expect(steps).toBeTruthy();
        expect(Array.isArray(steps)).toBe(true);
        expect(steps.length).toBeGreaterThan(0);
      });
    });
  }); 
 describe('ErrorDisplayManager', () => {
    it('should format IDL processing errors for display', () => {
      const idlError = IDLErrorFactory.createError(ERROR_CODES.INVALID_TYPE_FORMAT, {
        typeName: 'publicKey',
        expectedFormat: 'pubkey'
      });
      
      const formatted = ErrorDisplayManager.formatErrorForDisplay(idlError);
      
      expect(formatted.userMessage.title).toBe('Program Compatibility Issue');
      expect(formatted.troubleshootingSteps.length).toBeGreaterThan(0);
      expect(formatted.errorCode).toBe(ERROR_CODES.INVALID_TYPE_FORMAT);
      expect(formatted.shouldShowTechnicalDetails).toBeDefined();
    });

    it('should handle generic "Program not available" errors', () => {
      const genericError = new Error('Program not available - connection failed');
      const formatted = ErrorDisplayManager.formatErrorForDisplay(genericError);
      
      expect(formatted.userMessage.title).toBe('Connection Problem');
      expect(formatted.userMessage.message).toContain('blockchain program');
      expect(formatted.troubleshootingSteps.length).toBeGreaterThan(0);
      // Check that troubleshooting steps contain helpful guidance
      expect(formatted.troubleshootingSteps.some(step => 
        step.toLowerCase().includes('refresh') || 
        step.toLowerCase().includes('try again') ||
        step.toLowerCase().includes('check')
      )).toBe(true);
    });

    it('should handle Anchor-specific errors', () => {
      const anchorError = new Error('Cannot read properties of undefined (reading \'_bn\')');
      const formatted = ErrorDisplayManager.formatErrorForDisplay(anchorError);
      
      expect(formatted.userMessage.title).toBe('Connection Problem');
      expect(formatted.userMessage.message).toContain('blockchain program');
    });

    it('should handle network errors', () => {
      const networkError = new Error('fetch failed - network connection error');
      const formatted = ErrorDisplayManager.formatErrorForDisplay(networkError);
      
      expect(formatted.userMessage.title).toBe('Network Connection Problem');
      expect(formatted.userMessage.message).toContain('blockchain network');
    });

    it('should handle wallet errors', () => {
      const walletError = new Error('WalletNotConnectedError: Wallet not connected');
      const formatted = ErrorDisplayManager.formatErrorForDisplay(walletError);
      
      expect(formatted.userMessage.title).toBe('Wallet Connection Issue');
      expect(formatted.userMessage.message).toContain('browser wallet');
    });

    it('should create appropriate error notifications', () => {
      const criticalError = IDLErrorFactory.createError(ERROR_CODES.PROGRAM_CREATION_FAILED, {
        message: 'Critical failure'
      });
      
      const notification = ErrorDisplayManager.createErrorNotification(criticalError, 'test context');
      
      expect(notification.type).toBe('error');
      expect(notification.title).toBeTruthy();
      expect(notification.description).toBeTruthy();
      expect(notification.duration).toBeUndefined(); // Critical errors don't auto-dismiss
    });

    it('should create warning notifications for low severity errors', () => {
      const lowSeverityError = IDLErrorFactory.createError(ERROR_CODES.INSUFFICIENT_BALANCE, {
        required: '1.0',
        available: '0.5'
      });
      
      const notification = ErrorDisplayManager.createErrorNotification(lowSeverityError);
      
      expect(notification.type).toBe('warning');
      expect(notification.duration).toBe(5000);
    });
  }); 
 describe('ErrorRecoverySystem', () => {
    it('should provide comprehensive recovery plans for IDL errors', () => {
      const idlError = IDLErrorFactory.createError(ERROR_CODES.MISSING_ADDRESS_FIELD, {});
      const recoveryPlan = ErrorRecoverySystem.getRecoveryPlan(idlError);
      
      expect(recoveryPlan.immediateActions.length).toBeGreaterThan(0);
      expect(recoveryPlan.detailedSteps.length).toBeGreaterThan(0);
      expect(recoveryPlan.preventionTips.length).toBeGreaterThan(0);
      expect(recoveryPlan.documentationLinks.length).toBeGreaterThan(0);
      
      const firstStep = recoveryPlan.detailedSteps[0];
      expect(firstStep.title).toBeTruthy();
      expect(firstStep.description).toBeTruthy();
      expect(firstStep.steps.length).toBeGreaterThan(0);
      expect(firstStep.projectRuleReference).toContain('Rule #26');
    });

    it('should provide recovery scripts for fixable errors', () => {
      const typeError = IDLErrorFactory.createError(ERROR_CODES.INVALID_TYPE_FORMAT, {
        typeName: 'publicKey'
      });
      
      const script = ErrorRecoverySystem.generateRecoveryScript(typeError);
      
      expect(script).toBeTruthy();
      expect(script!.title).toContain('Type Compatibility');
      expect(script!.code).toContain('publicKey');
      expect(script!.code).toContain('pubkey');
      expect(script!.explanation).toContain('Rules #27-28');
    });

    it('should provide complete IDL processing script for program creation errors', () => {
      const programError = IDLErrorFactory.createError(ERROR_CODES.PROGRAM_CREATION_FAILED, {
        message: 'Program creation failed'
      });
      
      const script = ErrorRecoverySystem.generateRecoveryScript(programError);
      
      expect(script).toBeTruthy();
      expect(script!.title).toContain('Complete IDL Processing');
      expect(script!.code).toContain('processIDLForAnchor');
      expect(script!.code).toContain('discriminator');
      expect(script!.explanation).toContain('Rule #30');
    });

    it('should provide project rule references for all error codes', () => {
      const testCases: Array<{ code: ErrorCode; expectedRule: string }> = [
        { code: ERROR_CODES.MISSING_ADDRESS_FIELD, expectedRule: '26' },
        { code: ERROR_CODES.INVALID_TYPE_FORMAT, expectedRule: '27-28' },
        { code: ERROR_CODES.MALFORMED_ACCOUNT, expectedRule: '29' },
        { code: ERROR_CODES.PROGRAM_CREATION_FAILED, expectedRule: '30' },
        { code: ERROR_CODES.NETWORK_CONNECTION_FAILED, expectedRule: '6' },
        { code: ERROR_CODES.WALLET_CONNECTION_FAILED, expectedRule: '14' }
      ];
      
      testCases.forEach(({ code, expectedRule }) => {
        const reference = ErrorRecoverySystem.getProjectRuleReference(code);
        expect(reference).toBeTruthy();
        expect(reference!.ruleNumber).toBe(expectedRule);
        expect(reference!.title).toBeTruthy();
        expect(reference!.description).toBeTruthy();
      });
    });

    it('should handle recovery plans for all error types', () => {
      const errorCodes = Object.values(ERROR_CODES);
      
      errorCodes.forEach(code => {
        const error = IDLErrorFactory.createError(code, {
          methodName: 'test',
          availableMethods: ['test1'],
          accountName: 'testAccount',
          issue: 'test issue',
          walletType: 'Phantom',
          endpoint: 'https://api.devnet.solana.com'
        });
        
        const recoveryPlan = ErrorRecoverySystem.getRecoveryPlan(error);
        
        expect(recoveryPlan.immediateActions.length).toBeGreaterThan(0);
        expect(recoveryPlan.detailedSteps.length).toBeGreaterThan(0);
        expect(recoveryPlan.preventionTips.length).toBeGreaterThan(0);
        expect(recoveryPlan.documentationLinks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Message Generation', () => {
    it('should generate appropriate error messages for all scenarios', () => {
      const scenarios = [
        {
          error: IDLErrorFactory.createError(ERROR_CODES.MISSING_ADDRESS_FIELD, {}),
          expectedTitle: 'Program Configuration Issue'
        },
        {
          error: IDLErrorFactory.createError(ERROR_CODES.METHOD_NOT_FOUND, {
            methodName: 'deposit',
            availableMethods: ['initialize', 'claim']
          }),
          expectedTitle: 'Feature Unavailable'
        },
        {
          error: IDLErrorFactory.createError(ERROR_CODES.INSUFFICIENT_BALANCE, {
            required: '1.0',
            available: '0.5',
            tokenType: 'SOL'
          }),
          expectedTitle: 'Insufficient Balance'
        }
      ];
      
      scenarios.forEach(({ error, expectedTitle }) => {
        const userMessage = UserFriendlyErrorConverter.convertToUserMessage(error);
        expect(userMessage.title).toBe(expectedTitle);
        expect(userMessage.message).toBeTruthy();
        expect(userMessage.actionRequired).toBeTruthy();
      });
    });
  });
});