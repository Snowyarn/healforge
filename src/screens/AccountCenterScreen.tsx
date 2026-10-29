import React, { useState, useMemo } from 'react';
import type { ScreenId } from '../types';
import type { SettingsSectionId } from '../types/account';
import { useAccountState } from '../services/accountService';
import { AccountOverviewSection } from '../components/account/AccountOverviewSection';
import { ProfileSection } from '../components/account/ProfileSection';
import { EmailSection } from '../components/account/EmailSection';
import { SecuritySection } from '../components/account/SecuritySection';
import { SessionsSection } from '../components/account/SessionsSection';
import { BillingSection } from '../components/account/BillingSection';
import { ApiKeysSection } from '../components/account/ApiKeysSection';
import { PrivacySection } from '../components/account/PrivacySection';
import { NotificationsSection } from '../components/account/NotificationsSection';
import { IntegrationsSection } from '../components/account/IntegrationsSection';
import { TeamSection } from '../components/account/TeamSection';
import { PreferencesSection } from '../components/account/PreferencesSection';
import { ActivitySection } from '../components/account/ActivitySection';
import { SupportSection } from '../components/account/SupportSection';
import { DangerZoneSection } from '../components/account/DangerZoneSection';

interface AccountCenterScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
  initialSection?: SettingsSectionId;
}

interface NavCategory {
  category: string;
  items: {
    id: SettingsSectionId;
    label: string;
    icon: string;
    danger?: boolean;
  }[];
}

const SETTINGS_CATEGORIES: NavCategory[] = [
  {
    category: 'Account & Identity',
    items: [
      { id: 'overview', label: 'Overview', icon: 'account_circle' },
      { id: 'profile', label: 'Personal & Professional', icon: 'badge' },
      { id: 'email', label: 'Email Identity', icon: 'alternate_email' },
    ],
  },
  {
    category: 'Security & Access',
    items: [
      { id: 'security', label: 'Password & 2FA', icon: 'lock_reset' },
      { id: 'sessions', label: 'Devices & Sessions', icon: 'devices' },
      { id: 'api-keys', label: 'API Keys & Webhooks', icon: 'key' },
    ],
  },
  {
    category: 'Organization & Billing',
    items: [
      { id: 'billing', label: 'Subscription & Quota', icon: 'credit_card' },
      { id: 'team', label: 'Team Members', icon: 'group' },
      { id: 'integrations', label: 'Connected Apps', icon: 'extension' },
    ],
  },
  {
    category: 'Preferences & Governance',
    items: [
      { id: 'privacy', label: 'Privacy & Data Export', icon: 'shield' },
      { id: 'notifications', label: 'Notifications', icon: 'notifications' },
      { id: 'preferences', label: 'Appearance & Locale', icon: 'palette' },
      { id: 'activity', label: 'Audit Security Log', icon: 'history' },
    ],
  },
  {
    category: 'Support & Safety',
    items: [
      { id: 'support', label: 'Help & Docs', icon: 'help' },
      { id: 'danger-zone', label: 'Danger Zone', icon: 'dangerous', danger: true },
    ],
  },
];

export const AccountCenterScreen: React.FC<AccountCenterScreenProps> = ({
  onNavigate,
  onTriggerToast,
  initialSection = 'overview',
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(initialSection);
  const [searchQuery, setSearchQuery] = useState('');
  const state = useAccountState();

  // Filter categories and navigation items based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return SETTINGS_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return SETTINGS_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) => item.label.toLowerCase().includes(q) || cat.category.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  // Account data loads from the backend; show a loading state until hydrated.
  if (!state) {
    return (
      <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
        <div className="bg-surface-card border border-border-subtle rounded-2xl h-28 animate-pulse" />
        <div className="bg-surface-card border border-border-subtle rounded-2xl h-96 animate-pulse" />
      </div>
    );
  }

  // Find active item metadata for breadcrumbs
  let activeItem = { item: SETTINGS_CATEGORIES[0].items[0], category: 'Account & Identity' };
  for (const cat of SETTINGS_CATEGORIES) {
    const match = cat.items.find((i) => i.id === activeSection);
    if (match) {
      activeItem = { item: match, category: cat.category };
      break;
    }
  }

  const handleSelectSection = (id: SettingsSectionId) => {
    setActiveSection(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Top Banner & Breadcrumb Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb Path */}
          <div className="flex items-center gap-2 text-xs font-label-ui text-text-muted mb-1.5">
            <button
              onClick={() => onNavigate('dashboard')}
              className="hover:text-primary flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Workbench</span>
            </button>
            <span>/</span>
            <span>Settings</span>
            <span>/</span>
            <span className="font-semibold text-text-primary">{activeItem.item.label}</span>
          </div>

          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Account & Settings Center
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage your personal security profile, enterprise subscription, API access keys, and team roles.
          </p>
        </div>

        {/* User Identity Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-surface-container border border-border-subtle">
            <div className="w-7 h-7 rounded-lg bg-primary text-on-primary font-bold text-xs flex items-center justify-center">
              {state.profile.avatarInitials}
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-text-primary leading-none">
                {state.profile.displayName}
              </div>
              <div className="text-[10px] text-text-muted font-mono mt-0.5">
                @{state.profile.username}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container: Sidebar + Content */}
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Settings Left Navigation Sidebar (3 cols on desktop) */}
          <aside className="lg:col-span-3 space-y-4">
            {/* Search Input for Settings */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-muted text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-surface-card border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Navigation Groups */}
            <nav className="bg-surface-card border border-border-subtle rounded-2xl p-3 shadow-sm space-y-4">
              {filteredCategories.map((group) => (
                <div key={group.category} className="space-y-1">
                  <h4 className="px-3 text-[10px] font-bold text-text-muted uppercase tracking-wider font-label-ui">
                    {group.category}
                  </h4>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectSection(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-primary text-on-primary font-bold shadow-sm'
                              : item.danger
                              ? 'text-status-critical hover:bg-status-critical/10'
                              : 'text-text-secondary hover:text-text-primary hover:bg-surface-container/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`material-symbols-outlined text-[18px] ${
                                isActive ? 'text-on-primary' : item.danger ? 'text-status-critical' : 'text-text-muted'
                              }`}
                            >
                              {item.icon}
                            </span>
                            <span>{item.label}</span>
                          </div>
                          {isActive && (
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Active Settings Panel (9 cols on desktop) */}
          <main className="lg:col-span-9 min-h-[600px]">
            {activeSection === 'overview' && (
              <AccountOverviewSection
                state={state}
                onNavigateSection={handleSelectSection}
              />
            )}

            {activeSection === 'profile' && (
              <ProfileSection
                initialProfile={state.profile}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'email' && (
              <EmailSection
                profile={state.profile}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'security' && (
              <SecuritySection
                security={state.security}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'sessions' && (
              <SessionsSection
                sessions={state.sessions}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'billing' && (
              <BillingSection
                subscription={state.subscription ?? undefined}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'api-keys' && (
              <ApiKeysSection
                apiKeys={state.apiKeys}
                webhooks={state.webhooks}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'privacy' && (
              <PrivacySection
                privacy={state.privacy}
                onNavigateSection={handleSelectSection}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'notifications' && (
              <NotificationsSection
                notifications={state.notifications}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'integrations' && (
              <IntegrationsSection
                integrations={state.integrations}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'team' && (
              <TeamSection
                team={state.team}
                organizationName={state.profile.organization}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'preferences' && (
              <PreferencesSection
                preferences={state.preferences}
                onTriggerToast={onTriggerToast}
              />
            )}

            {activeSection === 'activity' && (
              <ActivitySection activity={state.activity} />
            )}

            {activeSection === 'support' && (
              <SupportSection onTriggerToast={onTriggerToast} />
            )}

            {activeSection === 'danger-zone' && (
              <DangerZoneSection
                onTriggerToast={onTriggerToast}
                onNavigateHome={() => onNavigate('home')}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
