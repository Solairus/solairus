import { useState, useEffect, useCallback } from "react";

interface CountdownTimerProps {
  targetDate: Date;
  onExpiry?: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * CountdownTimer
 * Purpose: Real-time countdown display for license expiration
 * Features:
 * - Live countdown with days, hours, minutes, seconds
 * - Automatic cleanup on unmount
 * - Expiry callback handling
 * - Responsive design
 */
export default function CountdownTimer({ targetDate, onExpiry }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);

  const calculateTimeRemaining = useCallback((): TimeRemaining => {
    const now = new Date().getTime();
    const target = targetDate.getTime();
    const difference = target - now;

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }, [targetDate]);

  useEffect(() => {
    const updateTimer = () => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      // Check if expired
      if (remaining.days === 0 && remaining.hours === 0 && remaining.minutes === 0 && remaining.seconds === 0) {
        if (!isExpired) {
          setIsExpired(true);
          onExpiry?.();
        }
      }
    };

    // Initial calculation
    updateTimer();

    // Set up interval for updates (only update every 30 seconds to be more efficient)
    const interval = setInterval(updateTimer, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [targetDate, onExpiry, isExpired, calculateTimeRemaining]);

  if (isExpired) {
    return (
      <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 font-semibold">License Expired</p>
        <p className="text-sm text-red-500">Please renew your license to continue</p>
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    return num.toString().padStart(2, '0');
  };

  const timeUnits = [
    { label: 'Days', value: timeRemaining.days, show: timeRemaining.days > 0 },
    { label: 'Hours', value: timeRemaining.hours, show: timeRemaining.days > 0 || timeRemaining.hours > 0 },
    { label: 'Minutes', value: timeRemaining.minutes, show: true },
    { label: 'Seconds', value: timeRemaining.seconds, show: timeRemaining.days === 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {timeUnits.map(({ label, value, show }) => 
        show && (
          <div key={label} className="text-center p-3 bg-white/80 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-primary">
              {formatNumber(value)}
            </div>
            <div className="text-xs text-gray-700 uppercase tracking-wide font-medium">
              {label}
            </div>
          </div>
        )
      )}
    </div>
  );
}