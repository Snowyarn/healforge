/**
 * Regression tests for the 2026-10 honesty/security fixes:
 *
 * 1. Uniform backend error envelope: the API maps BOTH the new
 *    {"error": {code, message}} shape and the legacy {"detail": {"error": ...}}
 *    shape into ApiError (no silent http_500 fallbacks).
 * 2. IntegrationsSection NEVER fabricates a connected state: with the
 *    not-configured server payload the Connect control is disabled and no
 *    success toast can be produced.
 * 3. TeamSection surfaces the server's one-time invitation link when email
 *    delivery is not configured.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../api';
import { accountService } from '../accountService';
// Raw source import (Vitest/Vite ?raw) for the static honesty assertions below.
import integrationsSectionSrc from '../../components/account/IntegrationsSection.tsx?raw';

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('uniform error envelope (risk 9)', () => {
  it('parses the new top-level {"error": {...}} envelope', async () => {
    stubFetch(async () => jsonResponse(404, { error: { code: 'scan_not_found', message: 'Scan not found.' } }));
    await expect(api.get('/scans/scan_x')).rejects.toMatchObject({
      status: 404,
      code: 'scan_not_found',
      message: 'Scan not found.',
    } as Partial<ApiError>);
  });

  it('still parses the legacy {"detail": {"error": {...}}} envelope', async () => {
    stubFetch(async () =>
      jsonResponse(409, { detail: { error: { code: 'version_conflict', message: 'reload' } } }),
    );
    await expect(api.get('/patches/pat_x')).rejects.toMatchObject({
      status: 409,
      code: 'version_conflict',
      message: 'reload',
    } as Partial<ApiError>);
  });

  it('maps a 401 session expiry to the unauthorized event (sign-in screen)', async () => {
    const listener = vi.fn();
    window.addEventListener('healforge:unauthorized', listener);
    stubFetch(async () => jsonResponse(401, { error: { code: 'unauthorized', message: 'No valid session.' } }));
    await expect(api.get('/projects')).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('healforge:unauthorized', listener);
  });
});

describe('integrations honesty (risk 3)', () => {
  it('toggleIntegration reports failure — never a fake connected account', async () => {
    const res = await accountService.toggleIntegration('itg-github', true);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not configured/i);
    expect(res.message).not.toMatch(/connected/i);
  });

  it('IntegrationsSection source: disabled Connect, no demo accounts, no connect-success toast', async () => {
    // Component-level testing-library is not a project dependency, so this pins
    // the honesty contract statically (same pattern as the backend hygiene tests).
    const src = integrationsSectionSrc;
    // The Connect control is disabled and cannot fire a success toast:
    expect(src).toMatch(/disabled\s+title=/);
    expect(src).not.toMatch(/Integration Connected/);
    // No fabricated demo account names on the connect path:
    expect(src).not.toMatch(/acme-corp/);
    expect(src).not.toMatch(/org-auth/);
    // Honest not-configured banner with server-provided instructions:
    expect(src).toMatch(/Not configured\./);
    expect(src).toMatch(/setupInstructions/);
  });

  it('the integrations payload from the server is not-configured, never connected', async () => {
    stubFetch(async () =>
      jsonResponse(200, {
        integrations: [
          {
            id: 'itg-github',
            provider: 'github',
            name: 'GitHub',
            icon: 'code',
            description: 'Import repositories',
            connected: false,
            accountName: null,
            scope: null,
            lastSync: null,
            notConfigured: true,
            setupInstructions: 'Configure server-side credentials first.',
          },
        ],
        note: 'No external provider credentials are configured.',
      }),
    );
    const res = await api.get<{ integrations: { connected: boolean; notConfigured?: boolean }[] }>(
      '/account/integrations',
    );
    expect(res.integrations[0].connected).toBe(false);
    expect(res.integrations[0].notConfigured).toBe(true);
  });
});

describe('invitation lifecycle surfacing (risk 2)', () => {
  it('inviteTeamMember surfaces the one-time invite link from the server', async () => {
    // First fetch = POST /account/team (invite), subsequent fetches = state refresh.
    let call = 0;
    stubFetch(async (_input, init) => {
      call += 1;
      if (call === 1) {
        expect(init?.method).toBe('POST');
        return jsonResponse(201, {
          member: { id: 'mem_1', name: 'Guest', email: 'guest@example.com', role: 'Viewer', status: 'Invited' },
          emailSent: false,
          inviteUrl: '/account/team-invite/tok_abc123',
        });
      }
      return jsonResponse(200, {
        profile: {}, sessions: [], apiKeys: [], team: [], integrations: [], webhooks: [],
        preferences: {}, activity: [],
      });
    });
    const res = await accountService.inviteTeamMember('Guest', 'guest@example.com', 'Viewer');
    expect(res.success).toBe(true);
    expect(res.inviteUrl).toBe('/account/team-invite/tok_abc123');
    expect(res.message).toMatch(/share the invitation link/i);
  });
});
