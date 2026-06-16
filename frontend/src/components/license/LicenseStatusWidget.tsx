import React from "react";
import { Shield, AlertTriangle, Clock } from "lucide-react";
import { useLicense } from "@/contexts/license-context";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";

interface LicenseStatusWidgetProps {
  variant?: 'compact' | 'detailed';
  showIcon?: boolean;
  className?: string;
}

/**
 * LicenseStatusWidget
 * Purpose: Reusable license status indicator for UI components
 * Features:
 * - Compact and detailed variants
 * - Color-coded status indicators
 * - Responsive design
 */
export default function LicenseStatusWidget({
  variant = 'compact',
  showIcon = true,
  className = '',
}: LicenseStatusWidgetProps) {
  const { isConnected } = useWalletConnection();
  const { hasValidLicense, isNearExpiry, daysRemaining, licenseInfo, isLoading } = useLicense();

  // Don't show if wallet not connected
  if (!isConnected) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {showIcon && <Clock className="w-4 h-4 text-gray-400 animate-pulse" />}
        <span className="text-xs text-gray-500">Checking...</span>
      </div>
    );
  }

  const getStatusConfig = () => {
    if (hasValidLicense) {
      if (isNearExpiry) {
        return {
          icon: AlertTriangle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          text: variant === 'detailed' ? `License expires in ${daysRemaining} days` : `${daysRemaining}d`,
        };
      }
      return {
        icon: Shield,
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        text: variant === 'detailed' ? 'License Active' : 'Licensed',
      };
    }

    return {
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      text: variant === 'detailed' ? 'No Active License' : 'No License',
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (variant === 'detailed') {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} ${config.borderColor} border ${className}`}>
        {showIcon && <Icon className={`w-4 h-4 ${config.color}`} />}
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${config.color}`}>
            {config.text}
          </span>
          {licenseInfo.expirationDate && hasValidLicense && (
            <span className="text-xs text-gray-500">
              Until {licenseInfo.expirationDate.toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Compact variant
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {showIcon && <Icon className={`w-4 h-4 ${config.color}`} />}
      <span className={`text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    </div>
  );
}