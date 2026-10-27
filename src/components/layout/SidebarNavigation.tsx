import React, { useState } from 'react';
import type { ScreenId } from '../../types';

interface SidebarNavigationProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: ScreenId;
  label: string;
  icon: string;
  badge?: string | number;
  badgeType?: 'critical' | 'warning' | 'info' | 'success';
}

interface NavGroup {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
}

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    id: 'workspace',
    title: 'Workspace',
    icon: 'folder_open',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'repositories', label: 'Repositories & Projects', icon: 'source', badge: 4, badgeType: 'info' },
      { id: 'bug-report', label: 'Bug Report', icon: 'bug_report' },
      { id: 'vulnerabilities', label: 'Vulnerabilities', icon: 'pest_control', badge: 2, badgeType: 'critical' },
    ],
  },
  {
    id: 'agent',
    title: 'AI Security Agent',
    icon: 'psychology',
    items: [
      { id: 'security-scans', label: 'Security Scans', icon: 'radar' },
      { id: 'code-explorer', label: 'Code Explorer', icon: 'terminal' },
      { id: 'patch-review', label: 'Patch Review', icon: 'code', badge: 1, badgeType: 'warning' },
      { id: 'agent-activity', label: 'Agent Activity', icon: 'neurology' },
    ],
  },
  {
    id: 'validation',
    title: 'Validation & Results',
    icon: 'verified',
    items: [
      { id: 'verification', label: 'Verification & Sandbox', icon: 'gvisor' },
      { id: 'verified-fixes', label: 'Verified Fixes', icon: 'check_circle', badge: 3, badgeType: 'success' },
      { id: 'scan-history', label: 'Scan History', icon: 'history' },
      { id: 'security-intelligence', label: 'Security Intelligence', icon: 'insights' },
      { id: 'reports-audit', label: 'Reports & Audit Trail', icon: 'description' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations & Settings',
    icon: 'settings',
    items: [
      { id: 'integrations', label: 'Integrations', icon: 'extension' },
      { id: 'developer-api', label: 'Developer & API', icon: 'key' },
      { id: 'team-permissions', label: 'Team & Permissions', icon: 'group' },
      { id: 'notifications-settings', label: 'Notifications', icon: 'notifications' },
      { id: 'account-privacy', label: 'Account & Privacy', icon: 'shield' },
      { id: 'settings', label: 'Settings', icon: 'tune' },
    ],
  },
];

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  currentScreen,
  onNavigate,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  // Collapsible group state: default all open
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleSelectNav = (id: ScreenId) => {
    onNavigate(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-surface-dark z-50 flex flex-col pt-5 pb-6 border-r border-outline/20 transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-5 mb-5 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => handleSelectNav('home')}
            title="Return to Homepage"
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary font-headline-sm font-bold group-hover:scale-105 transition-transform shadow-md">
              HF
            </div>
            <div className="flex flex-col">
              <span className="text-headline-sm text-surface-bright font-headline-sm tracking-tight group-hover:text-primary-fixed transition-colors">
                HealForge
              </span>
              <span className="text-[10px] font-label-code-sm text-secondary-fixed-dim">
                Autonomous Security
              </span>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 text-secondary-fixed-dim hover:text-white"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        {/* Collapsible Groups Navigation Scroll Area */}
        <nav className="flex-1 px-3 overflow-y-auto space-y-4 custom-scrollbar">
          {NAVIGATION_GROUPS.map((group) => {
            const isCollapsed = !!collapsedGroups[group.id];
            const hasActiveItem = group.items.some((item) => item.id === currentScreen);

            return (
              <div key={group.id} className="space-y-1">
                {/* Group Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded text-[11px] font-bold text-secondary-fixed-dim uppercase tracking-wider font-label-ui hover:text-surface-bright transition-colors group"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{group.title}</span>
                  </span>
                  <span
                    className={`material-symbols-outlined text-[14px] text-text-muted group-hover:text-secondary-fixed-dim transition-transform duration-200 ${
                      isCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                {/* Group Nav Items */}
                {(!isCollapsed || hasActiveItem) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive =
                        currentScreen === item.id ||
                        (item.id === 'account-privacy' && currentScreen === 'account-center');

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectNav(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left text-xs font-medium ${
                            isActive
                              ? 'bg-primary text-on-primary font-bold shadow-sm'
                              : 'text-secondary-fixed-dim hover:bg-surface-container/10 hover:text-surface-bright'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span
                              className={`material-symbols-outlined text-[18px] shrink-0 ${
                                isActive ? 'text-on-primary' : 'text-secondary-fixed-dim'
                              }`}
                            >
                              {item.icon === 'gvisor' ? 'shield' : item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </div>

                          {/* Data Badge */}
                          {item.badge !== undefined && (
                            <span
                              className={`ml-2 px-1.5 py-0.2 text-[10px] font-mono font-bold rounded shrink-0 ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : item.badgeType === 'critical'
                                  ? 'bg-status-critical/20 text-status-critical'
                                  : item.badgeType === 'warning'
                                  ? 'bg-status-warning/20 text-status-warning'
                                  : item.badgeType === 'success'
                                  ? 'bg-status-success/20 text-status-success'
                                  : 'bg-white/10 text-secondary-fixed-dim'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Exit to Homepage Action */}
        <div className="px-3 pt-3 border-t border-outline/20 space-y-1">
          <button
            onClick={() => handleSelectNav('home')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-label-ui text-secondary-fixed-dim hover:text-surface-bright hover:bg-surface-container/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            <span>Return to Homepage</span>
          </button>
        </div>

        {/* Sidebar Footer */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-2 text-secondary-fixed-dim text-xs">
            <span className="w-2 h-2 rounded-full bg-status-success" />
            <span>Autonomous Engine v2.4</span>
          </div>
        </div>
      </aside>
    </>
  );
};
