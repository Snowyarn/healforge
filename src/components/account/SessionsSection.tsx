import React, { useState } from 'react';
import type { ActiveSession } from '../../types/account';
import { accountService } from '../../services/accountService';
import { ModalBackdrop } from './AccountModals';

interface SessionsSectionProps {
  sessions: ActiveSession[];
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const SessionsSection: React.FC<SessionsSectionProps> = ({ sessions, onTriggerToast }) => {
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<ActiveSession | null>(null);

  const handleRevokeSingle = async (session: ActiveSession) => {
    if (session.isCurrent) {
      onTriggerToast({
        type: 'warning',
        title: 'Current Session',
        message: 'You cannot revoke your active working session from this list.',
      });
      return;
    }
    setSessionToRevoke(session);
  };

  const confirmRevokeSingle = async () => {
    if (!sessionToRevoke) return;
    const res = await accountService.revokeSession(sessionToRevoke.id);
    setSessionToRevoke(null);
    onTriggerToast({
      type: res.success ? 'success' : 'warning',
      title: res.success ? 'Session Revoked' : 'Error',
      message: res.message,
    });
  };

  const confirmRevokeAllOther = async () => {
    const res = await accountService.revokeAllOtherSessions();
    setShowRevokeAllModal(false);
    onTriggerToast({
      type: 'success',
      title: 'Sessions Terminated',
      message: res.message,
    });
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h2 className="text-lg font-bold font-headline-sm text-text-primary">
            Active Devices & Sessions
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Manage devices currently signed into your HealForge account. Revoke unfamiliar sessions.
          </p>
        </div>

        {otherSessionsCount > 0 && (
          <button
            onClick={() => setShowRevokeAllModal(true)}
            className="px-4 py-2 rounded-xl bg-surface-card hover:bg-status-critical/10 border border-border-subtle hover:border-status-critical/30 text-xs font-semibold text-status-critical flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Revoke All Other Sessions ({otherSessionsCount})</span>
          </button>
        )}
      </div>

      {/* Session Cards List */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`p-5 rounded-2xl border transition-all ${
              session.isCurrent
                ? 'bg-surface-card border-primary/40 shadow-sm'
                : 'bg-surface-card border-border-subtle'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    session.isCurrent
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-container text-text-secondary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {session.device.toLowerCase().includes('phone')
                      ? 'smartphone'
                      : session.device.toLowerCase().includes('cli')
                      ? 'terminal'
                      : 'laptop_mac'}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-text-primary font-headline-sm">
                      {session.device}
                    </h3>
                    {session.isCurrent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-status-success/10 text-status-success border border-status-success/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                        This Device (Current)
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-text-muted">
                        Active {session.lastActive}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-text-secondary mt-1">
                    {session.browser} • {session.os}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-text-muted mt-2 flex-wrap font-mono text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      {session.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">lan</span>
                      IP: {session.ip}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      Signed in: {session.signInTime}
                    </span>
                  </div>
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  onClick={() => handleRevokeSingle(session)}
                  className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-status-critical/10 border border-border-subtle hover:border-status-critical/30 text-xs font-semibold text-text-secondary hover:text-status-critical transition-all shrink-0"
                >
                  Revoke Access
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal: Revoke Single Session */}
      <ModalBackdrop
        isOpen={!!sessionToRevoke}
        onClose={() => setSessionToRevoke(null)}
        title="Revoke Device Access"
        subtitle={`Disconnect ${sessionToRevoke?.device}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Are you sure you want to terminate the session for{' '}
            <strong className="text-text-primary">{sessionToRevoke?.device}</strong> located in{' '}
            <strong className="text-text-primary">{sessionToRevoke?.location}</strong> (IP:{' '}
            {sessionToRevoke?.ip})? This device will be signed out immediately.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              onClick={() => setSessionToRevoke(null)}
              className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmRevokeSingle}
              className="px-4 py-2 rounded-lg bg-status-critical text-white text-xs font-semibold hover:bg-status-critical/90 transition-all"
            >
              Confirm Revocation
            </button>
          </div>
        </div>
      </ModalBackdrop>

      {/* Confirmation Modal: Revoke All Other Sessions */}
      <ModalBackdrop
        isOpen={showRevokeAllModal}
        onClose={() => setShowRevokeAllModal(false)}
        title="Revoke All Other Sessions"
        subtitle={`Terminate ${otherSessionsCount} active login(s)`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-xl flex items-start gap-3">
            <span className="material-symbols-outlined text-status-warning text-[20px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="text-xs text-status-warning leading-relaxed">
              This will immediately invalidate session tokens across all other laptops, mobile devices, and CLI instances. Only your current browser session will remain active.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              onClick={() => setShowRevokeAllModal(false)}
              className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmRevokeAllOther}
              className="px-4 py-2 rounded-lg bg-status-critical text-white text-xs font-semibold hover:bg-status-critical/90 transition-all"
            >
              Revoke {otherSessionsCount} Sessions
            </button>
          </div>
        </div>
      </ModalBackdrop>
    </div>
  );
};
