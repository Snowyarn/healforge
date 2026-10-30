import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScreenId } from '../types';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { ApiError, endpoints } from '../services/api';
import type { CodeLineDto, FileNodeDto, ProjectDto } from '../services/api';

interface CodeExplorerScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onSelectVulnerability: (vulnId: string) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
  currentProjectId: string | null;
}

interface FileContent {
  path: string;
  language: string;
  linesCount: number;
  codeSnippet: CodeLineDto[];
  findings: {
    id: string;
    internalId: string;
    title: string;
    severity: string;
    lineStart: number;
    lineEnd: number;
    cwe: string;
    cvssScore: number;
    description: string;
  }[];
}

/** Real source tree + file content browser, linked to persisted findings. */
export const CodeExplorerScreen: React.FC<CodeExplorerScreenProps> = ({
  onNavigate,
  onSelectVulnerability,
  onTriggerToast,
  currentProjectId,
}) => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [revisionId, setRevisionId] = useState<string>('');
  const [revisionDigest, setRevisionDigest] = useState<string>('');
  const [tree, setTree] = useState<FileNodeDto[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNodeDto | null>(null);
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    endpoints
      .projects()
      .then(({ projects: rows }) => {
        setProjects(rows);
        const preferred = currentProjectId && rows.some((p) => p.id === currentProjectId)
          ? currentProjectId
          : rows[0]?.id ?? '';
        setSelectedProjectId(preferred);
      })
      .catch(() => undefined);
  }, [currentProjectId]);

  const loadTree = useCallback(
    async (projectId: string) => {
      if (!projectId) return;
      setLoading(true);
      setContent(null);
      setSelectedFile(null);
      try {
        const res = await endpoints.fileTree(projectId);
        setRevisionId(res.revisionId);
        setRevisionDigest(res.revisionDigest);
        setTree(res.tree);
      } catch (exc) {
        setTree([]);
        onTriggerToast({
          type: 'info',
          title: 'No Source Imported',
          message:
            exc instanceof ApiError && exc.code === 'no_source_imported'
              ? 'Import a ZIP archive for this project first.'
              : 'Could not load the file tree.',
        });
      } finally {
        setLoading(false);
      }
    },
    [onTriggerToast],
  );

  useEffect(() => {
    if (selectedProjectId) loadTree(selectedProjectId);
  }, [selectedProjectId, loadTree]);

  const handleSelectFile = async (file: FileNodeDto) => {
    setSelectedFile(file);
    setContentLoading(true);
    try {
      const res = await endpoints.fileContent(selectedProjectId, file.path, revisionId);
      setContent(res);
    } catch {
      setContent(null);
      onTriggerToast({ type: 'warning', title: 'File Load Failed', message: 'Could not load file content.' });
    } finally {
      setContentLoading(false);
    }
  };

  const linkedFinding = content?.findings[0] ?? null;
  const vulnerablePaths = useMemo(() => {
    const set = new Set<string>();
    const walk = (nodes: FileNodeDto[]) => {
      nodes.forEach((n) => {
        if (n.type === 'file' && n.hasVulnerability) set.add(n.path);
        if (n.children) walk(n.children);
      });
    };
    walk(tree);
    return set;
  }, [tree]);

  const renderTree = (nodes: FileNodeDto[], depth = 0): React.ReactNode =>
    nodes.map((node) => (
      <div key={node.path}>
        <button
          onClick={() => node.type === 'file' && handleSelectFile(node)}
          disabled={node.type === 'dir'}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          className={`w-full text-left py-1.5 pr-3 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
            selectedFile?.path === node.path
              ? 'bg-primary/10 text-primary font-semibold'
              : node.type === 'dir'
                ? 'text-text-muted cursor-default'
                : 'text-text-primary hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined text-[14px] text-text-muted shrink-0">
            {node.type === 'dir' ? 'folder' : 'description'}
          </span>
          <span className="truncate">{node.name}</span>
          {node.type === 'file' && vulnerablePaths.has(node.path) && (
            <span className="w-1.5 h-1.5 rounded-full bg-status-critical animate-pulse shrink-0 ml-auto" />
          )}
          {node.type === 'file' && node.linesCount ? (
            <span className="text-[9px] text-text-muted font-mono ml-auto shrink-0">{node.linesCount}L</span>
          ) : null}
        </button>
        {node.children && node.children.length > 0 && renderTree(node.children, depth + 1)}
      </div>
    ));

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">Code Explorer</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Browse the imported source tree — findings link to exact file/line in this revision.
          </p>
        </div>
        {projects.length > 0 && (
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-surface-container border border-border-subtle rounded-xl px-3.5 py-2.5 text-body-sm text-text-primary"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-surface-card border border-dashed border-border-subtle rounded-2xl p-14 text-center">
          <span className="material-symbols-outlined text-4xl text-text-muted">folder_off</span>
          <p className="text-body-md text-text-primary font-medium mt-4">No projects yet</p>
          <p className="text-body-sm text-text-muted mt-1">
            Import a source archive from the Repositories screen to browse code here.
          </p>
          <button
            onClick={() => onNavigate('repositories')}
            className="mt-4 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold"
          >
            Go to Repositories
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* File tree */}
          <div className="col-span-12 lg:col-span-3 bg-surface-card border border-border-subtle rounded-2xl p-3 shadow-sm max-h-[70vh] overflow-y-auto">
            <div className="px-2 py-1.5 text-[10px] font-label-ui text-text-muted uppercase tracking-wider border-b border-border-subtle mb-2 flex items-center justify-between">
              <span>Source Tree</span>
              {revisionDigest && <span className="font-mono normal-case">{revisionDigest}…</span>}
            </div>
            {loading && <div className="space-y-2 px-2">{[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-5 bg-surface-container rounded animate-pulse" />
            ))}</div>}
            {!loading && tree.length === 0 && (
              <p className="text-xs text-text-muted p-4 text-center">No source imported for this project.</p>
            )}
            {!loading && renderTree(tree)}
          </div>

          {/* Code viewer */}
          <div className="col-span-12 lg:col-span-6">
            <div className="bg-surface-dark rounded-2xl border border-outline/20 overflow-hidden text-surface-bright">
              <div className="flex items-center justify-between px-4 py-3 border-b border-outline/20">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-critical/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-status-medium/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-status-success/70" />
                  </div>
                  <span className="ml-2 font-label-code-sm text-secondary-fixed-dim truncate max-w-[240px]">
                    {selectedFile?.path ?? 'no file selected'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {content?.language && (
                    <span className="text-label-code-sm text-secondary-fixed-dim">{content.language}</span>
                  )}
                  {linkedFinding && (
                    <span className="text-[10px] font-mono font-bold bg-status-critical/20 text-status-critical px-2 py-0.5 rounded">
                      FINDING LINKED
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 overflow-x-auto font-label-code-md leading-relaxed max-h-[58vh] overflow-y-auto">
                {!selectedFile && (
                  <div className="text-secondary-fixed-dim text-xs py-8 text-center">
                    Select a file from the tree to view its stored content.
                  </div>
                )}
                {contentLoading && (
                  <div className="space-y-2 py-4">{[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-4 bg-white/5 rounded animate-pulse" />
                  ))}</div>
                )}
                {!contentLoading && content && (
                  <table className="w-full border-collapse">
                    <tbody>
                      {content.codeSnippet.map((line) => (
                        <tr key={line.lineNumber} className={line.highlight ? 'bg-status-critical/10' : ''}>
                          <td
                            className={`pr-4 text-right select-none w-10 align-top ${
                              line.highlight ? 'text-status-critical font-bold' : 'text-outline'
                            }`}
                          >
                            {line.lineNumber}
                          </td>
                          <td
                            className={`whitespace-pre-wrap break-all ${
                              line.highlight
                                ? 'text-surface-bright border-l-2 border-status-critical pl-2'
                                : 'text-secondary-fixed-dim pl-2'
                            }`}
                          >
                            {line.content || ' '}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {content && (
                <div className="px-4 py-2.5 border-t border-outline/20 flex items-center justify-between text-[10px] font-mono text-secondary-fixed-dim">
                  <span>{content.linesCount} lines</span>
                  <span>Encoding: UTF-8 • stored content, never executed</span>
                </div>
              )}
            </div>
          </div>

          {/* Context panel */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            {linkedFinding ? (
              <div className="bg-surface-card border border-status-critical/30 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Linked Finding
                  </h3>
                  <SeverityBadge severity={linkedFinding.severity as 'Critical' | 'High' | 'Medium' | 'Low'} />
                </div>
                <p className="font-mono text-[11px] font-semibold text-text-primary">{linkedFinding.id}</p>
                <p className="text-xs text-text-primary font-medium leading-snug">{linkedFinding.title}</p>
                <p className="text-[11px] text-text-muted">{linkedFinding.cwe}</p>
                <div className="bg-surface-canvas border border-border-subtle rounded-xl p-3">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">CVSS (estimated)</div>
                  <div className="text-lg font-bold font-headline-sm text-status-critical">
                    {linkedFinding.cvssScore.toFixed(1)}
                  </div>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">{linkedFinding.description}</p>
                <button
                  onClick={() => {
                    onSelectVulnerability(linkedFinding.id);
                    onNavigate('vulnerabilities');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold"
                >
                  View Full Finding
                </button>
              </div>
            ) : (
              <div className="bg-surface-card border border-status-success/30 rounded-2xl p-5 shadow-sm text-center">
                <span className="material-symbols-outlined text-3xl text-status-success">verified</span>
                <p className="text-xs text-text-primary font-medium mt-2">No findings linked</p>
                <p className="text-[11px] text-text-muted mt-1">
                  {selectedFile
                    ? 'This file has no open findings in the current revision.'
                    : 'Select a file to see linked findings.'}
                </p>
              </div>
            )}

            <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-2">Revision</h3>
              <p className="font-mono text-[11px] text-text-secondary break-all">{revisionDigest}…</p>
              <button
                onClick={() => onNavigate('patch-review')}
                className="mt-3 w-full px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary"
              >
                Review Staged Patches
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
