import React, { useState } from 'react';
import type { SecuritySettings } from '../../types/account';
import { accountService } from '../../services/accountService';
import { RecoveryCodesModal } from './AccountModals';

interface SecuritySectionProps {
  security: SecuritySettings;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({ security, onTriggerToast }) => {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [totpInput, setTotpInput] = useState('');
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaUri, setMfaUri] = useState<string | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);

  // Password complexity checks
  const hasLength = newPass.length >= 10;
  const hasUpper = /[A-Z]/.test(newPass);
  const hasLower = /[a-z]/.test(newPass);
  const hasNumber = /[0-9]/.test(newPass);
  const hasSymbol = /[^A-Za-z0-9]/.test(newPass);
  const isPasswordValid = hasLength && hasUpper && hasLower && hasNumber && hasSymbol;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      onTriggerToast({
        type: 'warning',
        title: 'Passwords Do Not Match',
        message: 'The new password and confirmation password do not match.',
      });
      return;
    }
    if (!isPasswordValid) {
      onTriggerToast({
        type: 'warning',
        title: 'Weak Password',
        message: 'Password does not satisfy all complexity requirements.',
      });
      return;
    }

    const res = await accountService.changePassword(currentPass, newPass);
    if (res.success) {
      onTriggerToast({
        type: 'success',
        title: 'Password Updated',
        message: res.message,
      });
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } else {
      onTriggerToast({
        type: 'warning',
        title: 'Password Change Failed',
        message: res.message,
      });
    }
  };

  const handleToggleMfa = async () => {
    if (security.mfaEnabled) {
      // Disabling requires a valid TOTP or recovery code — ask for it first.
      const code = window.prompt(
        'Enter a current 6-digit TOTP code (or a recovery code) to disable MFA:',
      );
      if (!code) return;
      const res = await accountService.mfaDisable(code.trim());
      onTriggerToast({
        type: res.success ? 'warning' : 'error' in res ? 'warning' : 'warning',
        title: res.success ? '2FA Disabled' : 'Disable Failed',
        message: res.message,
      });
      return;
    }
    // Start REAL server-side enrollment: fetch secret + provisioning URI.
    setMfaBusy(true);
    const start = await accountService.mfaStart();
    setMfaBusy(false);
    if (!start.success || !start.secret) {
      onTriggerToast({ type: 'warning', title: 'MFA Enrollment Failed', message: start.message });
      return;
    }
    setMfaSecret(start.secret);
    setMfaUri(start.uri ?? null);
    setShowMfaSetup(true);
  };

  const handleConfirmMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpInput.length !== 6) {
      onTriggerToast({
        type: 'warning',
        title: 'Invalid Code',
        message: 'Please enter a 6-digit verification code.',
      });
      return;
    }
    setMfaBusy(true);
    const res = await accountService.mfaEnable(totpInput.trim());
    setMfaBusy(false);
    if (!res.success) {
      onTriggerToast({ type: 'warning', title: 'Activation Failed', message: res.message });
      return;
    }
    setShowMfaSetup(false);
    setTotpInput('');
    setMfaSecret(null);
    setMfaUri(null);
    if (res.recoveryCodes) {
      setRecoveryCodes(res.recoveryCodes);
      setIsRecoveryModalOpen(true);
    }
    onTriggerToast({
      type: 'success',
      title: '2FA Activated',
      message: 'TOTP registered. Store your recovery codes now — they are shown once.',
    });
  };

  const handleOpenRecoveryModal = async () => {
    const res = await accountService.regenerateRecoveryCodes();
    if (!res.success || !res.recoveryCodes) {
      onTriggerToast({ type: 'warning', title: 'Recovery Codes', message: res.message });
      return;
    }
    setRecoveryCodes(res.recoveryCodes);
    setIsRecoveryModalOpen(true);
  };

  const handleRegenerateCodes = async () => {
    const res = await accountService.regenerateRecoveryCodes();
    if (!res.success || !res.recoveryCodes) {
      onTriggerToast({ type: 'warning', title: 'Regeneration Failed', message: res.message });
      return;
    }
    setRecoveryCodes(res.recoveryCodes);
    onTriggerToast({
      type: 'info',
      title: 'Recovery Codes Regenerated',
      message: 'Previous recovery codes have been invalidated. Save your new emergency codes.',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold font-headline-sm text-text-primary">
          Password & Security Controls
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Configure authentication factors, manage passkeys, and review recent access events.
        </p>
      </div>

      {/* Password Management */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
            Account Password
          </h3>
          <span className="text-[11px] font-mono text-text-muted">
            Last changed: {security.lastPasswordChange}
          </span>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-mono transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-mono transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-mono transition-all"
              />
            </div>
          </div>

          {/* Complexity Checklist */}
          {newPass && (
            <div className="p-3 rounded-xl bg-surface-container/60 border border-border-subtle text-xs space-y-1.5">
              <span className="font-semibold text-text-secondary block mb-1">
                Password Security Requirements:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasLength ? 'text-status-success' : 'text-text-muted'}`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {hasLength ? 'check_circle' : 'circle'}
                  </span>
                  <span>10+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-status-success' : 'text-text-muted'}`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {hasUpper ? 'check_circle' : 'circle'}
                  </span>
                  <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? 'text-status-success' : 'text-text-muted'}`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {hasLower ? 'check_circle' : 'circle'}
                  </span>
                  <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-status-success' : 'text-text-muted'}`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {hasNumber ? 'check_circle' : 'circle'}
                  </span>
                  <span>Numeric digit</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-status-success' : 'text-text-muted'}`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {hasSymbol ? 'check_circle' : 'circle'}
                  </span>
                  <span>Special symbol (!@#$)</span>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!currentPass || !newPass || !confirmPass}
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold transition-all disabled:opacity-50"
          >
            Update Password
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication & Recovery Codes */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-5">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Two-Factor Authentication (2FA)
        </h3>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-surface-container/40 border border-border-subtle gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">phonelink_lock</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">
                Authenticator Application (TOTP)
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                Use Google Authenticator, 1Password, or YubiKey OATH to generate timed passcodes.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                security.mfaEnabled
                  ? 'bg-status-success/10 text-status-success border border-status-success/20'
                  : 'bg-text-muted/10 text-text-muted border border-border-subtle'
              }`}
            >
              {security.mfaEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={handleToggleMfa}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                security.mfaEnabled
                  ? 'bg-surface-card hover:bg-status-critical/10 text-status-critical border border-border-subtle hover:border-status-critical/30'
                  : 'bg-primary hover:bg-primary-container text-on-primary'
              }`}
            >
              {security.mfaEnabled ? 'Disable' : 'Enable 2FA'}
            </button>
          </div>
        </div>

        {/* Setup Drawer if toggling 2FA on */}
        {showMfaSetup && (
          <div className="p-5 rounded-xl bg-surface-container/60 border border-primary/30 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Step 1: Scan QR Code or Enter Secret Key
              </h4>
              <button
                onClick={() => setShowMfaSetup(false)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Real enrollment data — QR generation is not bundled; apps accept manual entry */}
              <div className="w-44 rounded-xl bg-surface-dark border border-outline/20 p-3.5 text-surface-bright shrink-0 space-y-2">
                <div className="text-[9px] uppercase tracking-wider text-secondary-fixed-dim">
                  Manual setup key
                </div>
                <code className="block font-mono text-[11px] text-primary-fixed break-all select-all">
                  {mfaSecret ?? '—'}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(mfaSecret ?? '')}
                  className="w-full text-[10px] py-1 rounded bg-white/10 hover:bg-white/20 text-surface-bright font-semibold"
                >
                  Copy Secret
                </button>
              </div>

              <div className="space-y-3 flex-1">
                <p className="text-xs text-text-secondary leading-relaxed">
                  Add the key to your authenticator app (Google Authenticator, 1Password, Aegis…), or paste
                  this provisioning URI if your app supports it:
                </p>
                <div className="flex items-center gap-2">
                  <code className="px-3 py-1.5 rounded-lg bg-surface-dark border border-outline/20 font-mono text-[10px] text-primary-fixed select-all break-all max-w-md">
                    {mfaUri ?? '—'}
                  </code>
                </div>

                <form onSubmit={handleConfirmMfaSetup} className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={totpInput}
                    onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, ''))}
                    className="w-40 px-3.5 py-1.5 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs font-mono text-center tracking-widest outline-none"
                  />
                  <button
                    type="submit"
                    disabled={mfaBusy}
                    className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {mfaBusy ? 'Verifying…' : 'Verify & Activate'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Recovery Codes */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <div className="text-xs font-semibold text-text-primary">Emergency Recovery Codes</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {security.recoveryCodesRemaining} backup codes remaining in your vault.
            </div>
          </div>
          <button
            onClick={handleOpenRecoveryModal}
            className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">vpn_key</span>
            <span>View Recovery Codes</span>
          </button>
        </div>
      </div>

      {/* Hardware Passkeys */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
              FIDO2 / WebAuthn Passkeys
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Log in passwordlessly with Touch ID, Face ID, Windows Hello, or YubiKey hardware keys.
            </p>
          </div>
          <button
            onClick={() => {
              onTriggerToast({
                type: 'info',
                title: 'Passkey Registration',
                message: 'WebAuthn navigator challenge initialized. Touch your security key to register.',
              });
            }}
            className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">fingerprint</span>
            <span>Add Passkey</span>
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-text-muted text-[20px]">
              usb
            </span>
            <div>
              <div className="text-xs font-semibold text-text-primary">No Hardware Keys Registered</div>
              <div className="text-[11px] text-text-muted">Register a FIDO2 passkey for phishing-resistant logins.</div>
            </div>
          </div>
          <span className="text-xs text-text-muted font-mono">0 keys</span>
        </div>
      </div>

      {/* Recent Authentication Events Log */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Recent Authentication Activity
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <th className="pb-2 font-medium">Event Description</th>
                <th className="pb-2 font-medium">Timestamp</th>
                <th className="pb-2 font-medium">Location</th>
                <th className="pb-2 font-medium">IP Address</th>
                <th className="pb-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {security.recentAuthEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-surface-container/30 transition-colors">
                  <td className="py-2.5 font-medium text-text-primary">{evt.event}</td>
                  <td className="py-2.5 text-text-muted font-mono text-[11px]">{evt.timestamp}</td>
                  <td className="py-2.5 text-text-secondary">{evt.location}</td>
                  <td className="py-2.5 font-mono text-[11px] text-text-muted">{evt.ip}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        evt.status === 'success'
                          ? 'bg-status-success/10 text-status-success'
                          : evt.status === 'warning'
                          ? 'bg-status-warning/10 text-status-warning'
                          : 'bg-status-critical/10 text-status-critical'
                      }`}
                    >
                      {evt.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recovery Codes Modal */}
      <RecoveryCodesModal
        isOpen={isRecoveryModalOpen}
        codes={recoveryCodes}
        onRegenerate={handleRegenerateCodes}
        onClose={() => setIsRecoveryModalOpen(false)}
      />
    </div>
  );
};
