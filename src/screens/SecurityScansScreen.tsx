import React, { useState } from 'react';
import type { ScreenId, SecurityScanRecord } from '../types';
import { mockProjects, mockSecurityScans } from '../services/mockData';
import { workbenchService } from '../services/workbenchService';

interface SecurityScansScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const SecurityScansScreen: React.FC<SecurityScansScreenProps> = ({
  onNavigate,
  onTriggerToast,
}) => {
  const [scans, setScans] = useState<SecurityScanRecord[]>(mockSecurityScans);
  const [selectedProject, setSelectedProject] = useState(mockProjects[0].name);
  const [selectedScanType, setSelectedScanType] = useState<SecurityScanRecord['scanType']>('AST Static Analysis (SAST)');
  const [enableTaintFlow, setEnableTaintFlow] = useState(true);
  const [enableSecretDetection, setEnableSecretDetection] = useState(true);
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [scanStage, setScanStage] = useState<'idle' | 'parsing' | 'taint' | 'enriching' | 'complete'>('idle');
  const [activeScanRecord, setActiveScanRecord] = useState<SecurityScanRecord | null>(null);

  const scanTypeOptions: { id: SecurityScanRecord['scanType']; label: string; desc: string; icon: string }[] = [
    {
      id: 'AST Static Analysis (SAST)',
      label: 'AST Static Analysis (SAST)',
      desc: 'Interprocedural static taint analysis across functions and call graphs to isolate exploitable sinks.',
      icon: 'radar',
    },
    {
      id: 'Dependency Vulnerability (SBOM)',
      label: 'Dependency Vulnerability (SBOM)',
      desc: 'Deep inspection of package manifests against OSV, GitHub Advisory, and CVE vulnerability databases.',
      icon: 'hub',
    },
    {
      id: 'Secret & Token Detection',
      label: 'Secret & Token Detection',
      desc: 'High-entropy pattern matching for exposed private keys, OAuth credentials, and cloud tokens.',
      icon: 'key',
    },
    {
      id: 'gVisor Container Config Audit',
      label: 'gVisor Container Config Audit',
      desc: 'Audits container specifications, capabilities, seccomp filters, and non-root user enforcement.',
      icon: 'shield',
    },
  ];

  const handleStartScan = async () => {
    setIsRunningScan(true);
    setScanStage('parsing');

    const result = await workbenchService.triggerSecurityScan(selectedProject, selectedScanType);
    setActiveScanRecord(result.data);
    setScans([result.data, ...scans]);

    onTriggerToast({
      type: 'info',
      title: 'Scan Initialized',
      message: `Triggered ${selectedScanType} for ${selectedProject}.`,
    });

    // Simulate animated scanning stages
    setTimeout(() => {
      setScanStage('taint');
    }, 1200);

    setTimeout(() => {
      setScanStage('enriching');
    }, 2400);

    setTimeout(() => {
      setScanStage('complete');
      setIsRunningScan(false);

      // Update scan record to completed with 1 Critical finding
      const finishedScan: SecurityScanRecord = {
        ...result.data,
        status: 'Completed',
        duration: '4.2s',
        findingsCount: 2,
        criticalCount: 1,
        highCount: 1,
        logs: [
          ...result.data.logs,
          '[TAINT] Trace completed. Identified 1 critical sink in api/handlers/docker.go:142.',
          '[CVE] Matched CWE-288 (Authentication Bypass).',
          '[PATCH] Autonomous AST patch candidate generated and staged.',
          '[COMPLETE] Security scan completed successfully in 4.2s.',
        ],
      };

      setActiveScanRecord(finishedScan);
      setScans((prev) => [finishedScan, ...prev.slice(1)]);

      onTriggerToast({
        type: 'success',
        title: 'Scan Completed',
        message: 'Analysis finished: 1 Critical, 1 High finding detected. Staged for patch synthesis.',
      });
    }, 3800);
  };

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-label-ui text-text-muted mb-1">
            <span className="material-symbols-outlined text-[16px] text-primary">radar</span>
            <span>AI Security Agent</span>
            <span>/</span>
            <span className="font-semibold text-text-primary">Security Scans</span>
          </div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Security Scans & Taint Analysis Engine
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure AST parsers, schedule dependency analysis, and inspect continuous execution runs.
          </p>
        </div>

        <button
          onClick={() => onNavigate('scan-history')}
          className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span>View Scan History</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Scan Configuration Workflow (7 cols) */}
        <div className="lg:col-span-7 bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-5">
          <div className="pb-3 border-b border-border-subtle">
            <h2 className="text-sm font-bold font-headline-sm text-text-primary uppercase tracking-wider font-label-ui">
              Configure New Security Scan
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Select the target repository and customize the automated static analysis depth.
            </p>
          </div>

          <div className="space-y-4">
            {/* Step 1: Project Selection */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Target Monitored Repository
              </label>
              <select
                disabled={isRunningScan}
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
              >
                {mockProjects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.runtime}) • {p.primaryBranch}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Scan Engine Selection */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Select Scan Engine Type
              </label>
              <div className="space-y-2.5">
                {scanTypeOptions.map((opt) => {
                  const isSelected = selectedScanType === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => !isRunningScan && setSelectedScanType(opt.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border-subtle hover:bg-surface-container/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`material-symbols-outlined text-[22px] mt-0.5 ${
                            isSelected ? 'text-primary' : 'text-text-muted'
                          }`}
                        >
                          {opt.icon}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-text-primary">{opt.label}</div>
                          <div className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                            {opt.desc}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Advanced Options */}
            <div className="p-4 rounded-xl bg-surface-container/30 border border-border-subtle space-y-3">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                Analysis Options
              </span>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={enableTaintFlow}
                  onChange={(e) => setEnableTaintFlow(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Interprocedural AST Taint Flow Tracking (Traces source parameters to vulnerable sinks)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={enableSecretDetection}
                  onChange={(e) => setEnableSecretDetection(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Correlate CVE Findings with Exploitability & Reachability Intelligence</span>
              </label>
            </div>

            {/* Step 4: Trigger CTA */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-text-muted">
                Engine: HealForge AST v2.4 (darwin-arm64)
              </span>
              <button
                onClick={handleStartScan}
                disabled={isRunningScan}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${isRunningScan ? 'animate-spin' : ''}`}>
                  {isRunningScan ? 'refresh' : 'play_arrow'}
                </span>
                <span>{isRunningScan ? 'Running AST Analysis...' : 'Trigger Autonomous Scan'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Scan Progress & Terminal Output (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface-dark border border-outline/20 rounded-2xl p-6 shadow-sm text-surface-bright space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed text-[20px]">
                  terminal
                </span>
                <h3 className="font-headline-sm text-sm font-bold text-surface-bright">
                  Analysis Pipeline Execution
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  isRunningScan
                    ? 'bg-status-warning/20 text-status-warning animate-pulse'
                    : scanStage === 'complete'
                    ? 'bg-status-success/20 text-status-success'
                    : 'bg-white/10 text-secondary-fixed-dim'
                }`}
              >
                {isRunningScan ? 'SCANNING' : scanStage === 'complete' ? 'COMPLETED' : 'IDLE'}
              </span>
            </div>

            {/* Visual Scan Stages Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-secondary-fixed-dim">
                <span>AST Parser</span>
                <span>Taint Traversal</span>
                <span>CVE Matching</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-primary-fixed transition-all duration-500 rounded-full"
                  style={{
                    width:
                      scanStage === 'parsing'
                        ? '33%'
                        : scanStage === 'taint'
                        ? '66%'
                        : scanStage === 'enriching'
                        ? '90%'
                        : scanStage === 'complete'
                        ? '100%'
                        : '0%',
                  }}
                />
              </div>
            </div>

            {/* Terminal Live Output */}
            <div className="bg-[#0b1411] border border-outline/20 rounded-xl p-3.5 font-mono text-xs text-primary-fixed min-h-[220px] max-h-[300px] overflow-y-auto space-y-1">
              {activeScanRecord ? (
                activeScanRecord.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={
                      log.includes('[ALERT]') || log.includes('SINK HIT')
                        ? 'text-status-critical font-bold'
                        : log.includes('[PASS]') || log.includes('[COMPLETE]')
                        ? 'text-status-success'
                        : 'text-secondary-fixed-dim'
                    }
                  >
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-secondary-fixed-dim/60 italic py-12 text-center">
                  Select a repository and click &quot;Trigger Autonomous Scan&quot; to begin AST taint flow analysis.
                </div>
              )}
            </div>

            {/* Results Action Footer */}
            {scanStage === 'complete' && activeScanRecord && (
              <div className="pt-3 border-t border-outline/20 flex items-center justify-between animate-fade-in">
                <div className="text-xs text-secondary-fixed-dim">
                  <span className="text-status-critical font-bold">{activeScanRecord.criticalCount} Critical</span> found
                </div>
                <button
                  onClick={() => onNavigate('vulnerabilities')}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-semibold text-xs flex items-center gap-1 hover:bg-primary-container transition-all"
                >
                  <span>Inspect Findings</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
