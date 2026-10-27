import type {
  Vulnerability,
  PatchItem,
  PatchStatus,
  VerificationSession,
  AgentExecutionLog,
  DashboardOverview,
  RepositoryHealth,
  ProjectDetail,
  BugReport,
  SecurityScanRecord,
  VerifiedFixItem,
  CodeExplorerFile,
  SecurityIntelligenceMetric,
  SecurityReport,
} from '../types';
import {
  mockDashboardOverview,
  mockRepositories,
  mockVulnerabilities,
  mockPatchItem,
  mockVerificationSession,
  mockAgentExecutions,
  mockProjects,
  mockBugReports,
  mockSecurityScans,
  mockVerifiedFixes,
  mockCodeFiles,
  mockIntelligenceMetric,
  mockReports,
} from './mockData';

export interface ServiceOperationResult<T> {
  data: T;
  isMock: true;
  simulatedLatencyMs: number;
}

class WorkbenchService {
  private vulnerabilities: Vulnerability[] = [...mockVulnerabilities];
  private patch: PatchItem = { ...mockPatchItem };
  private verification: VerificationSession = { ...mockVerificationSession };
  private agentExecutions: AgentExecutionLog[] = [...mockAgentExecutions];
  private projects: ProjectDetail[] = [...mockProjects];
  private bugReports: BugReport[] = [...mockBugReports];
  private scans: SecurityScanRecord[] = [...mockSecurityScans];
  private verifiedFixes: VerifiedFixItem[] = [...mockVerifiedFixes];

  async getDashboardOverview(): Promise<ServiceOperationResult<DashboardOverview>> {
    return {
      data: {
        ...mockDashboardOverview,
        repositories: [...mockRepositories],
      },
      isMock: true,
      simulatedLatencyMs: 80,
    };
  }

  async getRepositories(): Promise<ServiceOperationResult<RepositoryHealth[]>> {
    return {
      data: [...mockRepositories],
      isMock: true,
      simulatedLatencyMs: 60,
    };
  }

  async getProjects(): Promise<ServiceOperationResult<ProjectDetail[]>> {
    return {
      data: [...this.projects],
      isMock: true,
      simulatedLatencyMs: 50,
    };
  }

  async getBugReports(): Promise<ServiceOperationResult<BugReport[]>> {
    return {
      data: [...this.bugReports],
      isMock: true,
      simulatedLatencyMs: 40,
    };
  }

  async submitBugReport(report: Omit<BugReport, 'id' | 'status' | 'submittedAt' | 'submittedBy'>): Promise<ServiceOperationResult<BugReport>> {
    const newReport: BugReport = {
      ...report,
      id: `BUG-${Math.floor(400 + this.bugReports.length + 1)}`,
      status: 'In Triage',
      submittedAt: 'Just now',
      submittedBy: 'Alex Vance (Security Engineer)',
    };
    this.bugReports = [newReport, ...this.bugReports];
    return {
      data: newReport,
      isMock: true,
      simulatedLatencyMs: 120,
    };
  }

  async getSecurityScans(): Promise<ServiceOperationResult<SecurityScanRecord[]>> {
    return {
      data: [...this.scans],
      isMock: true,
      simulatedLatencyMs: 60,
    };
  }

  async triggerSecurityScan(project: string, scanType: SecurityScanRecord['scanType']): Promise<ServiceOperationResult<SecurityScanRecord>> {
    const newScan: SecurityScanRecord = {
      id: `SC-${Math.floor(9405 + this.scans.length)}`,
      project,
      scanType,
      startTime: 'Just now',
      duration: 'In progress',
      status: 'Running',
      findingsCount: 0,
      criticalCount: 0,
      highCount: 0,
      trigger: 'Manual Scan',
      commitHash: 'head-c42e',
      logs: [
        `[START] Triggered ${scanType} on ${project}...`,
        '[INFO] Parsing AST syntax trees across project workspace...',
        '[TAINT] Ingesting source code flows into engine...',
      ],
    };
    this.scans = [newScan, ...this.scans];
    return {
      data: newScan,
      isMock: true,
      simulatedLatencyMs: 200,
    };
  }

  async getVerifiedFixes(): Promise<ServiceOperationResult<VerifiedFixItem[]>> {
    return {
      data: [...this.verifiedFixes],
      isMock: true,
      simulatedLatencyMs: 50,
    };
  }

  async getCodeExplorerFiles(_project?: string): Promise<ServiceOperationResult<CodeExplorerFile[]>> {
    // Return sample AST file tree
    return {
      data: mockCodeFiles.map((f) => ({ ...f, name: `${f.name}` })),
      isMock: true,
      simulatedLatencyMs: 60,
    };
  }

  async getIntelligenceMetrics(): Promise<ServiceOperationResult<SecurityIntelligenceMetric>> {
    return {
      data: { ...mockIntelligenceMetric },
      isMock: true,
      simulatedLatencyMs: 70,
    };
  }

  async getReports(): Promise<ServiceOperationResult<SecurityReport[]>> {
    return {
      data: [...mockReports],
      isMock: true,
      simulatedLatencyMs: 50,
    };
  }

  async getVulnerabilities(): Promise<ServiceOperationResult<Vulnerability[]>> {
    return {
      data: [...this.vulnerabilities],
      isMock: true,
      simulatedLatencyMs: 70,
    };
  }

  async getVulnerabilityById(id: string): Promise<ServiceOperationResult<Vulnerability | undefined>> {
    const finding = this.vulnerabilities.find((v) => v.id.toLowerCase() === id.toLowerCase());
    return {
      data: finding ? { ...finding } : this.vulnerabilities[0],
      isMock: true,
      simulatedLatencyMs: 50,
    };
  }

  async getPatch(): Promise<ServiceOperationResult<PatchItem>> {
    return {
      data: { ...this.patch },
      isMock: true,
      simulatedLatencyMs: 60,
    };
  }

  async updatePatchStatus(status: PatchStatus): Promise<ServiceOperationResult<PatchItem>> {
    this.patch = {
      ...this.patch,
      status,
    };
    return {
      data: { ...this.patch },
      isMock: true,
      simulatedLatencyMs: 150,
    };
  }

  async getVerificationSession(): Promise<ServiceOperationResult<VerificationSession>> {
    return {
      data: { ...this.verification },
      isMock: true,
      simulatedLatencyMs: 90,
    };
  }

  async rerunVerification(): Promise<ServiceOperationResult<VerificationSession>> {
    const updatedStages = this.verification.stages.map((stage) => ({
      ...stage,
      status: 'passed' as const,
    }));

    this.verification = {
      ...this.verification,
      status: 'Verified Safe & Neutralized',
      stages: updatedStages,
    };

    return {
      data: { ...this.verification },
      isMock: true,
      simulatedLatencyMs: 600,
    };
  }

  async getAgentExecutions(): Promise<ServiceOperationResult<AgentExecutionLog[]>> {
    return {
      data: [...this.agentExecutions],
      isMock: true,
      simulatedLatencyMs: 100,
    };
  }
}

export const workbenchService = new WorkbenchService();

