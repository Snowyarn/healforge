import React, { useState } from 'react';
import type { ScreenId, BugReport, SeverityLevel } from '../types';
import { mockBugReports, mockProjects } from '../services/mockData';
import { workbenchService } from '../services/workbenchService';

interface BugReportScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const BugReportScreen: React.FC<BugReportScreenProps> = ({
  onNavigate,
  onTriggerToast,
}) => {
  const [reports, setReports] = useState<BugReport[]>(mockBugReports);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BugReport['category']>('Authorization Bypass');
  const [severity, setSeverity] = useState<SeverityLevel>('High');
  const [affectedRepo, setAffectedRepo] = useState(mockProjects[0].name);
  const [affectedFile, setAffectedFile] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [evidenceName, setEvidenceName] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !affectedFile.trim()) {
      onTriggerToast({
        type: 'warning',
        title: 'Validation Incomplete',
        message: 'Please complete all required fields before submitting.',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await workbenchService.submitBugReport({
      title: title.trim(),
      description: description.trim(),
      category,
      severity,
      affectedRepo,
      affectedFile: affectedFile.trim(),
      stepsToReproduce: stepsToReproduce.trim(),
      expectedBehavior: expectedBehavior.trim(),
      actualBehavior: actualBehavior.trim(),
    });
    setIsSubmitting(false);

    setReports([result.data, ...reports]);
    onTriggerToast({
      type: 'success',
      title: 'Bug Report Dispatched',
      message: `Report ${result.data.id} submitted. AST remediation agent will inspect the sink.`,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setAffectedFile('');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setActualBehavior('');
    setEvidenceName(null);
  };

  return (
    <div className="flex flex-col w-full p-margin space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-label-ui text-text-muted mb-1">
            <span className="material-symbols-outlined text-[16px] text-primary">bug_report</span>
            <span>Workspace</span>
            <span>/</span>
            <span className="font-semibold text-text-primary">Bug & Vulnerability Reporting</span>
          </div>
          <h1 className="text-xl font-bold font-headline-sm text-text-primary tracking-tight">
            Vulnerability Triage & Bug Reporting
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Submit reproducible security findings directly into HealForge's autonomous patch synthesis pipeline.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column (7 cols) */}
        <div className="lg:col-span-7 bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-5">
          <div className="pb-3 border-b border-border-subtle">
            <h2 className="text-sm font-bold font-headline-sm text-text-primary uppercase tracking-wider font-label-ui">
              New Security Finding Report
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Fill in the technical context. All fields marked with * are required.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Report Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Unauthenticated path traversal in file handler"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BugReport['category'])}
                  className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
                >
                  <option value="Authorization Bypass">Authorization Bypass</option>
                  <option value="SQL Injection">SQL Injection</option>
                  <option value="Authentication">Authentication</option>
                  <option value="Memory Safety">Memory Safety</option>
                  <option value="Logic Flaw">Logic Flaw</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Severity *
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                  className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
                >
                  <option value="Critical">Critical (CVSS 9.0+)</option>
                  <option value="High">High (CVSS 7.0 - 8.9)</option>
                  <option value="Medium">Medium (CVSS 4.0 - 6.9)</option>
                  <option value="Low">Low (CVSS 0.1 - 3.9)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Affected Repository *
                </label>
                <select
                  value={affectedRepo}
                  onChange={(e) => setAffectedRepo(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
                >
                  {mockProjects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Affected File & Line Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. api/handlers/docker.go:142"
                value={affectedFile}
                onChange={(e) => setAffectedFile(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs font-mono outline-none text-text-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Description of Vulnerability *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Explain the security flaw, attacker preconditions, and potential blast radius..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Steps to Reproduce
              </label>
              <textarea
                rows={3}
                placeholder="1. Send crafted payload to endpoint...&#10;2. Check response headers...&#10;3. Observe bypassed validation..."
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs font-mono outline-none text-text-primary leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Expected Secure Behavior
                </label>
                <input
                  type="text"
                  placeholder="e.g. Return 401 Unauthorized"
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Actual Insecure Behavior
                </label>
                <input
                  type="text"
                  placeholder="e.g. Forwards request with anonymous role"
                  value={actualBehavior}
                  onChange={(e) => setActualBehavior(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
                />
              </div>
            </div>

            {/* Evidence attachment simulation */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Supporting Evidence / Exploit PoC (Optional)
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEvidenceName('poc_exploit_payload.json');
                    onTriggerToast({
                      type: 'info',
                      title: 'File Attached',
                      message: 'poc_exploit_payload.json attached as reproduction evidence.',
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">attach_file</span>
                  <span>Attach Sample PoC</span>
                </button>
                {evidenceName && (
                  <span className="text-xs font-mono text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    {evidenceName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Submit Security Report</span>
              </button>
            </div>
          </form>
        </div>

        {/* Submitted Reports History (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h2 className="text-sm font-bold font-headline-sm text-text-primary uppercase tracking-wider font-label-ui">
                Submitted Reports ({reports.length})
              </h2>
              <span className="text-[10px] font-mono text-text-muted">Workbench DB</span>
            </div>

            <div className="space-y-3">
              {reports.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedReport?.id === r.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border-subtle hover:bg-surface-container/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-text-primary">{r.id}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          r.severity === 'Critical'
                            ? 'bg-status-critical/10 text-status-critical'
                            : r.severity === 'High'
                            ? 'bg-status-high/10 text-status-high'
                            : 'bg-status-medium/10 text-status-medium'
                        }`}
                      >
                        {r.severity}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-surface-container text-text-secondary">
                      {r.status}
                    </span>
                  </div>

                  <h3 className="font-semibold text-xs text-text-primary mt-2 line-clamp-1">
                    {r.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-text-muted mt-2 pt-2 border-t border-border-subtle/40">
                    <span className="font-mono">{r.affectedRepo}</span>
                    <span>{r.submittedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Detail Modal / Drawer if selected */}
          {selectedReport && (
            <div className="bg-surface-card border border-primary/40 rounded-2xl p-5 shadow-sm space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary">{selectedReport.id} Details</span>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              <h4 className="font-bold text-sm text-text-primary">{selectedReport.title}</h4>
              <p className="text-xs text-text-secondary leading-relaxed">{selectedReport.description}</p>

              <div className="p-3 rounded-lg bg-surface-container/40 border border-border-subtle text-[11px] space-y-1 font-mono">
                <div><strong>Location:</strong> {selectedReport.affectedFile}</div>
                <div><strong>Reported By:</strong> {selectedReport.submittedBy}</div>
                <div><strong>Category:</strong> {selectedReport.category}</div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onNavigate('patch-review')}
                  className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <span>View Synthesized Patch</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
