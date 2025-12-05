import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import CountdownTimer from "@/components/license/CountdownTimer";

export type LicenseStatus = 'active' | 'near-expiry' | 'expired' | 'none' | 'loading';

interface LicenseStatusCardProps {
  status: LicenseStatus;
  expirationDate?: Date;
  daysRemaining?: number;
  onActivate?: () => void;
  isLoading?: boolean;
  licenseFee?: string;
  error?: string;
  onRetry?: () => void;
}

/**
 * LicenseStatusCard
 * Purpose: Display license status with appropriate styling and actions
 * Features:
 * - Status-based styling and icons
 * - Countdown timer for active licenses
 * - Activation button for inactive licenses
 * - Loading states
 */
export default function LicenseStatusCard({
  status,
  expirationDate,
  daysRemaining,
  onActivate,
  isLoading = false,
  licenseFee,
  error,
  onRetry,
}: LicenseStatusCardProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          icon: CheckCircle,
          color: 'text-green-800',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeVariant: 'default' as const,
          title: 'License Active',
          description: 'Your yearly license is active and valid',
        };
      case 'near-expiry':
        return {
          icon: AlertTriangle,
          color: 'text-amber-800',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          badgeVariant: 'secondary' as const,
          title: 'License Expiring Soon',
          description: 'Your license will expire soon. Consider renewing.',
        };
      case 'expired':
        return {
          icon: XCircle,
          color: 'text-red-800',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeVariant: 'destructive' as const,
          title: 'License Expired',
          description: 'Your license has expired. Activate to continue using Solairus.',
        };
      case 'none':
        return {
          icon: Clock,
          color: 'text-blue-800',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          badgeVariant: 'outline' as const,
          title: 'No Active License',
          description: 'Activate your yearly license to access Solairus features.',
        };
      case 'loading':
      default:
        return {
          icon: Clock,
          color: 'text-gray-800',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          badgeVariant: 'outline' as const,
          title: 'Checking License...',
          description: 'Loading license information...',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const showActivateButton = (status === 'none' || status === 'expired') && onActivate;
  const showCountdown = (status === 'active' || status === 'near-expiry') && expirationDate;

  // Show error state if there's an error
  if (error) {
    return (
      <Card className="bg-red-50 border-red-200 border-2 shadow-lg">
        <CardHeader className="pb-4 text-center">
          <div className="flex items-center justify-center space-x-2">
            <XCircle className="h-6 w-6 text-red-600" />
            <CardTitle className="text-lg text-red-800">License Error</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-red-700 text-sm">{error}</p>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="h-6 bg-gray-200 rounded w-32"></div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2 shadow-lg`}>
      <CardHeader className="pb-4 text-center">
        <div className="flex flex-col items-center space-y-3">
          <div className={`p-3 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10`}>
            <Icon className={`w-8 h-8 ${config.color}`} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold text-gray-900">
              {config.title}
            </CardTitle>
            <Badge variant={config.badgeVariant} className="capitalize text-xs">
              {status === 'near-expiry' ? 'Expiring' : status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <p className="text-sm text-gray-700 text-center leading-relaxed">
          {config.description}
        </p>

        {/* Countdown Timer for Active Licenses */}
        {showCountdown && (
          <div className="p-4 bg-white/70 rounded-xl border border-gray-200">
            <div className="text-center mb-3">
              <span className="text-sm font-semibold text-gray-900">License Expires In</span>
              {daysRemaining && (
                <div className="text-2xl font-bold text-primary mt-1">
                  {daysRemaining} days
                </div>
              )}
            </div>
            <CountdownTimer
              targetDate={expirationDate}
              onExpiry={() => window.location.reload()}
            />
          </div>
        )}

        {/* License Fee Display */}
        {licenseFee && showActivateButton && (
          <div className="p-4 bg-white/70 rounded-xl border border-gray-200 text-center">
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">License Fee</span>
              <div className="text-3xl font-bold text-primary">
                {licenseFee} <span className="text-lg text-gray-600">USDT</span>
              </div>
              <p className="text-xs text-gray-600">
                Yearly access to all Solairus features
              </p>
            </div>
          </div>
        )}

        {/* Expiration Date Display */}
        {expirationDate && !showCountdown && (
          <div className="p-3 bg-white/70 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                {status === 'expired' ? 'Expired On:' : 'Expires On:'}
              </span>
              <span className="text-sm font-mono text-gray-700">
                {expirationDate.toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {/* Activation Button */}
        {showActivateButton && (
          <Button
            onClick={onActivate}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg"
            size="lg"
          >
            {status === 'expired' ? '🔄 Renew License' : '🚀 Activate License'}
          </Button>
        )}

        {/* Renewal Button for Near Expiry */}
        {status === 'near-expiry' && onActivate && (
          <Button
            onClick={onActivate}
            variant="outline"
            className="w-full h-12 text-base font-semibold border-2 border-primary text-primary hover:bg-primary hover:text-white"
            size="lg"
          >
            ⚡ Renew License Early
          </Button>
        )}
      </CardContent>
    </Card>
  );
}