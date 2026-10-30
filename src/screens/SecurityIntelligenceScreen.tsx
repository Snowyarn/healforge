import React, { useEffect, useState } from 'react';
import type { ScreenId } from '../types';
import { endpoints } from '../services/api';
import type { IntelligenceDto } from '../services/api';

interface SecurityIntelligenceScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

/** Security intelligence — all metrics derived from persisted findings. */
export const SecurityIntelligenceScreen: React.FC<SecurityIntelligenceScreenProps> = ({
  onNavigate,
  onTriggerToast,
}) => {
  const [metric, setMetric] = useState<IntelligenceDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    endpoints
      .intelligence()
      .then(setMetric)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleRefresh = () => {
    endpoints
      .intelligence()
      .then((m) => {
        setMetric(m);
        onTriggerToast({
          type: 'info',
          title: 'Intelligence Telemetry Synced',
          message: 'Security intelligence metrics reloaded from persisted findings.',
        });
      })
      .catch(() => undefined);
  };

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Security Intelligence
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            OWASP/CWE distributions and remediation velocity computed from your workspace records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Refresh Telemetry</span>
          </button>
          <button
            onClick={() => onNavigate('reports-audit')}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            <span>Generate Intelligence Report</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface-card border border-border-subtle rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && metric && !metric.hasData && (
        <div className="bg-surface-card border border-dashed border-border-subtle rounded-2xl p-14 text-center">
          <span className="material-symbols-outlined text-4xl text-text-muted">query_stats</span>
          <p className="text-body-md text-text-primary font-medium mt-4">No intelligence data yet</p>
          <p className="text-body-sm text-text-muted mt-1">
            Run a scan to populate OWASP/CWE distributions and remediation metrics.
          </p>
          <button
            onClick={() => onNavigate('security-scans')}
            className="mt-4 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold"
          >
            Go to Security Scans
          </button>
        </div>
      )}

      {!loading && metric && metric.hasData && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Mean Time to Remediate', value: `${metric.mttrHours} h`, hint: 'Finding → approved patch', tone: 'text-text-primary', icon: 'timer' },
              { label: 'Total Remediated', value: metric.totalRemediated, hint: 'Findings resolved by approved patches', tone: 'text-status-success', icon: 'check_circle' },
              { label: 'Avg Verification Time', value: `${metric.averageVerificationTimeSec} s`, hint: 'Static re-analysis runs', tone: 'text-text-primary', icon: 'speed' },
              { label: 'Total Findings', value: metric.totalFindings, hint: 'All findings ever recorded', tone: 'text-text-primary', icon: 'pest_control' },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                    {stat.label}
                  </span>
                  <span className="material-symbols-outlined text-text-muted text-[18px]">{stat.icon}</span>
                </div>
                <div className={`text-2xl font-bold font-headline-sm mt-2 ${stat.tone}`}>{stat.value}</div>
                <div className="text-[10px] text-text-muted mt-1">{stat.hint}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OWASP distribution */}
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div>
                  <h3 className="text-sm font-bold font-headline-sm text-text-primary uppercase tracking-wider font-label-ui">
                    OWASP Top 10 Distribution
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">Open findings classified by OWASP category.</p>
                </div>
                <span className="text-[10px] font-mono text-text-muted bg-surface-container px-2 py-0.5 rounded">
                  {metric.owaspCategories.length} Categories
                </span>
              </div>
              <div className="space-y-3.5">
                {metric.owaspCategories.map((cat, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-text-primary">{cat.name}</span>
                      <span className="font-mono text-text-secondary">
                        {cat.count} findings ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${cat.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CWE distribution */}
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div>
                  <h3 className="text-sm font-bold font-headline-sm text-text-primary uppercase tracking-wider font-label-ui">
                    Common Weakness Enumeration (CWE) Analysis
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">Finding density by standardized CWE taxonomy.</p>
                </div>
              </div>
              <div className="space-y-3">
                {metric.cweDistribution.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface-container/30 border border-border-subtle flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono text-xs font-semibold text-primary">{item.cwe}</span>
                      <p className="text-[11px] text-text-secondary mt-0.5">{item.title}</p>
                    </div>
                    <span className="font-mono text-xs text-text-primary bg-surface-card border border-border-subtle px-2 py-0.5 rounded">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Severity breakdown */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold font-headline-sm text-text-primary uppercase tracking-wider font-label-ui mb-4">
              Severity Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metric.severityBreakdown.map((s) => (
                <div
                  key={s.severity}
                  className={`rounded-xl p-4 border ${
                    s.severity === 'Critical'
                      ? 'bg-status-critical/5 border-status-critical/30'
                      : s.severity === 'High'
                        ? 'bg-status-high/5 border-status-high/30'
                        : s.severity === 'Medium'
                          ? 'bg-status-medium/5 border-status-medium/30'
                          : 'bg-status-low/5 border-status-low/30'
                  }`}
                >
                  <div className="text-2xl font-bold font-headline-sm text-text-primary">{s.count}</div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mt-1">{s.severity}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Methodology disclaimer */}
          <div className="bg-surface-canvas border border-border-subtle rounded-2xl p-5">
            <p className="text-[11px] text-text-muted leading-relaxed">
              Methodology: distributions aggregate all recorded findings in this workspace. MTTR is measured from
              finding creation to patch approval. CVSS values are static estimates (labelled as such on every
              finding) — they are not externally scored. Model-generated analysis, where present, is context only
              and never counted as verification evidence.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
