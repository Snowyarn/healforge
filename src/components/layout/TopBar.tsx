import React, { useState } from 'react';
import { useAccountState } from '../../services/accountService';

interface TopBarProps {
  currentRepository: string;
  onSelectRepository: (repo: string) => void;
  repositories: string[];
  onNavigateHome: () => void;
  onNavigateToAccountCenter?: () => void;
  onToggleMobileMenu?: () => void;
  onTriggerRefresh: () => void;
  isLoading?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentRepository,
  onSelectRepository,
  repositories,
  onNavigateHome,
  onNavigateToAccountCenter,
  onToggleMobileMenu,
  onTriggerRefresh,
  isLoading = false,
}) => {
  const [isRepoOpen, setIsRepoOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { profile } = useAccountState();

  const notifications = [
    {
      id: 'n-1',
      title: 'Autonomous Patch Generated',
      service: 'payments-api',
      desc: 'CVE-2024-2149 AST patch ready for review.',
      time: '2m ago',
      unread: true,
    },
    {
      id: 'n-2',
      title: 'gVisor Sandbox Pass',
      service: 'core-api-service',
      desc: 'All 1,420 regression tests passed for Patch #9402.',
      time: '14m ago',
      unread: false,
    },
    {
      id: 'n-3',
      title: 'Critical Vulnerability Flagged',
      service: 'auth-service',
      desc: 'CVE-2024-41110 Docker auth bypass detected.',
      time: '1h ago',
      unread: false,
    },
  ];

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface/80 backdrop-blur-xl z-40 flex items-center justify-between px-margin shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Left Area: Mobile Hamburger, Repository Selector & Return Home Link */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container transition-colors"
            aria-label="Open Navigation Drawer"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setIsRepoOpen(!isRepoOpen)}
            className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg border border-border-subtle hover:border-border-strong transition-colors"
          >
            <span className="material-symbols-outlined text-text-secondary text-[18px]">
              stethoscope_arrow
            </span>
            <span className="text-body-sm font-label-ui text-on-surface">{currentRepository}</span>
            <span className="material-symbols-outlined text-text-muted text-[16px]">expand_more</span>
          </button>

          {isRepoOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-surface-card rounded-lg shadow-lg border border-border-subtle py-1 z-50 animate-fade-in">
              <div className="px-3 py-1.5 text-[11px] font-label-ui text-text-muted uppercase tracking-wider border-b border-border-subtle">
                Monitored Repositories
              </div>
              {repositories.map((repo) => (
                <button
                  key={repo}
                  onClick={() => {
                    onSelectRepository(repo);
                    setIsRepoOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-body-sm hover:bg-surface-container flex items-center justify-between transition-colors ${
                    currentRepository === repo ? 'text-primary font-medium bg-primary/5' : 'text-text-primary'
                  }`}
                >
                  <span>{repo}</span>
                  {currentRepository === repo && (
                    <span className="material-symbols-outlined text-[16px] text-primary">check</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onNavigateHome}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-label-ui text-text-secondary hover:text-text-primary hover:bg-surface-container transition-colors"
          title="Return to Homepage"
        >
          <span className="material-symbols-outlined text-[16px]">home</span>
          <span>Home</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Skeleton Simulation / Reload Demo Button */}
        <button
          onClick={onTriggerRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-xs font-label-ui text-text-secondary hover:text-text-primary border border-border-subtle transition-all disabled:opacity-50"
          title="Simulate data fetch to test skeleton loading states"
        >
          <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          <span className="hidden md:inline">Simulate Loading</span>
        </button>

        {/* Notification Button & Menu */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 rounded-full hover:bg-surface-container text-text-secondary hover:text-on-surface transition-colors"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-status-critical" />
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-surface-card rounded-xl shadow-lg border border-border-subtle py-2 z-50 animate-fade-in">
              <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
                <span className="font-label-ui text-body-sm text-text-primary">Autonomous Engine Alerts</span>
                <span className="text-label-code-sm bg-primary/10 text-primary px-1.5 py-0.5 rounded">3 Updates</span>
              </div>
              <div className="divide-y divide-border-subtle/50 max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3 hover:bg-surface-container/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-label-ui text-[12px] text-text-primary">{n.title}</span>
                      <span className="text-[11px] text-text-muted font-label-code-sm">{n.time}</span>
                    </div>
                    <p className="text-[12px] text-text-secondary">{n.desc}</p>
                    <span className="inline-block mt-1 text-[11px] font-label-code-sm text-text-muted bg-surface-container px-1.5 rounded">
                      {n.service}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar - Opens Account Center */}
        <button
          onClick={onNavigateToAccountCenter}
          className="w-8 h-8 rounded-full bg-primary hover:bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          title={`Signed in as ${profile.fullName} (@${profile.username}) — Open Account Center`}
          aria-label="Account Settings and Profile"
        >
          <span>{profile.avatarInitials}</span>
        </button>
      </div>
    </header>
  );
};
