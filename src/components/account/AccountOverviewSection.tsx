import React from 'react';
import type { AccountState, SettingsSectionId } from '../../types/account';

interface AccountOverviewSectionProps {
  state: AccountState;
  onNavigateSection: (section: SettingsSectionId) => void;
}

/** Account overview — identity, security posture and honest workspace stats. */
export const AccountOverviewSection: React.FC<AccountOverviewSectionProps> = ({
  state,
  onNavigateSection,
}) => {
  const { profile, security, sessions, apiKeys, integrations, team } = state;

  const connectedIntegrations = integrations.filter((i) => i.connected).length;
  const activeKeys = apiKeys.filter((k) => k.status === 'active').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Primary Identity Card */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary text-lg font-bold flex items-center justify-center shadow-sm">
              {profile.avatarInitials}
            </div>
            <div>
              <h2 className="text-lg font-bold font-headline-sm text-text-primary">
                {profile.displayName || profile.fullName}
              </h2>
              <p className="text-xs text-text-muted font-mono mt-0.5">
                @{profile.username} • {profile.role}
                {profile.organization ? ` • ${profile.organization}` : ''}
              </p>
              <p className="text-xs text-text-secondary mt-1">{profile.jobTitle}</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateSection('profile')}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary self-start"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'MFA Status',
            value: security.mfaEnabled ? 'Enabled' : 'Disabled',
            hint: security.mfaEnabled ? security.mfaMethod.replace('_', ' ') : 'Enable in Security',
            tone: security.mfaEnabled ? 'text-status-success' : 'text-status-high',
            icon: 'shield',
            section: 'security' as SettingsSectionId,
          },
          {
            label: 'Active Sessions',
            value: sessions.length,
            hint: 'Manage in Sessions',
            tone: 'text-text-primary',
            icon: 'devices',
            section: 'sessions' as SettingsSectionId,
          },
          {
            label: 'API Keys',
            value: activeKeys,
            hint: `${apiKeys.length} total`,
            tone: 'text-text-primary',
            icon: 'key',
            section: 'api-keys' as SettingsSectionId,
          },
          {
            label: 'Team Members',
            value: team.length,
            hint: `${connectedIntegrations} integrations configured`,
            tone: 'text-text-primary',
            icon: 'group',
            section: 'team' as SettingsSectionId,
          },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => onNavigateSection(stat.section)}
            className="bg-surface-card border border-border-subtle rounded-2xl p-4 text-left hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                {stat.label}
              </span>
              <span className="material-symbols-outlined text-text-muted text-[16px]">{stat.icon}</span>
            </div>
            <div className={`text-xl font-bold font-headline-sm mt-2 ${stat.tone}`}>{stat.value}</div>
            <div className="text-[10px] text-text-muted mt-0.5">{stat.hint}</div>
          </button>
        ))}
      </div>

      {/* Honest billing state */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary text-[20px]">card_membership</span>
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-label-ui">
            Subscription
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-surface-container text-text-muted border border-border-subtle">
            Not Configured
          </span>
        </div>
        <div className="text-xs text-text-secondary leading-relaxed">
          <p className="font-semibold text-text-primary mb-1">Billing is not configured in this deployment</p>
          <p>
            No payment provider credentials exist, so no plan, usage meters or invoices are shown. HealForge does
            not store card data and never simulates billing information.
          </p>
          <p className="text-[11px] text-text-muted mt-2">
            Operator setup: configure a payment provider in the backend secret store to enable this section.
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-border-subtle/60 flex items-center justify-between">
          <span className="text-[11px] text-text-muted font-mono">No active subscription</span>
          <button
            onClick={() => onNavigateSection('billing')}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Billing Settings</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Recent security activity */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">security</span>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-label-ui">
              Recent Security Events
            </h3>
          </div>
          <button
            onClick={() => onNavigateSection('security')}
            className="text-xs text-primary font-semibold hover:underline"
          >
            View All
          </button>
        </div>
        <div className="divide-y divide-border-subtle/50">
          {security.recentAuthEvents.slice(0, 4).map((evt) => (
            <div key={evt.id} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-text-primary font-medium">{evt.event}</span>
                <p className="text-[11px] text-text-muted mt-0.5 font-mono">
                  {evt.timestamp} • {evt.ip}
                </p>
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                  evt.status === 'success' ? 'bg-status-success/10 text-status-success' : 'bg-status-high/10 text-status-high'
                }`}
              >
                {evt.status}
              </span>
            </div>
          ))}
          {security.recentAuthEvents.length === 0 && (
            <p className="py-4 text-xs text-text-muted text-center">No auth events recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
