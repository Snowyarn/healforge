import React, { useCallback, useEffect, useState } from 'react';
import type { ScreenId, SecurityReport } from '../types';
import { endpoints } from '../services/api';
import type { AuditEventDto, ReportDto } from '../services/api';

interface ReportsAuditScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

const AUDIT_CATEGORIES = ['All', 'Auth', 'Profile', 'Security', 'API', 'Billing', 'Team', 'Privacy'];

/** Reports (generated from persisted records) + server-side audit trail. */
export const ReportsAuditScreen: React.FC<ReportsAuditScreenProps> = ({
  onNavigate: _onNavigate,
  onTriggerToast,
}) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'audit'>('reports');
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventDto[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    endpoints
      .reports()
      .then(({ reports: rows }) =>
        setReports(
          rows.map((r: ReportDto) => ({
            id: r.id,
            title: r.title,
            type: r.type as SecurityReport['type'],
            generatedAt: r.generatedAt,
            project: r.project ?? 'Workspace',
            author: r.author,
            summary: r.summary,
            findingsCount: r.findingsCount,
            criticalCount: r.criticalCount,
            format: r.format,
            checksThatRan: r.checksThatRan,
          })),
        ),
      )
      .catch(() => undefined);
  }, []);

  const loadAuditEvents = useCallback(() => {
    endpoints
      .auditEvents(selectedCategory === 'All' ? undefined : selectedCategory, auditSearch || undefined)
      .then(({ events }) => setAuditEvents(events))
      .catch(() => undefined);
  }, [selectedCategory, auditSearch]);

  useEffect(() => {
    loadAuditEvents();
  }, [loadAuditEvents]);

  const handleDownloadReport = async (report: SecurityReport) => {
    try {
      const resp = await fetch(endpoints.reportDownloadUrl(report.id), { credentials: 'include' });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HealForge-Report-${report.id}.${report.format.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
      onTriggerToast({
        type: 'success',
        title: 'Report Downloaded',
        message: `${report.format} report generated from persisted records — it lists exactly which checks ran.`,
      });
    } catch {
      onTriggerToast({ type: 'warning', title: 'Download Failed', message: 'Could not download the report.' });
    }
  };

  const handleGenerateReport = async (format: 'PDF' | 'Markdown' | 'JSON') => {
    setGenerating(true);
    try {
      await endpoints.createReport({ type: 'vulnerability-summary', format });
      const { reports: rows } = await endpoints.reports();
      setReports(
        rows.map((r: ReportDto) => ({
          id: r.id,
          title: r.title,
          type: r.type as SecurityReport['type'],
          generatedAt: r.generatedAt,
          project: r.project ?? 'Workspace',
          author: r.author,
          summary: r.summary,
          findingsCount: r.findingsCount,
          criticalCount: r.criticalCount,
          format: r.format,
          checksThatRan: r.checksThatRan,
        })),
      );
      onTriggerToast({
        type: 'success',
        title: 'Report Generated',
        message: `A new ${format} report was generated from your persisted findings.`,
      });
    } catch {
      onTriggerToast({ type: 'warning', title: 'Generation Failed', message: 'Could not generate the report.' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Reports & Audit
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Compliance reports generated from persisted records, plus the full server-side audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGenerateReport('PDF')}
            disabled={generating}
            className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            <span>{generating ? 'Generating…' : 'Generate PDF Report'}</span>
          </button>
          <button
            onClick={() => handleGenerateReport('JSON')}
            disabled={generating}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">data_object</span>
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        {(['reports', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-primary text-on-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
            }`}
          >
            {tab === 'reports' ? `Executive Reports (${reports.length})` : `Audit Trail (${auditEvents.length})`}
          </button>
        ))}
      </div>

      {/* Reports tab */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 && (
            <div className="bg-surface-card border border-dashed border-border-subtle rounded-2xl p-14 text-center">
              <span className="material-symbols-outlined text-4xl text-text-muted">description</span>
              <p className="text-body-md text-text-primary font-medium mt-4">No reports yet</p>
              <p className="text-body-sm text-text-muted mt-1">
                Generate a report from your persisted findings — every report records which checks ran.
              </p>
            </div>
          )}
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold font-headline-sm text-text-primary truncate">
                      {report.title}
                    </h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-text-secondary uppercase">
                      {report.format}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 font-mono">
                    {report.id} • {report.generatedAt} • by {report.author} • project {report.project}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-status-critical bg-status-critical/10 px-2 py-1 rounded">
                    {report.criticalCount} Critical
                  </span>
                  <span className="text-[11px] font-mono text-text-secondary bg-surface-container px-2 py-1 rounded">
                    {report.findingsCount} findings
                  </span>
                  <button
                    onClick={() => handleDownloadReport(report)}
                    className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Download {report.format}</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{report.summary}</p>
              {report.checksThatRan && report.checksThatRan.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border-subtle/50">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                    Checks that ran:
                  </span>
                  {report.checksThatRan.map((check) => (
                    <span
                      key={check}
                      className="font-mono text-[10px] bg-surface-canvas border border-border-subtle px-1.5 py-0.5 rounded text-text-secondary"
                    >
                      {check}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Audit tab */}
      {activeTab === 'audit' && (
        <div className="bg-surface-card border border-border-subtle rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
                search
              </span>
              <input
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit events..."
                className="w-full bg-surface-container border border-border-subtle rounded-xl pl-10 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {AUDIT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    selectedCategory === cat
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider bg-surface-container/20">
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium">Action & Details</th>
                  <th className="py-3 px-4 font-medium">Actor</th>
                  <th className="py-3 px-4 font-medium">IP Address</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {auditEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 px-4 text-center text-text-muted">
                      No audit events match this filter. Every mutation (scan, review, account change) is
                      recorded here automatically.
                    </td>
                  </tr>
                )}
                {auditEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-text-secondary whitespace-nowrap">
                      {evt.timestampIso ? new Date(evt.timestampIso).toLocaleString() : evt.timestamp}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-text-secondary">
                        {evt.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 max-w-md">
                      <div className="font-semibold text-text-primary">{evt.action}</div>
                      {evt.description && (
                        <div className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{evt.description}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-text-secondary">{evt.actor}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-text-muted">{evt.ip}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                          evt.status === 'Success'
                            ? 'bg-status-success/10 text-status-success'
                            : evt.status === 'Warning'
                              ? 'bg-status-medium/10 text-status-medium'
                              : 'bg-status-critical/10 text-status-critical'
                        }`}
                      >
                        {evt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
