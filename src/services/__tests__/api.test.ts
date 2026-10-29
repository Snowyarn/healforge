/**
 * Unit tests for the typed API client (src/services/api.ts).
 *
 * fetch is stubbed per test — no network, no backend required. These tests
 * pin the contract the whole frontend relies on: cookie credentials, request
 * IDs, query serialization, and honest ApiError mapping (backend error shape,
 * non-JSON bodies, network failures).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../api';

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiError', () => {
  it('carries status, code, message and details', () => {
    const err = new ApiError(409, 'version_conflict', 'patch changed', { expected: 2 });
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(409);
    expect(err.code).toBe('version_conflict');
    expect(err.message).toBe('patch changed');
    expect(err.details).toEqual({ expected: 2 });
  });
});

describe('api.get', () => {
  it('parses JSON success payloads and sends cookie credentials + request id', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(200, { projects: [] }));
    const out = await api.get<{ projects: unknown[] }>('/projects');
    expect(out).toEqual({ projects: [] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [rawUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(rawUrl).pathname).toBe('/api/v1/projects');
    expect(init.credentials).toBe('include');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Request-ID']).toMatch(/^[a-z0-9]+$/);
    expect(init.method).toBe('GET');
  });

  it('appends only defined, non-empty query parameters', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(200, { scans: [] }));
    await api.get('/scans', { projectId: 'proj_1', q: undefined, severity: '' });
    const [rawUrl] = fetchMock.mock.calls[0] as [string];
    const url = new URL(rawUrl);
    expect(url.searchParams.get('projectId')).toBe('proj_1');
    expect(url.searchParams.has('q')).toBe(false);
    expect(url.searchParams.has('severity')).toBe(false);
  });

  it('returns undefined for 204 responses', async () => {
    stubFetch(async () => new Response(null, { status: 204 }));
    const out = await api.post<{ ok: boolean }>('/notifications/read-all');
    expect(out).toBeUndefined();
  });
});

describe('error mapping (honest failures, never fake success)', () => {
  it('maps the backend error envelope to ApiError code+message', async () => {
    stubFetch(async () =>
      jsonResponse(400, { detail: { error: { code: 'consent_required', message: 'Consent required before NVIDIA call.' } } }),
    );
    const err = await api.post('/scans', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(400);
    expect(apiErr.code).toBe('consent_required');
    expect(apiErr.message).toBe('Consent required before NVIDIA call.');
  });

  it('falls back to http_<status> when the body is not the error envelope', async () => {
    stubFetch(async () => jsonResponse(500, { unexpected: 'shape' }));
    const err = (await api.get('/dashboard/overview').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.code).toBe('http_500');
    expect(err.message).toContain('500');
  });

  it('survives completely non-JSON bodies', async () => {
    stubFetch(async () => new Response('<html>gateway timeout</html>', { status: 502 }));
    const err = (await api.get('/reports').catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('http_502');
  });

  it('maps network failure to network_error with status 0', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const err = (await api.get('/projects').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe('network_error');
  });
});

describe('api.postForm (source upload path)', () => {
  it('sends FormData without a JSON content-type and posts to the right path', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(201, { revision: { id: 'rev_1' } }));
    const fd = new FormData();
    fd.append('file', new File(['print(1)'], 'app.py', { type: 'text/x-python' }));
    const out = await api.postForm<{ revision: { id: string } }>('/projects/proj_1/sources', fd);
    expect(out.revision.id).toBe('rev_1');
    const [rawUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(rawUrl).pathname).toBe('/api/v1/projects/proj_1/sources');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(fd);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });
});

describe('download URL builders', () => {
  it('build same-origin relative URLs so cookies apply', async () => {
    // Import dynamically to keep the module-shape check independent of fetch.
    const { endpoints } = await import('../api');
    expect(endpoints.reportDownloadUrl('rep_1')).toBe('/api/v1/reports/rep_1/download');
    expect(endpoints.verificationEvidenceUrl('run_1')).toBe('/api/v1/verification-runs/run_1/evidence');
    expect(endpoints.account.exportUrl()).toBe('/api/v1/account/export');
  });
});
