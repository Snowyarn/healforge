import React, { useState } from 'react';
import type { ScreenId, Vulnerability, RepositoryHealth } from '../types';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { ReachabilityBadge } from '../components/common/ReachabilityBadge';
import { AutofixBadge } from '../components/common/AutofixBadge';

interface DashboardScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onSelectVulnerability: (vulnId: string) => void;
  onSelectRepository: (repoName: string) => void;
  vulnerabilities: Vulnerability[];
  repositories: RepositoryHealth[];
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigate,
  onSelectVulnerability,
  onSelectRepository,
  vulnerabilities,
  repositories,
}) => {
  const [showAllFindings, setShowAllFindings] = useState(false);

  const displayedVulnerabilities = showAllFindings
    ? vulnerabilities
    : vulnerabilities.slice(0, 4);

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header Banner & Demo Label */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-primary">
              Autonomous Remediation Workbench • Active Workspace
            </span>
          </div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Security Operations Dashboard
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Continuous AST taint tracking, autonomous pull request synthesis, and ephemeral sandbox verification.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onNavigate('security-scans')}
            className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">radar</span>
            <span>Start Scan</span>
          </button>
          <button
            onClick={() => onNavigate('bug-report')}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">bug_report</span>
            <span>Report Bug</span>
          </button>
          <button
            onClick={() => onNavigate('code-explorer')}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">terminal</span>
            <span>Code Explorer</span>
          </button>
        </div>
      </div>

      {/* Overview Cards (7 metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Repos */}
        <div
          onClick={() => onNavigate('repositories')}
          className="bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle hover:border-primary/40 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary font-label-ui uppercase tracking-wider font-semibold">
              Repositories
            </span>
            <span className="material-symbols-outlined text-primary text-[18px]">source</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-headline-sm text-text-primary">4</span>
            <span className="text-[10px] text-text-muted block mt-0.5">Monitored</span>
          </div>
        </div>

        {/* Recent Scans */}
        <div
          onClick={() => onNavigate('scan-history')}
          className="bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle hover:border-primary/40 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary font-label-ui uppercase tracking-wider font-semibold">
              Recent Scans
            </span>
            <span className="material-symbols-outlined text-[#0284c7] text-[18px]">history</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-headline-sm text-text-primary">5</span>
            <span className="text-[10px] text-text-muted block mt-0.5">Last 24h</span>
          </div>
        </div>

        {/* Open Vulns */}
        <div
          onClick={() => onNavigate('vulnerabilities')}
          className="bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle hover:border-primary/40 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary font-label-ui uppercase tracking-wider font-semibold">
              Open Vulns
            </span>
            <span className="material-symbols-outlined text-status-warning text-[18px]">pest_control</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-headline-sm text-text-primary">6</span>
            <span className="text-[10px] text-text-muted block mt-0.5">Identified</span>
          </div>
        </div>

        {/* Critical & High */}
        <div
          onClick={() => onNavigate('vulnerabilities')}
          className="bg-surface-card p-4 rounded-xl shadow-sm border border-status-critical/30 hover:border-status-critical cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-status-critical font-label-ui uppercase tracking-wider font-semibold">
              Critical / High
            </span>
            <span className="material-symbols-outlined text-status-critical text-[18px]">warning</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-headline-sm text-status-critical">02</span>
              <span className="text-xs text-text-secondary font-mono">/ 03</span>
            </div>
            <span className="text-[10px] text-status-critical font-semibold block mt-0.5">Triage Needed</span>
          </div>
        </div>

        {/* Pending Patch Approvals */}
        <div
          onClick={() => onNavigate('patch-review')}
          className="bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle hover:border-primary/40 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary font-label-ui uppercase tracking-wider font-semibold">
              Patch Reviews
            </span>
            <span className="material-symbols-outlined text-primary text-[18px]">code</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-headline-sm text-text-primary">1</span>
            <span className="text-[10px] text-primary font-semibold block mt-0.5">AST Ready</span>
          </div>
        </div>

        {/* Verified Fixes */}
        <div
          onClick={() => onNavigate('verified-fixes')}
          className="bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle hover:border-primary/40 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary font-label-ui uppercase tracking-wider font-semibold">
              Verified Fixes
            </span>
            <span className="material-symbols-outlined text-status-success text-[18px]">check_circle</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-headline-sm text-status-success">3</span>
            <span className="text-[10px] text-text-muted block mt-0.5">Neutralized</span>
          </div>
        </div>

        {/* Failed Verifications */}
        <div
          onClick={() => onNavigate('verification')}
          className="bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle hover:border-primary/40 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary font-label-ui uppercase tracking-wider font-semibold">
              Regressions
            </span>
            <span className="material-symbols-outlined text-status-success text-[18px]">verified_user</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-headline-sm text-status-success">0</span>
            <span className="text-[10px] text-status-success font-semibold block mt-0.5">100% Pass</span>
          </div>
        </div>
      </div>

      {/* Repositories Overview Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold font-headline-sm text-text-primary uppercase tracking-wider font-label-ui">
            Monitored Repositories & Services
          </h2>
          <button
            onClick={() => onNavigate('repositories')}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Manage All Projects</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {repositories.map((repo) => (
            <div
              key={repo.name}
              className="bg-surface-card p-5 rounded-2xl shadow-sm border border-border-subtle flex flex-col justify-between hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">{repo.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-body-lg text-text-primary font-semibold">
                        {repo.name}
                      </h3>
                      <span className="text-[11px] font-label-code-sm text-text-muted">
                        {repo.runtime}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      repo.status === 'optimal'
                        ? 'bg-status-success/10 text-status-success'
                        : 'bg-status-critical/10 text-status-critical'
                    }`}
                  >
                    Score: {repo.securityScore}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-3 leading-relaxed">
                  {repo.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border-subtle/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-status-critical">{repo.criticalCount} Critical</span>
                  <span className="text-status-high">{repo.highCount} High</span>
                </div>
                <button
                  onClick={() => {
                    onSelectRepository(repo.name);
                    onNavigate('vulnerabilities');
                  }}
                  className="text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <span>Findings</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Critical Findings Table Section */}
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold font-headline-sm text-text-primary">
              Active Vulnerability Backlog
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Live static taint analysis sink detections awaiting remediation approval.
            </p>
          </div>
          <button
            onClick={() => setShowAllFindings(!showAllFindings)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>{showAllFindings ? 'Show Top 4' : `View All (${vulnerabilities.length})`}</span>
            <span className="material-symbols-outlined text-[16px]">
              {showAllFindings ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider bg-surface-container/20">
                <th className="py-3 px-5 font-medium">Identifier</th>
                <th className="py-3 px-5 font-medium">Severity</th>
                <th className="py-3 px-5 font-medium">Vulnerability & Context</th>
                <th className="py-3 px-5 font-medium">Service</th>
                <th className="py-3 px-5 font-medium">Reachability</th>
                <th className="py-3 px-5 font-medium">Autofix</th>
                <th className="py-3 px-5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {displayedVulnerabilities.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => {
                    onSelectVulnerability(v.id);
                    onNavigate('vulnerabilities');
                  }}
                  className="hover:bg-surface-container/30 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-5 font-mono text-[11px] font-semibold text-text-primary">
                    {v.id}
                  </td>
                  <td className="py-3 px-5">
                    <SeverityBadge severity={v.severity} />
                  </td>
                  <td className="py-3 px-5 max-w-md">
                    <div className="font-semibold text-text-primary text-xs">{v.title}</div>
                    <div className="text-[11px] text-text-muted mt-0.5 truncate">{v.cwe}</div>
                  </td>
                  <td className="py-3 px-5 font-mono text-[11px] text-text-secondary">
                    {v.service}
                  </td>
                  <td className="py-3 px-5">
                    <ReachabilityBadge status={v.reachability} />
                  </td>
                  <td className="py-3 px-5">
                    <AutofixBadge status={v.autofixStatus} />
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVulnerability(v.id);
                        onNavigate('vulnerabilities');
                      }}
                      className="px-2.5 py-1 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-xs font-semibold text-text-primary transition-all"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Section: Live Agent Activity + Sandbox Verification Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Activity Summary (2 cols) */}
        <div className="lg:col-span-2 bg-surface-card rounded-2xl shadow-sm border border-border-subtle p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">neurology</span>
                <h2 className="font-bold font-headline-sm text-text-primary text-base">
                  Autonomous Remediation Pipeline
                </h2>
              </div>
              <button
                onClick={() => onNavigate('agent-activity')}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <span>Full Activity Log</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container/30 border border-border-subtle">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <span className="material-symbols-outlined text-[18px]">code</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-text-primary">Generated fix for CVE-2024-2149 in payments-api</span>
                    <span className="text-[11px] text-text-muted font-mono">2m ago</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    AST analysis verified parameter sanitization pattern in <code className="bg-surface-container px-1 rounded font-mono text-[10px]">db/queries.py:142</code>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container/30 border border-border-subtle">
                <div className="w-8 h-8 rounded-lg bg-status-success/10 flex items-center justify-center shrink-0 text-status-success">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-text-primary">Sandbox test suite completed successfully</span>
                    <span className="text-[11px] text-text-muted font-mono">14m ago</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    Ran 412 unit tests and 54 integration tests against PR #104. Zero regressions found.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container/30 border border-border-subtle">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-text-secondary">
                  <span className="material-symbols-outlined text-[18px]">policy</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-text-primary">Policy governance check passed</span>
                    <span className="text-[11px] text-text-muted font-mono">45m ago</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    Verified compliance with OWASP Top 10 and internal ISO-27001 coding guidelines.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border-subtle/50 flex items-center justify-between text-xs text-text-muted">
            <span>Remediation Velocity: 14.2 min average MTTR</span>
            <span className="font-mono text-primary font-semibold">48 fixes applied this month</span>
          </div>
        </div>

        {/* Live Sandbox Verification Status (1 col, Dark Panel) */}
        <div className="bg-surface-dark rounded-2xl shadow-sm p-6 text-surface-bright flex flex-col justify-between border border-outline/20">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed text-[20px]">terminal</span>
                <h2 className="font-headline-sm text-sm font-bold text-surface-bright">
                  gVisor MicroVM Sandbox
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold bg-primary/20 text-primary-fixed px-2 py-0.5 rounded">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-secondary-fixed-dim mb-4 leading-relaxed">
              Isolated microVM executing continuous fuzzing and regression verification.
            </p>

            {/* Terminal Output Box */}
            <div className="bg-[#0b1411] text-surface-bright font-mono p-3 rounded-xl text-[11px] space-y-1 mb-4 overflow-x-auto border border-outline/20">
              <div className="text-status-success">[INFO] Initializing sandbox container...</div>
              <div className="text-secondary-fixed-dim">[BUILD] Target: payments-api:v2.4</div>
              <div className="text-secondary-fixed-dim">[TEST] Executing vulnerability payload tests...</div>
              <div className="text-status-success">[PASS] CVE-2024-2149 patch neutralized exploit vector.</div>
              <div className="text-status-success">[PASS] All integration suites green. Ready for merge.</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-outline/20">
            <span className="text-xs text-secondary-fixed-dim font-mono">
              ID: <code className="text-primary-fixed">sb-88f2a1</code>
            </span>
            <button
              onClick={() => onNavigate('verification')}
              className="bg-primary hover:bg-primary-container text-on-primary px-3.5 py-1.5 rounded-xl font-label-ui text-xs font-semibold transition-all shadow-sm"
            >
              Live Verification Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
