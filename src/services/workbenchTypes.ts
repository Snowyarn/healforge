/** View types consumed by screens (re-exported from the canonical types). */
export type {
  AgentExecutionLog,
  BugReport,
  DashboardOverview,
  PatchItem,
  ProjectDetail,
  RepositoryHealth,
  SecurityIntelligenceMetric,
  SecurityReport,
  SecurityScanRecord,
  VerifiedFixItem,
  Vulnerability,
} from '../types';

export type FindingDtoLike = import('../types').Vulnerability;
export type ScanDraft = {
  projectId: string;
  revisionId?: string;
  scanType: string;
  taintFlow: boolean;
  cveCorrelation: boolean;
  modelEnrichment: boolean;
  consentGranted: boolean;
};
export type VerificationSessionLike = unknown;
