import React, { useState } from 'react';
import type { ScreenId, ProjectDetail } from '../types';
import { mockProjects, mockVulnerabilities, mockSecurityScans } from '../services/mockData';

interface RepositoriesScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onSelectRepository: (repoName: string) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const RepositoriesScreen: React.FC<RepositoriesScreenProps> = ({
  onNavigate,
  onSelectRepository,
  onTriggerToast,
}) => {
  const [projects, setProjects] = useState<ProjectDetail[]>(mockProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(mockProjects[0].id);
  const [activeTab, setActiveTab] = useState<'overview' | 'info' | 'vulnerabilities' | 'scans' | 'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const projectVulnerabilities = mockVulnerabilities.filter(
    (v) => v.service.toLowerCase() === selectedProject.name.toLowerCase()
  );

  const projectScans = mockSecurityScans.filter(
    (s) => s.project.toLowerCase() === selectedProject.name.toLowerCase()
  );

  const handleStartScan = (project: ProjectDetail) => {
    onSelectRepository(project.name);
    onTriggerToast({
      type: 'info',
      title: 'Scan Initialized',
      message: `Triggering AST static analysis on ${project.name} (${project.primaryBranch}).`,
    });
    onNavigate('security-scans');
  };

  const handleDisconnect = (projectId: string) => {
    setProjects(projects.filter((p) => p.id !== projectId));
    onTriggerToast({
      type: 'warning',
      title: 'Repository Disconnected',
      message: `Project ${selectedProject.name} unlinked from monitored workbench.`,
    });
  };

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-label-ui text-text-muted mb-1">
            <span className="material-symbols-outlined text-[16px] text-primary">source</span>
            <span>Workspace</span>
            <span>/</span>
            <span className="font-semibold text-text-primary">Repositories & Projects</span>
          </div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Monitored Repositories & Security Projects
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage repository providers, active branch analysis policies, and vulnerability postures.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onTriggerToast({
                type: 'info',
                title: 'Add Repository',
                message: 'Repository addition workflow initialized. Select Git provider in Integrations.',
              });
              onNavigate('integrations');
            }}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Connect Repository</span>
          </button>
        </div>
      </div>

      {/* Grid: Project List (4 cols) & Detail View (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Project Listing (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-muted text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Filter repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-surface-card border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui shadow-sm"
            />
          </div>

          {/* Cards List */}
          <div className="space-y-3">
            {filteredProjects.map((p) => {
              const isSelected = p.id === selectedProjectId;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    onSelectRepository(p.name);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-surface-card border-primary ring-1 ring-primary shadow-sm'
                      : 'bg-surface-card border-border-subtle hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold text-xs">
                        {p.provider === 'github' ? 'GH' : 'GL'}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-text-primary font-headline-sm">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono mt-0.5">
                          <span>branch: {p.primaryBranch}</span>
                          <span>•</span>
                          <span>{p.runtime}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        p.scanStatus === 'healthy'
                          ? 'bg-status-success/10 text-status-success'
                          : 'bg-status-critical/10 text-status-critical'
                      }`}
                    >
                      {p.healthScore}/100
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                    {p.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-border-subtle/50 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-text-muted">Scanned {p.lastScanTime}</span>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      {p.criticalCount > 0 && (
                        <span className="text-status-critical font-semibold">
                          {p.criticalCount} Critical
                        </span>
                      )}
                      <span className="text-text-secondary">{p.openVulnCount} Open</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Project Detail Panel (7 cols) */}
        <div className="lg:col-span-7 bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-6">
          {/* Project Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-headline-sm text-text-primary">
                  {selectedProject.name}
                </h2>
                <span className="text-[10px] font-mono bg-surface-container text-text-muted px-2 py-0.5 rounded">
                  {selectedProject.provider.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold">
                  commit {selectedProject.headCommit}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {selectedProject.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStartScan(selectedProject)}
                className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">radar</span>
                <span>Run Scan</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-border-subtle pb-2 overflow-x-auto">
            {[
              { id: 'overview' as const, label: 'Overview', icon: 'dashboard' },
              { id: 'info' as const, label: 'Repository Details', icon: 'info' },
              { id: 'vulnerabilities' as const, label: `Findings (${projectVulnerabilities.length})`, icon: 'pest_control' },
              { id: 'scans' as const, label: `Scan History (${projectScans.length})`, icon: 'history' },
              { id: 'settings' as const, label: 'Project Settings', icon: 'settings' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-surface-container/30 border border-border-subtle">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold block">
                    Security Score
                  </span>
                  <span className="text-2xl font-bold font-headline-sm text-text-primary mt-1 block">
                    {selectedProject.healthScore} / 100
                  </span>
                  <span className="text-[10px] text-status-success font-semibold mt-0.5 block">
                    Status: {selectedProject.scanStatus}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-container/30 border border-border-subtle">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold block">
                    Open Vulnerabilities
                  </span>
                  <span className="text-2xl font-bold font-headline-sm text-status-critical mt-1 block">
                    {selectedProject.openVulnCount}
                  </span>
                  <span className="text-[10px] text-status-critical font-semibold mt-0.5 block">
                    {selectedProject.criticalCount} Critical CVEs
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-container/30 border border-border-subtle">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold block">
                    Primary Branch
                  </span>
                  <span className="text-base font-mono font-bold text-text-primary mt-2 block truncate">
                    {selectedProject.primaryBranch}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5 block">
                    {selectedProject.branches.length} active branches
                  </span>
                </div>
              </div>

              {/* Action shortcuts */}
              <div className="p-4 rounded-xl bg-surface-container/20 border border-border-subtle space-y-3">
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
                  Project Quick Actions
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      onSelectRepository(selectedProject.name);
                      onNavigate('code-explorer');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-container border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">terminal</span>
                    <span>Inspect Code in Explorer</span>
                  </button>
                  <button
                    onClick={() => {
                      onSelectRepository(selectedProject.name);
                      onNavigate('vulnerabilities');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-container border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">pest_control</span>
                    <span>View All Findings</span>
                  </button>
                  <button
                    onClick={() => {
                      onSelectRepository(selectedProject.name);
                      onNavigate('patch-review');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-container border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">code</span>
                    <span>Review Pending Patches</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle">
                  <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                    Language & Framework
                  </span>
                  <span className="font-semibold text-text-primary mt-1 block">
                    {selectedProject.runtime}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle">
                  <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                    Head Commit SHA
                  </span>
                  <span className="font-mono text-text-primary mt-1 block">
                    {selectedProject.headCommit}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-text-primary block mb-1.5">Monitored Git Branches</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedProject.branches.map((b) => (
                    <span
                      key={b}
                      className="px-2.5 py-1 rounded bg-surface-container font-mono text-[11px] text-text-secondary border border-border-subtle"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vulnerabilities' && (
            <div className="space-y-3 animate-fade-in">
              {projectVulnerabilities.length > 0 ? (
                projectVulnerabilities.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => onNavigate('vulnerabilities')}
                    className="p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle hover:border-primary cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-xs text-text-primary">{v.id}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-status-critical/10 text-status-critical font-bold">
                          {v.severity}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">{v.title}</div>
                      <div className="text-[10px] text-text-muted font-mono mt-0.5">{v.affectedFile}</div>
                    </div>
                    <span className="material-symbols-outlined text-text-muted text-[18px]">chevron_right</span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-text-muted text-xs">
                  No active vulnerabilities flagged in this repository.
                </div>
              )}
            </div>
          )}

          {activeTab === 'scans' && (
            <div className="space-y-3 animate-fade-in">
              {projectScans.length > 0 ? (
                projectScans.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-surface-container/30 border border-border-subtle flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-xs text-text-primary">{s.id}</span>
                        <span className="text-xs text-text-primary font-semibold">{s.scanType}</span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {s.startTime} • Duration: {s.duration}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-status-success/10 text-status-success font-semibold">
                      {s.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-text-muted text-xs">
                  No previous scans recorded for this project.
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Default Target Branch
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedProject.primaryBranch}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border border-border-subtle font-mono text-xs text-text-primary"
                />
              </div>

              <div className="pt-3 border-t border-border-subtle flex justify-between items-center">
                <div>
                  <span className="font-semibold text-status-critical block">Disconnect Repository</span>
                  <span className="text-text-muted text-[11px]">Remove this project from autonomous monitoring</span>
                </div>
                <button
                  onClick={() => handleDisconnect(selectedProject.id)}
                  className="px-3 py-1.5 rounded-lg bg-status-critical/10 text-status-critical border border-status-critical/30 hover:bg-status-critical hover:text-white transition-all font-semibold"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
