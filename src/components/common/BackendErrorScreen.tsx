import React, { useState } from 'react';

interface BackendErrorScreenProps {
  error: string;
  status?: number | null;
  onRetry: () => void;
  isRetrying?: boolean;
  onNavigateHome?: () => void;
}

export const BackendErrorScreen: React.FC<BackendErrorScreenProps> = ({
  error,
  status,
  onRetry,
  isRetrying = false,
  onNavigateHome,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const is404 = status === 404;
  const is5xx = status && status >= 500 && status < 600;

  let title = 'Backend Connection Offline';
  let description =
    'Unable to establish a secure connection to the HealForge backend service. Protected workspace screens remain locked until authentication and backend connectivity can be verified.';

  if (is404) {
    title = 'Backend Service Not Found (HTTP 404)';
    description =
      'The frontend reached the server, but the HealForge API endpoints (/api/v1/...) are not mounted or routed. In production, configure the reverse proxy rewrite in vercel.json or specify VITE_API_BASE_URL. In local development, verify that healforge-backend-1 is running.';
  } else if (is5xx) {
    title = `Backend Server Error (HTTP ${status})`;
    description =
      'The HealForge backend service encountered an internal error. Please check backend server logs or database connectivity.';
  }

  return (
    <div className="min-h-screen bg-surface-default flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-status-critical/15 border border-status-critical/30 text-status-critical flex items-center justify-center mx-auto shadow-lg">
            <span className="material-symbols-outlined text-[32px]">cloud_off</span>
          </div>
          <h1 className="text-2xl font-bold font-headline-md text-text-primary mt-4">HealForge Security Platform</h1>
          <p className="text-xs text-text-secondary mt-1">Autonomous Vulnerability Remediation & Verification</p>
        </div>

        {/* Error Card */}
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-8 shadow-sm space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-status-critical/10 border border-status-critical/20 text-status-critical flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[20px]">error</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">{title}</h2>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Technical Diagnostics */}
          <div className="rounded-xl border border-border-subtle bg-surface-container/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-status-critical animate-ping" />
                <span>Connection Status: Degraded</span>
              </span>
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-primary hover:underline font-mono text-[11px]"
              >
                {showTechnicalDetails ? 'Hide Diagnostics' : 'Show Diagnostics'}
              </button>
            </div>

            {showTechnicalDetails && (
              <div className="pt-2 border-t border-border-subtle text-[11px] font-mono text-text-muted space-y-1 overflow-x-auto">
                <p>
                  <span className="text-text-secondary font-semibold">Endpoint:</span> /api/v1/auth/session
                </p>
                {status && (
                  <p>
                    <span className="text-text-secondary font-semibold">HTTP Status:</span> {status}
                  </p>
                )}
                <p>
                  <span className="text-text-secondary font-semibold">Error Message:</span> {error}
                </p>
                <p>
                  <span className="text-text-secondary font-semibold">Security Posture:</span> Fail-Closed (Protected Workspace Locked)
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[16px] ${isRetrying ? 'animate-spin' : ''}`}>
                {isRetrying ? 'sync' : 'refresh'}
              </span>
              <span>{isRetrying ? 'Retrying Connection...' : 'Retry Connection'}</span>
            </button>

            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-text-primary font-semibold text-xs transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Return to Homepage</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-text-muted mt-6">
          HealForge protects workspace data and synthetic patch pipelines. All workspace routes require active backend authentication.
        </p>
      </div>
    </div>
  );
};
