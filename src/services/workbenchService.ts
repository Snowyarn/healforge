/**
 * Workbench service — BACKEND-BACKED.
 *
 * All data comes from the real API (see api.ts). There are no fixtures here:
 * every list/detail reflects persisted server records. Methods keep names close
 * to the legacy service, but now return plain data and throw ApiError on failure.
 */
import type {
  AgentExecutionLog,
  BugReport,
  DashboardOverview,
  FindingDtoLike,
  PatchItem,
  ProjectDetail,
  RepositoryHealth,
  ScanDraft,
  SecurityIntelligenceMetric,
  SecurityReport,
  SecurityScanRecord,
  VerificationSessionLike,
  VerifiedFixItem,
} from './workbenchTypes';
import { ApiError, endpoints } from './api';
import type {
  AgentExecutionDto,
  BugReportDto,
  DashboardDto,
  FindingDto,
  IntelligenceDto,
  PatchDto,
  ProjectDto,
  ReportDto,
  ScanDto,
  VerificationRunDto,
  VerifiedFixDto,
} from './api';

export type { FindingDtoLike, ScanDraft, VerificationSessionLike };

// ---------------------------------------------------------------------------
// DTO -> legacy-view mapping (screens keep their expected shapes)

export function mapProject(p: ProjectDto): ProjectDetail {
  return {
    id: p.id,
    name: p.name,
    provider: (p.provider === 'zip-archive' ? 'github' : p.provider) as ProjectDetail['provider'],
    primaryBranch: p.primaryBranch,
    branches: p.branches,
    lastScanTime: p.lastScanTime,
    scanStatus: p.scanStatus,
    openVulnCount: p.openVulnCount,
    criticalCount: p.criticalCount,
    highCount: p.highCount,
    verificationStatus: (p.verificationStatus === 'verified' ? 'verified' : 'pending') as ProjectDetail['verificationStatus'],
    healthScore: p.healthScore,
    description: p.description,
    runtime: p.runtime,
    headCommit: p.headCommit,
  };
}

export function mapFinding(f: FindingDto): FindingDtoLike {
  return {
    id: f.id,
    internalId: f.internalId,
    cwe: f.cwe,
    title: f.title,
    description: f.description,
    service: f.service,
    repository: f.repository,
    projectId: f.projectId,
    affectedFile: f.affectedFile,
    exactLines: f.exactLines,
    discoveredBy: f.discoveredBy,
    severity: f.severity,
    cvssScore: f.cvssScore,
    cvssBasis: f.cvssBasis,
    reachability: f.reachability,
    reachabilityBasis: f.reachabilityBasis,
    autofixStatus: mapAutofix(f),
    status: f.status,
    confidence: f.confidence,
    discoveredAt: f.discoveredAt,
    hasPatch: f.hasPatch,
    patchId: f.patchId,
    modelAnalysis: f.modelAnalysis ?? null,
    codeSnippet: f.codeSnippet
      ? {
          language: f.codeSnippet.language,
          filePath: f.codeSnippet.filePath,
          lines: f.codeSnippet.lines,
          code: f.codeSnippet.code as unknown as import('../types').CodeLine[],
        }
      : null,
    taintSteps: f.taintSteps ?? [],
    impactAnalysis: f.impactAnalysis ?? f.description,
    astPatch: (f.astPatch ?? null) as FindingDtoLike['astPatch'],
    compliance: f.compliance ?? { owasp: '—', cvss: '—', exploitability: '—' },
  };
}

function mapAutofix(f: FindingDto) {
  if (f.status === 'resolved') return 'Applied' as const;
  if (f.hasPatch) return 'Review Required' as const;
  return 'Pending' as const;
}

export function mapScan(s: ScanDto): SecurityScanRecord {
  return {
    id: s.id,
    project: s.project,
    scanType: s.scanType as SecurityScanRecord['scanType'],
    startTime: s.startTime,
    duration: s.duration,
    status: s.status,
    findingsCount: s.findingsCount,
    criticalCount: s.criticalCount,
    highCount: s.highCount,
    trigger: s.trigger as SecurityScanRecord['trigger'],
    commitHash: s.commitHash,
    logs: s.logs,
    statusRaw: s.statusRaw,
    modelEnrichment: s.modelEnrichment,
    error: s.error,
    projectId: s.projectId,
  };
}

export function mapBugReport(b: BugReportDto): BugReport {
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    category: b.category as BugReport['category'],
    severity: b.severity,
    affectedRepo: b.affectedRepo,
    affectedFile: b.affectedFile,
    stepsToReproduce: b.stepsToReproduce,
    expectedBehavior: b.expectedBehavior,
    actualBehavior: b.actualBehavior,
    status: b.status as BugReport['status'],
    submittedAt: b.submittedAt,
    submittedBy: b.submittedBy,
  };
}

export function mapPatch(p: PatchDto): PatchItem {
  return {
    id: p.id,
    vulnerabilityId: p.vulnerabilityId,
    title: p.title,
    description: p.description,
    service: p.service,
    filePath: p.filePath,
    linesRange: p.linesRange,
    addedLinesCount: p.addedLinesCount,
    removedLinesCount: p.removedLinesCount,
    status: p.status,
    statusRaw: p.statusRaw,
    version: p.version,
    generatedAgo: p.generatedAgo,
    generator: p.generator,
    originalCode: p.originalCode as PatchItem['originalCode'],
    patchedCode: p.patchedCode as PatchItem['patchedCode'],
    astImpact: p.astImpact,
    rationale: {
      syntaxConventions: p.rationale?.syntaxConventions ?? '',
      dependencySafety: p.rationale?.dependencySafety ?? '',
      performanceImpact: p.rationale?.performanceImpact ?? '',
    },
    verificationLog: p.verificationLog,
    reviews: p.reviews,
    findingId: p.findingId,
  };
}

export function mapVerifiedFix(f: VerifiedFixDto): VerifiedFixItem {
  return {
    id: f.id,
    vulnerabilityId: f.vulnerabilityId,
    title: f.title,
    project: f.project,
    patchId: f.patchId,
    verificationResult: f.verificationResult as VerifiedFixItem['verificationResult'],
    verificationTimestamp: f.verificationTimestamp,
    reviewer: f.reviewer,
    attestationHash: f.attestationHash,
    attestationKind: f.attestationKind,
    testsPassed: f.testsPassed,
    testsTotal: f.testsTotal,
    checksKind: f.checksKind,
    regressionRisk: f.regressionRisk as VerifiedFixItem['regressionRisk'],
    evidenceReportUrl: f.evidenceReportUrl,
    mode: f.mode,
    internalRunId: f.id,
  };
}

export function mapAgentExecution(a: AgentExecutionDto): AgentExecutionLog {
  return {
    id: a.id,
    severityBadge: a.severityBadge,
    severityType: a.severityType,
    service: a.service,
    title: a.title,
    startTime: a.startTime,
    commitHash: a.commitHash,
    duration: a.duration,
    stages: (a.stages as AgentExecutionLog['stages']) ?? [],
    artifacts: a.artifacts as AgentExecutionLog['artifacts'],
    traceHeader: a.traceHeader,
    traceLines: a.traceLines,
  };
}

export function mapIntelligence(m: IntelligenceDto): SecurityIntelligenceMetric {
  return {
    owaspCategories: m.owaspCategories,
    cweDistribution: m.cweDistribution,
    severityBreakdown: m.severityBreakdown.map((s) => ({
      severity: s.severity as 'Critical' | 'High' | 'Medium' | 'Low',
      count: s.count,
    })),
    mttrHours: m.mttrHours,
    totalRemediated: m.totalRemediated,
    averageVerificationTimeSec: m.averageVerificationTimeSec,
    totalFindings: m.totalFindings,
    hasData: m.hasData,
  };
}

export function mapReport(r: ReportDto): SecurityReport {
  return {
    id: r.id,
    title: r.title,
    type: r.type as SecurityReport['type'],
    generatedAt: r.generatedAt,
    project: r.project ?? 'Workspace',
    author: r.author,
    summary: r.summary,
    findingsCount: r.findingsCount,
    criticalCount: r.criticalCount,
    format: r.format,
    checksThatRan: r.checksThatRan,
  };
}

export function mapDashboard(d: DashboardDto): DashboardOverview {
  return {
    metrics: {
      criticalCount: d.metrics.criticalCount,
      highCount: d.metrics.highCount,
      mediumCount: d.metrics.mediumCount,
      passRate: d.metrics.passRate,
      projectCount: d.metrics.projectCount,
      scanCount: d.metrics.scanCount,
      openFindingCount: d.metrics.openFindingCount,
      pendingReviewCount: d.metrics.pendingReviewCount,
      verifiedFixCount: d.metrics.verifiedFixCount,
      regressionCount: d.metrics.regressionCount,
    },
    repositories: d.repositories as RepositoryHealth[],
    remediationVelocity: d.remediationVelocity,
    recentAgentActivities: d.recentAgentActivities.map((x) => ({ ...x, descriptionHtml: x.description })),
    activeSandboxSummary: d.activeSandboxSummary,
  };
}

// ---------------------------------------------------------------------------
// Service

class WorkbenchService {
  async getDashboardOverview(): Promise<DashboardOverview> {
    return mapDashboard(await endpoints.dashboard());
  }

  async getRepositories(): Promise<RepositoryHealth[]> {
    const { projects } = await endpoints.projects();
    return projects.map(
      (p) =>
        ({
          name: p.name,
          runtime: p.runtime,
          icon: 'hub',
          description: p.description,
          securityScore: p.healthScore,
          criticalCount: p.criticalCount,
          highCount: p.highCount,
          headCommit: p.headCommit,
          status: p.criticalCount > 0 ? ('critical' as const) : ('optimal' as const),
          projectId: p.id,
        }) as RepositoryHealth & { projectId: string },
    );
  }

  async getProjects(): Promise<ProjectDetail[]> {
    const { projects } = await endpoints.projects();
    return projects.map(mapProject);
  }

  async getBugReports(): Promise<BugReport[]> {
    const { reports } = await endpoints.bugReports();
    return reports.map(mapBugReport);
  }

  async submitBugReport(
    report: Omit<BugReport, 'id' | 'status' | 'submittedAt' | 'submittedBy'> & { projectId?: string },
  ): Promise<BugReport> {
    const { report: created } = await endpoints.createBugReport(report as unknown as Record<string, unknown>);
    return mapBugReport(created);
  }

  async getSecurityScans(projectId?: string): Promise<SecurityScanRecord[]> {
    const { scans } = await endpoints.scans(projectId);
    return scans.map(mapScan);
  }

  async triggerSecurityScan(draft: ScanDraft): Promise<{ scanId: string }> {
    return endpoints.createScan({
      projectId: draft.projectId,
      revisionId: draft.revisionId,
      scanType: draft.scanType,
      options: {
        taintFlow: draft.taintFlow,
        cveCorrelation: draft.cveCorrelation,
        modelEnrichment: draft.modelEnrichment,
      },
      consent: {
        granted: draft.consentGranted,
        redactionAcknowledged: draft.consentGranted,
      },
    });
  }

  async getScan(scanId: string): Promise<SecurityScanRecord> {
    const { scan } = await endpoints.scan(scanId);
    return mapScan(scan);
  }

  async getVerifiedFixes(q?: string): Promise<VerifiedFixItem[]> {
    const { fixes } = await endpoints.verifiedFixes(q);
    return fixes.map(mapVerifiedFix);
  }

  async getIntelligenceMetrics(): Promise<SecurityIntelligenceMetric> {
    return mapIntelligence(await endpoints.intelligence());
  }

  async getReports(): Promise<SecurityReport[]> {
    const { reports } = await endpoints.reports();
    return reports.map(mapReport);
  }

  async getVulnerabilities(): Promise<FindingDtoLike[]> {
    const { findings } = await endpoints.findings({ status: 'open' });
    return findings.map(mapFinding);
  }

  async getVulnerabilityById(id: string): Promise<FindingDtoLike | null> {
    try {
      const { finding } = await endpoints.finding(id);
      return mapFinding(finding);
    } catch (exc) {
      if (exc instanceof ApiError && exc.status === 404) return null;
      throw exc;
    }
  }

  async requestPatchForFinding(findingInternalId: string): Promise<{ patchId: string; status: string }> {
    return endpoints.requestPatch(findingInternalId);
  }

  async getPatch(patchId?: string): Promise<PatchItem | null> {
    if (patchId) {
      const { patch } = await endpoints.patch(patchId);
      return mapPatch(patch);
    }
    const { patches } = await endpoints.patches();
    if (!patches.length) return null;
    // Most relevant: newest pending review, else newest.
    const pending = patches.find((p) => p.statusRaw === 'pending_review') ?? patches[0];
    return mapPatch(pending);
  }

  async reviewPatch(
    patchId: string,
    action: 'approve' | 'reject' | 'request_changes',
    notes: string,
    expectedVersion: number,
  ): Promise<PatchItem> {
    const { patch } = await endpoints.reviewPatch(patchId, action, notes, expectedVersion);
    return mapPatch(patch);
  }

  async getVerificationStatus() {
    return endpoints.verificationStatus();
  }

  async getVerificationRuns(patchId?: string): Promise<VerificationRunDto[]> {
    const { runs } = await endpoints.verificationRuns(patchId);
    return runs;
  }

  async createVerificationRun(
    patchId: string,
    mode: 'execution' | 'static_reanalysis',
  ): Promise<VerificationRunDto> {
    const { run } = await endpoints.createVerificationRun(patchId, mode);
    return run;
  }

  async getAgentExecutions(): Promise<AgentExecutionLog[]> {
    const { executions } = await endpoints.agentExecutions();
    return executions.map(mapAgentExecution);
  }
}

export const workbenchService = new WorkbenchService();
export { ApiError };
