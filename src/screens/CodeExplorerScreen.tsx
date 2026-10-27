import React, { useState } from 'react';
import type { ScreenId, CodeExplorerFile } from '../types';
import { mockCodeFiles, mockProjects, mockVulnerabilities } from '../services/mockData';

interface CodeExplorerScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onSelectVulnerability: (vulnId: string) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const CodeExplorerScreen: React.FC<CodeExplorerScreenProps> = ({
  onNavigate,
  onSelectVulnerability,
  onTriggerToast,
}) => {
  const [selectedRepo, setSelectedRepo] = useState(mockProjects[0].name);
  const [selectedFile, setSelectedFile] = useState<CodeExplorerFile>(
    mockCodeFiles[0].children![0].children![0] // docker.go
  );

  const linkedVulnerability = selectedFile.vulnId
    ? mockVulnerabilities.find((v) => v.id === selectedFile.vulnId)
    : null;

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-label-ui text-text-muted mb-1">
            <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
            <span>AI Security Agent</span>
            <span>/</span>
            <span className="font-semibold text-text-primary">Code Explorer</span>
          </div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Source Code Taint Explorer & AST Inspector
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Examine source code syntax trees, trace tainted data flows, and inspect highlighted vulnerability sinks.
          </p>
        </div>

        {/* Repository Switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-text-secondary">Project:</label>
          <select
            value={selectedRepo}
            onChange={(e) => {
              setSelectedRepo(e.target.value);
              onTriggerToast({
                type: 'info',
                title: 'Workspace Scope Switched',
                message: `Loaded AST file tree for ${e.target.value}.`,
              });
            }}
            className="px-3.5 py-1.5 rounded-xl bg-surface-container border border-border-subtle focus:border-primary text-xs font-label-ui outline-none text-text-primary font-semibold"
          >
            {mockProjects.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} ({p.runtime})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Three Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-h-[620px]">
        {/* Panel 1: File Tree Navigation (3 cols) */}
        <div className="lg:col-span-3 bg-surface-card border border-border-subtle rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
              Project Files
            </span>
            <span className="text-[10px] font-mono text-text-muted">{selectedRepo}</span>
          </div>

          <div className="space-y-1 font-mono text-xs">
            {mockCodeFiles.map((folder) => (
              <div key={folder.path} className="space-y-1">
                <div className="flex items-center gap-1.5 text-text-primary font-semibold py-1 px-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">folder</span>
                  <span>{folder.name}</span>
                </div>

                {folder.children?.map((sub) => (
                  <div key={sub.path} className="pl-4 space-y-1">
                    <div className="flex items-center gap-1.5 text-text-secondary py-0.5">
                      <span className="material-symbols-outlined text-[14px] text-text-muted">folder_open</span>
                      <span>{sub.name}</span>
                    </div>

                    {sub.children?.map((file) => {
                      const isFileSelected = selectedFile.path === file.path;
                      return (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full flex items-center justify-between pl-4 pr-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                            isFileSelected
                              ? 'bg-primary text-on-primary font-semibold'
                              : 'text-text-secondary hover:bg-surface-container/60 hover:text-text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="material-symbols-outlined text-[14px]">description</span>
                            <span className="truncate">{file.name}</span>
                          </div>

                          {file.hasVulnerability && (
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isFileSelected ? 'bg-white' : 'bg-status-critical animate-pulse'
                              }`}
                              title="Active vulnerability sink detected"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Source Code Viewer (6 cols) */}
        <div className="lg:col-span-6 bg-surface-card border border-border-subtle rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between min-h-[620px]">
          {/* File Tab Header */}
          <div className="p-4 border-b border-border-subtle bg-surface-container/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">code</span>
              <span className="font-mono text-xs font-bold text-text-primary">
                {selectedFile.path}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-text-muted">
                {selectedFile.language}
              </span>
            </div>

            {selectedFile.hasVulnerability && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-status-critical/10 text-status-critical border border-status-critical/20">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                Taint Sink Detected
              </span>
            )}
          </div>

          {/* Code Viewer with Line Numbers and Vulnerable Highlight */}
          <div className="flex-1 p-4 bg-[#0a1411] text-surface-bright font-mono text-xs overflow-x-auto leading-relaxed divide-y divide-white/5">
            {selectedFile.codeSnippet ? (
              selectedFile.codeSnippet.map((line) => {
                const isHighlight = line.highlight;
                return (
                  <div
                    key={line.lineNumber}
                    className={`flex items-start gap-4 py-0.5 px-2 rounded transition-colors ${
                      isHighlight
                        ? 'bg-status-critical/20 text-white border-l-2 border-status-critical font-semibold'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="text-secondary-fixed-dim/50 select-none w-8 text-right shrink-0">
                      {line.lineNumber}
                    </span>
                    <pre className="whitespace-pre font-mono flex-1 text-surface-bright">
                      {line.content}
                    </pre>
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-secondary-fixed-dim italic">
                No preview code lines available for this file.
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="p-3 border-t border-border-subtle bg-surface-container/20 flex items-center justify-between text-[11px] text-text-muted">
            <span>Encoding: UTF-8</span>
            <span>Lines: {selectedFile.codeSnippet?.length || 0}</span>
          </div>
        </div>

        {/* Panel 3: Vulnerability & AST Analysis Context (3 cols) */}
        <div className="lg:col-span-3 bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
              AST Taint Analysis
            </span>
            <span className="text-[10px] font-mono text-text-muted">Sink Details</span>
          </div>

          {linkedVulnerability ? (
            <div className="space-y-4 animate-fade-in text-xs">
              <div>
                <span className="font-mono text-xs font-bold text-status-critical block">
                  {linkedVulnerability.id}
                </span>
                <span className="font-bold text-text-primary text-xs mt-0.5 block leading-tight">
                  {linkedVulnerability.title}
                </span>
                <span className="text-[11px] text-text-muted block mt-1">
                  {linkedVulnerability.cwe}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-container/40 border border-border-subtle space-y-1.5">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">
                  CVSS Base Metric
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold font-headline-sm text-status-critical">
                    {linkedVulnerability.cvssScore}
                  </span>
                  <span className="text-[10px] text-status-critical font-semibold uppercase">
                    Critical Severity
                  </span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-text-primary block mb-1">Impact Analysis</span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {linkedVulnerability.impactAnalysis}
                </p>
              </div>

              <div className="pt-2 border-t border-border-subtle space-y-2">
                <button
                  onClick={() => {
                    onSelectVulnerability(linkedVulnerability.id);
                    onNavigate('vulnerabilities');
                  }}
                  className="w-full py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center justify-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>View Full Finding</span>
                </button>

                <button
                  onClick={() => onNavigate('patch-review')}
                  className="w-full py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">code</span>
                  <span>Review Staged Patch</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-text-muted text-xs space-y-2">
              <span className="material-symbols-outlined text-[28px] text-status-success">
                check_circle
              </span>
              <p>No active taint vulnerabilities found in this file.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
