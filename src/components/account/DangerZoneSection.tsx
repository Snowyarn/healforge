import React, { useState } from 'react';
import { accountService } from '../../services/accountService';
import { DeleteAccountModal, ModalBackdrop } from './AccountModals';

interface DangerZoneSectionProps {
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
  onNavigateHome: () => void;
}

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  onTriggerToast,
  onNavigateHome,
}) => {
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleDeactivate = async () => {
    const res = await accountService.deactivateAccount();
    setIsDeactivateModalOpen(false);
    onTriggerToast({
      type: 'warning',
      title: 'Account Deactivated',
      message: res.message,
    });
  };

  const handleConfirmPermanentDelete = async () => {
    const res = await accountService.deleteAccount();
    onTriggerToast({
      type: 'warning',
      title: 'Account Purged',
      message: res.message,
    });
    setTimeout(() => {
      onNavigateHome();
    }, 1200);
  };

  const handleResetDemoData = () => {
    accountService.resetToDefaults();
    onTriggerToast({
      type: 'info',
      title: 'Demo Data Restored',
      message: 'Account settings, audit logs, and demo keys reset to initial workbench state.',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold font-headline-sm text-status-critical">
          Danger Zone
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Irreversible actions regarding account deactivation, repository disconnection, and data scrubbing.
        </p>
      </div>

      {/* Card 1: Account Deactivation */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
              Temporarily Deactivate Account
            </h3>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed max-w-xl">
              Freezes your account, pauses scheduled AST repository scans, and disables inbound webhooks. Your data and previous patch archives will be retained safely until you log back in.
            </p>
          </div>
          <button
            onClick={() => setIsDeactivateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-surface-container hover:bg-status-warning/10 border border-border-subtle hover:border-status-warning/30 text-xs font-semibold text-text-secondary hover:text-status-warning transition-all shrink-0"
          >
            Deactivate Account
          </button>
        </div>
      </div>

      {/* Card 2: Permanent Account Deletion */}
      <div className="bg-surface-card border border-status-critical/30 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-status-critical text-[20px]">
                warning
              </span>
              <h3 className="text-xs font-bold text-status-critical uppercase tracking-wider font-label-ui">
                Permanently Delete Account & Workspace
              </h3>
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed max-w-xl">
              Immediately purges your profile, revokes all API tokens, disconnects GitHub/GitLab integrations, and scrubs all generated AST patches. <strong>This action cannot be undone.</strong>
            </p>
          </div>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-status-critical hover:bg-status-critical/90 text-white text-xs font-semibold transition-all shrink-0 shadow-sm"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Card 3: Reset Demo State */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
              Reset Demo State to Initial Defaults
            </h3>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed max-w-xl">
              Restore default test account parameters, default API keys, and sample audit activity. Useful when testing the interface.
            </p>
          </div>
          <button
            onClick={handleResetDemoData}
            className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary transition-all shrink-0 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>

      {/* Deactivate Confirmation Modal */}
      <ModalBackdrop
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        title="Confirm Account Deactivation"
        subtitle="Temporarily pause automated scanners and token authentication"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Are you sure you want to pause your account? Active CI/CD triggers will return HTTP 403 until you re-authenticate.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              onClick={() => setIsDeactivateModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              className="px-4 py-2 rounded-lg bg-status-warning text-white text-xs font-semibold hover:bg-status-warning/90 transition-all"
            >
              Confirm Deactivation
            </button>
          </div>
        </div>
      </ModalBackdrop>

      {/* Permanent Deletion Modal */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirmDelete={handleConfirmPermanentDelete}
      />
    </div>
  );
};
