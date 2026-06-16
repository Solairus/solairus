import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, X, Clock } from "lucide-react";
import { LicenseInfo } from "@/hooks/license/use-license-status";

interface LicenseExpiryNotificationProps {
  licenseInfo: LicenseInfo;
  onRenew?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * LicenseExpiryNotification
 * Purpose: Display near-expiry warnings and renewal reminders
 * Features:
 * - Dismissible notifications
 * - Different urgency levels based on days remaining
 * - Renewal call-to-action
 * - Local storage for dismissal state
 */
export default function LicenseExpiryNotification({
  licenseInfo,
  onRenew,
  onDismiss,
  className = "",
}: LicenseExpiryNotificationProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if notification was dismissed recently
  useEffect(() => {
    if (licenseInfo.status === 'near-expiry' && licenseInfo.daysRemaining) {
      const dismissKey = `license-notification-dismissed-${licenseInfo.daysRemaining}`;
      const dismissedUntil = localStorage.getItem(dismissKey);

      if (dismissedUntil) {
        const dismissTime = parseInt(dismissedUntil, 10);
        const now = Date.now();
        const hoursSinceDismiss = (now - dismissTime) / (1000 * 60 * 60);

        // Show again after 24 hours for 7+ days, 12 hours for 3-6 days, 6 hours for 1-2 days
        let showAgainAfterHours = 24;
        if (licenseInfo.daysRemaining <= 2) {
          showAgainAfterHours = 6;
        } else if (licenseInfo.daysRemaining <= 6) {
          showAgainAfterHours = 12;
        }

        setIsDismissed(hoursSinceDismiss < showAgainAfterHours);
      }
    }
  }, [licenseInfo]);

  const handleDismiss = () => {
    if (licenseInfo.daysRemaining) {
      const dismissKey = `license-notification-dismissed-${licenseInfo.daysRemaining}`;
      localStorage.setItem(dismissKey, Date.now().toString());
    }
    setIsDismissed(true);
    onDismiss?.();
  };

  // Don't show if dismissed or not near expiry
  if (isDismissed || licenseInfo.status !== 'near-expiry' || !licenseInfo.daysRemaining) {
    return null;
  }

  const getUrgencyConfig = () => {
    const days = licenseInfo.daysRemaining!;

    if (days <= 1) {
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        iconColor: 'text-red-600',
        badgeVariant: 'destructive' as const,
        urgencyText: 'Critical',
        message: 'Your license expires tomorrow! Renew now to avoid service interruption.',
      };
    } else if (days <= 3) {
      return {
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800',
        iconColor: 'text-orange-600',
        badgeVariant: 'secondary' as const,
        urgencyText: 'Urgent',
        message: `Your license expires in ${days} days. Renew soon to maintain access.`,
      };
    } else {
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        iconColor: 'text-yellow-600',
        badgeVariant: 'outline' as const,
        urgencyText: 'Reminder',
        message: `Your license expires in ${days} days. Consider renewing early.`,
      };
    }
  };

  const config = getUrgencyConfig();

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className={`w-5 h-5 ${config.iconColor} mt-0.5 flex-shrink-0`} />

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h4 className={`font-semibold ${config.textColor}`}>
                  License Expiring Soon
                </h4>
                <Badge variant={config.badgeVariant} className="text-xs">
                  {config.urgencyText}
                </Badge>
              </div>

              <p className={`text-sm ${config.textColor}`}>
                {config.message}
              </p>

              {licenseInfo.expiryDate && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    Expires: {licenseInfo.expiryDate.toLocaleDateString()} at{' '}
                    {licenseInfo.expiryDate.toLocaleTimeString()}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {onRenew && (
                  <Button
                    onClick={onRenew}
                    size="sm"
                    className="h-8"
                  >
                    Renew License
                  </Button>
                )}

                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  Remind Later
                </Button>
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className={`p-1 rounded-md hover:bg-background/50 ${config.textColor} opacity-70 hover:opacity-100 transition-opacity`}
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}