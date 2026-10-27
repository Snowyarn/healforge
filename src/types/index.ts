export type ScreenId =
  | 'home'
  // Group A — Workspace
  | 'dashboard'
  | 'repositories'
  | 'bug-report'
  | 'vulnerabilities'
  // Group B — AI Security Agent
  | 'security-scans'
  | 'code-explorer'
  | 'patch-review'
  | 'agent-activity'
  // Group C — Validation & Results
  | 'verification'
  | 'verified-fixes'
  | 'scan-history'
  | 'security-intelligence'
  | 'reports-audit'
  // Group D — Integrations & Configuration
  | 'integrations'
  | 'developer-api'
  | 'team-permissions'
  | 'notifications-settings'
  | 'account-privacy'
  | 'settings'
  | 'account-center';

export * from './account';

export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type ReachabilityStatus = 'Reachable' | 'Unreachable';
export type AutofixStatus = 'Ready' | 'Pending' | 'Applied' | 'Review Required';
export type PatchStatus = 'Pending Review' | 'Approved' | 'Rejected' | 'Changes Requested' | 'Applied';

export interface CodeLine {
  lineNumber: number;
  content: string;
  type?: 'neutral' | 'removed' | 'added' | 'comment';
  highlight?: boolean;
}

export interface ProjectDetail {
  id: string;
  name: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  primaryBranch: string;
  branches: string[];
  lastScanTime: string;
  scanStatus: 'healthy' | 'vulnerable' | 'scanning';
  openVulnCount: number;
  criticalCount: number;
  highCount: number;
  verificationStatus: 'verified' | 'pending' | 'failed';
  healthScore: number;
  description: string;
  runtime: string;
  headCommit: string;
}

export interface BugReport {
  id: string;
  title: string;
  description: string;
  category: 'Authentication' | 'Memory Safety' | 'SQL Injection' | 'Authorization Bypass' | 'Logic Flaw' | 'Other';
  severity: SeverityLevel;
  affectedRepo: string;
  affectedFile: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  status: 'In Triage' | 'Investigating' | 'Patch Synthesizing' | 'Resolved' | 'Closed';
  submittedAt: string;
  submittedBy: string;
}

export interface SecurityScanRecord {
  id: string;
  project: string;
  scanType: 'AST Static Analysis (SAST)' | 'Dependency Vulnerability (SBOM)' | 'Secret & Token Detection' | 'gVisor Container Config Audit';
  startTime: string;
  duration: string;
  status: 'Completed' | 'Running' | 'Queued' | 'Failed' | 'Cancelled';
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  trigger: 'Manual Scan' | 'CI/CD Webhook' | 'Scheduled Cron' | 'Pull Request Hook';
  commitHash: string;
  logs: string[];
}

export interface VerifiedFixItem {
  id: string;
  vulnerabilityId: string;
  title: string;
  project: string;
  patchId: string;
  verificationResult: '100% Tests Passed' | 'Partial Pass' | 'Regression Free';
  verificationTimestamp: string;
  reviewer: string;
  attestationHash: string;
  testsPassed: number;
  testsTotal: number;
  regressionRisk: 'Zero Regressions' | 'Low Risk' | 'Audited';
  evidenceReportUrl: string;
}

export interface CodeExplorerFile {
  path: string;
  name: string;
  type: 'file' | 'dir';
  children?: CodeExplorerFile[];
  language?: string;
  linesCount?: number;
  hasVulnerability?: boolean;
  vulnId?: string;
  codeSnippet?: CodeLine[];
}

export interface SecurityIntelligenceMetric {
  owaspCategories: { name: string; count: number; percentage: number }[];
  cweDistribution: { cwe: string; title: string; count: number }[];
  severityBreakdown: { severity: SeverityLevel; count: number }[];
  mttrHours: number;
  totalRemediated: number;
  averageVerificationTimeSec: number;
}

export interface SecurityReport {
  id: string;
  title: string;
  type: 'vulnerability-summary' | 'project-assessment' | 'scan-audit' | 'sandbox-attestation';
  generatedAt: string;
  project: string;
  author: string;
  summary: string;
  findingsCount: number;
  criticalCount: number;
  format: 'PDF' | 'Markdown' | 'JSON';
}

export interface Vulnerability {
  id: string; // e.g. 'CVE-2024-41110', 'CVE-2024-2149'
  cwe: string; // e.g. 'CWE-288: Authentication Bypass Using an Alternate Path'
  title: string;
  description: string;
  service: string; // 'auth-service', 'payments-api', 'ingestion-pipeline'
  repository: string;
  affectedFile: string;
  exactLines: string;
  discoveredBy: string;
  severity: SeverityLevel;
  cvssScore: number;
  reachability: ReachabilityStatus;
  autofixStatus: AutofixStatus;
  codeSnippet: {
    language: string;
    filePath: string;
    lines: string;
    code: CodeLine[];
  };
  taintSteps: {
    step: number;
    description: string;
    codeRef?: string;
    isCriticalSink?: boolean;
  }[];
  impactAnalysis: string;
  astPatch: {
    title: string;
    description: string;
    targetBranch: string;
    removedLines: string[];
    addedLines: string[];
  };
  compliance: {
    owasp: string;
    cvss: string;
    exploitability: string;
  };
}

export interface PatchItem {
  id: string; // e.g. 'AST #9402'
  vulnerabilityId: string;
  title: string;
  description: string;
  service: string;
  filePath: string;
  linesRange: string;
  addedLinesCount: number;
  removedLinesCount: number;
  status: PatchStatus;
  generatedAgo: string;
  generator: string;
  originalCode: CodeLine[];
  patchedCode: CodeLine[];
  astImpact: {
    taintSource: { label: string; param: string; desc: string };
    astMutation: { label: string; nodeType: string; desc: string };
    verificationStatus: { label: string; count: string; desc: string };
  };
  rationale: {
    syntaxConventions: string;
    dependencySafety: string;
    performanceImpact: string;
  };
  verificationLog: string[];
}

export interface VerificationStage {
  id: string;
  title: string;
  duration: string;
  description: string;
  status: 'passed' | 'running' | 'pending' | 'failed';
}

export interface TerminalLogLine {
  timestamp: string;
  level?: 'INFO' | 'NETWORKING' | 'MOUNT' | 'STATE' | 'SYSCALL' | 'DEFENSE' | 'TEST' | 'AST' | 'RESULT' | 'COMPLETE';
  text: string;
  type?: 'neutral' | 'success' | 'critical' | 'highlight' | 'muted';
}

export interface VerificationSession {
  patchId: string;
  status: 'Verified Safe & Neutralized' | 'Verifying...' | 'Regression Failed';
  containerId: string;
  containerRuntime: string;
  stages: VerificationStage[];
  statusTransition: {
    before: { status: string; desc: string };
    after: { status: string; desc: string };
  };
  attestation: {
    algorithm: string;
    signedBy: string;
    hash: string;
  };
  terminalLogs: TerminalLogLine[];
  metrics: {
    duration: string;
    exitCode: number;
  };
}

export interface AgentStage {
  name: string;
  status: 'completed' | 'running' | 'pending' | 'warning' | 'skipped';
  timing?: string;
  detail?: string;
}

export interface AgentExecutionLog {
  id: string; // e.g. '#EX-94821'
  severityBadge: string;
  severityType: 'critical' | 'success' | 'warning';
  service: string;
  title: string;
  startTime: string;
  commitHash: string;
  duration: string;
  stages: AgentStage[];
  artifacts?: { name: string; type: 'diff' | 'proof' }[];
  traceHeader: {
    title: string;
    status: string;
    statusType: 'success' | 'warning';
  };
  traceLines: string[];
}

export interface RepositoryHealth {
  name: string;
  runtime: string;
  icon: string;
  description: string;
  securityScore: number;
  criticalCount: number;
  highCount: number;
  headCommit?: string;
  status?: 'optimal' | 'critical';
}

export interface DashboardOverview {
  metrics: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    passRate: string;
  };
  repositories: RepositoryHealth[];
  remediationVelocity: {
    appliedPatches: string;
    passRate: string;
    avgTimeToFix: string;
    resolvedWeeklyCount: number;
  };
  recentAgentActivities: {
    id: string;
    icon: string;
    title: string;
    timeAgo: string;
    descriptionHtml: string;
  }[];
  activeSandboxSummary: {
    containerId: string;
    targetService: string;
    status: string;
    recentLogs: { text: string; type: 'success' | 'neutral' }[];
  };
}
