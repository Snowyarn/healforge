import React, { useCallback, useEffect, useState } from 'react';
import type { PatchItem } from '../types';
import { ApiError, endpoints } from '../services/api';
import type { VerificationRunDto, VerificationStatusDto } from '../services/api';

interface VerificationSandboxScreenProps {
  verificationStatus: VerificationStatusDto | null;
  patch: PatchItem | null;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
  onRunsChanged: () => void;
}

/**
 * Safe Verification UI.
 *
 * Truthfully shows the isolation boundary: in this deployment NO verified
 * isolated runner exists, so execution-based verification is disabled and
 * honestly returns `verification_unavailable` — there is no host fallback and
 * no arbitrary command field. Static re-analysis is offered as real, limited
 * evidence (the detection rule is re-run against the patched code).
 */
export const VerificationSandboxScreen: React.FC<VerificationSandboxScreenProps> = ({
  verificationStatus,
  patch,
  onTriggerToast,
  onRunsChanged,
}) => {
  const [runs, setRuns] = useState<VerificationRunDto[]>([]);
  const [selectedRun, setSelectedRun] = useState<VerificationRunDto | null>(null);
  const selectedRunId = selectedRun?.id;
  const [running, setRunning] = useState<'execution' | 'static_reanalysis' | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const res = await endpoints.verificationRuns(patch?.id);
      setRuns(res.runs);
      const current = res.runs.find((r) => r.id === selectedRunId) ?? res.runs[0] ?? null;
      setSelectedRun(current);
    } catch {
      setRuns([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch?.id]);

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch?.id]);

  const handleRun = async (mode: 'execution' | 'static_reanalysis') => {
    if (!patch) {
      onTriggerToast({
        type: 'info',
        title: 'No Patch Selected',
        message: 'Approve or review a patch first — verification always binds to an exact patch and revision.',
      });
      return;
    }
    setRunning(mode);
    try {
      const { run } = await endpoints.createVerificationRun(patch.id, mode);
      await loadRuns();
      setSelectedRun(run);
      onRunsChanged();
      if (mode === 'execution') {
        onTriggerToast({
          type: 'warning',
          title: 'Execution Verification Unavailable',
          message: 'No isolated runner is verified in this deployment, so execution was honestly refused.',
        });
      } else if (run.status === 'completed') {
        onTriggerToast({
          type: 'success',
          title: 'Static Re-analysis Passed',
          message: 'The detection rule no longer matches the patched code. See evidence for limitations.',
        });
      } else {
        onTriggerToast({
          type: 'warning',
          title: 'Static Re-analysis Failed',
          message: 'The rule still matches the patched code — the pattern was not removed.',
        });
      }
    } catch (exc) {
      onTriggerToast({
        type: 'warning',
        title: 'Verification Error',
        message: exc instanceof ApiError ? exc.message : 'Backend unreachable.',
      });
    } finally {
      setRunning(null);
    }
  };

  const handleExportEvidence = async () => {
    if (!selectedRun) return;
    try {
      const resp = await fetch(endpoints.verificationEvidenceUrl(selectedRun.id), { credentials: 'include' });
      if (!resp.ok) throw new Error('download failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `healforge-evidence-${selectedRun.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onTriggerToast({
        type: 'success',
        title: 'Evidence Exported',
        message: 'Evidence bundle downloaded — it lists exactly which checks ran and its limitations.',
      });
    } catch {
      onTriggerToast({ type: 'warning', title: 'Export Failed', message: 'Could not download evidence bundle.' });
    }
  };

  const handleCopyLogs = async () => {
    if (!selectedRun) return;
    const lines = [
      `Verification run ${selectedRun.id}`,
      `mode=${selectedRun.mode} status=${selectedRun.status}`,
      selectedRun.reason && `reason: ${selectedRun.reason}`,
      ...selectedRun.checks.map((c) => `[${c.passed ? 'PASS' : 'FAIL'}] ${c.name} — ${c.detail}`),
      selectedRun.disclaimer,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      onTriggerToast({ type: 'info', title: 'Logs Copied', message: 'Verification log copied to clipboard.' });
    } catch {
      onTriggerToast({ type: 'warning', title: 'Copy Failed', message: 'Clipboard unavailable.' });
    }
  };

  const policy = verificationStatus?.policy;
  const executionAvailable = verificationStatus?.execution_available ?? false;

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Verification Sandbox
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Isolation boundary status and verification evidence for reviewed patches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportEvidence}
            disabled={!selectedRun?.evidenceAvailable}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary disabled:opacity-40 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Evidence Bundle</span>
          </button>
          <button
            onClick={handleCopyLogs}
            disabled={!selectedRun}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary disabled:opacity-40 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            <span>Copy Logs</span>
          </button>
        </div>
      </div>

      {/* Isolation boundary — honest state */}
      <div
        className={`rounded-2xl p-5 border ${
          executionAvailable ? 'bg-status-success/5 border-status-success/30' : 'bg-status-high/5 border-status-high/30'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-status-high text-[22px]">gpp_maybe</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold font-headline-sm text-text-primary">
                Execution-based verification is {executionAvailable ? 'available' : 'DISABLED'}
              </h2>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  executionAvailable ? 'bg-status-success/10 text-status-success' : 'bg-status-high/10 text-status-high'
                }`}
              >
                {verificationStatus?.execution_status ?? 'unknown'}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">
              {verificationStatus?.reason ??
                'Loading runner status…'}
            </p>
            <p className="text-[11px] text-text-muted mt-2 font-mono">
              Host code execution: FORBIDDEN — untrusted code is never run on the API/worker host, in any fallback.
            </p>
          </div>
        </div>
      </div>

      {/* Target patch + actions */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm">
        <h2 className="text-label-ui text-text-secondary uppercase tracking-wider mb-3">Verification Target</h2>
        {patch ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-text-primary">
                {patch.title}{' '}
                <span className="font-mono text-[11px] text-text-muted">
                  ({patch.id} • v{patch.version} • {patch.status})
                </span>
              </p>
              <p className="text-[11px] text-text-muted mt-1 font-mono">
                {patch.filePath} {patch.linesRange} • bound to finding {patch.vulnerabilityId} • generator{' '}
                {patch.generator || 'n/a'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRun('execution')}
                disabled={running !== null || !executionAvailable}
                title={
                  executionAvailable
                    ? 'Run in the isolated runner'
                    : 'Disabled: no verified isolated runner in this deployment — there is no host fallback'
                }
                className="px-3.5 py-2 rounded-xl bg-surface-container border border-border-subtle text-xs font-semibold text-text-muted disabled:opacity-40 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">play_disabled</span>
                <span>Run in Isolated Sandbox</span>
              </button>
              <button
                onClick={() => handleRun('static_reanalysis')}
                disabled={running !== null}
                className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold shadow-sm disabled:opacity-40 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">rule</span>
                <span>{running === 'static_reanalysis' ? 'Re-analyzing…' : 'Run Static Re-analysis'}</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-muted">
            No patch in review context. Request a patch from a finding (needs NVIDIA inference configured) or open a
            patch from Patch Review — verification always binds to an exact patch + revision digest.
          </p>
        )}
      </div>

      {/* Policy card */}
      {policy && (
        <div className="bg-surface-dark rounded-2xl border border-outline/20 p-6 text-surface-bright">
          <h2 className="text-sm font-bold font-headline-sm text-surface-bright mb-1">Runner Policy (would-be)</h2>
          <p className="text-[11px] text-secondary-fixed-dim mb-4">
            The policy a verified isolated runner would enforce. Shown for transparency — it is NOT active in this
            deployment.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 text-[11px] font-mono">
            {[
              ['Runtime', policy.would_be_policy.runtime],
              ['Identity', policy.would_be_policy.identity],
              ['Image', policy.would_be_policy.image],
              ['Filesystem', policy.would_be_policy.filesystem],
              ['Network', policy.would_be_policy.network],
              ['Commands', policy.would_be_policy.commands],
              ['Cleanup', policy.would_be_policy.cleanup],
              ['Resource caps', Object.entries(policy.would_be_policy.resource_caps)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')],
            ].map(([k, v]) => (
              <div key={k as string} className="flex gap-2 border-b border-outline/10 pb-1.5">
                <span className="text-secondary-fixed-dim w-28 shrink-0">{k}</span>
                <span className="text-primary-fixed break-all">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-secondary-fixed-dim mt-4">
            No arbitrary command field exists anywhere in this product — commands are backend-defined only.
          </p>
        </div>
      )}

      {/* Runs + checks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2.5">
          <h2 className="text-label-ui text-text-secondary uppercase tracking-wider">Verification Runs</h2>
          {runs.length === 0 && (
            <div className="bg-surface-card border border-dashed border-border-subtle rounded-2xl p-6 text-center text-xs text-text-muted">
              No runs recorded yet for this patch.
            </div>
          )}
          {runs.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRun(r)}
              className={`w-full text-left bg-surface-card border rounded-xl p-3.5 transition-all ${
                selectedRun?.id === r.id ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border-subtle'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-text-primary">{r.id.slice(0, 18)}…</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                    r.status === 'completed'
                      ? 'bg-status-success/10 text-status-success'
                      : r.status === 'verification_unavailable'
                        ? 'bg-status-high/10 text-status-high'
                        : 'bg-status-critical/10 text-status-critical'
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                {r.mode === 'execution' ? 'Execution (refused)' : 'Static re-analysis'} •{' '}
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
              </p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm">
          <h2 className="text-label-ui text-text-secondary uppercase tracking-wider mb-4">
            Run Detail & Evidence
          </h2>
          {!selectedRun && (
            <p className="text-xs text-text-muted">
              Select a run to see exactly which checks ran, their outcomes and the evidence digest.
            </p>
          )}
          {selectedRun && (
            <div className="space-y-4">
              {selectedRun.status === 'verification_unavailable' && (
                <div className="bg-status-high/10 border border-status-high/30 rounded-xl p-3.5 text-xs text-status-high leading-relaxed">
                  {selectedRun.reason}
                </div>
              )}

              <div className="space-y-2">
                {selectedRun.checks.length === 0 && (
                  <p className="text-xs text-text-muted">No checks ran in this run.</p>
                )}
                {selectedRun.checks.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-surface-canvas border border-border-subtle rounded-xl p-3"
                  >
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        c.passed ? 'text-status-success' : 'text-status-critical'
                      }`}
                    >
                      {c.passed ? 'check_circle' : 'cancel'}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-text-primary">{c.name}</p>
                      <p className="text-[11px] text-text-secondary mt-0.5">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedRun.disclaimer && (
                <div className="bg-surface-canvas border border-border-subtle rounded-xl p-3.5 text-[11px] text-text-muted leading-relaxed">
                  {selectedRun.disclaimer}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="bg-surface-canvas border border-border-subtle rounded-xl p-3">
                  <div className="text-[9px] uppercase tracking-wider text-text-muted mb-1">Evidence digest</div>
                  <div className="text-text-primary break-all">{selectedRun.evidenceDigest}</div>
                </div>
                <div className="bg-surface-canvas border border-border-subtle rounded-xl p-3">
                  <div className="text-[9px] uppercase tracking-wider text-text-muted mb-1">Finished</div>
                  <div className="text-text-primary">
                    {selectedRun.finishedAt ? new Date(selectedRun.finishedAt).toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
