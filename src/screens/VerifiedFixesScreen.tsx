import React, { useState } from 'react';
import type { ScreenId, VerifiedFixItem } from '../types';
import { mockVerifiedFixes } from '../services/mockData';

interface VerifiedFixesScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const VerifiedFixesScreen: React.FC<VerifiedFixesScreenProps> = ({
  onNavigate,
  onTriggerToast,
}) => {
  const [fixes] = useState<VerifiedFixItem[]>(mockVerifiedFixes);
  const [selectedFix, setSelectedFix] = useState<VerifiedFixItem | null>(mockVerifiedFixes[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFixes = fixes.filter(
    (f) =>
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.vulnerabilityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.project.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-label-ui text-text-muted mb-1">
            <span className="material-symbols-outlined text-[16px] text-status-success">check_circle</span>
            <span>Validation & Results</span>
            <span>/</span>
            <span className="font-semibold text-text-primary">Verified Fixes</span>
          </div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Verified Remediations & Attestations
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Cryptographically proven security patches that completed isolated gVisor microVM regression testing.
          </p>
        </div>

        <button
          onClick={() => onNavigate('verification')}
          className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">terminal</span>
          <span>Open Live Sandbox</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Table Column (7 cols) */}
        <div className="lg:col-span-7 bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <h2 className="text-sm font-bold font-headline-sm text-text-primary uppercase tracking-wider font-label-ui">
              Neutralized Vulnerabilities ({fixes.length})
            </h2>

            <div className="relative min-w-[200px]">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-text-muted text-[14px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search verified fixes..."
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
                  <th className="pb-2 font-medium">Vulnerability</th>
                  <th className="pb-2 font-medium">Patch ID</th>
                  <th className="pb-2 font-medium">Project</th>
                  <th className="pb-2 font-medium">Test Pass Rate</th>
                  <th className="pb-2 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredFixes.map((fix) => {
                  const isSelected = selectedFix?.id === fix.id;
                  return (
                    <tr
                      key={fix.id}
                      onClick={() => setSelectedFix(fix)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/5 font-semibold'
                          : 'hover:bg-surface-container/30'
                      }`}
                    >
                      <td className="py-3">
                        <div className="font-mono text-[11px] text-text-primary font-bold">
                          {fix.vulnerabilityId}
                        </div>
                        <div className="text-[11px] text-text-secondary truncate max-w-xs">
                          {fix.title}
                        </div>
                      </td>

                      <td className="py-3 font-mono text-[11px] text-primary">{fix.patchId}</td>

                      <td className="py-3 font-mono text-[11px] text-text-muted">{fix.project}</td>

                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-status-success/10 text-status-success border border-status-success/20">
                          <span className="material-symbols-outlined text-[12px]">check</span>
                          {fix.testsPassed} / {fix.testsTotal}
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <button
                          onClick={() => setSelectedFix(fix)}
                          className="text-xs text-primary hover:underline font-semibold"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Fix Detail Drawer (5 cols) */}
        <div className="lg:col-span-5 bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
          {selectedFix ? (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div>
                  <span className="text-[10px] font-mono text-text-muted uppercase">Verification Attestation</span>
                  <h3 className="font-bold text-sm text-text-primary mt-0.5">{selectedFix.title}</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-status-success/10 text-status-success border border-status-success/20">
                  {selectedFix.regressionRisk}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-surface-container/30 border border-border-subtle">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block">Remediated Target</span>
                  <span className="font-mono text-text-primary font-bold mt-1 block">{selectedFix.project}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container/30 border border-border-subtle">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block">Patch Applied</span>
                  <span className="font-mono text-primary font-bold mt-1 block">{selectedFix.patchId}</span>
                </div>
              </div>

              {/* Cryptographic Execution Attestation */}
              <div className="p-3.5 rounded-xl bg-surface-dark border border-outline/20 text-surface-bright space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono text-primary-fixed font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">verified_user</span>
                    Signed Attestation Digest
                  </span>
                  <span className="text-[10px] text-secondary-fixed-dim">SHA-256</span>
                </div>
                <code className="text-[11px] font-mono text-primary-fixed block break-all select-all">
                  {selectedFix.attestationHash}
                </code>
                <div className="text-[10px] text-secondary-fixed-dim pt-1 border-t border-white/10 flex justify-between">
                  <span>Signer: {selectedFix.reviewer}</span>
                  <span>{selectedFix.verificationTimestamp}</span>
                </div>
              </div>

              {/* Test Results Summary */}
              <div>
                <span className="font-semibold text-text-primary block mb-1">Regression Coverage</span>
                <div className="p-3 rounded-xl bg-surface-container/40 border border-border-subtle text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Unit & Integration Tests:</span>
                    <span className="font-mono font-bold text-status-success">{selectedFix.testsPassed} Passed (0 Failed)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Sandbox Isolation Runtime:</span>
                    <span className="font-mono text-text-primary">gVisor runsc (ptrace sandbox)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Remaining Production Risk:</span>
                    <span className="text-status-success font-semibold">Zero Identified Regressions</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border-subtle flex justify-end gap-2">
                <button
                  onClick={() => {
                    onTriggerToast({
                      type: 'info',
                      title: 'Evidence Certificate',
                      message: `Exported verification attestation certificate for ${selectedFix.patchId}.`,
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Download Proof</span>
                </button>
                <button
                  onClick={() => onNavigate('patch-review')}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">code</span>
                  <span>View Diff</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-text-muted text-xs">
              Select a verified remediation to inspect cryptographic attestation evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
