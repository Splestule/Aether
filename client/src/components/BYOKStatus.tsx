// © 2025 Aether Flight Tracker - All Rights Reserved
// Unauthorized copying of this file, via any medium is strictly prohibited
// Proprietary and confidential
// Author: Eduard Šimon

import { useEffect, useState } from "react";
import { checkBYOKStatus, getSessionToken } from "../config";

interface BYOKStatusProps {
  className?: string;
}

export function BYOKStatus({ className = "" }: BYOKStatusProps) {
  const [status, setStatus] = useState<{
    byokEnabled: boolean;
    hasSession: boolean;
    sessionActive: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateStatus = async () => {
      setIsLoading(true);
      try {
        const newStatus = await checkBYOKStatus();
        setStatus(newStatus);
      } catch (error) {
        console.warn('Failed to check BYOK status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    updateStatus();
    
    // Check status periodically
    const interval = setInterval(updateStatus, 30000); // Every 30 seconds
    
    // Also check when session token changes
    const checkToken = () => {
      const token = getSessionToken();
      if (token !== (status?.hasSession ? 'exists' : null)) {
        updateStatus();
      }
    };
    const tokenInterval = setInterval(checkToken, 5000); // Every 5 seconds

    return () => {
      clearInterval(interval);
      clearInterval(tokenInterval);
    };
  }, [status?.hasSession]);

  // Don't show anything if BYOK is not enabled or still loading
  if (isLoading || !status || !status.byokEnabled) {
    return null;
  }

  // Show status based on session
  if (status.sessionActive) {
    return (
      <div className={`vr-panel p-2 sm:p-3 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-sm sm:text-base">✓</span>
          <span className="text-white text-xs sm:text-sm font-medium">
            Credentials Connected
          </span>
        </div>
      </div>
    );
  }

  // Limited mode - BYOK enabled but no session
  return (
    <div className={`vr-panel p-2 sm:p-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-orange-400 text-sm sm:text-base">⚠</span>
        <span className="text-white text-xs sm:text-sm font-medium">
          Limited Mode
        </span>
      </div>
    </div>
  );
}
