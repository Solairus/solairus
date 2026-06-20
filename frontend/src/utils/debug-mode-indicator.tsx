/**
 * Debug Mode Indicator Component
 * 
 * Shows a visual indicator when the contract is in debug mode (5-minute intervals)
 * This helps users understand they're testing with accelerated timing
 */

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';
import { getContractTimingInfo } from '@/services/agent/contract-timing-service';
import { Connection } from '@solana/web3.js';

interface DebugModeIndicatorProps {
  connection?: Connection;
  className?: string;
}

export const DebugModeIndicator: React.FC<DebugModeIndicatorProps> = ({
  connection,
  className
}) => {
  const [timingInfo, setTimingInfo] = useState<{
    isDebugMode: boolean;
    displayName: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    const loadTimingInfo = async () => {
      if (!connection) return;

      try {
        const info = await getContractTimingInfo(connection);
        setTimingInfo(info);
      } catch (error) {
        console.warn('Could not load timing info for debug indicator:', error);
      }
    };

    loadTimingInfo();
  }, [connection]);

  if (!timingInfo?.isDebugMode) {
    return null; // Don't show anything in production mode
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Badge 
        variant="outline" 
        className="bg-amber-500/10 border-amber-500/30 text-amber-600 text-xs px-2 py-1"
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        Debug Mode Active
        <Clock className="h-3 w-3 ml-1" />
      </Badge>
    </div>
  );
};

export default DebugModeIndicator;