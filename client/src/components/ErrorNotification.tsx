import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";

export interface ErrorNotificationData {
  type: 'opensky' | 'network' | 'server';
  message: string;
  statusCode?: number;
  details?: string;
  timestamp: number;
}

interface ErrorNotificationProps {
  error: ErrorNotificationData | null;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorNotification({ error, onDismiss, onRetry }: ErrorNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (error) {
      setIsVisible(true);
      setIsDismissing(false);
    } else {
      setIsDismissing(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!error || !isVisible) {
    return null;
  }

  const getErrorTitle = () => {
    switch (error.type) {
      case 'opensky':
        if (error.statusCode === 503) {
          return 'OpenSky Network Unavailable';
        }
        if (error.statusCode === 429) {
          return 'Rate Limit Exceeded';
        }
        if (error.statusCode === 401 || error.statusCode === 403) {
          return 'OpenSky Authentication Error';
        }
        return 'OpenSky Network Error';
      case 'network':
        return 'Network Connection Error';
      case 'server':
        return 'Server Error';
      default:
        return 'Connection Error';
    }
  };

  const getErrorMessage = () => {
    if (error.message) {
      return error.message;
    }
    
    switch (error.type) {
      case 'opensky':
        if (error.statusCode === 503) {
          return 'OpenSky Network is currently unavailable. The service may be temporarily down or experiencing high load.';
        }
        if (error.statusCode === 429) {
          return 'Too many requests to OpenSky Network. Please wait a moment before trying again.';
        }
        if (error.statusCode === 401 || error.statusCode === 403) {
          return 'Authentication failed with OpenSky Network. Please check your credentials.';
        }
        return 'Unable to fetch flight data from OpenSky Network.';
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection.';
      case 'server':
        return 'The server encountered an error while processing your request.';
      default:
        return 'An error occurred while fetching flight data.';
    }
  };

  const getErrorColor = () => {
    switch (error.type) {
      case 'opensky':
        return 'text-orange-300 border-orange-400/50 bg-orange-950/20';
      case 'network':
        return 'text-red-300 border-red-400/50 bg-red-950/20';
      case 'server':
        return 'text-yellow-300 border-yellow-400/50 bg-yellow-950/20';
      default:
        return 'text-white/80 border-white/40 bg-white/5';
    }
  };

  return (
    <div
      className={clsx(
        "fixed top-4 right-4 sm:top-6 sm:right-6 z-[10001] max-w-sm w-full sm:max-w-md transition-all duration-300",
        isDismissing ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"
      )}
      style={{
        pointerEvents: 'auto',
      }}
    >
      <div
        className={clsx(
          "vr-panel p-4 sm:p-5 border-2",
          getErrorColor()
        )}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
          
          <div className="flex-1 min-w-0">
            <h3 className="compass-title text-sm sm:text-base mb-1.5 sm:mb-2">
              {getErrorTitle()}
            </h3>
            <p className="compass-subtle text-[10px] sm:text-[0.65rem] leading-relaxed mb-3 sm:mb-4">
              {getErrorMessage()}
            </p>
            
            {error.details && (
              <p className="compass-subtle text-[9px] sm:text-[0.55rem] text-white/40 mb-3 sm:mb-4 font-mono">
                {error.details}
              </p>
            )}
            
            <div className="flex items-center gap-2 sm:gap-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className={clsx(
                    "vr-button text-[10px] sm:text-[0.6rem] px-3 py-1.5 sm:px-4 sm:py-2",
                    "flex items-center gap-1.5 sm:gap-2"
                  )}
                >
                  <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Retry</span>
                </button>
              )}
              
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="compass-subtle text-[10px] sm:text-[0.6rem] hover:text-white/80 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="group relative -mt-1 -mr-2 inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-transparent text-white/50 transition-colors duration-300 hover:text-white focus:outline-none flex-shrink-0"
            >
              <span className="sr-only">Close notification</span>
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}








