import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScreenId, ProjectDetail, SecurityScanRecord } from '../types';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { ApiError, endpoints } from '../services/api';
import type { FindingDto, ProjectDto, ScanDto } from '../services/api';

interface RepositoriesScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onSelectRepository: (repoName: string) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
  onOpenImport: () => void;
  currentProjectId: string | null;
}

interface TabDef {
  id: 'overview' | 'info' | 'vulnerabilities' | 'scans' | 'settings';
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'info', label: 'Repository Details', icon: 'info' },
  { id: 'vulnerabilities', label: 'Findings', icon: 'pest_control' },
  { id: 'scans', label: 'Scan History', icon: 'history' },
  { id: 'settings', label: 'Project Settings', icon: 'settings' },
];

/** Projects workbench — every card, tab and action is backed by persisted server records. */
export const RepositoriesScreen: React.FC<RepositoriesScreenProps> = ({
  onNavigate,
  onSelectRepository,
  onTriggerToast,
  onOpenImport,
  currentProjectId,
}) => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [detail, setDetail] = useState<ProjectDto | null>(null);
  const [detailFindings, setDetailFindings] = useState<FindingDto[]>([]);
  const [detailScans, setDetailScans] = useState<ScanDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(currentProjectId);
  const [activeTab, setActiveTab] = useState<TabDef['id']>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await endpoints.projects();
      setProjects(res.projects);
      setSelectedId((prev) => prev ?? res.projects[0]?.id ?? null);
    } catch (exc) {
      onTriggerToast({
        type: 'warning',
        title: 'Load Failed',
        message: exc instanceof ApiError ? exc.message : 'Backend unreachable.',
      });
    } finally {
      setLoading(false);
    }
  }, [onTriggerToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load the full detail (findings + scans joined server-side by project id)
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailFindings([]);
      setDetailScans([]);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    endpoints
      .project(selectedId)
      .then(({ project }) => {
        if (cancelled) return;
        setDetail(project);
        setDetailFindings((project.findings ?? []) as FindingDto[]);
        setDetailScans((project.scans ?? []) as ScanDto[]);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  const handleSelect = (project: ProjectDto) => {
    setSelectedId(project.id);
    onSelectRepository(project.name);
  };

  const handleStartScan = (project: ProjectDto) => {
    onSelectRepository(project.name);
    onNavigate('security-scans');
  };

  const handleDisconnect = async (project: ProjectDto) => {
    try {
      await endpoints.archiveProject(project.id);
      onTriggerToast({
        type: 'warning',
        title: 'Project Archived',
        message: `'${project.name}' archived. Its scans and findings remain retained for audit.`,
      });
      setSelectedId(null);
      loadProjects();
    } catch (exc) {
      onTriggerToast({
        type: 'warning',
        title: 'Archive Failed',
        message: exc instanceof ApiError ? exc.message : 'Backend unreachable.',
      });
    }
  };

  const openFindings = detailFindings.filter((f) => f.status === 'open');
  const providerLabel = (p: ProjectDto) =>
    p.provider === 'zip-archive' ? 'ZIP' : p.provider === 'github' ? 'GH' : p.provider === 'gitlab' ? 'GL' : 'BB';

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Repositories & Projects
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Projects created from imported source archives. All findings and scans below are persisted records.
          </p>
        </div>
        <button
          onClick={onOpenImport}
          className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">upload_file</span>
          <span>Import Source Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Project list */}
        <div className="lg:col-span-5 space-y-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
              search
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter repositories..."
              className="w-full bg-surface-card border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-card border border-border-subtle rounded-2xl h-28 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && filteredProjects.length === 0 && (
            <div className="bg-surface-card border border-dashed border-border-subtle rounded-2xl p-10 text-center">
              <span className="material-symbols-outlined text-3xl text-text-muted">folder_open</span>
              <p className="text-body-md text-text-primary font-medium mt-3">
                {projects.length === 0 ? 'No projects yet' : 'No projects match this filter'}
              </p>
              <p className="text-body-sm text-text-muted mt-1">
                {projects.length === 0
                  ? 'Import a ZIP source archive to create your first project.'
                  : 'Try a different search term.'}
              </p>
              {projects.length === 0 && (
                <button
                  onClick={onOpenImport}
                  className="mt-4 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold"
                >
                  Import Source Project
                </button>
              )}
            </div>
          )}

          {!loading &&
            filteredProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                className={`w-full text-left bg-surface-card border rounded-2xl p-4 transition-all hover:shadow-md ${
                  selectedId === p.id ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border-subtle'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-[10px] font-mono font-bold text-text-secondary shrink-0">
                      {providerLabel(p)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-headline-sm text-body-md text-text-primary font-semibold truncate">
                          {p.name}
                        </h3>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                            p.scanStatus === 'vulnerable'
                              ? 'bg-status-critical/10 text-status-critical'
                              : p.scanStatus === 'scanning'
                                ? 'bg-status-medium/10 text-status-medium'
                                : 'bg-status-success/10 text-status-success'
                          }`}
                        >
                          {p.scanStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 truncate">
                        {p.primaryBranch} • {p.runtime} • {p.lastScanTime === '—' ? 'never scanned' : `scanned ${p.lastScanTime}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold font-headline-sm text-text-primary">{p.healthScore}</div>
                    <div className="text-[9px] text-text-muted uppercase tracking-wider">Health</div>
                  </div>
                </div>
                {p.description && (
                  <p className="text-xs text-text-secondary mt-2 line-clamp-2 leading-relaxed">{p.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2.5 font-mono text-[11px]">
                  <span className="text-status-critical">{p.criticalCount} critical</span>
                  <span className="text-status-high">{p.highCount} high</span>
                  <span className="text-text-muted">{p.openVulnCount} open</span>
                </div>
              </button>
            ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-7">
          {detailLoading && (
            <div className="bg-surface-card border border-border-subtle rounded-2xl h-96 animate-pulse" />
          )}

          {!detailLoading && !detail && (
            <div className="bg-surface-card border border-dashed border-border-subtle rounded-2xl p-14 text-center">
              <span className="material-symbols-outlined text-4xl text-text-muted">inventory_2</span>
              <p className="text-body-md text-text-primary font-medium mt-4">Select a project</p>
              <p className="text-body-sm text-text-muted mt-1">
                Choose a project on the left to see its findings, scans and settings.
              </p>
            </div>
          )}

          {!detailLoading && detail && (
            <div className="bg-surface-card border border-border-subtle rounded-2xl shadow-sm overflow-hidden">
              {/* Detail header */}
              <div className="p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container/20">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-headline-sm text-text-primary">{detail.name}</h2>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-text-secondary uppercase">
                      {providerLabel(detail)}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 font-mono">
                    branch {detail.primaryBranch} • head {detail.headCommit} • runtime {detail.runtime}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartScan(detail)}
                    className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">radar</span>
                    <span>Run Scan</span>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-5 pt-4 flex items-center gap-1.5 overflow-x-auto border-b border-border-subtle">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-on-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">{tab.icon}</span>
                    {tab.id === 'vulnerabilities' ? `Findings (${openFindings.length})` : tab.label}
                    {tab.id === 'scans' ? ` (${detailScans.length})` : ''}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Open Findings', value: detail.openVulnCount, tone: 'text-status-high' },
                      { label: 'Critical', value: detail.criticalCount, tone: 'text-status-critical' },
                      { label: 'Health Score', value: detail.healthScore, tone: 'text-status-success' },
                      {
                        label: 'Revisions',
                        value: (detail.revisions ?? []).length,
                        tone: 'text-text-primary',
                      },
                    ].map((m) => (
                      <div key={m.label} className="bg-surface-canvas border border-border-subtle rounded-xl p-4">
                        <div className={`text-2xl font-bold font-headline-sm ${m.tone}`}>{m.value}</div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">{m.label}</div>
                      </div>
                    ))}
                    <div className="col-span-2 md:col-span-4 bg-surface-canvas border border-border-subtle rounded-xl p-4">
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                        Latest imported revisions
                      </div>
                      {(detail.revisions ?? []).slice(0, 3).map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs py-1 font-mono">
                          <span className="text-text-primary">{r.shortDigest}…</span>
                          <span className="text-text-muted">
                            {r.textFileCount} files • {r.createdAt}
                          </span>
                        </div>
                      ))}
                      {(detail.revisions ?? []).length === 0 && (
                        <p className="text-xs text-text-muted">No revisions imported.</p>
                      )}
                    </div>
                    <div className="col-span-2 md:col-span-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => onNavigate('code-explorer')}
                        className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary"
                      >
                        Inspect Code in Explorer
                      </button>
                      <button
                        onClick={() => onNavigate('vulnerabilities')}
                        className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary"
                      >
                        View All Findings
                      </button>
                      <button
                        onClick={() => onNavigate('patch-review')}
                        className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary"
                      >
                        Review Pending Patches
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'info' && (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                    {[
                      ['Project ID', detail.id],
                      ['Imported provider', detail.provider],
                      ['Primary branch', detail.primaryBranch],
                      ['Runtime', detail.runtime],
                      ['Head revision digest', `${detail.headCommit}…`],
                      ['Created', detail.createdAtIso ? new Date(detail.createdAtIso).toLocaleString() : '—'],
                      ['Last scan', detail.lastScanTime],
                      ['Verification status', detail.verificationStatus],
                    ].map(([k, v]) => (
                      <div key={k as string} className="border-b border-border-subtle/50 pb-2">
                        <dt className="text-[10px] uppercase tracking-wider text-text-muted">{k}</dt>
                        <dd className="text-text-primary font-mono text-[11px] mt-0.5 break-all">{v}</dd>
                      </div>
                    ))}
                    <div className="sm:col-span-2 text-text-secondary leading-relaxed">{detail.description}</div>
                  </dl>
                )}

                {activeTab === 'vulnerabilities' && (
                  <div className="divide-y divide-border-subtle/50">
                    {openFindings.length === 0 && (
                      <p className="py-8 text-center text-xs text-text-muted">
                        No open findings for this project{detailScans.length ? '' : ' — run a scan first.'}
                      </p>
                    )}
                    {openFindings.map((f) => (
                      <button
                        key={f.internalId}
                        onClick={() => onNavigate('vulnerabilities')}
                        className="w-full text-left py-3 flex items-center justify-between gap-3 hover:bg-surface-container/30 px-2 rounded-lg transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-text-primary">{f.id}</span>
                            <SeverityBadge severity={f.severity} />
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5 truncate">
                            {f.title} — <span className="font-mono text-[11px]">{f.affectedFile}:{f.exactLines}</span>
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-text-muted text-[16px]">chevron_right</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'scans' && (
                  <div className="divide-y divide-border-subtle/50">
                    {detailScans.length === 0 && (
                      <p className="py-8 text-center text-xs text-text-muted">No scans recorded yet.</p>
                    )}
                    {detailScans.map((s) => (
                      <div key={s.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-mono text-[11px] text-text-primary">{s.scanType}</span>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {s.startTime} • {s.duration} • revision {s.commitHash}…
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[11px] text-text-secondary">
                            {s.findingsCount} findings
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                              s.status === 'Completed'
                                ? 'bg-status-success/10 text-status-success'
                                : s.status === 'Failed'
                                  ? 'bg-status-critical/10 text-status-critical'
                                  : 'bg-status-medium/10 text-status-medium'
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-label-ui text-text-secondary mb-1.5">Default branch label</label>
                      <input
                        readOnly
                        value={detail.primaryBranch}
                        className="w-full bg-surface-container border border-border-subtle rounded-xl px-3.5 py-2.5 text-body-sm text-text-muted font-mono"
                      />
                      <p className="text-[11px] text-text-muted mt-1">
                        Branch label is set at import time and shown with every finding for traceability.
                      </p>
                    </div>
                    <div className="border border-status-critical/30 rounded-xl p-4 bg-status-critical/5">
                      <p className="text-label-ui text-status-critical uppercase tracking-wider mb-1">Danger zone</p>
                      <p className="text-xs text-text-secondary mb-3">
                        Archiving removes the project from dashboards and scan targets. Its findings and scans remain
                        retained in the audit trail.
                      </p>
                      <button
                        onClick={() => handleDisconnect(detail)}
                        className="px-3.5 py-2 rounded-xl bg-status-critical/10 hover:bg-status-critical/20 text-status-critical text-xs font-semibold border border-status-critical/30"
                      >
                        Archive Project
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export type { ProjectDetail, SecurityScanRecord };
