import React, { useState } from 'react';
import type { PrivacyPreferences, SettingsSectionId } from '../../types/account';
import { accountService } from '../../services/accountService';

interface PrivacySectionProps {
  privacy: PrivacyPreferences;
  onNavigateSection: (sectionId: SettingsSectionId) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const PrivacySection: React.FC<PrivacySectionProps> = ({
  privacy: initialPrivacy,
  onNavigateSection,
  onTriggerToast,
}) => {
  const [privacy, setPrivacy] = useState<PrivacyPreferences>(initialPrivacy);

  const handleToggle = async (key: keyof PrivacyPreferences) => {
    const updated = {
      ...privacy,
      [key]: !privacy[key],
    };
    setPrivacy(updated);
    accountService.updatePrivacyPreferences(updated);
    onTriggerToast({
      type: 'success',
      title: 'Privacy Setting Saved',
      message: `Preference for ${String(key)} has been updated.`,
    });
  };

  const handleRetentionChange = (months: number) => {
    const updated = {
      ...privacy,
      dataRetentionMonths: months,
    };
    setPrivacy(updated);
    accountService.updatePrivacyPreferences(updated);
    onTriggerToast({
      type: 'success',
      title: 'Retention Policy Updated',
      message: `Analysis cache retention adjusted to ${months} months.`,
    });
  };

  const handleExportData = async () => {
    const res = await accountService.downloadDataExport();
    onTriggerToast({
      type: res.success ? 'success' : 'warning',
      title: res.success ? 'Export Downloaded' : 'Export Failed',
      message: res.message,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold font-headline-sm text-text-primary">
          Privacy & Data Governance
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Control telemetry sharing, analysis cache retention policies, and export your personal data archive.
        </p>
      </div>

      {/* Telemetry & Analytics Toggles */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Data Sharing & Telemetry
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle">
            <div>
              <div className="text-xs font-semibold text-text-primary">
                Product Usage Telemetry
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Share anonymized interaction metrics to help improve AST synthesis workflows.
              </div>
            </div>
            <button
              onClick={() => handleToggle('telemetryOptIn')}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                privacy.telemetryOptIn ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  privacy.telemetryOptIn ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle">
            <div>
              <div className="text-xs font-semibold text-text-primary">
                Automated Crash & Error Reporting
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Automatically send stack traces when a sandbox container run encounters an unhandled exception.
              </div>
            </div>
            <button
              onClick={() => handleToggle('crashReporting')}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                privacy.crashReporting ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  privacy.crashReporting ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle">
            <div>
              <div className="text-xs font-semibold text-text-primary">
                Product Security Advisory Bulletins
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Receive email alerts regarding newly uncovered zero-days affecting monitored dependencies.
              </div>
            </div>
            <button
              onClick={() => handleToggle('productUpdates')}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                privacy.productUpdates ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  privacy.productUpdates ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Cache Retention Policy */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          AST Analysis Data Retention
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          Specify how long ephemeral sandbox execution artifacts and AST taint traces are stored in our encrypted storage before automated purging.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[6, 12, 24, 36].map((months) => (
            <button
              key={months}
              onClick={() => handleRetentionChange(months)}
              className={`p-3 rounded-xl border text-center transition-all ${
                privacy.dataRetentionMonths === months
                  ? 'border-primary bg-primary/10 text-primary font-bold'
                  : 'border-border-subtle hover:bg-surface-container/50 text-text-secondary'
              }`}
            >
              <div className="text-sm font-headline-sm">{months} Months</div>
              <div className="text-[10px] text-text-muted mt-0.5">Automated Purge</div>
            </button>
          ))}
        </div>
      </div>

      {/* Data Export (Real Download) */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
              Export Account Data Archive
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Download a machine-readable JSON bundle containing your entire profile, credentials manifest, and audit logs.
            </p>
          </div>
          <button
            onClick={handleExportData}
            className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export JSON Archive</span>
          </button>
        </div>
      </div>

      {/* Danger Zone Link */}
      <div className="p-4 rounded-xl bg-status-critical/5 border border-status-critical/20 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-status-critical block">Looking to close your account?</span>
          <span className="text-[11px] text-text-muted">
            Permanent account deletion and data scrubbing are managed in the Danger Zone.
          </span>
        </div>
        <button
          onClick={() => onNavigateSection('danger-zone')}
          className="text-xs font-semibold text-status-critical hover:underline flex items-center gap-1"
        >
          <span>Go to Danger Zone</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
