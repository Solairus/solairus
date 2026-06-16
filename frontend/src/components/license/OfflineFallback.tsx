import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";

interface OfflineFallbackProps {
  onRetry?: () => void;
  children?: React.ReactNode;
}

/**
 * OfflineFallback
 * Purpose: Fallback UI for offline scenarios
 * Features:
 * - Network status detection
 * - Retry functionality
 * - Graceful degradation
 */
export default function OfflineFallback({ onRetry, children }: OfflineFallbackProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastOnline, setLastOnline] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnline(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial last online time if currently online
    if (navigator.onLine && !lastOnline) {
      setLastOnline(new Date());
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [lastOnline]);

  // If online, render children or nothing
  if (isOnline) {
    return <>{children}</>;
  }

  // Offline fallback UI
  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <WifiOff className="w-8 h-8 text-orange-600" />
        </div>
        <CardTitle className="text-xl text-orange-800">
          You're Offline
        </CardTitle>
      </CardHeader>
      
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-orange-700">
          License information cannot be updated while offline. 
          Please check your internet connection.
        </p>
        
        {lastOnline && (
          <p className="text-xs text-orange-600">
            Last connected: {lastOnline.toLocaleString()}
          </p>
        )}
        
        <div className="space-y-2">
          <Button
            onClick={() => {
              // Force a network check
              setIsOnline(navigator.onLine);
              onRetry?.();
            }}
            variant="outline"
            className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Connection
          </Button>
          
          <p className="text-xs text-orange-600">
            Some features may be limited while offline
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook to detect online/offline status
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Trigger a refresh when coming back online
        window.location.reload();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}