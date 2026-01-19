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
  const [lastApiCallTime, setLastApiCallTime] = useState<number | null>(null);

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
          // Initialize remaining to limit if not set
          if (remaining === null) {
            setRemaining(data.limit);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch rate limit info:', error);
    }
  };

  // Track API calls to estimate remaining
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      // Check if this is an API call (not rate-limit/status)
      if (args[0] && typeof args[0] === 'string' && 
          args[0].includes('/api/') && 
          !args[0].includes('/api/rate-limit/status')) {
        setLastApiCallTime(Date.now());
        const remainingHeader = response.headers.get('ratelimit-remaining');
        if (remainingHeader !== null) {
          setRemaining(parseInt(remainingHeader, 10));
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

    const updateTimer = setInterval(() => {
      // Refresh rate limit info every 30 seconds to get updated reset time
      if (Date.now() % 30000 < 1000) {
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
        if (newStatus.byokEnabled && !newStatus.sessionActive) {
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

  // Show status based on session
  if (status.sessionActive) {
    return (
      <div className={`vr-button justify-center cursor-default hover:bg-[rgba(26,26,26,0.92)] hover:border-white/60 hover:text-white text-[10px] sm:text-[0.65rem] px-2.5 py-2 sm:px-5 sm:py-3 w-full ${className}`}>
        <span className="text-green-400 text-sm sm:text-base">✓</span>
        <span className="text-white text-xs sm:text-sm font-medium whitespace-nowrap">
          <span className="hidden sm:inline">Credentials Connected</span>
          <span className="sm:hidden">Connected</span>
        </span>
      </div>
    );
  }

  // Limited mode - BYOK enabled but no session
  const limit = rateLimitInfo?.limit ?? 150;
  const resetTimestamp = rateLimitInfo?.resetTimestamp;
  const currentRemaining = remaining ?? limit;
  const percentage = limit > 0 ? (currentRemaining / limit) * 100 : 0;
  
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
        <span className="text-orange-400 text-sm sm:text-base">⚠</span>
        <span className="text-white text-xs sm:text-sm font-medium whitespace-nowrap">
          <span className="hidden sm:inline">Limited Mode</span>
          <span className="sm:hidden">Limited</span>
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
            className="h-full bg-orange-400/60 transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
