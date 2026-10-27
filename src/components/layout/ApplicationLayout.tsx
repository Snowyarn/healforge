import React, { useState } from 'react';
import type { ScreenId } from '../../types';
import { SidebarNavigation } from './SidebarNavigation';
import { TopBar } from './TopBar';

interface ApplicationLayoutProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  currentRepository: string;
  onSelectRepository: (repo: string) => void;
  repositories: string[];
  onTriggerRefresh: () => void;
  isLoading?: boolean;
  children: React.ReactNode;
}

export const ApplicationLayout: React.FC<ApplicationLayoutProps> = ({
  currentScreen,
  onNavigate,
  currentRepository,
  onSelectRepository,
  repositories,
  onTriggerRefresh,
  isLoading = false,
  children,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen">
      {/* Fixed Sidebar with Mobile Drawer support */}
      <SidebarNavigation
        currentScreen={currentScreen}
        onNavigate={onNavigate}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Container offset by sidebar width on large screens */}
      <div className="pl-0 lg:pl-64">
        {/* Fixed TopBar */}
        <TopBar
          currentRepository={currentRepository}
          onSelectRepository={onSelectRepository}
          repositories={repositories}
          onNavigateHome={() => onNavigate('home')}
          onNavigateToAccountCenter={() => onNavigate('account-center')}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onTriggerRefresh={onTriggerRefresh}
          isLoading={isLoading}
        />

        {/* Content Body */}
        <main className="relative pt-16 bg-surface min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};
