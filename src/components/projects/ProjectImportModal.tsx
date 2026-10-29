import { useRef, useState } from 'react';
import { ApiError, endpoints } from '../../services/api';
import type { RevisionDto } from '../../services/api';

export interface ProjectImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (projectId: string, revision: RevisionDto, projectName: string) => void;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

const MAX_ARCHIVE_MB = 20;

/**
 * Real project creation + bounded ZIP source import.
 * The archive is parsed server-side with zip-slip/symlink/size defenses —
 * nothing is executed, and only text source files are stored.
 */
export function ProjectImportModal({ isOpen, onClose, onImported, onTriggerToast }: ProjectImportModalProps) {
  const [step, setStep] = useState<'details' | 'upload' | 'importing' | 'done'>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [runtime, setRuntime] = useState('Multi-language');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [revision, setRevision] = useState<RevisionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const reset = () => {
    setStep('details');
    setName('');
    setDescription('');
    setRuntime('Multi-language');
    setProjectId(null);
    setFile(null);
    setRevision(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreateProject = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError('Project name must be at least 2 characters.');
      return;
    }
    try {
      const res = await endpoints.createProject({
        name: name.trim(),
        description: description.trim(),
        runtime,
        primaryBranch: 'import',
      });
      setProjectId(res.project.id);
      setStep('upload');
      onTriggerToast({
        type: 'success',
        title: 'Project Created',
        message: `Project '${res.project.name}' created. Now import a source archive.`,
      });
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Failed to create project.');
    }
  };

  const handleFileChange = (selected: File | null) => {
    setError(null);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.zip')) {
      setError('Only .zip archives are accepted.');
      return;
    }
    if (selected.size > MAX_ARCHIVE_MB * 1024 * 1024) {
      setError(`Archive exceeds the ${MAX_ARCHIVE_MB} MB limit.`);
      return;
    }
    setFile(selected);
  };

  const handleImport = async () => {
    if (!projectId || !file) return;
    setError(null);
    setStep('importing');
    try {
      const res = await endpoints.uploadSource(projectId, file);
      setRevision(res.revision);
      setStep('done');
      onTriggerToast({
        type: 'success',
        title: 'Source Imported',
        message: `${res.revision.textFileCount} text files stored (revision ${res.revision.shortDigest}).`,
      });
    } catch (exc) {
      setStep('upload');
      const msg = exc instanceof ApiError ? `${exc.code}: ${exc.message}` : 'Import failed.';
      setError(msg);
      onTriggerToast({ type: 'warning', title: 'Import Rejected', message: msg });
    }
  };

  const handleFinish = () => {
    if (projectId && revision) {
      onImported(projectId, revision, name.trim());
    }
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-subtle rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-container/30 rounded-t-2xl">
          <div>
            <h3 className="text-headline-sm text-text-primary">Import Source Project</h3>
            <p className="text-body-sm text-text-muted mt-0.5">
              Create a project and upload a source archive — static analysis only, never executed.
            </p>
          </div>
          <button onClick={handleClose} className="text-text-muted hover:text-text-primary transition-colors" aria-label="Close">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-status-critical/10 border border-status-critical/30 text-status-critical text-body-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {step === 'details' && (
            <>
              <div>
                <label className="block text-label-ui text-text-secondary mb-1.5" htmlFor="hf-project-name">
                  Project name
                </label>
                <input
                  id="hf-project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="acme-corp / core-api-service"
                  className="w-full bg-surface-container border border-border-subtle rounded-xl px-3.5 py-2.5 text-body-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-label-ui text-text-secondary mb-1.5" htmlFor="hf-project-desc">
                  Description
                </label>
                <textarea
                  id="hf-project-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Primary Go microservice handling payments…"
                  className="w-full bg-surface-container border border-border-subtle rounded-xl px-3.5 py-2.5 text-body-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-label-ui text-text-secondary mb-1.5" htmlFor="hf-project-runtime">
                  Primary runtime
                </label>
                <select
                  id="hf-project-runtime"
                  value={runtime}
                  onChange={(e) => setRuntime(e.target.value)}
                  className="w-full bg-surface-container border border-border-subtle rounded-xl px-3.5 py-2.5 text-body-md text-text-primary"
                >
                  {['Multi-language', 'python', 'javascript', 'typescript', 'go', 'rust', 'java'].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCreateProject}
                className="w-full rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold px-4 py-3 shadow-sm transition-colors"
              >
                Create Project & Continue
              </button>
            </>
          )}

          {step === 'upload' && projectId && (
            <>
              <div className="bg-surface-canvas border border-border-subtle rounded-xl p-4 space-y-2">
                <p className="text-label-ui text-text-secondary uppercase tracking-wider">Upload rules</p>
                <ul className="text-body-sm text-text-secondary space-y-1.5 list-disc pl-4">
                  <li>ZIP archive only, max {MAX_ARCHIVE_MB} MB, max 500 entries, 256 KB per text file.</li>
                  <li>Zip-slip, symlinks, absolute paths and archive bombs are rejected server-side.</li>
                  <li>Only text source files are stored (with SHA-256 digests); binaries are skipped.</li>
                  <li>Uploaded code is never executed — it is analyzed statically.</li>
                </ul>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border-subtle hover:border-primary/50 rounded-2xl p-8 text-center transition-colors"
              >
                <span className="material-symbols-outlined text-3xl text-primary mb-2 block">upload_file</span>
                <p className="text-body-md text-text-primary font-medium">
                  {file ? file.name : 'Choose a .zip source archive'}
                </p>
                {file && <p className="text-body-sm text-text-muted mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={handleImport}
                disabled={!file}
                className="w-full rounded-xl bg-primary hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed text-on-primary text-xs font-semibold px-4 py-3 shadow-sm transition-colors"
              >
                Import & Analyze Archive
              </button>
            </>
          )}

          {step === 'importing' && (
            <div className="py-10 text-center">
              <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-body-md text-text-secondary mt-4">Extracting and hashing source files server-side…</p>
            </div>
          )}

          {step === 'done' && revision && (
            <>
              <div className="bg-status-success/10 border border-status-success/30 rounded-xl p-4 space-y-2">
                <p className="flex items-center gap-2 text-body-md text-status-success font-medium">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Source imported successfully
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body-sm">
                  <dt className="text-text-muted">Revision digest</dt>
                  <dd className="font-mono text-label-code-sm break-all">{revision.shortDigest}…</dd>
                  <dt className="text-text-muted">Text files stored</dt>
                  <dd className="font-mono text-label-code-sm">{revision.textFileCount}</dd>
                  <dt className="text-text-muted">Total text bytes</dt>
                  <dd className="font-mono text-label-code-sm">{(revision.sizeBytes / 1024).toFixed(1)} KB</dd>
                  {revision.skipped && revision.skipped.length > 0 && (
                    <>
                      <dt className="text-text-muted">Skipped entries</dt>
                      <dd className="font-mono text-label-code-sm">{revision.skipped.length} (safety policy)</dd>
                    </>
                  )}
                </dl>
              </div>
              <button
                onClick={handleFinish}
                className="w-full rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold px-4 py-3 shadow-sm transition-colors"
              >
                Go to Project
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
