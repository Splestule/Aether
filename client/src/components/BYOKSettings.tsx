// © 2025 Aether Flight Tracker - All Rights Reserved
// Unauthorized copying of this file, via any medium is strictly prohibited
// Proprietary and confidential
// Author: Eduard Šimon

import { useState, useEffect } from 'react';
import { config, saveSessionToken, removeSessionToken, getSessionToken } from '../config';

interface BYOKSettingsProps {
  onClose?: () => void;
}

export function BYOKSettings({ onClose }: BYOKSettingsProps) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has an active session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const sessionToken = getSessionToken();
        if (sessionToken) {
          const response = await fetch(`${config.apiUrl}/api/opensky/status`, {
            headers: {
              'X-Session-Token': sessionToken,
            },
          });
          if (response.ok) {
            const data = await response.json();
            setHasSession(data.sessionActive ?? false);
          }
        }
      } catch (error) {
        console.warn('Failed to check session status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/opensky/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.sessionToken) {
        saveSessionToken(data.sessionToken);
        setSuccess('Credentials validated and saved successfully!');
        setHasSession(true);
        setClientId('');
        setClientSecret('');
        // Refresh page after a short delay to apply new session
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(data.error || data.message || 'Failed to validate credentials');
      }
    } catch (error) {
      console.error('Failed to submit credentials:', error);
      setError('Network error: Failed to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        setError('No active session found');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/opensky/credentials`, {
        method: 'DELETE',
        headers: {
          'X-Session-Token': sessionToken,
        },
      });

      if (response.ok) {
        removeSessionToken();
        setHasSession(false);
        setSuccess('Credentials removed successfully');
        // Refresh page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || data.message || 'Failed to remove credentials');
      }
    } catch (error) {
      console.error('Failed to remove credentials:', error);
      setError('Network error: Failed to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="vr-panel p-4 sm:p-6">
        <div className="text-white text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 border-t border-white/20 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold text-white">Bring Your Own Key</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      <p className="text-xs sm:text-sm text-white/80">
        Provide your own OpenSky credentials for full API access. Without credentials, you'll have limited access (10 req/min).
      </p>

      {hasSession ? (
        <div className="space-y-4">
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-400">✓</span>
              <span className="text-white font-semibold">Credentials Configured</span>
            </div>
            <p className="text-sm text-white/70">
              Your OpenSky credentials are active. You have full API access.
            </p>
          </div>
          <button
            onClick={handleRemove}
            disabled={isSubmitting}
            className="vr-button w-full !bg-red-500/20 !border-red-500/50 hover:!bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Removing...' : 'Remove Credentials'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-white/90 mb-2">
              OpenSky Client ID
            </label>
            <input
              id="clientId"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Enter your OpenSky Client ID"
              required
              className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#c6a0e8] focus:ring-1 focus:ring-[#c6a0e8]"
            />
          </div>

          <div>
            <label htmlFor="clientSecret" className="block text-sm font-medium text-white/90 mb-2">
              OpenSky Client Secret
            </label>
            <input
              id="clientSecret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Enter your OpenSky Client Secret"
              required
              className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#c6a0e8] focus:ring-1 focus:ring-[#c6a0e8]"
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
              <p className="text-sm text-green-300">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !clientId.trim() || !clientSecret.trim()}
            className="vr-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Validating...' : 'Save Credentials'}
          </button>
        </form>
      )}

      <p className="text-[10px] sm:text-xs text-white/50 mt-3">
        Credentials are stored securely in a session token. Sessions expire after 24 hours.
      </p>
    </div>
  );
}
