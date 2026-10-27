import React, { useState } from 'react';
import type { VerificationSession } from '../types';

interface VerificationSandboxScreenProps {
  session: VerificationSession;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const VerificationSandboxScreen: React.FC<VerificationSandboxScreenProps> = ({
  session,
  onTriggerToast,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [activeStageIndex, setActiveStageIndex] = useState(3);
  const [showTraceModal, setShowTraceModal] = useState(false);

  const handleRerun = () => {
    setIsRunning(true);
    setActiveStageIndex(0);

    const stepInterval = setInterval(() => {
      setActiveStageIndex((prev) => {
        if (prev >= 3) {
          clearInterval(stepInterval);
          setIsRunning(false);
          onTriggerToast({
            type: 'success',
            title: 'Verification Suite Completed',
            message: 'All 4 sandbox verification stages passed in ephemeral gVisor microVM container. Exit code: 0.',
          });
          return 3;
        }
        return prev + 1;
      });
    }, 900);
  };

  const handleCopyLogs = () => {
    const rawLogs = session.terminalLogs.map((l) => `${l.timestamp} ${l.text}`).join('\n');
    navigator.clipboard?.writeText(rawLogs);
    onTriggerToast({
      type: 'info',
      title: 'Logs Copied to Clipboard',
      message: 'Full execution stream with timestamps copied.',
    });
  };

  const handleExportBundle = () => {
    const evidenceData = {
      bundleVersion: '2.4.0',
      patchId: session.patchId,
      attestation: session.attestation,
      stages: session.stages,
      timestamp: new Date().toISOString(),
      verifiedBy: 'HealForge Secure Enclave gVisor Sandbox v2.9',
      reproducedCve: 'CVE-2024-3819',
      unitTestSummary: {
        total: 1420,
        passed: 1420,
        failed: 0,
        durationSeconds: 6.74,
      },
      auditNotice: 'This document is a simulated cryptographic evidence artifact for frontend demonstration.',
    };

    const blob = new Blob([JSON.stringify(evidenceData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `healforge_evidence_bundle_${session.patchId.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    onTriggerToast({
      type: 'success',
      title: 'Evidence Bundle Exported',
      message: `Downloaded cryptographic evidence manifest for ${session.patchId}.`,
    });
  };

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Banner / Header Context */}
      <div className="px-margin pt-margin pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-surface-container text-text-secondary font-label-code-sm border border-border-subtle">
              {session.patchId}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-status-verified/10 text-status-verified font-label-code-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-status-verified animate-pulse" />
              {isRunning ? 'Running Dynamic Verification...' : session.status}
            </span>
          </div>
          <h1 className="text-headline-lg font-headline-lg text-text-primary tracking-tight">
            gVisor Sandbox Verification Engine
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportBundle}
            className="px-4 py-2 rounded-lg bg-surface-card border border-border-subtle text-text-primary font-label-ui hover:bg-surface-container transition-all flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Evidence Bundle
          </button>
          <button
            onClick={handleRerun}
            disabled={isRunning}
            className="px-4 py-2 rounded-full bg-primary text-on-primary font-label-ui hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[18px] ${isRunning ? 'animate-spin' : ''}`}>
              replay
            </span>
            {isRunning ? 'Re-running Tests...' : 'Re-run Verification'}
          </button>
        </div>
      </div>

      {/* Main Content Layout (Bento / Split Workbench) */}
      <div className="px-margin grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left Column: Lifecycle Stages & Verification Proof (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-gutter">
          {/* Lifecycle Stages Card */}
          <div className="bg-surface-card rounded-xl p-6 shadow-sm border border-border-subtle flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-headline-sm font-headline-sm text-text-primary">Verification Lifecycle</h2>
              <span className="text-text-muted font-label-code-sm">{session.containerRuntime}</span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
              {session.stages.map((stage, idx) => {
                const isPassed = idx <= activeStageIndex;
                const isCurrent = isRunning && idx === activeStageIndex;

                return (
                  <div key={stage.id} className="relative flex items-start gap-3">
                    <span
                      className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrent
                          ? 'bg-primary text-on-primary animate-pulse'
                          : isPassed
                          ? 'bg-status-success text-on-primary'
                          : 'bg-surface-container text-text-muted'
                      }`}
                    >
                      {isCurrent ? '●' : isPassed ? '✓' : idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-label-ui text-text-primary">{stage.title}</span>
                        <span className="text-text-muted font-label-code-sm">{stage.duration}</span>
                      </div>
                      <p className="text-body-sm text-text-secondary mt-0.5">{stage.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Before and After Vulnerability Status */}
          <div className="bg-surface-card rounded-xl p-6 shadow-sm border border-border-subtle flex flex-col gap-4">
            <h2 className="text-headline-sm font-headline-sm text-text-primary">Status Transition</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-status-critical/10 border border-status-critical/20 flex flex-col gap-1">
                <span className="text-text-muted font-label-code-sm uppercase">Before Patch</span>
                <span className="text-headline-sm text-status-critical font-headline-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  {session.statusTransition.before.status}
                </span>
                <span className="text-body-sm text-text-secondary mt-1">
                  {session.statusTransition.before.desc}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-status-verified/10 border border-status-verified/20 flex flex-col gap-1">
                <span className="text-text-muted font-label-code-sm uppercase">After Patch</span>
                <span className="text-headline-sm text-status-verified font-headline-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  {session.statusTransition.after.status}
                </span>
                <span className="text-body-sm text-text-secondary mt-1">
                  {session.statusTransition.after.desc}
                </span>
              </div>
            </div>
          </div>

          {/* Cryptographic Proof-of-Verification Badge */}
          <div className="bg-surface-dark rounded-xl p-6 text-surface-bright flex flex-col gap-3 shadow-md border border-outline/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed text-[20px]">
                  workspace_premium
                </span>
                <span className="font-label-ui text-surface-bright">Cryptographic Attestation</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-primary/30 text-primary-fixed font-label-code-sm">
                {session.attestation.algorithm}
              </span>
            </div>
            <p className="text-body-sm text-secondary-fixed-dim">
              {session.attestation.signedBy}. Immutable proof of sandbox execution and regression stability.
            </p>
            <div className="p-3 rounded bg-black/30 font-label-code-sm text-primary-fixed-dim break-all select-all border border-outline/10">
              {session.attestation.hash}
            </div>
          </div>
        </div>

        {/* Right Column: Live Execution Console Output Logs (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-surface-dark rounded-xl shadow-md overflow-hidden flex flex-col h-full border border-outline/20">
            {/* Terminal Header */}
            <div className="px-4 py-3 bg-surface-dark/90 border-b border-outline/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-status-critical/80" />
                <div className="w-3 h-3 rounded-full bg-status-medium/80" />
                <div className="w-3 h-3 rounded-full bg-status-success/80" />
                <span className="ml-2 font-label-code-sm text-secondary-fixed-dim">
                  gVisor Sandbox Console // Execution Stream [{session.containerId}]
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-status-success font-label-code-sm">
                  <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                  Live Stream Complete
                </span>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-5 font-label-code-md text-secondary-fixed-dim space-y-2 overflow-y-auto flex-1 bg-[#121c19] text-[13px] leading-relaxed selection:bg-primary selection:text-white">
              {session.terminalLogs.map((log, index) => {
                if (log.type === 'critical') {
                  return (
                    <div
                      key={index}
                      className="text-surface-bright bg-status-critical/10 px-2 py-1 rounded border border-status-critical/20"
                    >
                      {log.text}
                    </div>
                  );
                }

                if (log.level === 'COMPLETE') {
                  return (
                    <div
                      key={index}
                      className="text-surface-bright font-bold pt-2 border-t border-outline/20 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-status-verified text-[18px]">
                        check_circle
                      </span>
                      {log.text}
                    </div>
                  );
                }

                const colorClass =
                  log.type === 'success'
                    ? 'text-status-success'
                    : log.type === 'highlight'
                    ? 'text-primary-fixed'
                    : log.type === 'muted'
                    ? 'text-text-muted'
                    : 'text-secondary-fixed-dim';

                return (
                  <div key={index} className={colorClass}>
                    <span className="text-outline mr-2">{log.timestamp}</span>
                    {log.text}
                  </div>
                );
              })}
            </div>

            {/* Terminal Footer Actions */}
            <div className="px-4 py-3 bg-surface-dark border-t border-outline/20 flex items-center justify-between">
              <span className="text-text-muted font-label-code-sm">
                Duration: {session.metrics.duration} | Exit Code: {session.metrics.exitCode}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLogs}
                  className="px-3 py-1.5 rounded bg-surface-container/10 hover:bg-surface-container/20 text-secondary-fixed-dim font-label-code-sm transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  Copy Logs
                </button>
                <button
                  onClick={() => setShowTraceModal(true)}
                  className="px-3 py-1.5 rounded bg-primary text-on-primary font-label-code-sm hover:bg-primary/90 transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  View Full Trace
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Trace Modal */}
      {showTraceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-dark text-surface-bright rounded-xl max-w-3xl w-full p-6 shadow-2xl border border-outline/30 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed text-[20px]">terminal</span>
                <h3 className="font-headline-sm">gVisor Syscall & Execution Trace Trace Dump</h3>
              </div>
              <button
                onClick={() => setShowTraceModal(false)}
                className="text-secondary-fixed-dim hover:text-surface-bright"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-4 bg-[#0e1614] rounded-lg font-label-code-sm text-xs overflow-y-auto space-y-2 flex-1 text-secondary-fixed-dim">
              <div>[TRACE INIT] Attached seccomp-bpf filter: 24 syscalls permitted.</div>
              <div>[SECCOMP TRAP] Blocked: execveat, ptrace, process_vm_writev.</div>
              <div>[NETNS] Sandboxed network interface lo:127.0.0.1, eth0:10.244.0.14/32.</div>
              <div>[MEMORY MAP] Initial RSS: 14.2MB, Peak RSS: 48.6MB.</div>
              {session.terminalLogs.map((l, i) => (
                <div key={i}>
                  {l.timestamp} {l.text}
                </div>
              ))}
              <div className="text-status-success font-bold mt-2">
                [IMMUTABLE PROOF] Digest verified against Secure Enclave public key.
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setShowTraceModal(false)}
                className="px-4 py-2 rounded-full bg-primary text-on-primary font-label-ui text-xs hover:bg-primary/90"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
