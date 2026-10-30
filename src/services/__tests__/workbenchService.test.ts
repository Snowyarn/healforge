/**
 * Unit tests for the DTO -> view mappers in src/services/workbenchService.ts.
 *
 * Screens consume the legacy view shapes; these tests pin the mapping rules
 * (provider normalization, verification status, autofix badge logic, null
 * safety for optional backend fields) so backend serializer changes that
 * would break screens are caught in CI, not in the browser.
 */
import { describe, expect, it } from 'vitest';
import type { FindingDto, ProjectDto, ScanDto } from '../api';
import { mapFinding, mapProject, mapScan } from '../workbenchService';

const baseProject: ProjectDto = {
  id: 'proj_1',
  name: 'demo-api',
  provider: 'zip-archive',
  primaryBranch: 'import',
  branches: ['import'],
  lastScanTime: '2 minutes ago',
  lastScanTimeIso: '2026-01-01T00:00:00',
  scanStatus: 'vulnerable',
  openVulnCount: 3,
  criticalCount: 1,
  highCount: 2,
  verificationStatus: 'pending',
  healthScore: 40,
  description: 'Test project',
  runtime: 'python',
  headCommit: 'abc1234',
  latestRevisionId: 'rev_1',
  archived: false,
  createdAtIso: '2026-01-01T00:00:00',
};

describe('mapProject', () => {
  it('normalizes the zip-archive provider label for the legacy view', () => {
    const view = mapProject(baseProject);
    expect(view.provider).toBe('github');
    expect(view.name).toBe('demo-api');
    expect(view.id).toBe('proj_1');
  });

  it('passes through non-zip providers untouched', () => {
    const view = mapProject({ ...baseProject, provider: 'gitlab' });
    expect(view.provider).toBe('gitlab');
  });

  it('maps only exact "verified" to verified; anything else stays pending', () => {
    expect(mapProject({ ...baseProject, verificationStatus: 'verified' }).verificationStatus).toBe('verified');
    expect(mapProject({ ...baseProject, verificationStatus: 'failed' }).verificationStatus).toBe('pending');
    expect(mapProject({ ...baseProject, verificationStatus: 'unknown-state' }).verificationStatus).toBe('pending');
  });
});

const baseFinding: FindingDto = {
  id: 'HF-0001',
  internalId: 'HF-0001',
  cwe: 'CWE-89',
  title: 'SQL query built via string interpolation',
  description: 'desc',
  service: 'demo-api',
  repository: 'demo-api',
  projectId: 'proj_1',
  affectedFile: 'app/db.py',
  exactLines: '12-18',
  discoveredBy: 'healforge-static-engine/1.2',
  severity: 'Critical',
  cvssScore: 9.1,
  reachability: 'Reachable',
  autofixStatus: 'Pending',
  status: 'open',
  discoveredAt: '2026-01-01',
  hasPatch: false,
  patchId: null,
};

describe('mapFinding autofix badge logic', () => {
  it('resolved findings show "Applied"', () => {
    expect(mapFinding({ ...baseFinding, status: 'resolved' }).autofixStatus).toBe('Applied');
  });

  it('open findings with a patch show "Review Required"', () => {
    expect(mapFinding({ ...baseFinding, hasPatch: true, patchId: 'patch_1' }).autofixStatus).toBe('Review Required');
  });

  it('open findings without a patch stay "Pending"', () => {
    expect(mapFinding(baseFinding).autofixStatus).toBe('Pending');
  });
});

describe('mapFinding null safety (backend optionals)', () => {
  it('defaults taintSteps to [], modelAnalysis/codeSnippet/astPatch to null, compliance to placeholders', () => {
    const view = mapFinding(baseFinding);
    expect(view.taintSteps).toEqual([]);
    expect(view.modelAnalysis).toBeNull();
    expect(view.codeSnippet).toBeNull();
    expect(view.astPatch).toBeNull();
    expect(view.compliance).toEqual({ owasp: '—', cvss: '—', exploitability: '—' });
  });

  it('falls back to the description for impactAnalysis when the backend omits it', () => {
    const view = mapFinding(baseFinding);
    expect(view.impactAnalysis).toBe('desc');
  });

  it('keeps a real code snippet when provided', () => {
    const view = mapFinding({
      ...baseFinding,
      codeSnippet: {
        language: 'python',
        filePath: 'app/db.py',
        lines: '12-18',
        code: [{ lineNumber: 12, content: 'query = f"SELECT * FROM t WHERE id={uid}"', type: 'code', highlight: true }],
      },
    });
    expect(view.codeSnippet).not.toBeNull();
    expect(view.codeSnippet?.code[0].lineNumber).toBe(12);
    expect(view.codeSnippet?.language).toBe('python');
  });
});

describe('mapScan', () => {
  it('passes through scan fields screens poll on', () => {
    const dto: ScanDto = {
      id: 'scan_1',
      project: 'demo-api',
      projectId: 'proj_1',
      scanType: 'AST Static Analysis (SAST)',
      startTime: 'Just now',
      startTimeIso: '2026-01-01T00:00:00',
      duration: '1.2s',
      status: 'Completed',
      statusRaw: 'completed',
      findingsCount: 4,
      criticalCount: 2,
      highCount: 2,
      trigger: 'Manual Scan',
      commitHash: 'abc1234',
      revisionId: 'rev_1',
      logs: ['[INFO] started', '[INFO] finished'],
      consentGranted: false,
      modelEnrichment: 'not_configured',
      error: null,
    };
    const view = mapScan(dto);
    expect(view.id).toBe('scan_1');
    expect(view.statusRaw).toBe('completed');
    expect(view.status).toBe('Completed');
    expect(view.findingsCount).toBe(4);
    expect(view.logs).toHaveLength(2);
    // Honest-state contract: the unconfigured model enrichment label must survive mapping.
    expect(view.modelEnrichment).toBe('not_configured');
    expect(view.error).toBeNull();
  });
});
