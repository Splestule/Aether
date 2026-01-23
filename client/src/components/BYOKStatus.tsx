// © 2025 Aether Flight Tracker - All Rights Reserved
// Unauthorized copying of this file, via any medium is strictly prohibited
// Proprietary and confidential
// Author: Eduard Šimon

import { useEffect, useState } from "react";
import { checkBYOKStatus, getSessionToken, config } from "../config";

interface BYOKStatusProps {
  className?: string;
}

interface RateLimitInfo {
  isLimited: boolean;
  limit: number;
  windowMs: number;
  resetTimestamp: number;
  resetTime: string;
}

export function BYOKStatus({ className = "" }: BYOKStatusProps) {
  const [status, setStatus] = useState<{
    byokEnabled: boolean;
    hasSession: boolean;
    sessionActive: boolean;
  } | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRateLimitInfo = async () => {
    try {
      const sessionToken = getSessionToken();
      const headers: HeadersInit = {};
      if (sessionToken) {
        headers['X-Session-Token'] = sessionToken;
      }
      const response = await fetch(`${config.apiUrl}/api/rate-limit/status`, { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRateLimitInfo(data);
          // Try to get remaining from response headers
          const remainingHeader = response.headers.get('ratelimit-remaining');
          if (remainingHeader !== null) {
            const remainingValue = parseInt(remainingHeader, 10);
            if (!isNaN(remainingValue)) {
              setRemaining(remainingValue);
            }
          } else if (remaining === null) {
            // Initialize remaining to limit if not set and no header available
            setRemaining(data.limit);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch rate limit info:', error);
    }
  };

  // Track API calls to update remaining count from response headers
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      // Check if this is an API call (not rate-limit/status or opensky/status)
      if (args[0] && typeof args[0] === 'string' &&
        args[0].includes('/api/') &&
        !args[0].includes('/api/rate-limit/status') &&
        !args[0].includes('/api/opensky/status')) {
        // Get remaining from response headers
        const remainingHeader = response.headers.get('ratelimit-remaining');
        if (remainingHeader !== null) {
          const remainingValue = parseInt(remainingHeader, 10);
          if (!isNaN(remainingValue)) {
            setRemaining(remainingValue);
          }
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Update reset time display every second and refresh rate limit info periodically
  useEffect(() => {
    if (!rateLimitInfo || !rateLimitInfo.isLimited) return;

    let lastRefresh = Date.now();
    const updateTimer = setInterval(() => {
      // Refresh rate limit info every 10 seconds to get updated remaining count
      const now = Date.now();
      if (now - lastRefresh >= 10000) {
        lastRefresh = now;
        fetchRateLimitInfo();
      }
    }, 1000);

    return () => clearInterval(updateTimer);
  }, [rateLimitInfo]);

  useEffect(() => {
    const updateStatus = async () => {
      setIsLoading(true);
      try {
        const newStatus = await checkBYOKStatus();
        setStatus(newStatus);
        // Fetch rate limit info for both limited mode (no session) and full mode (with session)
        if (newStatus.byokEnabled) {
          await fetchRateLimitInfo();
        }
      } catch (error) {
        console.warn('Failed to check BYOK status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    updateStatus();

    // Check status periodically
    const interval = setInterval(() => {
      updateStatus();
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Don't show anything if BYOK is not enabled or still loading
  if (isLoading || !status || !status.byokEnabled) {
    return null;
  }

  // Calculate rate limit values (150 for limited, 600 for verified)
  const limit = rateLimitInfo?.limit ?? (status.sessionActive ? 600 : 150);
  const resetTimestamp = rateLimitInfo?.resetTimestamp;
  const currentRemaining = remaining ?? limit;
  const percentage = limit > 0 ? (currentRemaining / limit) * 100 : 0;

  // Determine status mode for display
  const isConnected = status.sessionActive;

  // Calculate time until reset
  const getResetTimeText = (): string => {
    if (!resetTimestamp) return '';
    const resetDate = new Date(resetTimestamp);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();

    if (diffMs <= 0) return 'Resets now';

    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    if (minutes > 0) {
      return `Resets in ${minutes}m ${seconds}s`;
    }
    return `Resets in ${seconds}s`;
  };

  return (
    <div className={`vr-button justify-center cursor-default hover:bg-[rgba(26,26,26,0.92)] hover:border-white/60 hover:text-white text-[10px] sm:text-[0.65rem] px-2.5 py-2 sm:px-5 sm:py-3 w-full flex flex-col gap-1.5 sm:gap-2 ${className}`}>
      <div className="flex items-center gap-2 justify-center w-full">
        <span className={`${isConnected ? 'text-green-400' : 'text-orange-400'} text-sm sm:text-base`}>
          {isConnected ? '✓' : '⚠'}
        </span>
        <span className="text-white text-xs sm:text-sm font-medium whitespace-nowrap">
          {isConnected ? (
            <>
              <span className="hidden sm:inline">Credentials Connected</span>
              <span className="sm:hidden">Connected</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Limited Mode</span>
              <span className="sm:hidden">Limited</span>
            </>
          )}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full px-1 sm:px-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] sm:text-[0.55rem] text-white/70">
            {currentRemaining}/{limit}
          </span>
          {resetTimestamp && (
            <span className="text-[8px] sm:text-[0.55rem] text-white/70">
              {getResetTimeText()}
            </span>
          )}
        </div>
        <div className="w-full h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${isConnected ? 'bg-green-400/60' : 'bg-orange-400/60'} transition-all duration-300`}
            style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
