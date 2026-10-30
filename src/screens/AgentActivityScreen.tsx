import React, { useEffect, useState } from 'react';
import type { ScreenId, AgentExecutionLog } from '../types';
import { endpoints } from '../services/api';
import { workbenchService } from '../services/workbenchService';

interface AgentActivityScreenProps {
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
  onNavigate?: (screen: ScreenId) => void;
}

export const AgentActivityScreen: React.FC<AgentActivityScreenProps> = ({ onTriggerToast, onNavigate }) => {
  const [streamFilter, setStreamFilter] = useState<'all' | 'solver' | 'replay'>('all');
  const [executions, setExecutions] = useState<AgentExecutionLog[]>([]);
  const [telemetry, setTelemetry] = useState<{
    activeAgents: number; successRate: string; runsPerHour: number; totalExecutions: number;
    monitoredRepos: { name: string; runtime: string; projectId: string }[]; workerNode: string;
  } | null>(null);
  const [isEngineRunning, setIsEngineRunning] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({});

  const toggleTrace = (id: string) => {
    setExpandedTraceIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  useEffect(() => {
    workbenchService.getAgentExecutions().then(setExecutions).catch(() => undefined);
    endpoints.agentTelemetry().then(setTelemetry).catch(() => undefined);
    endpoints.engineState().then((s) => setIsEngineRunning(!s.paused)).catch(() => undefined);
  }, []);

  const handleToggleEngine = async () => {
    try {
      const res = isEngineRunning ? await endpoints.enginePause() : await endpoints.engineResume();
      setIsEngineRunning(!res.paused);
      onTriggerToast({
        type: res.paused ? 'warning' : 'success',
        title: res.paused ? 'Autonomous Engine Paused' : 'Autonomous Engine Resumed',
        message: res.paused
          ? 'Engine paused for this workspace (persisted server-side). Manual scans remain available.'
          : 'Engine resumed — automated activity continues for this workspace.',
      });
    } catch {
      onTriggerToast({ type: 'warning', title: 'Engine Control Failed', message: 'Backend unreachable.' });
    }
  };

  const filteredExecutions = executions.filter((item) => {
    // Stream filter
    if (streamFilter === 'solver' && !item.title.toLowerCase().includes('taint')) return false;
    if (streamFilter === 'replay' && !item.title.toLowerCase().includes('gvisor')) return false;

    // Severity filter
    if (severityFilter === 'critical' && item.severityType !== 'critical') return false;
    if (severityFilter === 'warning' && item.severityType !== 'warning') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = item.id.toLowerCase().includes(q);
      const matchCommit = item.commitHash.toLowerCase().includes(q);
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchService = item.service.toLowerCase().includes(q);
      if (!matchId && !matchCommit && !matchTitle && !matchService) return false;
    }

    return true;
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-surface pb-16">
      {/* Top Banner / Action Bar */}
      <div className="px-margin pt-6 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-label-code-sm font-label-code-sm ${
                isEngineRunning ? 'bg-primary/10 text-primary' : 'bg-status-high/10 text-status-high'
              }`}
            >
              {isEngineRunning ? 'LIVE STREAM' : 'STREAM PAUSED'}
            </span>
            <span className="text-body-sm text-text-muted">
              Node ID: <code className="font-label-code-sm text-on-surface">hf-worker-09a</code>
            </span>
          </div>
          <h1 className="text-headline-lg font-headline-lg text-on-surface">Autonomous Agent Activity</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-surface-container p-1 rounded-lg">
            <button
              onClick={() => setStreamFilter('all')}
              className={`px-3 py-1.5 rounded text-label-ui transition-all ${
                streamFilter === 'all'
                  ? 'bg-surface text-on-surface shadow-sm font-medium'
                  : 'text-text-secondary hover:text-on-surface'
              }`}
            >
              All Streams
            </button>
            <button
              onClick={() => setStreamFilter('solver')}
              className={`px-3 py-1.5 rounded text-label-ui transition-all ${
                streamFilter === 'solver'
                  ? 'bg-surface text-on-surface shadow-sm font-medium'
                  : 'text-text-secondary hover:text-on-surface'
              }`}
            >
              AST Solver
            </button>
            <button
              onClick={() => setStreamFilter('replay')}
              className={`px-3 py-1.5 rounded text-label-ui transition-all ${
                streamFilter === 'replay'
                  ? 'bg-surface text-on-surface shadow-sm font-medium'
                  : 'text-text-secondary hover:text-on-surface'
              }`}
            >
              gVisor Replay
            </button>
          </div>

          <button
            onClick={handleToggleEngine}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-label-ui transition-all shadow-sm ${
              isEngineRunning
                ? 'bg-primary text-on-primary hover:bg-primary/90'
                : 'bg-status-high text-on-primary hover:bg-status-high/90'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isEngineRunning ? 'pause' : 'play_arrow'}
            </span>
            {isEngineRunning ? 'Pause Engine' : 'Resume Engine'}
          </button>
        </div>
      </div>

      {/* Main Grid / Dashboard Body */}
      <div className="px-margin grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Quick Stats & Metrics (1 col) */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface-card p-6 rounded-xl shadow-sm border border-border-subtle flex flex-col gap-4">
            <h3 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">neurology</span>
              Agent Telemetry
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container/50 p-4 rounded-lg">
                <span className="text-body-sm text-text-muted block mb-1">Recent Executions</span>
                <span className="text-headline-md font-headline-md text-on-surface">{telemetry ? telemetry.totalExecutions : '—'}</span>
                <span className="text-label-code-sm text-status-success flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success" /> Optimal
                </span>
              </div>
              <div className="bg-surface-container/50 p-4 rounded-lg">
                <span className="text-body-sm text-text-muted block mb-1">Success Rate</span>
                <span className="text-headline-md font-headline-md text-on-surface">{telemetry ? telemetry.successRate : '—'}</span>
                <span className="text-label-code-sm text-text-secondary mt-1 block">Last 24 hours</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border-subtle">
              <div className="flex justify-between text-body-sm">
                <span className="text-text-secondary">Worker</span>
                <span className="font-label-code-sm text-on-surface">{telemetry?.workerNode ?? '—'}</span>
              </div>
              <div className="flex justify-between text-body-sm">
                <span className="text-text-secondary">Total runs</span>
                <span className="font-label-code-sm text-on-surface">{telemetry ? telemetry.runsPerHour : '—'}</span>
              </div>
            </div>
          </div>

          {/* Live Target Repositories */}
          <div className="bg-surface-card p-6 rounded-xl shadow-sm border border-border-subtle flex flex-col gap-4">
            <h3 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">stethoscope_arrow</span>
              Monitored Repos
            </h3>

            <div className="flex flex-col gap-3">
              {(telemetry?.monitoredRepos ?? []).map((repo) => (
                <button
                  key={repo.projectId}
                  onClick={() => onNavigate?.('repositories')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-surface-container/30 border border-border-subtle hover:bg-surface-container/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">code</span>
                    <div>
                      <span className="text-body-md font-label-ui text-on-surface block">{repo.name}</span>
                      <span className="text-body-sm text-text-muted font-label-code-sm">{repo.runtime}</span>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                </button>
              ))}
              {(!telemetry || telemetry.monitoredRepos.length === 0) && (
                <p className="text-body-sm text-text-muted text-center py-4">
                  No monitored repositories yet — import a project first.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Chronological Execution Log Stream (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="material-symbols-outlined text-text-muted">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search execution ID, commit hash, or tool name..."
                className="w-full bg-transparent border-none text-body-md text-on-surface focus:outline-none placeholder:text-text-muted"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-body-sm text-text-muted">Filter:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-surface-container border border-border-subtle rounded px-2 py-1 text-body-sm text-on-surface focus:outline-none"
              >
                <option value="all">All Severity Levels</option>
                <option value="critical">Critical & High</option>
                <option value="warning">Warnings Only</option>
              </select>
            </div>
          </div>

          {/* Execution Log Entries */}
          <div className="flex flex-col gap-4">
            {executions.length === 0 ? (
              <div className="p-10 text-center bg-surface-card rounded-xl border border-dashed border-border-subtle">
                <span className="material-symbols-outlined text-3xl text-text-muted block mb-2">neurology</span>
                <p className="text-body-md text-text-primary font-medium">No agent executions yet</p>
                <p className="text-body-sm text-text-muted mt-1">
                  Execution records are created when scans run — trigger one from Security Scans.
                </p>
              </div>
            ) : filteredExecutions.length === 0 ? (
              <div className="p-8 text-center text-text-muted bg-surface-card rounded-xl border border-border-subtle">
                No matching execution streams found for "{searchQuery}".
              </div>
            ) : (
              filteredExecutions.map((log) => {
                const isExpanded = !!expandedTraceIds[log.id];

                return (
                  <div
                    key={log.id}
                    className="bg-surface-card rounded-xl shadow-sm border border-border-subtle overflow-hidden transition-all"
                  >
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle/50">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            log.severityType === 'critical'
                              ? 'bg-primary/10 text-primary'
                              : log.severityType === 'success'
                              ? 'bg-status-success/10 text-status-success'
                              : 'bg-status-medium/10 text-status-medium'
                          }`}
                        >
                          <span className="material-symbols-outlined">
                            {log.severityType === 'critical'
                              ? 'bolt'
                              : log.severityType === 'success'
                              ? 'verified'
                              : 'warning'}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-label-code-md text-on-surface">{log.id}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-label-code-sm font-label-code-sm border ${
                                log.severityType === 'critical'
                                  ? 'bg-status-critical/10 text-status-critical border-status-critical/20'
                                  : log.severityType === 'success'
                                  ? 'bg-status-success/10 text-status-success border-status-success/20'
                                  : 'bg-status-medium/10 text-status-medium border-status-medium/20'
                              }`}
                            >
                              {log.severityBadge}
                            </span>
                            <span className="px-2 py-0.5 rounded text-label-code-sm font-label-code-sm bg-surface-container text-text-secondary">
                              {log.service}
                            </span>
                          </div>
                          <h4 className="text-headline-sm font-headline-sm text-on-surface">{log.title}</h4>
                          <span className="text-body-sm text-text-muted font-label-code-sm mt-0.5 block">
                            {log.startTime} • Commit <code className="text-on-surface">{log.commitHash}</code>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <span className="text-body-sm text-text-muted block">Duration</span>
                          <span className="font-label-code-md text-on-surface">{log.duration}</span>
                        </div>
                        <button
                          onClick={() => toggleTrace(log.id)}
                          className="px-3.5 py-2 rounded-full border border-border-subtle hover:bg-surface-container text-body-sm text-on-surface font-label-ui flex items-center gap-1.5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">code</span>
                          Trace Details
                          <span
                            className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          >
                            expand_more
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Stages Stepper */}
                    <div className="p-5 bg-surface-canvas/50 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border-subtle/50">
                      {log.stages.map((stage, sIdx) => {
                        const isDone = stage.status === 'completed';
                        const isRunningStage = stage.status === 'running';
                        const isWarningStage = stage.status === 'warning';

                        return (
                          <div
                            key={sIdx}
                            className={`flex items-center gap-3 p-3 rounded-lg bg-surface-card border ${
                              isRunningStage
                                ? 'border-primary/40 ring-1 ring-primary/20'
                                : 'border-border-subtle'
                            } ${stage.status === 'pending' || stage.status === 'skipped' ? 'opacity-60' : ''}`}
                          >
                            <span
                              className={`material-symbols-outlined text-[20px] ${
                                isDone
                                  ? 'text-status-success'
                                  : isRunningStage
                                  ? 'text-primary animate-spin'
                                  : isWarningStage
                                  ? 'text-status-medium'
                                  : 'text-text-muted'
                              }`}
                            >
                              {isDone
                                ? 'check_circle'
                                : isRunningStage
                                ? 'progress_activity'
                                : isWarningStage
                                ? 'warning'
                                : stage.status === 'skipped'
                                ? 'remove_circle_outline'
                                : 'radio_button_unchecked'}
                            </span>
                            <div>
                              <span className="text-body-sm font-label-ui text-on-surface block">
                                {stage.name}
                              </span>
                              <span
                                className={`text-body-sm font-label-code-sm ${
                                  isRunningStage
                                    ? 'text-primary'
                                    : isWarningStage
                                    ? 'text-status-medium'
                                    : 'text-text-muted'
                                }`}
                              >
                                {stage.timing || stage.detail}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Generated Artifacts Section (if present) */}
                    {log.artifacts && log.artifacts.length > 0 && (
                      <div className="px-5 py-3 bg-surface-container/30 flex flex-wrap items-center gap-3 border-b border-border-subtle/50">
                        <span className="text-body-sm text-text-muted font-label-code-sm">
                          Artifacts Produced:
                        </span>
                        {log.artifacts.map((art, aIdx) => (
                          <span
                            key={aIdx}
                            className="px-2.5 py-1 rounded-md bg-surface-card border border-border-subtle text-label-code-sm font-label-code-sm flex items-center gap-1.5 text-on-surface"
                          >
                            <span
                              className={`material-symbols-outlined text-[14px] ${
                                art.type === 'diff' ? 'text-status-success' : 'text-status-verified'
                              }`}
                            >
                              {art.type === 'diff' ? 'description' : 'verified_user'}
                            </span>
                            {art.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expandable Technical Trace Details */}
                    {isExpanded && (
                      <div className="bg-surface-dark text-surface-bright p-5 font-label-code-sm overflow-x-auto border-t border-outline/20 animate-fade-in">
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline/20">
                          <span className="text-secondary-fixed-dim">{log.traceHeader.title}</span>
                          <span
                            className={
                              log.traceHeader.statusType === 'success'
                                ? 'text-status-success'
                                : 'text-status-medium'
                            }
                          >
                            {log.traceHeader.status}
                          </span>
                        </div>
                        <pre className="text-[12px] leading-relaxed text-secondary-fixed-dim font-label-code-sm">
                          {log.traceLines.join('\n')}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
