import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

export interface ValidationRule {
  field: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
}

export interface FormValidationProps {
  errors: ValidationRule[];
  className?: string;
}

/**
 * Form validation display component
 */
export const FormValidation: React.FC<FormValidationProps> = ({ 
  errors, 
  className = '' 
}) => {
  if (errors.length === 0) return null;

  const errorsByType = errors.reduce((acc, error) => {
    const type = error.type || 'error';
    if (!acc[type]) acc[type] = [];
    acc[type].push(error);
    return acc;
  }, {} as Record<string, ValidationRule[]>);

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'default';
      default:
        return 'default';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getAlertClass = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-900/20 border-red-800';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-800';
      case 'info':
        return 'bg-blue-900/20 border-blue-800';
      default:
        return 'bg-red-900/20 border-red-800';
    }
  };

  const getTextClass = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-red-400';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {Object.entries(errorsByType).map(([type, typeErrors]) => (
        <Alert 
          key={type} 
          variant={getAlertVariant(type)}
          className={getAlertClass(type)}
        >
          {getIcon(type)}
          <AlertDescription className={getTextClass(type)}>
            {typeErrors.length === 1 ? (
              <span>{typeErrors[0].message}</span>
            ) : (
              <div>
                <div className="font-medium mb-1">
                  {type === 'error' ? 'Please fix the following errors:' : 
                   type === 'warning' ? 'Please note:' : 'Information:'}
                </div>
                <ul className="space-y-1 text-sm">
                  {typeErrors.map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="opacity-70 mt-0.5">•</span>
                      <span>{error.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};

/**
 * Hook for form validation
 */
export const useFormValidation = () => {
  const [errors, setErrors] = React.useState<ValidationRule[]>([]);

  const addError = (field: string, message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    setErrors(prev => [...prev.filter(e => e.field !== field), { field, message, type }]);
  };

  const removeError = (field: string) => {
    setErrors(prev => prev.filter(e => e.field !== field));
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const hasErrors = () => {
    return errors.some(e => e.type === 'error' || !e.type);
  };

  const hasWarnings = () => {
    return errors.some(e => e.type === 'warning');
  };

  return {
    errors,
    addError,
    removeError,
    clearErrors,
    hasErrors,
    hasWarnings,
    setErrors
  };
};

/**
 * Validation utilities
 */
export const validators = {
  required: (value: string, fieldName: string): ValidationRule | null => {
    if (!value || value.trim() === '') {
      return { field: fieldName, message: `${fieldName} is required` };
    }
    return null;
  },

  publicKey: (value: string, fieldName: string): ValidationRule | null => {
    if (!value) return null;
    
    try {
      // Basic Solana public key validation
      if (value.length < 32 || value.length > 44) {
        return { field: fieldName, message: `${fieldName} must be a valid Solana address` };
      }
      
      // Check for valid base58 characters
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
      if (!base58Regex.test(value)) {
        return { field: fieldName, message: `${fieldName} contains invalid characters` };
      }
      
      return null;
    } catch {
      return { field: fieldName, message: `${fieldName} is not a valid address format` };
    }
  },

  number: (value: string, fieldName: string, min?: number, max?: number): ValidationRule | null => {
    if (!value) return null;
    
    const num = parseFloat(value);
    if (isNaN(num)) {
      return { field: fieldName, message: `${fieldName} must be a valid number` };
    }
    
    if (min !== undefined && num < min) {
      return { field: fieldName, message: `${fieldName} must be at least ${min}` };
    }
    
    if (max !== undefined && num > max) {
      return { field: fieldName, message: `${fieldName} must be at most ${max}` };
    }
    
    return null;
  },

  integer: (value: string, fieldName: string, min?: number, max?: number): ValidationRule | null => {
    if (!value) return null;
    
    const num = parseInt(value);
    if (isNaN(num) || !Number.isInteger(parseFloat(value))) {
      return { field: fieldName, message: `${fieldName} must be a whole number` };
    }
    
    if (min !== undefined && num < min) {
      return { field: fieldName, message: `${fieldName} must be at least ${min}` };
    }
    
    if (max !== undefined && num > max) {
      return { field: fieldName, message: `${fieldName} must be at most ${max}` };
    }
    
    return null;
  },

  usdtAmount: (value: string, fieldName: string): ValidationRule | null => {
    if (!value) return null;
    
    const num = parseFloat(value);
    if (isNaN(num)) {
      return { field: fieldName, message: `${fieldName} must be a valid amount` };
    }
    
    if (num <= 0) {
      return { field: fieldName, message: `${fieldName} must be greater than 0` };
    }
    
    if (num > 1000000) {
      return { field: fieldName, message: `${fieldName} cannot exceed 1,000,000 USDT` };
    }
    
    // Check decimal places (USDT has 6 decimal places)
    const decimalPlaces = (value.split('.')[1] || '').length;
    if (decimalPlaces > 6) {
      return { field: fieldName, message: `${fieldName} cannot have more than 6 decimal places` };
    }
    
    return null;
  }
};