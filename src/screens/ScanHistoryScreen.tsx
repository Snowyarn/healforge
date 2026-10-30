import React, { useCallback, useEffect, useState } from 'react';
import { endpoints } from '../services/api';
import type { ScanDto } from '../services/api';
import type { ScreenId, SecurityScanRecord } from '../types';

interface ScanHistoryScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
  currentProjectId: string | null;
}

export const ScanHistoryScreen: React.FC<ScanHistoryScreenProps> = ({
  onNavigate,
  onTriggerToast,
  currentProjectId,
}) => {
  const [scans, setScans] = useState<SecurityScanRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScan, setSelectedScan] = useState<SecurityScanRecord | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [scanAId, setScanAId] = useState<string>('');
  const [scanBId, setScanBId] = useState<string>('');
  const [diff, setDiff] = useState<{ resolved: number; new: number; persistent: number } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const loadScans = useCallback(async () => {
    const { scans: rows } = await endpoints.scans(currentProjectId ?? undefined);
    const mapped: SecurityScanRecord[] = rows.map((s: ScanDto) => ({
      id: s.id,
      project: s.project,
      scanType: s.scanType as SecurityScanRecord['scanType'],
      startTime: s.startTime,
      duration: s.duration,
      status: s.status,
      findingsCount: s.findingsCount,
      criticalCount: s.criticalCount,
      highCount: s.highCount,
      trigger: s.trigger as SecurityScanRecord['trigger'],
      commitHash: s.commitHash,
      logs: s.logs,
    }));
    setScans(mapped);
    if (!scanAId) setScanAId(mapped[mapped.length - 1]?.id ?? '');
    if (!scanBId) setScanBId(mapped[0]?.id ?? '');
  }, [currentProjectId]);

  useEffect(() => {
    loadScans().catch(() => undefined);
  }, [loadScans]);

  const runDiff = async () => {
    if (!scanAId || !scanBId) return;
    setDiffLoading(true);
    try {
      const res = await endpoints.scanDiff(scanAId, scanBId);
      setDiff({ resolved: res.resolved, new: res.new, persistent: res.persistent });
    } catch {
      setDiff(null);
    } finally {
      setDiffLoading(false);
    }
  };

  const filteredScans = scans.filter(
    (s) =>
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.scanType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scanA = scans.find((s) => s.id === scanAId) || scans[0];
  const scanB = scans.find((s) => s.id === scanBId) || scans[1];

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-label-ui text-text-muted mb-1">
            <span className="material-symbols-outlined text-[16px] text-primary">history</span>
            <span>Validation & Results</span>
            <span>/</span>
            <span className="font-semibold text-text-primary">Scan History</span>
          </div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Security Scan History & Differential Audits
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Search historical AST and dependency analysis executions. Compare delta findings across build commits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const resp = await fetch(endpoints.scansExportUrl(), { credentials: 'include' });
                if (!resp.ok) throw new Error();
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'healforge-scan-manifest.json';
                a.click();
                URL.revokeObjectURL(url);
                onTriggerToast({
                  type: 'success',
                  title: 'Scan Manifest Downloaded',
                  message: 'Historical scan audit records exported as a JSON manifest from the server.',
                });
              } catch {
                onTriggerToast({
                  type: 'warning',
                  title: 'Export Failed',
                  message: 'Could not download the scan manifest.',
                });
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export</span>
          </button>
          <button
            onClick={() => setCompareModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
            <span>Compare Scans</span>
          </button>
          <button
            onClick={() => onNavigate('security-scans')}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">radar</span>
            <span>New Scan</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
          <h2 className="text-sm font-bold font-headline-sm text-text-primary uppercase tracking-wider font-label-ui">
            Historical Scan Runs ({filteredScans.length})
          </h2>

          <div className="relative min-w-[220px]">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-text-muted text-[14px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search scan ID, repo, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <th className="pb-2 font-medium">Scan ID</th>
                <th className="pb-2 font-medium">Project</th>
                <th className="pb-2 font-medium">Scan Engine</th>
                <th className="pb-2 font-medium">Timestamp</th>
                <th className="pb-2 font-medium">Duration</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Findings</th>
                <th className="pb-2 font-medium">Trigger</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {filteredScans.map((scan) => (
                <tr key={scan.id} className="hover:bg-surface-container/30 transition-colors">
                  <td className="py-3 font-mono font-bold text-text-primary text-[11px]">
                    {scan.id}
                  </td>
                  <td className="py-3 font-mono text-text-secondary">{scan.project}</td>
                  <td className="py-3 font-semibold text-text-primary">{scan.scanType}</td>
                  <td className="py-3 text-text-muted text-[11px]">{scan.startTime}</td>
                  <td className="py-3 font-mono text-[11px] text-text-muted">{scan.duration}</td>
                  <td className="py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-status-success/10 text-status-success">
                      {scan.status}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-[11px]">
                    {scan.criticalCount > 0 ? (
                      <span className="text-status-critical font-bold">{scan.criticalCount} Critical</span>
                    ) : (
                      <span className="text-text-muted">0 Critical</span>
                    )}
                    <span className="text-text-muted"> ({scan.findingsCount} total)</span>
                  </td>
                  <td className="py-3 text-[11px] text-text-muted">{scan.trigger}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedScan(scan)}
                        className="text-xs text-primary hover:underline font-semibold"
                      >
                        Logs
                      </button>
                      <button
                        onClick={() => onNavigate('vulnerabilities')}
                        className="text-xs text-text-secondary hover:text-text-primary hover:underline"
                      >
                        Findings
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Scan Logs Modal */}
      {selectedScan && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedScan(null)}
        >
          <div
            className="w-full max-w-2xl bg-surface-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-container/30">
              <div>
                <h3 className="text-body-lg font-headline-sm font-semibold text-text-primary">
                  Scan Execution Log — {selectedScan.id}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {selectedScan.project} • {selectedScan.scanType}
                </p>
              </div>
              <button
                onClick={() => setSelectedScan(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-[#0a1411] border border-outline/20 rounded-xl font-mono text-xs text-primary-fixed max-h-72 overflow-y-auto space-y-1">
                {selectedScan.logs.map((log, idx) => (
                  <div key={idx} className={log.includes('ALERT') ? 'text-status-critical font-bold' : ''}>
                    {log}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedScan(null)}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-text-primary text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare Scans Modal */}
      {compareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setCompareModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl bg-surface-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-container/30">
              <div>
                <h3 className="text-body-lg font-headline-sm font-semibold text-text-primary">
                  Differential Scan Comparison
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Compare findings between two scan runs to verify resolved or introduced vulnerabilities.
                </p>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Baseline Scan A (Earlier)
                  </label>
                  <select
                    value={scanAId}
                    onChange={(e) => setScanAId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container border border-border-subtle text-xs font-mono text-text-primary outline-none"
                  >
                    {scans.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} ({s.project} - {s.startTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Comparison Scan B (Later)
                  </label>
                  <select
                    value={scanBId}
                    onChange={(e) => setScanBId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container border border-border-subtle text-xs font-mono text-text-primary outline-none"
                  >
                    {scans.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} ({s.project} - {s.startTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comparison Matrix Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-status-success/10 border border-status-success/20 text-center">
                  <span className="text-[10px] uppercase font-bold text-status-success block">
                    Resolved Findings
                  </span>
                  <span className="text-2xl font-bold font-headline-sm text-status-success mt-1 block">
                    -{diff ? diff.resolved : '—'}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5 block">Present in A, absent in B</span>
                </div>

                <div className="p-3.5 rounded-xl bg-status-critical/10 border border-status-critical/20 text-center">
                  <span className="text-[10px] uppercase font-bold text-status-critical block">
                    New Findings Introduced
                  </span>
                  <span className="text-2xl font-bold font-headline-sm text-status-critical mt-1 block">
                    +{diff ? diff.new : '—'}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5 block">Present in B, absent in A</span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container/40 border border-border-subtle text-center">
                  <span className="text-[10px] uppercase font-bold text-text-secondary block">
                    Persistent Vulnerabilities
                  </span>
                  <span className="text-2xl font-bold font-headline-sm text-text-primary mt-1 block">
                    {diff ? diff.persistent : '—'}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5 block">Unchanged across runs</span>
                </div>
              </div>

              {!diff && (
                <button
                  onClick={runDiff}
                  disabled={diffLoading || !scanAId || !scanBId}
                  className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold disabled:opacity-40"
                >
                  {diffLoading ? 'Computing differential…' : 'Compute Differential (server-side)'}
                </button>
              )}

              <div className="p-3 rounded-xl bg-surface-container/30 border border-border-subtle text-xs text-text-secondary flex justify-between">
                <span>Baseline: <strong>{scanA.project}</strong> ({scanA.id})</span>
                <span>Compared: <strong>{scanB.project}</strong> ({scanB.id})</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setCompareModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold"
                >
                  Close Differential View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
