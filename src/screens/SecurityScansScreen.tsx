import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ScreenId } from '../types';
import { ApiError, endpoints } from '../services/api';
import type { ProjectDto, ScanDto } from '../services/api';

interface SecurityScansScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
  onScanCompleted: () => void;
  currentProjectId: string | null;
  nvidiaConfigured: boolean | null;
}

const SCAN_ENGINES = [
  {
    id: 'AST Static Analysis (SAST)',
    icon: 'radar',
    title: 'AST Static Analysis (SAST)',
    description: 'Rule-based taint and sink detection across all stored text files (CWE-mapped).',
  },
  {
    id: 'Dependency Vulnerability (SBOM)',
    icon: 'hub',
    title: 'Dependency Vulnerability (SBOM)',
    description: 'Parses requirements.txt / package.json / go.mod and matches a local advisory set.',
  },
  {
    id: 'Secret & Token Detection',
    icon: 'key',
    title: 'Secret & Token Detection',
    description: 'Provider-specific secret patterns plus entropy-guarded credential detection.',
  },
  {
    id: 'gVisor Container Config Audit',
    icon: 'shield',
    title: 'gVisor Container Config Audit',
    description: 'Static audit of Dockerfiles and compose files (root user, socket mounts, secrets in ENV).',
  },
] as const;

/**
 * Scan configuration + live execution. A scan is a real persisted job: the button
 * creates it on the server, and this screen polls the actual status/logs — no
 * timers, no fabricated results. Model enrichment requires explicit consent.
 */
export const SecurityScansScreen: React.FC<SecurityScansScreenProps> = ({
  onNavigate,
  onTriggerToast,
  onScanCompleted,
  currentProjectId,
  nvidiaConfigured,
}) => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedScanType, setSelectedScanType] = useState<string>(SCAN_ENGINES[0].id);
  const [enableTaintFlow, setEnableTaintFlow] = useState(true);
  const [enableCveCorrelation, setEnableCveCorrelation] = useState(false);
  const [modelEnrichment, setModelEnrichment] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeScan, setActiveScan] = useState<ScanDto | null>(null);
  const [stageLabel, setStageLabel] = useState('Idle');
  const pollRef = useRef<number | null>(null);
  const completedNotified = useRef<string | null>(null);

  useEffect(() => {
    endpoints
      .projects()
      .then(({ projects: rows }) => {
        const withSource = rows.filter((p) => p.latestRevisionId);
        setProjects(withSource);
        const preferred = currentProjectId && withSource.some((p) => p.id === currentProjectId)
          ? currentProjectId
          : withSource[0]?.id ?? '';
        setSelectedProjectId(preferred);
      })
      .catch(() => undefined);
  }, [currentProjectId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const beginPolling = useCallback(
    (scanId: string) => {
      stopPolling();
      pollRef.current = window.setInterval(async () => {
        try {
          const { scan } = await endpoints.scan(scanId);
          setActiveScan(scan);
          if (scan.statusRaw === 'running') setStageLabel('Analyzing source…');
          if (scan.statusRaw === 'queued') setStageLabel('Queued…');
          if (['completed', 'failed', 'cancelled'].includes(scan.statusRaw)) {
            stopPolling();
            setIsRunning(false);
            if (scan.statusRaw === 'completed' && completedNotified.current !== scan.id) {
              completedNotified.current = scan.id;
              onTriggerToast({
                type: 'success',
                title: 'Scan Completed',
                message: `${scan.findingsCount} findings (${scan.criticalCount} critical, ${scan.highCount} high).`,
              });
              onScanCompleted();
            } else if (scan.statusRaw === 'failed' && completedNotified.current !== scan.id) {
              completedNotified.current = scan.id;
              onTriggerToast({
                type: 'warning',
                title: 'Scan Failed',
                message: scan.error?.message ?? 'The scan job failed — see logs.',
              });
            }
          }
        } catch {
          stopPolling();
          setIsRunning(false);
        }
      }, 1000);
    },
    [stopPolling, onScanCompleted, onTriggerToast],
  );

  const handleStartScan = async () => {
    if (!selectedProjectId) {
      onTriggerToast({
        type: 'warning',
        title: 'No Target',
        message: 'Import a source archive first — a scan needs an imported revision.',
      });
      return;
    }
    if (modelEnrichment && !consentGranted) {
      onTriggerToast({
        type: 'warning',
        title: 'Consent Required',
        message: 'Model enrichment sends source code to NVIDIA. Review and accept the consent step first.',
      });
      return;
    }
    setIsRunning(true);
    setStageLabel('Queued…');
    setActiveScan(null);
    try {
      const project = projects.find((p) => p.id === selectedProjectId);
      const res = await endpoints.createScan({
        projectId: selectedProjectId,
        revisionId: project?.latestRevisionId ?? undefined,
        scanType: selectedScanType,
        options: {
          taintFlow: enableTaintFlow,
          cveCorrelation: enableCveCorrelation,
          modelEnrichment,
        },
        consent: { granted: consentGranted, redactionAcknowledged: consentGranted },
      });
      onTriggerToast({
        type: 'info',
        title: 'Scan Queued',
        message: `Job ${res.scanId} created on the server. Tracking live progress…`,
      });
      beginPolling(res.scanId);
    } catch (exc) {
      setIsRunning(false);
      setStageLabel('Idle');
      onTriggerToast({
        type: 'warning',
        title: 'Scan Rejected',
        message: exc instanceof ApiError ? `${exc.code}: ${exc.message}` : 'Backend unreachable.',
      });
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const stageProgress = !activeScan
    ? 8
    : activeScan.statusRaw === 'queued'
      ? 20
      : activeScan.statusRaw === 'running'
        ? 62
        : 100;

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Security Scans
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure and run real analysis jobs against an imported source revision.
          </p>
        </div>
        <button
          onClick={() => onNavigate('scan-history')}
          className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span>View Scan History</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-4">
          {/* Target */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm">
            <h2 className="text-label-ui text-text-secondary uppercase tracking-wider mb-3">Scan Target</h2>
            {projects.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-text-muted mb-3">
                  No project with an imported source revision. Import a ZIP archive first.
                </p>
                <button
                  onClick={() => onNavigate('repositories')}
                  className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold"
                >
                  Go to Repositories
                </button>
              </div>
            ) : (
              <>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-surface-container border border-border-subtle rounded-xl px-3.5 py-2.5 text-body-sm text-text-primary"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.runtime}) • {p.primaryBranch} • rev {p.headCommit}…
                    </option>
                  ))}
                </select>
                {selectedProject && (
                  <p className="text-[11px] text-text-muted mt-2 font-mono">
                    revision digest {selectedProject.headCommit}… • imported {selectedProject.lastScanTime}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Engine selection */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-2.5">
            <h2 className="text-label-ui text-text-secondary uppercase tracking-wider">Scan Engine</h2>
            {SCAN_ENGINES.map((engine) => (
              <button
                key={engine.id}
                onClick={() => setSelectedScanType(engine.id)}
                disabled={isRunning}
                className={`w-full text-left p-3.5 rounded-xl border transition-all disabled:opacity-50 ${
                  selectedScanType === engine.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border-subtle hover:border-border-strong bg-surface-card'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selectedScanType === engine.id ? 'bg-primary/10 text-primary' : 'bg-surface-container text-text-secondary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{engine.icon}</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary">{engine.title}</div>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{engine.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-label-ui text-text-secondary uppercase tracking-wider">Analysis Options</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableTaintFlow}
                onChange={(e) => setEnableTaintFlow(e.target.checked)}
                disabled={isRunning}
                className="mt-0.5 accent-primary"
              />
              <span className="text-xs text-text-primary">
                Interprocedural taint-flow tracing
                <span className="block text-[11px] text-text-muted">
                  Records source → sink traces for injection-class findings.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableCveCorrelation}
                onChange={(e) => setEnableCveCorrelation(e.target.checked)}
                disabled={isRunning}
                className="mt-0.5 accent-primary"
              />
              <span className="text-xs text-text-primary">
                Correlate dependency findings with advisory data
                <span className="block text-[11px] text-text-muted">
                  Matches manifests against the local advisory set (not a live OSV/NVD feed).
                </span>
              </span>
            </label>
          </div>

          {/* Model enrichment + consent gate */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-label-ui text-text-secondary uppercase tracking-wider">
                NVIDIA Model Enrichment
              </h2>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                  nvidiaConfigured ? 'bg-status-success/10 text-status-success' : 'bg-status-high/10 text-status-high'
                }`}
              >
                {nvidiaConfigured === null ? 'checking…' : nvidiaConfigured ? 'configured' : 'not configured'}
              </span>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={modelEnrichment}
                onChange={(e) => {
                  setModelEnrichment(e.target.checked);
                  if (!e.target.checked) setConsentGranted(false);
                }}
                disabled={isRunning}
                className="mt-0.5 accent-primary"
              />
              <span className="text-xs text-text-primary">
                Send findings to the NVIDIA model for deeper analysis
                <span className="block text-[11px] text-text-muted">
                  Runs after static analysis completes. Scans work fully without it.
                </span>
              </span>
            </label>

            {modelEnrichment && (
              <div
                className={`rounded-xl p-4 border space-y-2.5 ${
                  nvidiaConfigured === false
                    ? 'bg-status-high/5 border-status-high/30'
                    : 'bg-surface-canvas border-border-subtle'
                }`}
              >
                <p className="text-xs font-semibold text-text-primary">Before you consent — what gets sent</p>
                <ul className="text-[11px] text-text-secondary space-y-1 list-disc pl-4">
                  <li>Source file paths and secret-redacted snippets around each finding.</li>
                  <li>Finding metadata (rule, CWE, severity, location).</li>
                  <li>
                    Inference runs on NVIDIA-hosted infrastructure (NIM API Catalog) — it is not on-premise.
                  </li>
                  <li>Detected secrets are replaced with placeholders before anything leaves this server.</li>
                </ul>
                {nvidiaConfigured === false && (
                  <p className="text-[11px] text-status-high">
                    NVIDIA_API_KEY is not configured in the backend. The scan will still run — model enrichment
                    will be honestly recorded as <span className="font-mono">not_configured</span>. Set the key in
                    backend/.env to enable it (never in the browser).
                  </p>
                )}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-border-subtle/60">
                  <input
                    type="checkbox"
                    checked={consentGranted}
                    onChange={(e) => setConsentGranted(e.target.checked)}
                    disabled={isRunning}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-[11px] text-text-primary">
                    I understand and consent to sending the described source data to NVIDIA for this scan.
                  </span>
                </label>
              </div>
            )}
          </div>

          <button
            onClick={handleStartScan}
            disabled={isRunning || !selectedProjectId}
            className="w-full px-4 py-3 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed text-on-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">{isRunning ? 'hourglass_top' : 'radar'}</span>
            <span>{isRunning ? 'Scan Running…' : 'Trigger Autonomous Scan'}</span>
          </button>
        </div>

        {/* Live execution panel */}
        <div className="bg-surface-dark rounded-2xl border border-outline/20 p-6 text-surface-bright flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-status-critical/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-status-medium/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-status-success/70" />
              </div>
              <span className="text-xs font-semibold text-surface-bright ml-2">Live Scan Execution</span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                isRunning
                  ? 'bg-status-medium/20 text-status-medium animate-pulse'
                  : activeScan?.statusRaw === 'completed'
                    ? 'bg-status-success/20 text-status-success'
                    : activeScan?.statusRaw === 'failed'
                      ? 'bg-status-critical/20 text-status-critical'
                      : 'bg-white/10 text-secondary-fixed-dim'
              }`}
            >
              {isRunning ? 'RUNNING' : activeScan ? activeScan.status.toUpperCase() : 'IDLE'}
            </span>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[11px] font-mono text-secondary-fixed-dim mb-1.5">
              <span>{stageLabel}</span>
              <span>{activeScan ? `${activeScan.findingsCount} findings` : ''}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  activeScan?.statusRaw === 'failed' ? 'bg-status-critical' : 'bg-primary-fixed'
                }`}
                style={{ width: `${stageProgress}%` }}
              />
            </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 bg-[#0b1411] border border-outline/20 rounded-xl p-4 font-mono text-[11px] space-y-1 overflow-y-auto max-h-96 min-h-64">
            {!activeScan && (
              <div className="text-secondary-fixed-dim">
                [IDLE] Configure a target and engine, then trigger a scan. Real job logs will stream here.
              </div>
            )}
            {activeScan && activeScan.logs.length === 0 && (
              <div className="text-secondary-fixed-dim">[QUEUED] Waiting for a worker slot…</div>
            )}
            {activeScan?.logs.map((line, i) => (
              <div
                key={i}
                className={
                  line.includes('[FAIL]') || line.includes('ERROR')
                    ? 'text-status-critical'
                    : line.includes('[COMPLETE]') || line.includes('[PASS]')
                      ? 'text-status-success'
                      : line.includes('[MODEL]') && line.includes('not configured')
                        ? 'text-status-high'
                        : 'text-secondary-fixed-dim'
                }
              >
                {line}
              </div>
            ))}
            {activeScan?.error && (
              <div className="text-status-critical mt-2">
                [ERROR] {activeScan.error.code}: {activeScan.error.message}
              </div>
            )}
          </div>

          {/* Result footer */}
          {activeScan && ['completed', 'failed'].includes(activeScan.statusRaw) && (
            <div className="mt-4 pt-4 border-t border-outline/20 flex items-center justify-between">
              <div className="text-[11px] font-mono text-secondary-fixed-dim">
                {activeScan.statusRaw === 'completed' ? (
                  <>
                    {activeScan.findingsCount} findings • {activeScan.criticalCount} critical •{' '}
                    {activeScan.highCount} high • duration {activeScan.duration}
                    {activeScan.modelEnrichment !== 'not_requested' && (
                      <> • model: {activeScan.modelEnrichment}</>
                    )}
                  </>
                ) : (
                  <>Job failed — {activeScan.error?.code ?? 'unknown error'}</>
                )}
              </div>
              {activeScan.statusRaw === 'completed' && activeScan.findingsCount > 0 && (
                <button
                  onClick={() => onNavigate('vulnerabilities')}
                  className="bg-primary hover:bg-primary-container text-on-primary px-3.5 py-1.5 rounded-xl font-label-ui text-xs font-semibold"
                >
                  Inspect Findings
                </button>
              )}
            </div>
          )}

          <p className="text-[10px] text-secondary-fixed-dim mt-3 font-mono">
            Engine: healforge-static-engine + secret-engine • jobs persist server-side and survive reloads
          </p>
        </div>
      </div>
    </div>
  );
};
