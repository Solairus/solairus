import React from 'react';
import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, Info, Copy, ExternalLink } from 'lucide-react';

export interface NotificationOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  txSignature?: string;
}

/**
 * Enhanced notification system for admin operations
 */
export class AdminNotifications {
  static success(message: string, options: NotificationOptions = {}) {
    const { title, description, duration = 5000, action, txSignature } = options;
    
    toast.success(title || message, {
      description: description || (txSignature ? `Transaction: ${txSignature.slice(0, 8)}...` : undefined),
      duration,
      icon: <CheckCircle className="h-4 w-4" />,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : txSignature ? {
        label: 'Copy Tx',
        onClick: () => {
          navigator.clipboard.writeText(txSignature);
          toast.info('Transaction signature copied to clipboard');
        },
      } : undefined,
      className: 'bg-gray-900 border-gray-700 text-white',
    });
  }

  static error(message: string, options: NotificationOptions = {}) {
    const { title, description, duration = 8000, action } = options;
    
    toast.error(title || message, {
      description,
      duration,
      icon: <XCircle className="h-4 w-4" />,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      className: 'bg-gray-900 border-gray-700 text-white',
    });
  }

  static warning(message: string, options: NotificationOptions = {}) {
    const { title, description, duration = 6000, action } = options;
    
    toast.warning(title || message, {
      description,
      duration,
      icon: <AlertTriangle className="h-4 w-4" />,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      className: 'bg-gray-900 border-gray-700 text-white',
    });
  }

  static info(message: string, options: NotificationOptions = {}) {
    const { title, description, duration = 4000, action } = options;
    
    toast.info(title || message, {
      description,
      duration,
      icon: <Info className="h-4 w-4" />,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      className: 'bg-gray-900 border-gray-700 text-white',
    });
  }

  static loading(message: string, options: Omit<NotificationOptions, 'duration'> = {}) {
    const { title, description } = options;
    
    return toast.loading(title || message, {
      description,
      className: 'bg-gray-900 border-gray-700 text-white',
    });
  }

  static dismiss(toastId?: string | number) {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }

  static promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options: {
      successOptions?: NotificationOptions;
      errorOptions?: NotificationOptions;
    } = {}
  ) {
    return toast.promise(promise, {
      loading: messages.loading,
      success: (data) => {
        const message = typeof messages.success === 'function' ? messages.success(data) : messages.success;
        
        // If success options include txSignature, add copy action
        if (options.successOptions?.txSignature) {
          setTimeout(() => {
            AdminNotifications.success(message, options.successOptions);
          }, 100);
          return message;
        }
        
        return message;
      },
      error: (error) => {
        const message = typeof messages.error === 'function' ? messages.error(error) : messages.error;
        
        if (options.errorOptions) {
          setTimeout(() => {
            AdminNotifications.error(message, options.errorOptions);
          }, 100);
          return message;
        }
        
        return message;
      },
    });
  }

  // Specialized notifications for common admin operations
  static transactionSuccess(operation: string, txSignature: string, details?: string) {
    this.success(`${operation} completed successfully`, {
      description: details,
      txSignature,
      action: {
        label: 'View on Explorer',
        onClick: () => {
          // This would open the transaction in a Solana explorer
          window.open(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`, '_blank');
        },
      },
    });
  }

  static transactionError(operation: string, error: Error, canRetry: boolean = false, onRetry?: () => void) {
    this.error(`${operation} failed`, {
      description: error.message,
      duration: canRetry ? 10000 : 8000,
      action: canRetry && onRetry ? {
        label: 'Retry',
        onClick: onRetry,
      } : undefined,
    });
  }

  static validationError(field: string, message: string) {
    this.warning(`Validation Error: ${field}`, {
      description: message,
      duration: 5000,
    });
  }

  static permissionDenied(action: string) {
    this.error('Permission Denied', {
      description: `You don't have permission to ${action}`,
      duration: 6000,
    });
  }

  static walletNotConnected() {
    this.warning('Wallet Not Connected', {
      description: 'Please connect your wallet to continue',
      duration: 5000,
    });
  }

  static operationInProgress(operation: string) {
    return this.loading(`${operation} in progress...`, {
      description: 'Please wait while the transaction is processed',
    });
  }

  static autoRegistrationNotice(userAddress: string) {
    this.info('User Auto-Registration', {
      description: `User ${userAddress.slice(0, 8)}... will be automatically registered`,
      duration: 6000,
    });
  }

  static bucketWithdrawal(bucketType: string, amount: string, txSignature: string) {
    this.transactionSuccess(
      'Bucket Withdrawal',
      txSignature,
      `Successfully withdrew ${amount} USDT from ${bucketType} bucket`
    );
  }

  static licenseActivation(userAddress: string, duration: number, txSignature: string, wasNewUser: boolean = false) {
    this.transactionSuccess(
      'License Activation',
      txSignature,
      `Activated ${duration} day license for ${userAddress.slice(0, 8)}...${wasNewUser ? ' (new user registered)' : ''}`
    );
  }

  static creditOperation(operation: 'credit' | 'debit', amount: string, userAddress: string, txSignature: string) {
    this.transactionSuccess(
      `User ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
      txSignature,
      `${operation === 'credit' ? 'Added' : 'Subtracted'} ${amount} USDT ${operation === 'credit' ? 'to' : 'from'} ${userAddress.slice(0, 8)}...`
    );
  }
}

// Export convenience functions
export const {
  success: notifySuccess,
  error: notifyError,
  warning: notifyWarning,
  info: notifyInfo,
  loading: notifyLoading,
  dismiss: dismissNotification,
  promise: notifyPromise,
  transactionSuccess: notifyTransactionSuccess,
  transactionError: notifyTransactionError,
  validationError: notifyValidationError,
  permissionDenied: notifyPermissionDenied,
  walletNotConnected: notifyWalletNotConnected,
  operationInProgress: notifyOperationInProgress,
} = AdminNotifications;