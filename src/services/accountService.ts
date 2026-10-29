/**
 * Account service — BACKEND-BACKED.
 *
 * Every mutation calls the real API and persists server-side. Nothing sensitive
 * is stored in localStorage (the legacy client-side account blob is gone).
 * Only nonsensitive UI preferences (theme) remain in localStorage.
 *
 * The public method names intentionally mirror the legacy service so the
 * existing account section components keep working with minimal edits.
 */
import { useEffect, useState } from 'react';
import type {
  AccountState,
  ActiveSession,
  ApiKey,
  AuditActivityEvent,
  ConnectedIntegration,
  NotificationPreferences,
  PrivacyPreferences,
  TeamMember,
  TeamRole,
  UserPreferences,
  UserProfile,
  WebhookEndpoint,
} from '../types/account';
import { ApiError, endpoints } from './api';

// ---------------------------------------------------------------------------
// In-memory store (hydrated from the server on demand)

let cache: AccountState | null = null;
let loading: Promise<AccountState> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export async function loadAccountState(force = false): Promise<AccountState> {
  if (cache && !force) return cache;
  if (loading && !force) return loading;
  loading = (async () => {
    const raw = (await endpoints.accountState()) as unknown as AccountState & { billingNotConfigured?: boolean };
    cache = raw;
    notify();
    return raw;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export function getCachedAccountState(): AccountState | null {
  return cache;
}

export function useAccountState(): AccountState | null {
  const [state, setState] = useState<AccountState | null>(cache);
  useEffect(() => {
    const update = () => setState(cache ? { ...cache } : null);
    listeners.add(update);
    loadAccountState().then(update).catch(() => undefined);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return state;
}

/** Hook that guarantees a non-null state after hydration (used by TopBar). */
export function useAccountStateLoaded(): AccountState {
  const state = useAccountState();
  return state ?? FALLBACK_STATE;
}

async function refreshAfter(): Promise<void> {
  await loadAccountState(true);
}

export interface AccountOpResult {
  success: boolean;
  message: string;
  /** Server-generated one-time invitation link (shown once; token stored hashed). */
  inviteUrl?: string;
}

const ok = (message: string): AccountOpResult => ({ success: true, message });
const fail = (message: string): AccountOpResult => ({ success: false, message });

function errMessage(exc: unknown): string {
  if (exc instanceof ApiError) return exc.message;
  return 'Network error — the backend could not be reached.';
}

// ---------------------------------------------------------------------------
// Profile

export const accountService = {
  async getState(): Promise<AccountState | null> {
    return loadAccountState(true);
  },

  async updateProfile(patch: Partial<UserProfile>): Promise<AccountOpResult> {
    try {
      await endpoints.account.updateProfile(patch as Record<string, unknown>);
      await refreshAfter();
      return ok('Profile updated and persisted server-side.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async requestEmailChange(newEmail: string): Promise<AccountOpResult> {
    try {
      const res = await endpoints.account.requestEmailChange(newEmail);
      await refreshAfter();
      return {
        success: true,
        message: res.deliveryConfigured
          ? 'Verification email sent.'
          : 'Pending change stored. Email delivery is not configured in this deployment, so verification must be completed by an operator.',
      };
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async cancelPendingEmail(): Promise<AccountOpResult> {
    try {
      await endpoints.account.cancelPendingEmail();
      await refreshAfter();
      return ok('Pending email change cancelled.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async resendEmailVerification(): Promise<AccountOpResult> {
    return fail('Email delivery is not configured in this deployment — verification emails cannot be sent.');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<AccountOpResult> {
    if (newPassword.length < 10) return fail('New password must be at least 10 characters.');
    try {
      await endpoints.account.changePassword(currentPassword, newPassword);
      return ok('Password changed (PBKDF2 hash rotated server-side).');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  // ----- MFA (real TOTP) -----

  async mfaStart(): Promise<{ success: boolean; message: string; secret?: string; uri?: string }> {
    try {
      const res = await endpoints.account.mfaStart();
      return { success: true, message: res.note, secret: res.secret, uri: res.uri };
    } catch (exc) {
      return { success: false, message: errMessage(exc) };
    }
  },

  async mfaEnable(code: string): Promise<{ success: boolean; message: string; recoveryCodes?: string[] }> {
    try {
      const res = await endpoints.account.mfaEnable(code);
      await refreshAfter();
      return { success: true, message: res.note, recoveryCodes: res.recoveryCodes };
    } catch (exc) {
      return { success: false, message: errMessage(exc) };
    }
  },

  async mfaDisable(code: string): Promise<AccountOpResult> {
    try {
      await endpoints.account.mfaDisable(code);
      await refreshAfter();
      return ok('MFA disabled.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async regenerateRecoveryCodes(): Promise<{ success: boolean; message: string; recoveryCodes?: string[] }> {
    try {
      const res = await endpoints.account.regenerateRecoveryCodes();
      await refreshAfter();
      return { success: true, message: res.note, recoveryCodes: res.recoveryCodes };
    } catch (exc) {
      return { success: false, message: errMessage(exc) };
    }
  },

  // ----- Sessions -----

  async revokeSession(sessionId: string): Promise<AccountOpResult> {
    try {
      await endpoints.account.revokeSession(sessionId);
      await refreshAfter();
      return ok('Session revoked.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async revokeAllOtherSessions(): Promise<AccountOpResult> {
    try {
      const res = await endpoints.account.revokeOtherSessions();
      await refreshAfter();
      return ok(`Revoked ${res.revoked} other session(s).`);
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  // ----- API keys (secret shown ONCE, only hash stored server-side) -----

  async createApiKey(
    name: string,
    scopes: string[],
    expiryDays: number,
  ): Promise<AccountOpResult & { key?: string; rawSecret?: string }> {
    try {
      const res = await endpoints.account.createApiKey(name, scopes, expiryDays);
      await refreshAfter();
      return { success: true, message: res.note, key: res.key, rawSecret: res.key };
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async revokeApiKey(keyId: string): Promise<AccountOpResult> {
    try {
      await endpoints.account.revokeApiKey(keyId);
      await refreshAfter();
      return ok('API key revoked.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  // ----- Webhooks (registration only; delivery worker not configured) -----

  async createWebhook(url: string, events: string[]): Promise<AccountOpResult> {
    try {
      const res = await endpoints.account.createWebhook(url, events);
      await refreshAfter();
      return {
        success: true,
        message: res.webhook.deliveryConfigured
          ? 'Webhook registered.'
          : 'Webhook registered. Delivery worker is not configured in this deployment — events are recorded, not delivered.',
      };
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async deleteWebhook(id: string): Promise<AccountOpResult> {
    try {
      await endpoints.account.deleteWebhook(id);
      await refreshAfter();
      return ok('Webhook deleted.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  // ----- Integrations: honestly not configured without provider credentials -----

  async toggleIntegration(_id: string, _connect: boolean, _accountName?: string): Promise<AccountOpResult> {
    return fail(
      'Integration is not configured. An operator must configure provider credentials in the backend secret store first. ' +
        'Until then, import source code via the ZIP archive flow.',
    );
  },

  // ----- Team -----

  async inviteTeamMember(name: string, email: string, role: TeamRole): Promise<AccountOpResult> {
    try {
      const res = await endpoints.account.inviteMember(name, email, role);
      await refreshAfter();
      return {
        success: true,
        message: res.emailSent
          ? 'Invitation sent.'
          : 'Invitation persisted (status: Invited). Email delivery is not configured — share the invitation link below manually; it expires in 7 days and binds to the invited email.',
        inviteUrl: res.inviteUrl,
      };
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async updateTeamMemberRole(id: string, role: TeamRole): Promise<AccountOpResult> {
    try {
      await endpoints.account.updateMemberRole(id, role);
      await refreshAfter();
      return ok('Role updated.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async removeTeamMember(id: string): Promise<AccountOpResult> {
    try {
      await endpoints.account.removeMember(id);
      await refreshAfter();
      return ok('Team member removed.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  // ----- Preferences -----

  async updatePreferences(patch: Partial<UserPreferences>): Promise<AccountOpResult> {
    try {
      await endpoints.account.updatePreferences(patch as Record<string, unknown>);
      await refreshAfter();
      return ok('Preferences saved.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async updateNotificationPreferences(patch: Partial<NotificationPreferences>): Promise<AccountOpResult> {
    try {
      await endpoints.account.updateNotificationPrefs(patch as Record<string, unknown>);
      await refreshAfter();
      return ok('Notification preferences saved.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async updatePrivacyPreferences(patch: Partial<PrivacyPreferences>): Promise<AccountOpResult> {
    try {
      await endpoints.account.updatePrivacyPrefs(patch as Record<string, unknown>);
      await refreshAfter();
      return ok('Privacy preferences saved.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  // ----- Billing: honestly not configured -----

  async updateSubscriptionPlan(): Promise<AccountOpResult> {
    return fail('Billing is not configured in this deployment. No payment provider credentials exist; no simulated billing.');
  },

  async updatePaymentMethod(): Promise<AccountOpResult> {
    return fail('Billing is not configured. HealForge does not store card data.');
  },

  async cancelSubscription(): Promise<AccountOpResult> {
    return fail('There is no subscription: billing is not configured in this deployment.');
  },

  // ----- Data export / deletion -----

  async downloadDataExport(): Promise<AccountOpResult> {
    try {
      const resp = await fetch(endpoints.account.exportUrl(), { credentials: 'include' });
      if (!resp.ok) return fail('Export failed.');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'healforge-account-export.json';
      a.click();
      URL.revokeObjectURL(url);
      return ok('Account data export downloaded (source code excluded).');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async deactivateAccount(): Promise<AccountOpResult> {
    try {
      await endpoints.account.deactivate();
      return ok('Account deactivated. Sign-in is blocked until reactivated by an operator.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async deleteAccount(): Promise<AccountOpResult> {
    try {
      await endpoints.account.deleteAccount();
      cache = null;
      notify();
      return ok('Account and all workspace data deleted.');
    } catch (exc) {
      return fail(errMessage(exc));
    }
  },

  async resetToDefaults(): Promise<AccountOpResult> {
    await refreshAfter();
    return ok('State reloaded from the server.');
  },
};

// ---------------------------------------------------------------------------
// Fallback shape used before the first successful hydration (TopBar render).

const FALLBACK_STATE: AccountState = {
  profile: {
    fullName: 'HealForge',
    displayName: 'HealForge',
    username: 'healforge',
    email: '',
    isEmailVerified: false,
    pendingEmail: null,
    phone: '',
    location: '',
    bio: '',
    jobTitle: '',
    role: 'Owner',
    organization: '',
    department: '',
    expertise: [],
    skills: [],
    githubUrl: '',
    websiteUrl: '',
    linkedinUrl: '',
    avatarInitials: 'HF',
  },
  security: {
    mfaEnabled: false,
    mfaMethod: 'none',
    passkeysEnabled: false,
    passkeyCount: 0,
    recoveryCodesRemaining: 0,
    lastPasswordChange: 'not recorded',
    recentAuthEvents: [],
  },
  sessions: [],
  subscription: null,
  apiKeys: [],
  webhooks: [],
  privacy: {
    telemetryOptIn: false,
    productUpdates: false,
    marketingEmails: false,
    crashReporting: true,
    dataRetentionMonths: 12,
  },
  notifications: {
    securityAlertsInApp: true,
    securityAlertsEmail: false,
    patchGeneratedInApp: true,
    patchGeneratedEmail: false,
    sandboxCompletedInApp: true,
    sandboxCompletedEmail: false,
    credentialChangesEmail: true,
    billingAlertsEmail: false,
    weeklyDigest: false,
  },
  integrations: [],
  team: [],
  preferences: {
    theme: 'system',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
    density: 'comfortable',
    reducedMotion: false,
    defaultLanding: 'home',
  },
  activity: [],
};

export type { ActiveSession, ApiKey, AuditActivityEvent, ConnectedIntegration, TeamMember, WebhookEndpoint };
