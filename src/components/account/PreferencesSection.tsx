import React, { useState } from 'react';
import type { UserPreferences } from '../../types/account';
import { accountService } from '../../services/accountService';

interface PreferencesSectionProps {
  preferences: UserPreferences;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  preferences: initialPreferences,
  onTriggerToast,
}) => {
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences);

  const handleUpdate = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const updated = {
      ...preferences,
      [key]: value,
    };
    setPreferences(updated);
    accountService.updatePreferences(updated);
    onTriggerToast({
      type: 'success',
      title: 'Preference Saved',
      message: `Adjusted setting for ${String(key)}.`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold font-headline-sm text-text-primary">
          Appearance & Workspace Preferences
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Customize UI theme, typography density, regional time formatting, and default views.
        </p>
      </div>

      {/* Theme Selection */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Interface Theme
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'dark' as const, label: 'Dark Slate', desc: 'Default forest & mint dark theme', icon: 'dark_mode' },
            { id: 'light' as const, label: 'Clean Light', desc: 'High-contrast day mode', icon: 'light_mode' },
            { id: 'system' as const, label: 'System Sync', desc: 'Matches OS system appearance', icon: 'computer' },
          ].map((theme) => {
            const isSelected = preferences.theme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleUpdate('theme', theme.id)}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border-subtle hover:bg-surface-container/50'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    isSelected ? 'text-primary' : 'text-text-muted'
                  }`}
                >
                  {theme.icon}
                </span>
                <div>
                  <div
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-primary' : 'text-text-primary'
                    }`}
                  >
                    {theme.label}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">{theme.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Formatting & Locale */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Regional Time & Date Formats
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Primary Timezone
            </label>
            <select
              value={preferences.timezone}
              onChange={(e) => handleUpdate('timezone', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs font-label-ui outline-none text-text-primary"
            >
              <option value="America/Los_Angeles (UTC-08:00)">America/Los_Angeles (Pacific Time)</option>
              <option value="America/New_York (UTC-05:00)">America/New_York (Eastern Time)</option>
              <option value="Europe/London (UTC+00:00)">Europe/London (GMT / BST)</option>
              <option value="Europe/Berlin (UTC+01:00)">Europe/Berlin (CET)</option>
              <option value="Asia/Tokyo (UTC+09:00)">Asia/Tokyo (JST)</option>
              <option value="UTC (UTC+00:00)">Coordinated Universal Time (UTC)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Date Format
            </label>
            <select
              value={preferences.dateFormat}
              onChange={(e) =>
                handleUpdate('dateFormat', e.target.value as UserPreferences['dateFormat'])
              }
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs font-mono outline-none text-text-primary"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601 Standard)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (UK / EU Standard)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Time Display
            </label>
            <select
              value={preferences.timeFormat}
              onChange={(e) =>
                handleUpdate('timeFormat', e.target.value as UserPreferences['timeFormat'])
              }
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs font-mono outline-none text-text-primary"
            >
              <option value="24h">24-Hour Military Time (14:30)</option>
              <option value="12h">12-Hour AM/PM Time (2:30 PM)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Default Landing Screen
            </label>
            <select
              value={preferences.defaultLanding}
              onChange={(e) =>
                handleUpdate('defaultLanding', e.target.value as UserPreferences['defaultLanding'])
              }
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs font-label-ui outline-none text-text-primary"
            >
              <option value="dashboard">Workbench Dashboard</option>
              <option value="home">Product Homepage</option>
              <option value="vulnerabilities">Vulnerabilities Detail</option>
            </select>
          </div>
        </div>
      </div>

      {/* Accessibility & Density */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Accessibility & Layout Density
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle">
            <div>
              <div className="text-xs font-semibold text-text-primary">
                Reduced Motion & Parallax
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Disable particle effects and cinematic hero animations for vestibular comfort.
              </div>
            </div>
            <button
              onClick={() => handleUpdate('reducedMotion', !preferences.reducedMotion)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                preferences.reducedMotion ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  preferences.reducedMotion ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle">
            <div>
              <div className="text-xs font-semibold text-text-primary">
                Compact Data Table Density
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Reduce vertical padding in CVE findings lists to view more items on screen.
              </div>
            </div>
            <button
              onClick={() =>
                handleUpdate(
                  'density',
                  preferences.density === 'comfortable' ? 'compact' : 'comfortable'
                )
              }
              className={`w-11 h-6 rounded-full transition-colors relative ${
                preferences.density === 'compact' ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  preferences.density === 'compact' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
