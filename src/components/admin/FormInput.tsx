import React, { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

interface FormInputProps extends React.ComponentProps<typeof Input> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  info?: string;
  required?: boolean;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  containerClassName?: string;
}

/**
 * Enhanced form input component with validation states
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(({
  label,
  description,
  error,
  success,
  info,
  required,
  badge,
  containerClassName = '',
  className = '',
  ...props
}, ref) => {
  const getInputClasses = () => {
    let classes = 'bg-gray-800 border-gray-700 text-white transition-all duration-200 ';
    
    if (error) {
      classes += 'border-red-500 focus:border-red-400 focus:ring-red-400/20 ';
    } else if (success) {
      classes += 'border-green-500 focus:border-green-400 focus:ring-green-400/20 ';
    } else {
      classes += 'focus:border-blue-400 focus:ring-blue-400/20 ';
    }
    
    return classes + className;
  };

  const getMessage = () => {
    if (error) {
      return (
        <div className="flex items-center gap-2 text-red-400 text-sm mt-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      );
    }
    
    if (success) {
      return (
        <div className="flex items-center gap-2 text-green-400 text-sm mt-1">
          <CheckCircle className="h-3 w-3 flex-shrink-0" />
          <span>{success}</span>
        </div>
      );
    }
    
    if (info) {
      return (
        <div className="flex items-center gap-2 text-blue-400 text-sm mt-1">
          <Info className="h-3 w-3 flex-shrink-0" />
          <span>{info}</span>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-300">
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          {badge && (
            <Badge variant={badge.variant || 'outline'} className="text-xs">
              {badge.text}
            </Badge>
          )}
        </div>
      )}
      
      <Input
        ref={ref}
        className={getInputClasses()}
        {...props}
      />
      
      {description && !error && !success && !info && (
        <div className="text-xs text-gray-500">
          {description}
        </div>
      )}
      
      {getMessage()}
    </div>
  );
});

FormInput.displayName = 'FormInput';

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  required?: boolean;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  containerClassName?: string;
}

/**
 * Enhanced form select component with validation states
 */
export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(({
  label,
  description,
  error,
  success,
  required,
  options,
  containerClassName = '',
  className = '',
  ...props
}, ref) => {
  const getSelectClasses = () => {
    let classes = 'bg-gray-800 border-gray-700 text-white rounded-md px-3 py-2 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ';
    
    if (error) {
      classes += 'border-red-500 focus:border-red-400 focus:ring-red-400/20 ';
    } else if (success) {
      classes += 'border-green-500 focus:border-green-400 focus:ring-green-400/20 ';
    } else {
      classes += 'focus:border-blue-400 focus:ring-blue-400/20 ';
    }
    
    return classes + className;
  };

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <Label className="text-sm font-medium text-gray-300">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </Label>
      )}
      
      <select
        ref={ref}
        className={getSelectClasses()}
        {...props}
      >
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
            className="bg-gray-800 text-white"
          >
            {option.label}
          </option>
        ))}
      </select>
      
      {description && !error && !success && (
        <div className="text-xs text-gray-500">
          {description}
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="h-3 w-3 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
});

FormSelect.displayName = 'FormSelect';

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  required?: boolean;
  containerClassName?: string;
}

/**
 * Enhanced form textarea component with validation states
 */
export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(({
  label,
  description,
  error,
  success,
  required,
  containerClassName = '',
  className = '',
  ...props
}, ref) => {
  const getTextareaClasses = () => {
    let classes = 'bg-gray-800 border-gray-700 text-white rounded-md px-3 py-2 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 resize-vertical ';
    
    if (error) {
      classes += 'border-red-500 focus:border-red-400 focus:ring-red-400/20 ';
    } else if (success) {
      classes += 'border-green-500 focus:border-green-400 focus:ring-green-400/20 ';
    } else {
      classes += 'focus:border-blue-400 focus:ring-blue-400/20 ';
    }
    
    return classes + className;
  };

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <Label className="text-sm font-medium text-gray-300">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </Label>
      )}
      
      <textarea
        ref={ref}
        className={getTextareaClasses()}
        {...props}
      />
      
      {description && !error && !success && (
        <div className="text-xs text-gray-500">
          {description}
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="h-3 w-3 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
});

FormTextarea.displayName = 'FormTextarea';