/**
 * HealForge typed API client.
 *
 * - Uses VITE_API_BASE_URL when set (public config, never a secret), otherwise
 *   same-origin relative "/api/v1" (dev proxy / reverse proxy).
 * - Cookies carry the session (HttpOnly). No tokens/keys are ever stored client-side.
 * - All model output / logs / code is treated as DATA (React escapes it; no raw HTML).
 */

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

function requestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function request<T>(
  method: string,
  path: string,
  opts: { json?: unknown; formData?: FormData; query?: Record<string, string | undefined> } = {},
): Promise<T> {
  const url = new URL(`${BASE}/api/v1${path}`, window.location.origin);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
  }
  const headers: Record<string, string> = { 'X-Request-ID': requestId() };
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (opts.formData) {
    body = opts.formData;
  }
  let resp: Response;
  try {
    resp = await fetch(url.toString(), {
      method,
      headers,
      body,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the HealForge backend. Is it running?');
  }
  if (resp.status === 204) return undefined as T;
  const text = await resp.text();
  let payload: unknown = undefined;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }
  if (!resp.ok) {
    // The backend uses one uniform envelope: {"error": {code, message, request_id}}.
    // (detail-wrapped errors are accepted for backward compatibility.)
    const asNew = (payload as { error?: { code?: string; message?: string } } | undefined)?.error;
    const asLegacy = (
      payload as { detail?: { error?: { code?: string; message?: string } } } | undefined
    )?.detail?.error;
    const err = asNew ?? asLegacy;
    if (resp.status === 401 && err?.code !== 'no_session' && err?.code !== 'invalid_credentials') {
      window.dispatchEvent(new CustomEvent('healforge:unauthorized'));
    }
    throw new ApiError(resp.status, err?.code || `http_${resp.status}`, err?.message || `Request failed (${resp.status})`);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, string | undefined>) => request<T>('GET', path, { query }),
  post: <T>(path: string, json?: unknown) => request<T>('POST', path, { json }),
  postForm: <T>(path: string, formData: FormData) => request<T>('POST', path, { formData }),
  patch: <T>(path: string, json?: unknown) => request<T>('PATCH', path, { json }),
  delete: <T>(path: string, json?: unknown) => request<T>('DELETE', path, { json }),
};

// ---------------------------------------------------------------------------
// Shared DTO shapes (mirror backend serializers; keep frontend types compatible)

export interface SessionInfo {
  user: { id: string; username: string; email: string; displayName: string; avatarInitials: string; role: string };
  workspace: { id: string; name: string };
  mode: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  provider: string;
  primaryBranch: string;
  branches: string[];
  lastScanTime: string;
  lastScanTimeIso: string | null;
  scanStatus: 'healthy' | 'vulnerable' | 'scanning';
  openVulnCount: number;
  criticalCount: number;
  highCount: number;
  verificationStatus: string;
  healthScore: number;
  description: string;
  runtime: string;
  headCommit: string;
  latestRevisionId: string | null;
  archived: boolean;
  createdAtIso: string | null;
  findings?: FindingDto[];
  scans?: ScanDto[];
  revisions?: RevisionDto[];
}

export interface RevisionDto {
  id: string;
  digest: string;
  shortDigest: string;
  archiveFilename: string;
  branchLabel: string;
  fileCount: number;
  textFileCount: number;
  sizeBytes: number;
  createdAt: string;
  createdAtIso?: string | null;
  skipped?: { path: string; reason: string; size?: number }[];
}

export interface ScanDto {
  id: string;
  project: string;
  projectId: string;
  scanType: string;
  startTime: string;
  startTimeIso: string | null;
  duration: string;
  status: 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  statusRaw: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount?: number;
  lowCount?: number;
  trigger: string;
  commitHash: string;
  revisionId: string;
  logs: string[];
  consentGranted: boolean;
  modelEnrichment: string;
  modelUsed?: string | null;
  error: { code: string; message: string } | null;
}

export interface CodeLineDto {
  lineNumber: number;
  content: string;
  type: string;
  highlight: boolean;
}

export interface FindingDto {
  id: string;
  internalId: string;
  cwe: string;
  title: string;
  description: string;
  service: string;
  repository: string;
  projectId: string;
  affectedFile: string;
  exactLines: string;
  discoveredBy: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  cvssScore: number;
  cvssBasis?: string;
  reachability: 'Reachable' | 'Unreachable';
  reachabilityBasis?: string;
  autofixStatus: string;
  status: string;
  confidence?: string;
  scanId?: string;
  revisionDigest?: string;
  discoveredAt: string;
  discoveredAtIso?: string | null;
  hasPatch: boolean;
  patchId: string | null;
  modelAnalysis?: {
    impact: string;
    recommendation: string;
    confidence: string;
    provenance: Record<string, unknown>;
    disclaimer: string;
  } | null;
  codeSnippet?: { language: string; filePath: string; lines: string; code: CodeLineDto[] };
  taintSteps?: { step: number; description: string; codeRef?: string; isCriticalSink?: boolean }[];
  impactAnalysis?: string;
  astPatch?: {
    title: string;
    description: string;
    targetBranch: string;
    removedLines: string[];
    addedLines: string[];
    patchId?: string;
    patchStatus?: string;
  };
  compliance?: { owasp: string; cvss: string; exploitability: string };
}

export interface PatchDto {
  id: string;
  vulnerabilityId: string;
  findingId: string;
  title: string;
  description: string;
  service: string;
  filePath: string;
  linesRange: string;
  addedLinesCount: number;
  removedLinesCount: number;
  status: 'Pending Review' | 'Approved' | 'Rejected' | 'Changes Requested' | 'Applied';
  statusRaw: string;
  version: number;
  generatedAgo: string;
  generatedAtIso: string | null;
  generator: string;
  originalCode: CodeLineDto[];
  patchedCode: CodeLineDto[];
  unifiedDiff?: string;
  astImpact: {
    taintSource: { label: string; param: string; desc: string };
    astMutation: { label: string; nodeType: string; desc: string };
    verificationStatus: { label: string; count: string; desc: string };
  };
  rationale: { syntaxConventions?: string; dependencySafety?: string; performanceImpact?: string };
  verificationLog: string[];
  reviews: { action: string; notes: string; actor: string; at: string | null }[];
  verificationRuns: { id: string; mode: string; status: string; createdAt: string | null; evidenceDigest: string }[];
}

export interface VerificationStatusDto {
  execution_available: boolean;
  execution_status: string;
  reason: string;
  static_reanalysis_available: boolean;
  policy: {
    isolation_boundary: string;
    runner_type: string | null;
    would_be_policy: {
      runtime: string;
      identity: string;
      image: string;
      filesystem: string;
      network: string;
      resource_caps: Record<string, string>;
      commands: string;
      cleanup: string;
    };
    host_execution: string;
  };
  host_execution_forbidden: boolean;
}

export interface VerificationRunDto {
  id: string;
  patchId: string;
  patchStatus?: string | null;
  mode: 'execution' | 'static_reanalysis';
  status: string;
  reason: string;
  policy: Record<string, unknown>;
  checks: { name: string; kind: string; passed: boolean; detail: string }[];
  disclaimer: string;
  evidenceDigest: string;
  createdAt: string | null;
  finishedAt: string | null;
  evidenceAvailable: boolean;
}

export interface AgentExecutionDto {
  id: string;
  internalId: string;
  severityBadge: string;
  severityType: 'critical' | 'success' | 'warning';
  service: string;
  title: string;
  startTime: string;
  startTimeIso: string | null;
  commitHash: string;
  duration: string;
  stages: { name: string; status: string; timing?: string; detail?: string }[];
  artifacts?: { name: string; type: string }[];
  traceHeader: { title: string; status: string; statusType: 'success' | 'warning' };
  traceLines: string[];
}

export interface VerifiedFixDto {
  id: string;
  vulnerabilityId: string;
  title: string;
  project: string;
  patchId: string;
  verificationResult: string;
  verificationTimestamp: string;
  verificationTimestampIso: string | null;
  reviewer: string;
  attestationHash: string;
  attestationKind: string;
  testsPassed: number;
  testsTotal: number;
  checksKind: string;
  regressionRisk: string;
  evidenceReportUrl: string;
  mode: string;
}

export interface IntelligenceDto {
  owaspCategories: { name: string; count: number; percentage: number }[];
  cweDistribution: { cwe: string; title: string; count: number }[];
  severityBreakdown: { severity: string; count: number }[];
  mttrHours: number;
  totalRemediated: number;
  averageVerificationTimeSec: number;
  totalFindings: number;
  hasData: boolean;
}

export interface DashboardDto {
  metrics: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    passRate: string;
    projectCount: number;
    scanCount: number;
    openFindingCount: number;
    pendingReviewCount: number;
    verifiedFixCount: number;
    regressionCount: number;
  };
  repositories: {
    name: string;
    runtime: string;
    icon: string;
    description: string;
    securityScore: number;
    criticalCount: number;
    highCount: number;
    headCommit?: string;
    status?: 'optimal' | 'critical';
    projectId: string;
  }[];
  remediationVelocity: { appliedPatches: string; passRate: string; avgTimeToFix: string; resolvedWeeklyCount: number };
  recentAgentActivities: { id: string; icon: string; title: string; timeAgo: string; description: string }[];
  activeSandboxSummary: {
    containerId: string;
    targetService: string;
    status: string;
    recentLogs: { text: string; type: 'success' | 'neutral' }[];
  };
}

export interface ReportDto {
  id: string;
  title: string;
  type: string;
  generatedAt: string;
  generatedAtIso: string | null;
  project: string | null;
  author: string;
  summary: string;
  findingsCount: number;
  criticalCount: number;
  format: 'PDF' | 'Markdown' | 'JSON';
  checksThatRan: string[];
}

export interface BugReportDto {
  id: string;
  internalId: string;
  title: string;
  description: string;
  category: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  affectedRepo: string;
  affectedFile: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  status: string;
  submittedAt: string;
  submittedAtIso: string | null;
  submittedBy: string;
  evidenceName: string | null;
  hasEvidence: boolean;
}

export interface FileNodeDto {
  path: string;
  name: string;
  type: 'file' | 'dir';
  children?: FileNodeDto[];
  language?: string;
  linesCount?: number;
  hasVulnerability?: boolean;
  vulnId?: string | null;
  findingId?: string | null;
  internalFileId?: string;
  codeSnippet?: CodeLineDto[];
}

export interface AuditEventDto {
  id: string;
  category: string;
  action: string;
  description: string;
  timestamp: string;
  timestampIso: string | null;
  actor: string;
  ip: string;
  status: string;
}

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  icon: string;
  linkScreen: string;
  read: boolean;
  createdAt: string | null;
}

export interface NvidiaStatusDto {
  configured: boolean;
  provider: string;
  base_url: string;
  model_id: string;
  prompt_schema_version: string;
  note: string;
}

export interface CountsDto {
  repositories: number;
  vulnerabilities: number;
  patchReviews: number;
  verifiedFixes: number;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers

export const endpoints = {
  session: () => api.get<SessionInfo>('/auth/session'),
  login: (body: { email: string; password: string }) => api.post<SessionInfo>('/auth/login', body),
  register: (body: { email: string; username: string; password: string }) =>
    api.post<SessionInfo>('/auth/register', body),
  nvidiaStatus: () => api.get<NvidiaStatusDto>('/nvidia/status'),
  counts: () => api.get<CountsDto>('/counts'),

  projects: (q?: string) => api.get<{ projects: ProjectDto[] }>('/projects', { q }),
  project: (id: string) => api.get<{ project: ProjectDto }>(`/projects/${id}`),
  createProject: (body: { name: string; description?: string; runtime?: string; primaryBranch?: string }) =>
    api.post<{ project: ProjectDto }>('/projects', body),
  patchProject: (id: string, body: { description?: string; primaryBranch?: string }) =>
    api.patch<{ project: ProjectDto }>(`/projects/${id}`, body),
  archiveProject: (id: string) => api.delete<{ ok: boolean }>(`/projects/${id}`),
  uploadSource: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.postForm<{ revision: RevisionDto; filesWithPossibleSecrets: number }>(
      `/projects/${projectId}/sources`, fd);
  },
  listSources: (projectId: string) => api.get<{ revisions: RevisionDto[] }>(`/projects/${projectId}/sources`),
  fileTree: (projectId: string, revisionId?: string) =>
    api.get<{ revisionId: string; revisionDigest: string; tree: FileNodeDto[] }>(`/projects/${projectId}/files`,
      { revision_id: revisionId }),
  fileContent: (projectId: string, path: string, revisionId?: string) =>
    api.get<{
      path: string; language: string; linesCount: number; codeSnippet: CodeLineDto[];
      findings: { id: string; internalId: string; title: string; severity: string; lineStart: number; lineEnd: number; cwe: string; cvssScore: number; description: string }[];
    }>(`/projects/${projectId}/files/content`, { path, revision_id: revisionId }),

  createScan: (body: {
    projectId: string; revisionId?: string; scanType: string;
    options: { taintFlow?: boolean; cveCorrelation?: boolean; modelEnrichment?: boolean };
    consent?: { granted?: boolean; redactionAcknowledged?: boolean };
  }) => api.post<{ scanId: string; status: string; poll: string }>('/scans', body),
  scans: (projectId?: string, q?: string) => api.get<{ scans: ScanDto[] }>('/scans', { projectId, q }),
  scan: (id: string) => api.get<{ scan: ScanDto }>(`/scans/${id}`),
  scanFindings: (id: string) => api.get<{ scanId: string; status: string; findings: FindingDto[] }>(`/scans/${id}/findings`),
  scanDiff: (scanAId: string, scanBId: string) =>
    api.post<{ scanA: { id: string; findingsCount: number }; scanB: { id: string; findingsCount: number }; resolved: number; new: number; persistent: number }>('/scans/diff', { scanAId, scanBId }),

  findings: (params?: { status?: string; severity?: string; projectId?: string; q?: string }) =>
    api.get<{ findings: FindingDto[] }>('/findings', params as Record<string, string | undefined>),
  finding: (id: string) => api.get<{ finding: FindingDto }>(`/findings/${id}`),
  requestPatch: (findingId: string) =>
    api.post<{ patchId: string; status: string; generator?: string }>(`/findings/${findingId}/patch-request`),

  patches: (findingId?: string) => api.get<{ patches: PatchDto[] }>('/patches', { findingId }),
  patch: (id: string) => api.get<{ patch: PatchDto }>(`/patches/${id}`),
  reviewPatch: (id: string, action: 'approve' | 'reject' | 'request_changes', notes: string, expectedVersion: number) =>
    api.post<{ patch: PatchDto }>(`/patches/${id}/review`, { action, notes, expectedVersion }),

  verificationStatus: () => api.get<VerificationStatusDto>('/verification/status'),
  verificationRuns: (patchId?: string) => api.get<{ runs: VerificationRunDto[] }>('/verification-runs', { patchId }),
  createVerificationRun: (patchId: string, mode: 'execution' | 'static_reanalysis') =>
    api.post<{ run: VerificationRunDto }>('/verification-runs', { patchId, mode }),
  verificationEvidenceUrl: (runId: string) => `${BASE}/api/v1/verification-runs/${runId}/evidence`,

  dashboard: () => api.get<DashboardDto>('/dashboard/overview'),
  agentExecutions: (stream?: string, severity?: string, q?: string) =>
    api.get<{ executions: AgentExecutionDto[] }>('/agent-executions', { stream, severity, q }),
  agentTelemetry: () => api.get<{
    activeAgents: number; successRate: string; runsPerHour: number; totalExecutions: number;
    monitoredRepos: { name: string; runtime: string; projectId: string }[]; workerNode: string;
  }>('/agent-activity/telemetry'),
  engineState: () => api.get<{ paused: boolean }>('/engine'),
  enginePause: () => api.post<{ paused: boolean }>('/engine/pause'),
  engineResume: () => api.post<{ paused: boolean }>('/engine/resume'),
  verifiedFixes: (q?: string) => api.get<{ fixes: VerifiedFixDto[]; note: string }>('/verified-fixes', { q }),
  intelligence: () => api.get<IntelligenceDto>('/security-intelligence/metrics'),

  bugReports: () => api.get<{ reports: BugReportDto[] }>('/bug-reports'),
  createBugReport: (body: Record<string, unknown>) => api.post<{ report: BugReportDto }>('/bug-reports', body),
  attachEvidence: (reportId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.postForm<{ ok: boolean; evidenceName: string; sha256: string }>(`/bug-reports/${reportId}/evidence`, fd);
  },

  reports: () => api.get<{ reports: ReportDto[] }>('/reports'),
  createReport: (body: { type: string; format: string; projectId?: string; scanId?: string }) =>
    api.post<{ report: ReportDto }>('/reports', body),
  reportDownloadUrl: (id: string) => `${BASE}/api/v1/reports/${id}/download`,
  scansExportUrl: () => `${BASE}/api/v1/scans/export`,

  auditEvents: (category?: string, q?: string) =>
    api.get<{ events: AuditEventDto[] }>('/audit-events', { category, q }),
  notifications: () => api.get<{ notifications: NotificationDto[]; unread: number }>('/notifications'),
  markNotificationRead: (id: string) => api.post<{ ok: boolean }>(`/notifications/${id}/read`),
  markAllNotificationsRead: () => api.post<{ ok: boolean }>('/notifications/read-all'),

  accountState: () => api.get<Record<string, unknown>>('/account/state'),
  account: {
    updateProfile: (body: Record<string, unknown>) => api.patch<{ ok: boolean }>('/account/profile', body),
    requestEmailChange: (newEmail: string) =>
      api.post<{ ok: boolean; deliveryConfigured: boolean; message: string }>('/account/email/change', { newEmail }),
    cancelPendingEmail: () => api.delete<{ ok: boolean }>('/account/email/pending'),
    changePassword: (currentPassword: string, newPassword: string) =>
      api.post<{ ok: boolean }>('/account/password', { currentPassword, newPassword }),
    mfaStart: () => api.post<{ secret: string; uri: string; note: string }>('/account/mfa/totp/start'),
    mfaEnable: (code: string) =>
      api.post<{ ok: boolean; recoveryCodes: string[]; note: string }>('/account/mfa/totp/enable', { code }),
    mfaDisable: (code: string) => api.post<{ ok: boolean }>('/account/mfa/disable', { code }),
    regenerateRecoveryCodes: () =>
      api.post<{ recoveryCodes: string[]; note: string }>('/account/mfa/recovery-codes'),
    sessions: () => api.get<{ sessions: unknown[] }>('/account/sessions'),
    revokeSession: (id: string) => api.delete<{ ok: boolean }>(`/account/sessions/${id}`),
    revokeOtherSessions: () => api.post<{ ok: boolean; revoked: number }>('/account/sessions/revoke-others'),
    apiKeys: () => api.get<{ apiKeys: unknown[] }>('/account/api-keys'),
    createApiKey: (name: string, scopes: string[], expiryDays: number) =>
      api.post<{ id: string; key: string; prefix: string; note: string }>('/account/api-keys',
        { name, scopes, expiryDays }),
    revokeApiKey: (id: string) => api.delete<{ ok: boolean }>(`/account/api-keys/${id}`),
    webhooks: () => api.get<{ webhooks: unknown[] }>('/account/webhooks'),
    createWebhook: (url: string, events: string[]) =>
      api.post<{ webhook: { id: string; url: string; events: string[]; deliveryConfigured: boolean } }>(
        '/account/webhooks', { url, events }),
    deleteWebhook: (id: string) => api.delete<{ ok: boolean }>(`/account/webhooks/${id}`),
    integrations: () => api.get<{ integrations: unknown[] }>('/account/integrations'),
    team: () => api.get<{ team: unknown[]; emailDeliveryConfigured: boolean }>('/account/team'),
    inviteMember: (name: string, email: string, role: string) =>
      api.post<{ member: unknown; emailSent: boolean; inviteUrl?: string; note?: string }>(
        '/account/team',
        { name, email, role },
      ),
    updateMemberRole: (id: string, role: string) => api.patch<{ ok: boolean }>(`/account/team/${id}`, { role }),
    removeMember: (id: string) => api.delete<{ ok: boolean }>(`/account/team/${id}`),
    updatePreferences: (body: Record<string, unknown>) => api.patch<{ ok: boolean }>('/account/preferences', body),
    updateNotificationPrefs: (body: Record<string, unknown>) =>
      api.patch<{ ok: boolean }>('/account/notifications', body),
    updatePrivacyPrefs: (body: Record<string, unknown>) => api.patch<{ ok: boolean }>('/account/privacy', body),
    billing: () => api.get<{ configured: boolean; status: string; message: string }>('/account/billing'),
    exportUrl: () => `${BASE}/api/v1/account/export`,
    deactivate: () => api.post<{ ok: boolean }>('/account/deactivate'),
    deleteAccount: () => api.delete<{ ok: boolean }>('/account'),
  },
};
