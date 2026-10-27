import React, { useState } from 'react';
import type { TeamRole } from '../../types/account';

// Base Modal Shell
export const ModalBackdrop: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, subtitle, children }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-container/30">
          <div>
            <h3 className="text-body-lg font-headline-sm font-semibold text-text-primary">{title}</h3>
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// 1. Create API Key Modal
export const CreateApiKeyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, scopes: string[], expiryDays: number) => void;
}> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read:findings', 'write:patches']);
  const [expiryDays, setExpiryDays] = useState<number>(90);

  const availableScopes = [
    { id: 'read:findings', label: 'read:findings', desc: 'Query vulnerabilities, CWE taint traces, and CVSS scores' },
    { id: 'write:patches', label: 'write:patches', desc: 'Synthesize and stage AST patches in workbench' },
    { id: 'execute:sandbox', label: 'execute:sandbox', desc: 'Trigger gVisor microVM test runs and export test logs' },
    { id: 'admin:repos', label: 'admin:repos', desc: 'Manage repository webhooks and CI/CD triggers' },
  ];

  const handleToggleScope = (scopeId: string) => {
    if (scopes.includes(scopeId)) {
      setScopes(scopes.filter((s) => s !== scopeId));
    } else {
      setScopes([...scopes, scopeId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), scopes, expiryDays);
    setName('');
    onClose();
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="Create New API Key"
      subtitle="Issue an encrypted authentication credential for HealForge CLI or CI pipelines."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Key Name / Purpose
          </label>
          <input
            type="text"
            required
            placeholder="e.g. GitHub Actions CI Remediation"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-sm font-label-ui transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Expiration Period
          </label>
          <select
            value={expiryDays}
            onChange={(e) => setExpiryDays(Number(e.target.value))}
            className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-sm font-label-ui transition-all"
          >
            <option value={30}>30 Days (Recommended for short projects)</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days (Default for CI/CD)</option>
            <option value={365}>1 Year</option>
            <option value={0}>Never Expire (High Security Caution)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Granular API Scopes
          </label>
          <div className="space-y-2">
            {availableScopes.map((scope) => {
              const isChecked = scopes.includes(scope.id);
              return (
                <label
                  key={scope.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isChecked
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border-subtle hover:bg-surface-container/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleScope(scope.id)}
                    className="mt-0.5 rounded border-border-subtle text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-mono text-xs font-semibold text-text-primary block">
                      {scope.label}
                    </span>
                    <span className="text-xs text-text-muted block mt-0.5">{scope.desc}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || scopes.length === 0}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold transition-all disabled:opacity-50"
          >
            Generate Key
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

// 2. Reveal Secret Key Modal (One-time)
export const RevealApiKeyModal: React.FC<{
  isOpen: boolean;
  secret: string;
  keyName: string;
  onClose: () => void;
}> = ({ isOpen, secret, keyName, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="API Key Generated Successfully"
      subtitle={`Credentials generated for: ${keyName}`}
    >
      <div className="space-y-4">
        <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-xl flex items-start gap-3">
          <span className="material-symbols-outlined text-status-warning text-[20px] shrink-0 mt-0.5">
            warning
          </span>
          <div className="text-xs text-status-warning leading-relaxed">
            <strong>Important:</strong> Copy and store this secret key in a secure vault now. For your security, this key cannot be retrieved again after you close this modal.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Secret Access Token
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={secret}
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-dark border border-outline/20 font-mono text-xs text-primary-fixed outline-none select-all"
            />
            <button
              onClick={handleCopy}
              className="px-3.5 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-border-subtle flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-text-primary text-xs font-semibold transition-colors"
          >
            I have secured this key
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// 3. Invite Team Member Modal
export const InviteTeamMemberModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onInvite: (name: string, email: string, role: TeamRole) => void;
}> = ({ isOpen, onClose, onInvite }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('Security Engineer');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onInvite(name.trim(), email.trim(), role);
    setName('');
    setEmail('');
    onClose();
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Team Member"
      subtitle="Add a collaborator to the Acme Corp HealForge workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Dr. Jordan Lee"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-sm font-label-ui transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Corporate Email Address
          </label>
          <input
            type="email"
            required
            placeholder="jordan.lee@acme-corp.internal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-sm font-label-ui transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Workspace Role & Permissions
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
            className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-sm font-label-ui transition-all"
          >
            <option value="Security Engineer">Security Engineer (Full workbench & patch synthesis)</option>
            <option value="Admin">Admin (Team management & repository configuration)</option>
            <option value="Developer">Developer (Read findings & trigger sandbox verification)</option>
            <option value="Viewer">Viewer (Read-only reports and audit exports)</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !email.trim()}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold transition-all disabled:opacity-50"
          >
            Send Invitation
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

// 4. Add Webhook Modal
export const AddWebhookModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string, events: string[]) => void;
}> = ({ isOpen, onClose, onAdd }) => {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['finding.detected', 'patch.generated']);

  const eventOptions = [
    { id: 'finding.detected', label: 'finding.detected', desc: 'New CWE or CVE identified via AST scan' },
    { id: 'patch.generated', label: 'patch.generated', desc: 'Autonomous AST patch ready for review' },
    { id: 'patch.approved', label: 'patch.approved', desc: 'Human reviewer approved remediated pull request' },
    { id: 'sandbox.verified', label: 'sandbox.verified', desc: 'gVisor microVM test execution completed' },
  ];

  const handleToggleEvent = (eventId: string) => {
    if (events.includes(eventId)) {
      setEvents(events.filter((e) => e !== eventId));
    } else {
      setEvents([...events, eventId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.startsWith('https://')) return;
    onAdd(url.trim(), events);
    setUrl('');
    onClose();
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="Add Webhook Endpoint"
      subtitle="Deliver HTTP POST payloads to your security automation pipelines."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Payload URL (HTTPS required)
          </label>
          <input
            type="url"
            required
            placeholder="https://security.example.com/hooks/healforge"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-sm font-label-ui transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Event Triggers
          </label>
          <div className="space-y-2">
            {eventOptions.map((opt) => {
              const isChecked = events.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isChecked
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border-subtle hover:bg-surface-container/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleEvent(opt.id)}
                    className="mt-0.5 rounded border-border-subtle text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-mono text-xs font-semibold text-text-primary block">
                      {opt.label}
                    </span>
                    <span className="text-xs text-text-muted block mt-0.5">{opt.desc}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!url.startsWith('https://') || events.length === 0}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold transition-all disabled:opacity-50"
          >
            Create Webhook
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

// 5. Update Payment Method Modal
export const UpdatePaymentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (brand: string, last4: string, expiryMonth: number, expiryYear: number) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = cardNumber.replace(/\s+/g, '');
    const last4 = cleanNum.slice(-4) || '4242';
    const [monthStr, yearStr] = expiry.split('/');
    const expiryMonth = parseInt(monthStr, 10) || 12;
    const expiryYear = parseInt(`20${yearStr || '28'}`, 10);
    onSave('Visa', last4, expiryMonth, expiryYear);
    onClose();
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="Update Payment Method"
      subtitle="Encrypted via 256-bit TLS. Billed under Acme Corp."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
            Card Number
          </label>
          <input
            type="text"
            required
            placeholder="4242 •••• •••• 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-sm font-mono transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Expiration (MM/YY)
            </label>
            <input
              type="text"
              required
              placeholder="08/28"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-sm font-mono transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              CVC Security Code
            </label>
            <input
              type="password"
              maxLength={4}
              required
              placeholder="•••"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-sm font-mono transition-all"
            />
          </div>
        </div>

        <p className="text-[11px] text-text-muted flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">lock</span>
          Simulated Payment Processor — No actual charges will be executed.
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold transition-all"
          >
            Save Card
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

// 6. Delete Account Typed Confirmation Modal
export const DeleteAccountModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
}> = ({ isOpen, onClose, onConfirmDelete }) => {
  const [typedConfirm, setTypedConfirm] = useState('');
  const requiredPhrase = 'DELETE MY ACCOUNT';
  const isMatch = typedConfirm === requiredPhrase;

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Account & Workspace Data"
      subtitle="This action is permanently irreversible."
    >
      <div className="space-y-4">
        <div className="p-3 bg-status-critical/10 border border-status-critical/30 rounded-xl flex items-start gap-3">
          <span className="material-symbols-outlined text-status-critical text-[20px] shrink-0 mt-0.5">
            dangerous
          </span>
          <div className="text-xs text-status-critical leading-relaxed">
            <strong>Warning:</strong> Deleting your account will immediately revoke all API tokens, disconnect all repository webhooks, and purge stored taint analysis cache.
          </div>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          To confirm that you truly intend to delete your account, please type{' '}
          <strong className="text-text-primary font-mono select-all bg-surface-container px-1 py-0.5 rounded">
            {requiredPhrase}
          </strong>{' '}
          in the box below:
        </p>

        <input
          type="text"
          value={typedConfirm}
          onChange={(e) => setTypedConfirm(e.target.value)}
          placeholder={`Type "${requiredPhrase}"`}
          className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container border border-status-critical/40 focus:border-status-critical focus:ring-1 focus:ring-status-critical outline-none text-text-primary text-sm font-mono transition-all"
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isMatch}
            onClick={() => {
              if (isMatch) {
                onConfirmDelete();
                onClose();
              }
            }}
            className="px-4 py-2 rounded-lg bg-status-critical text-white text-xs font-semibold hover:bg-status-critical/90 transition-all disabled:opacity-40"
          >
            Permanently Delete Account
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// 7. Recovery Codes Modal
export const RecoveryCodesModal: React.FC<{
  isOpen: boolean;
  codes: string[];
  onRegenerate: () => void;
  onClose: () => void;
}> = ({ isOpen, codes, onRegenerate, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title="Two-Factor Recovery Codes"
      subtitle="Use these backup codes to access your account if you lose your authenticator device."
    >
      <div className="space-y-4">
        <p className="text-xs text-text-secondary leading-relaxed">
          Each recovery code can only be used once. Store these emergency codes in an encrypted password manager or offline vault.
        </p>

        <div className="p-4 bg-surface-dark border border-outline/20 rounded-xl grid grid-cols-2 gap-2.5 font-mono text-xs text-primary-fixed">
          {codes.map((code, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-secondary-fixed-dim text-[10px] w-4">{idx + 1}.</span>
              <span>{code}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onRegenerate}
            className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Generate New Codes</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy Codes'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
};
