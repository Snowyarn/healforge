import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { ScreenId, PatchStatus, Vulnerability, RepositoryHealth, ProjectDetail, PatchItem } from './types';
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
import { ProjectImportModal } from './components/projects/ProjectImportModal';
import { SignInScreen } from './components/auth/SignInScreen';
import { BackendErrorScreen } from './components/common/BackendErrorScreen';
import { ApiError, endpoints } from './services/api';
import type { VerificationStatusDto } from './services/api';
import { workbenchService } from './services/workbenchService';

const VALID_SCREENS: ScreenId[] = [
  'dashboard', 'repositories', 'bug-report', 'vulnerabilities', 'security-scans',
  'code-explorer', 'patch-review', 'agent-activity', 'verification', 'verified-fixes',
  'scan-history', 'security-intelligence', 'reports-audit', 'integrations', 'developer-api',
  'team-permissions', 'notifications-settings', 'account-privacy', 'settings', 'account-center',
];

export function App() {
  // Initial route: honour a deep-link hash (e.g. #dashboard) on first load.
  const [currentScreen, setCurrentScreen] = useState<ScreenId>(() => {
    const hash = window.location.hash.replace('#', '') as ScreenId;
    return VALID_SCREENS.includes(hash) ? hash : 'home';
  });
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Real workspace state
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentRepository, setCurrentRepository] = useState<string>('');
  const [repositories, setRepositories] = useState<RepositoryHealth[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
  const [patch, setPatch] = useState<PatchItem | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatusDto | null>(null);
  const [counts, setCounts] = useState({ repositories: 0, vulnerabilities: 0, patchReviews: 0, verifiedFixes: 0 });
  const [notifications, setNotifications] = useState<{
    items: { id: string; title: string; message: string; icon: string; linkScreen: string; read: boolean }[];
    unread: number;
  }>({ items: [], unread: 0 });
  const [importOpen, setImportOpen] = useState(false);
  const [nvidiaConfigured, setNvidiaConfigured] = useState<boolean | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [backendError, setBackendError] = useState<{ message: string; status?: number | null } | null>(null);
  const refreshTimer = useRef<number | null>(null);

  const showToast = useCallback((toastData: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => {
    setToast({ id: String(Date.now()), ...toastData });
  }, []);

  const notifyError = useCallback((exc: unknown, context: string) => {
    const msg = exc instanceof ApiError ? exc.message : 'Backend unreachable.';
    showToast({ type: 'warning', title: context, message: msg });
  }, [showToast]);

  // ---- Data loading ---------------------------------------------------------

  const loadCounts = useCallback(async () => {
    try {
      setCounts(await endpoints.counts());
    } catch { /* sidebar badges degrade silently */ }
  }, []);

  const loadProjects = useCallback(async () => {
    const { projects: rows } = await endpoints.projects();
    const mapped = rows.map((p) => ({
      id: p.id, name: p.name, provider: p.provider === 'zip-archive' ? 'github' : p.provider,
      primaryBranch: p.primaryBranch, branches: p.branches, lastScanTime: p.lastScanTime,
      scanStatus: p.scanStatus, openVulnCount: p.openVulnCount, criticalCount: p.criticalCount,
      highCount: p.highCount, verificationStatus: p.verificationStatus, healthScore: p.healthScore,
      description: p.description, runtime: p.runtime, headCommit: p.headCommit,
    } as ProjectDetail));
    setProjects(mapped);
    setRepositories(rows.map((p) => ({
      name: p.name, runtime: p.runtime, icon: 'hub', description: p.description,
      securityScore: p.healthScore, criticalCount: p.criticalCount, highCount: p.highCount,
      headCommit: p.headCommit, status: p.criticalCount > 0 ? 'critical' as const : 'optimal' as const,
      projectId: p.id,
    })));
    setCurrentProjectId((prev) => {
      if (prev && mapped.some((m) => m.id === prev)) return prev;
      return mapped[0]?.id ?? null;
    });
    setCurrentRepository((prev) => (mapped.some((m) => m.name === prev) ? prev : mapped[0]?.name ?? ''));
    return mapped;
  }, []);

  const loadFindings = useCallback(async () => {
    const { findings } = await endpoints.findings({ status: 'open' });
    const mapped = findings.map((f) => ({
      id: f.id, internalId: f.internalId, cwe: f.cwe, title: f.title, description: f.description,
      service: f.service, repository: f.repository, projectId: f.projectId, affectedFile: f.affectedFile,
      exactLines: f.exactLines, discoveredBy: f.discoveredBy, discoveredAt: f.discoveredAt,
      severity: f.severity, cvssScore: f.cvssScore, cvssBasis: f.cvssBasis, reachability: f.reachability,
      reachabilityBasis: f.reachabilityBasis, autofixStatus: f.status === 'resolved' ? 'Applied' as const
        : f.hasPatch ? 'Review Required' as const : 'Pending' as const,
      status: f.status, confidence: f.confidence, hasPatch: f.hasPatch, patchId: f.patchId,
      modelAnalysis: f.modelAnalysis ?? null, codeSnippet: null, taintSteps: [], impactAnalysis: '',
      astPatch: null, compliance: { owasp: '—', cvss: '—', exploitability: '—' },
    } as unknown as Vulnerability));
    setVulnerabilities(mapped);
    return mapped;
  }, []);

  const loadPatch = useCallback(async (findingId?: string | null) => {
    try {
      const p = await workbenchService.getPatch(findingId ?? undefined);
      setPatch(p);
    } catch {
      setPatch(null);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await endpoints.notifications();
      setNotifications({ items: res.notifications, unread: res.unread });
    } catch { /* degrade silently */ }
  }, []);

  const refreshAll = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      await Promise.all([loadProjects().catch(() => undefined), loadFindings().catch(() => undefined)]);
      await Promise.all([
        loadCounts(),
        loadPatch().catch(() => undefined),
        loadNotifications(),
        endpoints.verificationStatus().then(setVerificationStatus).catch(() => undefined),
        endpoints.nvidiaStatus().then((s) => setNvidiaConfigured(s.configured)).catch(() => undefined),
      ]);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, [loadProjects, loadFindings, loadCounts, loadPatch, loadNotifications]);

  // Bootstrap session + initial data
  const bootstrapSession = useCallback(async () => {
    setSessionLoading(true);
    setBackendError(null);
    try {
      await endpoints.session();
      setIsAuthenticated(true);
      setAuthRequired(false);
      setBackendError(null);
      await refreshAll();
      setBootstrapped(true);
    } catch (exc) {
      setIsAuthenticated(false);
      if (exc instanceof ApiError && (exc.code === 'no_session' || exc.status === 401)) {
        // Multi-user deployment (production posture): a real sign-in is required.
        setAuthRequired(true);
        setBackendError(null);
      } else {
        const status = exc instanceof ApiError ? exc.status : null;
        const message = exc instanceof ApiError
          ? exc.message
          : (exc instanceof Error ? exc.message : 'Cannot reach the HealForge backend API.');
        setAuthRequired(false);
        setBackendError({ message, status });
      }
    } finally {
      setSessionLoading(false);
    }
  }, [refreshAll]);

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  // Session expiry mid-use (any API call returning 401) returns to the sign-in screen.
  useEffect(() => {
    const onUnauthorized = () => {
      setIsAuthenticated(false);
      setAuthRequired(true);
    };
    window.addEventListener('healforge:unauthorized', onUnauthorized);
    return () => window.removeEventListener('healforge:unauthorized', onUnauthorized);
  }, []);

  // Poll notifications periodically (real data, cheap query)
  useEffect(() => {
    refreshTimer.current = window.setInterval(loadNotifications, 30000);
    return () => {
      if (refreshTimer.current) window.clearInterval(refreshTimer.current);
    };
  }, [loadNotifications]);

  // Browser back/forward navigation support
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.screen) {
        setCurrentScreen(event.state.screen as ScreenId);
      } else {
        const hash = window.location.hash.replace('#', '') as ScreenId;
        setCurrentScreen(VALID_SCREENS.includes(hash) ? hash : 'home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = useCallback((screen: ScreenId = 'dashboard', triggerSkeleton = true) => {
    startTransition(() => {
      setCurrentScreen(screen);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const targetHash = screen === 'home' ? '' : `#${screen}`;
      window.history.pushState({ screen }, '', `${window.location.pathname}${targetHash}`);
      // Real refresh of workspace data on workbench navigation
      if (screen !== 'home' && triggerSkeleton) {
        refreshAll(true);
      }
    });
  }, [refreshAll]);

  const handleTriggerRefresh = useCallback(() => {
    setIsLoading(true);
    refreshAll();
    showToast({
      type: 'info',
      title: 'Refreshing Workspace Data',
      message: 'Reloading projects, findings and verification state from the backend.',
    });
    window.setTimeout(() => setIsLoading(false), 700);
  }, [refreshAll, showToast]);

  const handleSignOut = useCallback(async () => {
    try {
      await endpoints.logout();
    } catch {
      // Ignore logout errors
    } finally {
      setIsAuthenticated(false);
      setAuthRequired(true);
      showToast({
        type: 'info',
        title: 'Signed Out',
        message: 'You have been signed out of your session.',
      });
    }
  }, [showToast]);

  // Auto-load full detail of the first finding when the screen opens with no selection.
  // (Ref is declared first; effect fires after data loads.)
  const autoSelectRef = useRef<(id: string) => void>(() => undefined);

  useEffect(() => {
    if (currentScreen === 'vulnerabilities' && !selectedVulnerability && vulnerabilities.length > 0) {
      autoSelectRef.current(vulnerabilities[0].id);
    }
  }, [currentScreen, selectedVulnerability, vulnerabilities]);

  const handleSelectVulnerability = useCallback(async (vulnId: string) => {
    // Fetch the FULL finding detail (code snippet, taint steps, compliance).
    try {
      const { finding } = await endpoints.finding(vulnId);
      const v = {
        ...finding,
        autofixStatus: finding.status === 'resolved' ? ('Applied' as const)
          : finding.hasPatch ? ('Review Required' as const) : ('Pending' as const),
      } as unknown as Vulnerability;
      setSelectedVulnerability(v);
      // Load the linked patch for review context
      loadPatch(finding.hasPatch ? null : undefined);
    } catch (exc) {
      notifyError(exc, 'Finding Detail');
    }
  }, [loadPatch, notifyError]);

  // Keep the auto-select ref pointing at the latest handler.
  autoSelectRef.current = (id: string) => {
    handleSelectVulnerability(id).catch(() => undefined);
  };

  const handleSelectRepository = useCallback((repoName: string) => {
    const project = projects.find((p) => p.name === repoName);
    if (project) {
      setCurrentProjectId(project.id);
      setCurrentRepository(project.name);
      showToast({
        type: 'info',
        title: 'Workspace Context Switched',
        message: `Active scope shifted to ${project.name} (${project.headCommit}).`,
      });
    }
  }, [projects, showToast]);

  const handleUpdatePatchStatus = useCallback((_status: PatchStatus) => {
    // Kept for layout compatibility; real review actions go through the screen's API calls.
    loadPatch();
    loadCounts();
    loadFindings().catch(() => undefined);
  }, [loadPatch, loadCounts, loadFindings]);

  const handleMarkNotificationRead = useCallback(async (notificationId: string) => {
    try {
      await endpoints.markNotificationRead(notificationId);
      loadNotifications();
    } catch { /* non-fatal */ }
  }, [loadNotifications]);

  const repositoryNames = projects.map((p) => p.name);

  // ---- Render ---------------------------------------------------------------

  // 1. Landing homepage: publicly viewable
  if (currentScreen === 'home') {
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <HomepageScreen onLaunchWorkbench={handleNavigate} />
      </>
    );
  }

  // 2. Protected workspace screens: require verified backend session
  // Loading state while verifying session
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-surface-default flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center mb-4 shadow-lg animate-pulse">
          <span className="material-symbols-outlined text-[32px]">security</span>
        </div>
        <p className="text-sm font-bold text-text-primary">Connecting to HealForge Security Engine...</p>
        <p className="text-xs text-text-secondary mt-1">Verifying authenticated session and workspace access</p>
      </div>
    );
  }

  // 3. Backend connectivity failure (HTTP 404, 5xx, or network unreachable)
  if (backendError) {
    return (
      <BackendErrorScreen
        error={backendError.message}
        status={backendError.status}
        isRetrying={sessionLoading}
        onRetry={bootstrapSession}
        onNavigateHome={() => {
          setCurrentScreen('home');
          window.location.hash = '';
        }}
      />
    );
  }

  // 4. Authentication required (HTTP 401 or no active session)
  if (authRequired || !isAuthenticated) {
    return (
      <SignInScreen
        onSignedIn={() => {
          setIsAuthenticated(true);
          setAuthRequired(false);
          setBackendError(null);
          setBootstrapped(true);
          refreshAll(true);
        }}
        onNavigateHome={() => {
          setCurrentScreen('home');
          window.location.hash = '';
        }}
      />
    );
  }

  return (
    <ApplicationLayout
      currentScreen={currentScreen}
      onNavigate={handleNavigate}
      currentRepository={currentRepository || 'No project selected'}
      onSelectRepository={handleSelectRepository}
      repositories={repositoryNames.length ? repositoryNames : ['No project yet — import one']}
      onTriggerRefresh={handleTriggerRefresh}
      isLoading={isLoading}
      counts={counts}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
      onSignOut={handleSignOut}
    >
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ProjectImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(_pid, _rev, projectName) => {
          refreshAll();
          showToast({
            type: 'success',
            title: 'Project Ready',
            message: `'${projectName}' imported. Start a scan from the Security Scans screen.`,
          });
        }}
        onTriggerToast={showToast}
      />

      {!bootstrapped && <DashboardSkeleton />}

      {bootstrapped && currentScreen === 'dashboard' &&
        (isLoading ? (
          <DashboardSkeleton />
        ) : (
          <DashboardScreen
            onNavigate={handleNavigate}
            onSelectVulnerability={handleSelectVulnerability}
            onSelectRepository={handleSelectRepository}
            vulnerabilities={vulnerabilities}
            repositories={repositories}
            onOpenImport={() => setImportOpen(true)}
            onRefresh={refreshAll}
          />
        ))}

      {bootstrapped && currentScreen === 'repositories' && (
        <RepositoriesScreen
          onNavigate={handleNavigate}
          onSelectRepository={handleSelectRepository}
          onTriggerToast={showToast}
          onOpenImport={() => setImportOpen(true)}
          currentProjectId={currentProjectId}
        />
      )}

      {bootstrapped && currentScreen === 'bug-report' && (
        <BugReportScreen onNavigate={handleNavigate} onTriggerToast={showToast} />
      )}

      {bootstrapped && currentScreen === 'vulnerabilities' &&
        (isLoading && !selectedVulnerability ? (
          <VulnerabilityDetailSkeleton />
        ) : (
          <VulnerabilityDetailScreen
            selectedVulnerability={selectedVulnerability ?? vulnerabilities[0] ?? null}
            onNavigate={handleNavigate}
            onSelectVulnerability={handleSelectVulnerability}
            allVulnerabilities={vulnerabilities}
            onTriggerToast={showToast}
            nvidiaConfigured={nvidiaConfigured}
            onPatchRequested={() => {
              loadCounts();
              loadPatch();
            }}
          />
        ))}

      {bootstrapped && currentScreen === 'security-scans' && (
        <SecurityScansScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
          onScanCompleted={() => {
            refreshAll();
          }}
          currentProjectId={currentProjectId}
          nvidiaConfigured={nvidiaConfigured}
        />
      )}

      {bootstrapped && currentScreen === 'code-explorer' && (
        <CodeExplorerScreen
          onNavigate={handleNavigate}
          onSelectVulnerability={handleSelectVulnerability}
          onTriggerToast={showToast}
          currentProjectId={currentProjectId}
        />
      )}

      {bootstrapped && currentScreen === 'patch-review' &&
        (isLoading && !patch ? (
          <PatchReviewSkeleton />
        ) : (
          <PatchReviewScreen
            patch={patch}
            onNavigate={handleNavigate}
            onUpdateStatus={handleUpdatePatchStatus}
            onTriggerToast={showToast}
            onReviewed={() => {
              loadPatch();
              loadCounts();
              loadFindings().catch(() => undefined);
            }}
          />
        ))}

      {bootstrapped && currentScreen === 'verification' &&
        (isLoading ? (
          <VerificationSandboxSkeleton />
        ) : (
          <VerificationSandboxScreen
            verificationStatus={verificationStatus}
            patch={patch}
            onTriggerToast={showToast}
            onRunsChanged={() => {
              loadCounts();
              loadPatch();
            }}
          />
        ))}

      {bootstrapped && currentScreen === 'agent-activity' &&
        (isLoading ? (
          <AgentActivitySkeleton />
        ) : (
          <AgentActivityScreen onTriggerToast={showToast} onNavigate={handleNavigate} />
        ))}

      {bootstrapped && currentScreen === 'verified-fixes' && (
        <VerifiedFixesScreen onNavigate={handleNavigate} onTriggerToast={showToast} />
      )}

      {bootstrapped && currentScreen === 'scan-history' && (
        <ScanHistoryScreen onNavigate={handleNavigate} onTriggerToast={showToast} currentProjectId={currentProjectId} />
      )}

      {bootstrapped && currentScreen === 'security-intelligence' && (
        <SecurityIntelligenceScreen onNavigate={handleNavigate} onTriggerToast={showToast} />
      )}

      {bootstrapped && currentScreen === 'reports-audit' && (
        <ReportsAuditScreen onNavigate={handleNavigate} onTriggerToast={showToast} />
      )}

      {bootstrapped && ['integrations', 'developer-api', 'team-permissions', 'notifications-settings',
        'account-privacy', 'settings', 'account-center'].includes(currentScreen) && (
        <AccountCenterScreen
          onNavigate={handleNavigate}
          onTriggerToast={showToast}
          initialSection={
            currentScreen === 'integrations' ? 'integrations'
              : currentScreen === 'developer-api' ? 'api-keys'
                : currentScreen === 'team-permissions' ? 'team'
                  : currentScreen === 'notifications-settings' ? 'notifications'
                    : currentScreen === 'account-privacy' ? 'privacy'
                      : currentScreen === 'settings' ? 'preferences'
                        : 'overview'
          }
        />
      )}
    </ApplicationLayout>
  );
}

export default App;
