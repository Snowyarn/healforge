import React, { useState } from 'react';
import type { UserProfile } from '../../types/account';
import { accountService } from '../../services/accountService';

interface EmailSectionProps {
  profile: UserProfile;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const EmailSection: React.FC<EmailSectionProps> = ({ profile, onTriggerToast }) => {
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail !== confirmEmail) {
      onTriggerToast({
        type: 'warning',
        title: 'Email Mismatch',
        message: 'The new email address and confirmation do not match.',
      });
      return;
    }
    if (password.length < 6) {
      onTriggerToast({
        type: 'warning',
        title: 'Re-authentication Required',
        message: 'Please provide your account password to verify identity.',
      });
      return;
    }

    setIsSubmitting(true);
    const result = accountService.requestEmailChange(newEmail.trim());
    setIsSubmitting(false);

    if (result.success) {
      onTriggerToast({
        type: 'success',
        title: 'Verification Link Dispatched',
        message: result.message,
      });
      setNewEmail('');
      setConfirmEmail('');
      setPassword('');
    } else {
      onTriggerToast({
        type: 'warning',
        title: 'Request Failed',
        message: result.message,
      });
    }
  };

  const handleResend = () => {
    const res = accountService.resendEmailVerification();
    onTriggerToast({
      type: res.success ? 'info' : 'warning',
      title: 'Email Dispatch',
      message: res.message,
    });
  };

  const handleCancelPending = () => {
    accountService.cancelPendingEmail();
    onTriggerToast({
      type: 'info',
      title: 'Email Change Cancelled',
      message: 'Pending email address change has been discarded.',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold font-headline-sm text-text-primary">
          Email & Account Identity
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Manage your verified authentication address and security notification channels.
        </p>
      </div>

      {/* Current Email Status Card */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Current Primary Email
        </h3>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-surface-container/40 border border-border-subtle gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">mark_email_read</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary font-mono">{profile.email}</div>
              <div className="text-xs text-text-muted mt-0.5">
                Primary address for AST reports, sandbox alerts, and workspace billing.
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-status-success/10 text-status-success border border-status-success/20">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            Verified
          </span>
        </div>
      </div>

      {/* Pending Email Verification Banner if Active */}
      {profile.pendingEmail && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-status-warning text-[24px] shrink-0 mt-0.5">
                pending
              </span>
              <div>
                <h4 className="text-sm font-bold text-text-primary">
                  Pending Email Verification in Progress
                </h4>
                <p className="text-xs text-text-secondary mt-1">
                  A verification confirmation was dispatched to{' '}
                  <strong className="font-mono text-text-primary">{profile.pendingEmail}</strong>.
                  Your primary email will switch once confirmed.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResend}
                className="px-3.5 py-1.5 rounded-lg bg-surface-card hover:bg-surface-container border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                Resend Verification
              </button>
              <button
                onClick={handleCancelPending}
                className="px-3.5 py-1.5 rounded-lg bg-surface-card hover:bg-status-critical/10 border border-border-subtle hover:border-status-critical/30 text-xs font-semibold text-status-critical flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Cancel Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Email Form */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Update Email Address
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          Changing your primary email requires re-entering your account password for security. You will need to verify the new inbox before the transition completes.
        </p>

        <form onSubmit={handleRequestChange} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              New Email Address
            </label>
            <input
              type="email"
              required
              placeholder="e.g. alex.vance@security.acme.org"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Confirm New Email Address
            </label>
            <input
              type="email"
              required
              placeholder="Re-enter your new email address"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Confirm Account Password (Re-authentication)
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-mono transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !newEmail || !confirmEmail || !password}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span>
              <span>Send Verification Link</span>
            </button>
          </div>
        </form>

        {/* Honest Architecture Disclosure */}
        <div className="mt-4 p-3 rounded-xl bg-surface-container/60 border border-border-subtle text-[11px] text-text-muted leading-relaxed flex items-start gap-2.5">
          <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
            info
          </span>
          <div>
            <strong>Architecture Notice:</strong> In a production cluster, an HMAC-signed token is dispatched through Amazon SES or SendGrid. In this standalone workbench demo, requests simulate verification lifecycle via persistent local storage.
          </div>
        </div>
      </div>
    </div>
  );
};
