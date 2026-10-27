import React, { useState } from 'react';
import type { ScreenId, PatchItem, PatchStatus } from '../types';

interface PatchReviewScreenProps {
  patch: PatchItem;
  onNavigate: (screen: ScreenId) => void;
  onUpdateStatus: (status: PatchStatus) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const PatchReviewScreen: React.FC<PatchReviewScreenProps> = ({
  patch,
  onNavigate,
  onUpdateStatus,
  onTriggerToast,
}) => {
  const [currentStatus, setCurrentStatus] = useState<PatchStatus>(patch.status);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');

  const handleApprove = () => {
    setIsApproving(true);
    setTimeout(() => {
      setIsApproving(false);
      setCurrentStatus('Approved');
      onUpdateStatus('Approved');
      onTriggerToast({
        type: 'success',
        title: 'Patch Approved & Merged',
        message: `${patch.id} (${patch.title}) merged into sandbox release candidate. Sandbox container scheduled for final regression.`,
      });
    }, 700);
  };

  const handleReject = () => {
    setIsRejecting(true);
    setTimeout(() => {
      setIsRejecting(false);
      setCurrentStatus('Rejected');
      onUpdateStatus('Rejected');
      onTriggerToast({
        type: 'warning',
        title: 'Patch Rejected',
        message: `${patch.id} was rejected. Autonomous repair agent scheduled to generate alternative AST permutation.`,
      });
    }, 500);
  };

  const handleRequestChangesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowChangesModal(false);
    setCurrentStatus('Changes Requested');
    onUpdateStatus('Changes Requested');
    onTriggerToast({
      type: 'info',
      title: 'Changes Requested',
      message: `Feedback dispatched to HealForge Agent: "${changeNotes || 'Please adjust SQL binding syntax.'}"`,
    });
  };

  return (
    <div className="flex flex-col w-full pb-20">
      {/* Top Banner Header */}
      <div className="flex flex-col px-margin pt-6 pb-4 bg-surface-container-low border-b border-border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md bg-status-critical/10 text-status-critical font-label-code-sm border border-status-critical/20">
              {patch.id}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-status-low/10 text-status-low font-label-code-sm border border-status-low/20">
              CWE-89: SQL Injection
            </span>
            <span className="flex items-center gap-1.5 text-text-secondary text-body-sm font-label-code-sm">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              {patch.generatedAgo} by {patch.generator}
            </span>
            {currentStatus !== 'Pending Review' && (
              <span
                className={`px-2.5 py-0.5 rounded-full font-label-code-sm text-xs ${
                  currentStatus === 'Approved'
                    ? 'bg-status-success/20 text-status-success font-bold'
                    : currentStatus === 'Rejected'
                    ? 'bg-status-critical/20 text-status-critical'
                    : 'bg-amber-100 text-status-high'
                }`}
              >
                Status: {currentStatus}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleReject}
              disabled={isRejecting || currentStatus === 'Rejected'}
              className="px-4 py-2 rounded-full bg-surface text-text-secondary hover:bg-surface-container font-label-ui border border-border-subtle transition-all flex items-center gap-2 hover:text-status-critical disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              {isRejecting ? 'Rejecting...' : 'Reject'}
            </button>
            <button
              onClick={() => setShowChangesModal(true)}
              className="px-4 py-2 rounded-full bg-surface text-text-secondary hover:bg-surface-container font-label-ui border border-border-subtle transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">rate_review</span>
              Request Changes
            </button>
            <button
              onClick={handleApprove}
              disabled={isApproving || currentStatus === 'Approved'}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-label-ui hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isApproving ? 'sync' : 'verified'}
              </span>
              {isApproving ? 'Merging PR...' : currentStatus === 'Approved' ? 'PR Approved' : 'Approve & Merge PR'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-headline-lg text-text-primary font-headline-lg tracking-tight mb-1">
              SQL Injection Sanitization in{' '}
              <code className="font-label-code-md text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                reports.go
              </code>
            </h1>
            <p className="text-body-md text-text-secondary">{patch.description}</p>
          </div>
          <div className="flex items-center gap-4 text-body-sm font-label-code-sm">
            <div className="flex items-center gap-1 text-status-success bg-status-success/10 px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-[16px]">add</span> +{patch.addedLinesCount} lines
            </div>
            <div className="flex items-center gap-1 text-status-critical bg-status-critical/10 px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-[16px]">remove</span> -{patch.removedLinesCount} lines
            </div>
          </div>
        </div>
      </div>

      {/* Main Diff Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-margin px-margin mt-6">
        {/* Left Column (8 cols): Diff Viewer & Flow Graph */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Side-by-Side Diff Container */}
          <div className="bg-surface-card rounded-xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-text-secondary text-[18px]">code</span>
                <span className="text-body-sm font-label-code-md text-text-primary">
                  {patch.filePath} (Side-by-Side Diff)
                </span>
              </div>
              <div className="flex items-center gap-2 text-body-sm text-text-muted">
                <span>{patch.linesRange}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-subtle font-label-code-sm bg-surface-card">
              {/* Left: Vulnerable Original Code */}
              <div className="overflow-x-auto p-4 bg-[#FFF1F2]/30">
                <div className="text-xs uppercase font-label-ui text-status-critical mb-3 tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">remove_circle</span>
                  Vulnerable Original Code
                </div>
                <pre className="text-text-primary leading-relaxed font-label-code-sm">
                  <code>
                    {patch.originalCode.map((line) => (
                      <span
                        key={line.lineNumber}
                        className={
                          line.type === 'removed'
                            ? 'text-text-muted select-none bg-status-critical/20 block text-status-critical'
                            : 'text-text-muted select-none block'
                        }
                      >
                        <span className="select-none inline-block w-8 text-right pr-2 text-outline">
                          {line.lineNumber} |
                        </span>
                        <span className={line.type === 'removed' ? 'text-status-critical font-bold' : ''}>
                          {line.content}
                        </span>
                      </span>
                    ))}
                  </code>
                </pre>
              </div>

              {/* Right: Autonomous Patched Code */}
              <div className="overflow-x-auto p-4 bg-[#ECFDF5]/30">
                <div className="text-xs uppercase font-label-ui text-status-success mb-3 tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                  Autonomous Patched Code
                </div>
                <pre className="text-text-primary leading-relaxed font-label-code-sm">
                  <code>
                    {patch.patchedCode.map((line) => (
                      <span
                        key={line.lineNumber}
                        className={
                          line.type === 'added'
                            ? 'text-text-muted select-none bg-status-success/20 block text-status-success'
                            : 'text-text-muted select-none block'
                        }
                      >
                        <span className="select-none inline-block w-8 text-right pr-2 text-outline">
                          {line.lineNumber} |
                        </span>
                        <span className={line.type === 'added' ? 'text-status-success font-bold' : ''}>
                          {line.content}
                        </span>
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          </div>

          {/* AST Dependency & Flow Graph Impact Bento */}
          <div className="bg-surface-card rounded-xl shadow-sm border border-border-subtle p-6">
            <h3 className="text-headline-sm text-text-primary font-headline-sm mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">neurology</span>
              AST Dependency & Flow Graph Impact
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-surface-container-low border border-border-subtle">
                <span className="text-body-sm font-label-ui text-text-muted uppercase tracking-wider block mb-1">
                  {patch.astImpact.taintSource.label}
                </span>
                <span className="font-label-code-sm text-text-primary block mb-2">
                  HTTP Query Param <code className="text-status-critical">?query=</code>
                </span>
                <p className="text-body-sm text-text-secondary">{patch.astImpact.taintSource.desc}</p>
              </div>

              <div className="p-4 rounded-lg bg-surface-container-low border border-border-subtle">
                <span className="text-body-sm font-label-ui text-text-muted uppercase tracking-wider block mb-1">
                  {patch.astImpact.astMutation.label}
                </span>
                <span className="font-label-code-sm text-text-primary block mb-2">
                  Node Replace: <code className="text-primary">BinaryExpr</code>
                </span>
                <p className="text-body-sm text-text-secondary">{patch.astImpact.astMutation.desc}</p>
              </div>

              <div className="p-4 rounded-lg bg-surface-container-low border border-border-subtle">
                <span className="text-body-sm font-label-ui text-text-muted uppercase tracking-wider block mb-1">
                  {patch.astImpact.verificationStatus.label}
                </span>
                <span className="font-label-code-sm text-status-success flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  {patch.astImpact.verificationStatus.count}
                </span>
                <p className="text-body-sm text-text-secondary">
                  {patch.astImpact.verificationStatus.desc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): AI Rationale & Verification Log */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* AI Agent Rationale Card */}
          <div className="bg-surface-card rounded-xl shadow-sm border border-border-subtle p-6">
            <div className="flex items-center gap-2 text-primary mb-4">
              <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              <h2 className="text-headline-sm text-text-primary font-headline-sm">AI Agent Rationale</h2>
            </div>

            <div className="space-y-4 text-body-md text-text-secondary">
              <div className="p-3.5 rounded-lg bg-surface-container-low border border-border-subtle">
                <span className="font-label-ui text-text-primary block mb-1">Syntax Conventions</span>
                <p className="text-body-sm">{patch.rationale.syntaxConventions}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-container-low border border-border-subtle">
                <span className="font-label-ui text-text-primary block mb-1">Dependency Safety</span>
                <p className="text-body-sm">{patch.rationale.dependencySafety}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-container-low border border-border-subtle">
                <span className="font-label-ui text-text-primary block mb-1">Performance Impact</span>
                <p className="text-body-sm">{patch.rationale.performanceImpact}</p>
              </div>
            </div>
          </div>

          {/* Sandbox Verification Log (Dark Terminal Box) */}
          <div className="bg-surface-dark rounded-xl p-6 text-surface-bright shadow-md border border-outline/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-headline-sm text-surface-bright font-headline-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed text-[20px]">terminal</span>
                Sandbox Verification Log
              </h3>
              <button
                onClick={() => onNavigate('verification')}
                className="text-[11px] font-label-code-sm text-primary-fixed hover:underline"
              >
                Open Full View
              </button>
            </div>

            <div className="font-label-code-sm text-secondary-fixed-dim space-y-2 text-xs bg-surface/40 p-4 rounded-lg border border-outline/20">
              {patch.verificationLog.map((logLine, idx) => (
                <div
                  key={idx}
                  className={
                    logLine.startsWith('$')
                      ? 'text-secondary-fixed-dim'
                      : logLine.includes('PASS')
                      ? 'text-status-success'
                      : logLine.includes('neutralized')
                      ? 'text-surface-bright font-bold mt-2'
                      : 'text-text-muted'
                  }
                >
                  {logLine}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Request Changes Modal */}
      {showChangesModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-xl max-w-lg w-full p-6 shadow-xl border border-border-subtle">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-headline-sm text-text-primary">Request Remediation Changes</h4>
              <button
                onClick={() => setShowChangesModal(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="text-body-sm text-text-secondary mb-4">
              Provide guidance for the autonomous AST agent. The agent will parse your feedback, regenerate the
              patch, and rerun regression testing.
            </p>
            <form onSubmit={handleRequestChangesSubmit}>
              <textarea
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                placeholder="e.g. Please use named bind parameters rather than positional $1, $2 placeholders..."
                rows={4}
                className="w-full p-3 rounded-lg bg-surface border border-border-strong text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-4"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangesModal(false)}
                  className="px-4 py-2 rounded-full border border-border-subtle text-text-secondary hover:bg-surface-container font-label-ui text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full bg-primary text-on-primary font-label-ui text-xs hover:bg-primary/90"
                >
                  Dispatch to Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
