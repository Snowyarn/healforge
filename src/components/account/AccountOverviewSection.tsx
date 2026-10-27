import React from 'react';
import type { AccountState, SettingsSectionId } from '../../types/account';

interface AccountOverviewSectionProps {
  state: AccountState;
  onNavigateSection: (sectionId: SettingsSectionId) => void;
}

export const AccountOverviewSection: React.FC<AccountOverviewSectionProps> = ({
  state,
  onNavigateSection,
}) => {
  const { profile, security, sessions, subscription, apiKeys, integrations, team } = state;

  const scansPercentage = Math.round(
    (subscription.usage.scansUsed / subscription.usage.scansLimit) * 100
  );
  const sandboxPercentage = Math.round(
    (subscription.usage.sandboxMinutesUsed / subscription.usage.sandboxMinutesLimit) * 100
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Primary Identity Card */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary text-on-primary font-headline-sm text-2xl font-bold flex items-center justify-center shadow-md">
              {profile.avatarInitials}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-text-primary tracking-tight font-headline-sm">
                  {profile.fullName}
                </h2>
                <span className="font-mono text-xs bg-surface-container text-text-muted px-2 py-0.5 rounded-full">
                  @{profile.username}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-status-success/10 text-status-success border border-status-success/20">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Verified Identity
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {profile.jobTitle} • {profile.department} ({profile.organization})
              </p>
              <div className="flex items-center gap-4 text-xs text-text-muted mt-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">mail</span>
                  {profile.email}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {profile.location}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onNavigateSection('profile')}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center justify-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Edit Profile
            </button>
            <button
              onClick={() => onNavigateSection('security')}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">lock_reset</span>
              Security
            </button>
          </div>
        </div>

        {profile.bio && (
          <div className="mt-5 pt-5 border-t border-border-subtle/60 text-xs text-text-secondary leading-relaxed">
            {profile.bio}
          </div>
        )}
      </div>

      {/* Grid: Security Health & Active Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security Health Scorecard */}
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  security
                </span>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-label-ui">
                  Security Posture
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-success/10 text-status-success border border-status-success/20">
                Optimal
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container/50 border border-border-subtle/50">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-status-success text-[18px]">
                    check_circle
                  </span>
                  <span className="text-xs font-medium text-text-primary">Two-Factor Authentication</span>
                </div>
                <span className="text-[11px] font-mono text-status-success bg-status-success/10 px-2 py-0.5 rounded">
                  {security.mfaEnabled ? 'Authenticator App (Active)' : 'Disabled'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container/50 border border-border-subtle/50">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">devices</span>
                  <span className="text-xs font-medium text-text-primary">Active Login Sessions</span>
                </div>
                <span className="text-[11px] font-mono text-text-secondary">
                  {sessions.length} devices logged in
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container/50 border border-border-subtle/50">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-text-muted text-[18px]">key</span>
                  <span className="text-xs font-medium text-text-primary">Active API Tokens</span>
                </div>
                <span className="text-[11px] font-mono text-text-secondary">
                  {apiKeys.filter((k) => k.status === 'active').length} active tokens
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border-subtle/60 flex items-center justify-between">
            <span className="text-[11px] text-text-muted font-mono">
              Password updated {security.lastPasswordChange}
            </span>
            <button
              onClick={() => onNavigateSection('security')}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>Manage Security</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Subscription & Resource Consumption */}
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  credit_card
                </span>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-label-ui">
                  Active Subscription
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                {subscription.name}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-text-secondary font-medium">AST Vulnerability Scans</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {subscription.usage.scansUsed} / {subscription.usage.scansLimit} ({scansPercentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(scansPercentage, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-text-secondary font-medium">gVisor Sandbox Minutes</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {subscription.usage.sandboxMinutesUsed} / {subscription.usage.sandboxMinutesLimit} min ({sandboxPercentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full bg-[#0284c7] rounded-full transition-all"
                    style={{ width: `${Math.min(sandboxPercentage, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 text-text-muted">
                <span>Team Seats: {subscription.usage.teamMembersCount} / {subscription.usage.teamMembersLimit} seats</span>
                <span>Renews: {subscription.nextRenewal}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border-subtle/60 flex items-center justify-between">
            <span className="text-[11px] text-text-muted font-mono">
              Billed {subscription.billingInterval}ly
            </span>
            <button
              onClick={() => onNavigateSection('billing')}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>Manage Billing & Quota</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Connected Integrations & Workspace Summary */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-label-ui">
              Integrated Platforms & Team
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Workflows connected to automated PR generation and security webhook alerts.
            </p>
          </div>
          <button
            onClick={() => onNavigateSection('integrations')}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>All Integrations</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {integrations.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                item.connected
                  ? 'bg-surface-container/40 border-border-subtle'
                  : 'bg-surface/50 border-border-subtle/40 opacity-60'
              }`}
            >
              <span className="material-symbols-outlined text-primary text-[22px]">
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-text-primary truncate">{item.name}</div>
                <div className="text-[10px] text-text-muted flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.connected ? 'bg-status-success' : 'bg-text-muted'
                    }`}
                  />
                  <span>{item.connected ? 'Connected' : 'Not linked'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-border-subtle/60 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="material-symbols-outlined text-text-muted text-[18px]">group</span>
            <span>
              Workspace <strong>{profile.organization}</strong> has {team.length} active members.
            </span>
          </div>
          <button
            onClick={() => onNavigateSection('team')}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Manage Team Members</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
