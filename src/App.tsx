import { useState, useEffect, useTransition } from 'react';
import type { ScreenId, PatchStatus } from './types';
import {
  mockVulnerabilities,
  mockRepositories,
  mockPatchItem,
  mockVerificationSession,
  mockAgentExecutions,
} from './services/mockData';
import { ApplicationLayout } from './components/layout/ApplicationLayout';
import { Toast } from './components/common/Toast';
import type { ToastMessage } from './components/common/Toast';
import { HomepageScreen } from './screens/HomepageScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { VulnerabilityDetailScreen } from './screens/VulnerabilityDetailScreen';
import { PatchReviewScreen } from './screens/PatchReviewScreen';
import { VerificationSandboxScreen } from './screens/VerificationSandboxScreen';
import { AgentActivityScreen } from './screens/AgentActivityScreen';
import { AccountCenterScreen } from './screens/AccountCenterScreen';
import { RepositoriesScreen } from './screens/RepositoriesScreen';
import { BugReportScreen } from './screens/BugReportScreen';
import { SecurityScansScreen } from './screens/SecurityScansScreen';
import { CodeExplorerScreen } from './screens/CodeExplorerScreen';
import { VerifiedFixesScreen } from './screens/VerifiedFixesScreen';
import { ScanHistoryScreen } from './screens/ScanHistoryScreen';
import { SecurityIntelligenceScreen } from './screens/SecurityIntelligenceScreen';
import { ReportsAuditScreen } from './screens/ReportsAuditScreen';
import {
  DashboardSkeleton,
  VulnerabilityDetailSkeleton,
  PatchReviewSkeleton,
  VerificationSandboxSkeleton,
  AgentActivitySkeleton,
} from './components/common/ScreenSkeleton';

export function App() {
  // Initial route is 'home' as required
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const [selectedVulnerabilityId, setSelectedVulnerabilityId] = useState<string>('CVE-2024-41110');
  const [currentRepository, setCurrentRepository] = useState<string>('acme-corp / core-api-service');
  const [patch, setPatch] = useState(mockPatchItem);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const repositoryNames = [
    'acme-corp / core-api-service',
    'auth-service',
    'payments-api',
    'ingestion-pipeline',
  ];

  // Browser back/forward navigation support
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.screen) {
        setCurrentScreen(event.state.screen as ScreenId);
      } else {
        const hash = window.location.hash.replace('#', '') as ScreenId;
        const validScreens: ScreenId[] = [
          'dashboard',
          'repositories',
          'bug-report',
          'vulnerabilities',
          'security-scans',
          'code-explorer',
          'patch-review',
          'agent-activity',
          'verification',
          'verified-fixes',
          'scan-history',
          'security-intelligence',
          'reports-audit',
          'integrations',
          'developer-api',
          'team-permissions',
          'notifications-settings',
          'account-privacy',
          'settings',
          'account-center',
        ];

        if (validScreens.includes(hash)) {
          setCurrentScreen(hash);
        } else {
          setCurrentScreen('home');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (screen: ScreenId = 'dashboard', triggerSkeleton = true) => {
    startTransition(() => {
      setCurrentScreen(screen);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Update browser history
      const targetHash = screen === 'home' ? '' : `#${screen}`;
      window.history.pushState({ screen }, '', `${window.location.pathname}${targetHash}`);

      // If navigating into a workbench screen, trigger a brief simulated skeleton loading state
      if (screen !== 'home' && triggerSkeleton) {
        setIsLoading(true);
        setTimeout(() => {
          setIsLoading(false);
        }, 450);
      } else {
        setIsLoading(false);
      }
    });
  };

  const handleTriggerRefresh = () => {
    setIsLoading(true);
    showToast({
      type: 'info',
      title: 'Simulating Data Ingestion',
      message: 'Demonstrating CSS skeleton shimmer resolution.',
    });
    setTimeout(() => {
      setIsLoading(false);
    }, 600);
  };

  const handleSelectVulnerability = (vulnId: string) => {
    setSelectedVulnerabilityId(vulnId);
  };

  const handleSelectRepository = (repo: string) => {
    setCurrentRepository(repo);
    showToast({
      type: 'info',
      title: 'Repository Context Switched',
      message: `Active workspace scope shifted to ${repo}.`,
    });
  };

  const handleUpdatePatchStatus = (status: PatchStatus) => {
    setPatch((prev) => ({
      ...prev,
      status,
    }));
  };

  const showToast = (toastData: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => {
    setToast({
      id: String(Date.now()),
      ...toastData,
    });
  };

  const selectedVulnerability =
    mockVulnerabilities.find((v) => v.id.toLowerCase() === selectedVulnerabilityId.toLowerCase()) ||
    mockVulnerabilities[0];

  // If on Homepage, render the dedicated landing page
  if (currentScreen === 'home') {
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <HomepageScreen onLaunchWorkbench={handleNavigate} />
      </>
    );
  }

  // Otherwise, render the Workbench ApplicationLayout with the selected screen
  return (
    <ApplicationLayout
      currentScreen={currentScreen}
      onNavigate={handleNavigate}
      currentRepository={currentRepository}
      onSelectRepository={handleSelectRepository}
      repositories={repositoryNames}
      onTriggerRefresh={handleTriggerRefresh}
      isLoading={isLoading}
    >
      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Screen Routing with Skeleton Loading States */}
      {currentScreen === 'dashboard' &&
        (isLoading ? (
          <DashboardSkeleton />
        ) : (
          <DashboardScreen
            onNavigate={handleNavigate}
            onSelectVulnerability={handleSelectVulnerability}
            onSelectRepository={handleSelectRepository}
            vulnerabilities={mockVulnerabilities}
            repositories={mockRepositories}
          />
        ))}

      {currentScreen === 'repositories' && (
        <RepositoriesScreen
          onNavigate={handleNavigate}
          onSelectRepository={handleSelectRepository}
          onTriggerToast={showToast}
        />
      )}

      {currentScreen === 'bug-report' && (
        <BugReportScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
        />
      )}

      {currentScreen === 'vulnerabilities' &&
        (isLoading ? (
          <VulnerabilityDetailSkeleton />
        ) : (
          <VulnerabilityDetailScreen
            selectedVulnerability={selectedVulnerability}
            onNavigate={handleNavigate}
            onSelectVulnerability={handleSelectVulnerability}
            allVulnerabilities={mockVulnerabilities}
            onTriggerToast={showToast}
          />
        ))}

      {currentScreen === 'security-scans' && (
        <SecurityScansScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
        />
      )}

      {currentScreen === 'code-explorer' && (
        <CodeExplorerScreen
          onNavigate={handleNavigate}
          onSelectVulnerability={handleSelectVulnerability}
          onTriggerToast={showToast}
        />
      )}

      {currentScreen === 'patch-review' &&
        (isLoading ? (
          <PatchReviewSkeleton />
        ) : (
          <PatchReviewScreen
            patch={patch}
            onNavigate={handleNavigate}
            onUpdateStatus={handleUpdatePatchStatus}
            onTriggerToast={showToast}
          />
        ))}

      {currentScreen === 'verification' &&
        (isLoading ? (
          <VerificationSandboxSkeleton />
        ) : (
          <VerificationSandboxScreen
            session={mockVerificationSession}
            onTriggerToast={showToast}
          />
        ))}

      {currentScreen === 'agent-activity' &&
        (isLoading ? (
          <AgentActivitySkeleton />
        ) : (
          <AgentActivityScreen
            executions={mockAgentExecutions}
            onTriggerToast={showToast}
          />
        ))}

      {currentScreen === 'verified-fixes' && (
        <VerifiedFixesScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
        />
      )}

      {currentScreen === 'scan-history' && (
        <ScanHistoryScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
        />
      )}

      {currentScreen === 'security-intelligence' && (
        <SecurityIntelligenceScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
        />
      )}

      {currentScreen === 'reports-audit' && (
        <ReportsAuditScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
        />
      )}

      {/* Group D: Account & Configuration Sections mapped to AccountCenter */}
      {currentScreen === 'integrations' && (
        <AccountCenterScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
          initialSection="integrations"
        />
      )}

      {currentScreen === 'developer-api' && (
        <AccountCenterScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
          initialSection="api-keys"
        />
      )}

      {currentScreen === 'team-permissions' && (
        <AccountCenterScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
          initialSection="team"
        />
      )}

      {currentScreen === 'notifications-settings' && (
        <AccountCenterScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
          initialSection="notifications"
        />
      )}

      {currentScreen === 'account-privacy' && (
        <AccountCenterScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
          initialSection="privacy"
        />
      )}

      {currentScreen === 'settings' && (
        <AccountCenterScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
          initialSection="preferences"
        />
      )}

      {currentScreen === 'account-center' && (
        <AccountCenterScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
          initialSection="overview"
        />
      )}
    </ApplicationLayout>
  );
}

export default App;
