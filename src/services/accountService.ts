import { useState, useEffect } from 'react';
import type {
  AccountState,
  UserProfile,
  ApiKey,
  WebhookEndpoint,
  PrivacyPreferences,
  NotificationPreferences,
  TeamMember,
  TeamRole,
  UserPreferences,
  AuditActivityEvent,
} from '../types/account';

const STORAGE_KEY = 'healforge_account_data_v1';

export const INITIAL_ACCOUNT_STATE: AccountState = {
  profile: {
    fullName: 'Alex Vance',
    displayName: 'Alex Vance',
    username: 'avance',
    email: 'alex.vance@acme-corp.internal',
    isEmailVerified: true,
    pendingEmail: null,
    phone: '+1 (555) 382-9104',
    location: 'San Francisco, CA (Remote)',
    bio: 'Principal Application Security Engineer at Acme Corp. Focusing on automated AST taint analysis, gVisor microVM isolation, and zero-day triage across distributed microservices.',
    jobTitle: 'Principal Application Security Engineer',
    role: 'Security Engineer',
    organization: 'Acme Corp',
    department: 'Product Security & Trust',
    expertise: ['AST Static Analysis', 'Taint Tracking', 'Container Sandboxing', 'Go / Python / Node.js AppSec', 'OWASP Top 10'],
    skills: ['Go', 'Python', 'TypeScript', 'Semgrep', 'Docker', 'gVisor', 'SQLi Mitigation', 'JWT Auditing'],
    githubUrl: 'https://github.com/alexvance-sec',
    websiteUrl: 'https://alexvance.dev',
    linkedinUrl: 'https://linkedin.com/in/alexvance-security',
    avatarInitials: 'AV',
  },
  security: {
    mfaEnabled: true,
    mfaMethod: 'authenticator_app',
    passkeysEnabled: false,
    passkeyCount: 0,
    recoveryCodesRemaining: 8,
    lastPasswordChange: '42 days ago',
    recentAuthEvents: [
      {
        id: 'auth-1',
        event: 'Successful Sign-in (SSO / SAML 2.0)',
        timestamp: 'Today at 09:14 AM',
        location: 'San Francisco, United States',
        ip: '198.51.100.24',
        status: 'success',
      },
      {
        id: 'auth-2',
        event: 'MFA Verification via Authenticator App',
        timestamp: 'Today at 09:14 AM',
        location: 'San Francisco, United States',
        ip: '198.51.100.24',
        status: 'success',
      },
      {
        id: 'auth-3',
        event: 'CLI Token Generated via agy login',
        timestamp: 'Yesterday at 04:30 PM',
        location: 'San Francisco, United States',
        ip: '198.51.100.24',
        status: 'success',
      },
      {
        id: 'auth-4',
        event: 'Failed Password Challenge (Rate Limited)',
        timestamp: '3 days ago',
        location: 'Frankfurt, Germany',
        ip: '203.0.113.88',
        status: 'warning',
      },
    ],
  },
  sessions: [
    {
      id: 'sess-current',
      isCurrent: true,
      device: 'MacBook Air 15" (Apple M-Series)',
      browser: 'Chrome 131.0 on macOS Sonoma',
      os: 'macOS 15.1',
      location: 'San Francisco, CA, USA',
      ip: '198.51.100.24',
      lastActive: 'Active now',
      signInTime: 'Today at 09:14 AM',
    },
    {
      id: 'sess-cli',
      isCurrent: false,
      device: 'HealForge Headless CLI / Antigravity Daemon',
      browser: 'HealForge CLI v2.4 (darwin-arm64)',
      os: 'macOS 15.1',
      location: 'San Francisco, CA, USA',
      ip: '198.51.100.24',
      lastActive: '42m ago',
      signInTime: 'Oct 25, 2026 at 03:22 PM',
    },
    {
      id: 'sess-mobile',
      isCurrent: false,
      device: 'iPhone 15 Pro',
      browser: 'Mobile Safari 18.1 on iOS',
      os: 'iOS 18.1',
      location: 'San Francisco, CA, USA',
      ip: '198.51.100.45',
      lastActive: '2 days ago',
      signInTime: 'Oct 24, 2026 at 11:08 AM',
    },
  ],
  subscription: {
    id: 'pro',
    name: 'Enterprise Security Workbench',
    status: 'active',
    billingInterval: 'annual',
    priceMonthly: 120,
    priceAnnual: 1152, // 20% discount
    nextRenewal: 'October 24, 2027',
    trialEndsAt: null,
    usage: {
      scansUsed: 142,
      scansLimit: 500,
      sandboxMinutesUsed: 318,
      sandboxMinutesLimit: 1200,
      apiCallsUsed: 14280,
      apiCallsLimit: 50000,
      teamMembersCount: 8,
      teamMembersLimit: 25,
    },
    entitlements: [
      'Unlimited AST Taint Analysis',
      'Ephemeral gVisor microVM Sandboxes (Up to 10 concurrent)',
      'Automated Pull Request Generation & Git Signing',
      'Continuous OWASP & ISO-27001 Rule Engine',
      'Dedicated Enclave Attestation Digests (SHA-256)',
      'Priority Support & Dedicated Slack Channel',
    ],
    paymentMethod: {
      brand: 'Mastercard',
      last4: '4288',
      expiryMonth: 11,
      expiryYear: 2028,
    },
    billingAddress: {
      line1: '100 Montgomery Street, Suite 1400',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94104',
      country: 'United States',
    },
    invoices: [
      {
        id: 'INV-2026-004',
        date: 'Oct 24, 2026',
        amount: '$1,152.00',
        status: 'Paid',
        pdfUrl: '#download-inv-2026-004',
      },
      {
        id: 'INV-2025-003',
        date: 'Oct 24, 2025',
        amount: '$1,152.00',
        status: 'Paid',
        pdfUrl: '#download-inv-2025-003',
      },
    ],
  },
  apiKeys: [
    {
      id: 'key-1',
      name: 'CI/CD Pipeline GitHub Actions',
      prefix: 'hf_live_948a',
      scopes: ['read:findings', 'write:patches', 'execute:sandbox'],
      createdAt: 'Oct 12, 2026',
      lastUsedAt: '12m ago',
      status: 'active',
      expiresAt: 'Oct 12, 2027',
    },
    {
      id: 'key-2',
      name: 'Local Antigravity Developer Key',
      prefix: 'hf_live_33f1',
      scopes: ['read:findings', 'write:patches'],
      createdAt: 'Oct 20, 2026',
      lastUsedAt: 'Just now',
      status: 'active',
      expiresAt: 'Jan 20, 2027',
    },
    {
      id: 'key-3',
      name: 'Legacy Staging Ingestion Worker',
      prefix: 'hf_live_810e',
      scopes: ['read:findings'],
      createdAt: 'Aug 04, 2026',
      lastUsedAt: '28 days ago',
      status: 'revoked',
      expiresAt: 'Revoked',
    },
  ],
  webhooks: [
    {
      id: 'wh-1',
      url: 'https://security.acme-corp.internal/hooks/healforge',
      events: ['finding.detected', 'patch.generated', 'sandbox.verified'],
      createdAt: 'Sep 15, 2026',
      status: 'healthy',
      signingSecret: 'whsec_88f2a11b9402c42e190...',
    },
    {
      id: 'wh-2',
      url: 'https://hooks.slack.com/services/T00/B00/sec-alerts',
      events: ['finding.detected', 'patch.approved'],
      createdAt: 'Oct 01, 2026',
      status: 'healthy',
      signingSecret: 'whsec_slack_channel_alert_41...',
    },
  ],
  privacy: {
    telemetryOptIn: false,
    productUpdates: true,
    marketingEmails: false,
    crashReporting: true,
    dataRetentionMonths: 24,
  },
  notifications: {
    securityAlertsInApp: true,
    securityAlertsEmail: true,
    patchGeneratedInApp: true,
    patchGeneratedEmail: true,
    sandboxCompletedInApp: true,
    sandboxCompletedEmail: false,
    credentialChangesEmail: true,
    billingAlertsEmail: true,
    weeklyDigest: false,
  },
  integrations: [
    {
      id: 'github',
      provider: 'github',
      name: 'GitHub Enterprise',
      icon: 'code',
      description: 'Synchronize repositories, branch previews, and pull request mutations.',
      connected: true,
      accountName: 'acme-corp (Org)',
      scope: 'repo, read:org, workflow',
      lastSync: '4m ago',
    },
    {
      id: 'gitlab',
      provider: 'gitlab',
      name: 'GitLab Self-Managed',
      icon: 'commit',
      description: 'Secondary repository mirror for legacy core-api pipelines.',
      connected: false,
      accountName: null,
      scope: null,
      lastSync: null,
    },
    {
      id: 'slack',
      provider: 'slack',
      name: 'Slack Security Alerts',
      icon: 'chat',
      description: 'Real-time alert dispatch to #appsec-triage and developer mentions.',
      connected: true,
      accountName: '#appsec-triage',
      scope: 'incoming-webhook, chat:write',
      lastSync: '12m ago',
    },
    {
      id: 'jira',
      provider: 'jira',
      name: 'Jira Software Cloud',
      icon: 'task_alt',
      description: 'Automatic ticket generation for unverified CVEs exceeding SLA.',
      connected: true,
      accountName: 'acme-corp.atlassian.net',
      scope: 'read:jira-work, write:jira-work',
      lastSync: '1h ago',
    },
  ],
  team: [
    {
      id: 'tm-1',
      name: 'Alex Vance',
      email: 'alex.vance@acme-corp.internal',
      role: 'Owner',
      status: 'Active',
      joinedAt: 'Aug 2024',
    },
    {
      id: 'tm-2',
      name: 'Sarah Chen',
      email: 'sarah.chen@acme-corp.internal',
      role: 'Admin',
      status: 'Active',
      joinedAt: 'Oct 2024',
    },
    {
      id: 'tm-3',
      name: 'Marcus Brody',
      email: 'm.brody@acme-corp.internal',
      role: 'Security Engineer',
      status: 'Active',
      joinedAt: 'Jan 2025',
    },
    {
      id: 'tm-4',
      name: 'Elena Rostova',
      email: 'elena.r@acme-corp.internal',
      role: 'Developer',
      status: 'Active',
      joinedAt: 'Mar 2025',
    },
    {
      id: 'tm-5',
      name: 'Kavita Patel',
      email: 'kavita.p@acme-corp.internal',
      role: 'Security Engineer',
      status: 'Invited',
      joinedAt: 'Pending',
    },
  ],
  preferences: {
    theme: 'dark',
    timezone: 'America/Los_Angeles (UTC-08:00)',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
    density: 'comfortable',
    reducedMotion: false,
    defaultLanding: 'dashboard',
  },
  activity: [
    {
      id: 'act-001',
      category: 'Security',
      action: 'API Key Generated',
      description: 'Generated key "Local Antigravity Developer Key" with read/write permissions.',
      timestamp: 'Today at 02:40 PM',
      actor: 'Alex Vance (You)',
      ip: '198.51.100.24',
      status: 'Success',
    },
    {
      id: 'act-002',
      category: 'Auth',
      action: 'Sign-in from New Device',
      description: 'Chrome 131.0 on macOS Sonoma authenticated via SAML 2.0.',
      timestamp: 'Today at 09:14 AM',
      actor: 'Alex Vance (You)',
      ip: '198.51.100.24',
      status: 'Success',
    },
    {
      id: 'act-003',
      category: 'Profile',
      action: 'Profile Updated',
      description: 'Updated bio and security skill tags in personal profile.',
      timestamp: 'Yesterday at 05:12 PM',
      actor: 'Alex Vance (You)',
      ip: '198.51.100.24',
      status: 'Success',
    },
    {
      id: 'act-004',
      category: 'Billing',
      action: 'Annual Plan Renewed',
      description: 'Successfully processed invoice INV-2026-004 for $1,152.00.',
      timestamp: 'Oct 24, 2026',
      actor: 'System Auto-Billing',
      ip: 'Internal',
      status: 'Success',
    },
    {
      id: 'act-005',
      category: 'Security',
      action: 'Failed Login Challenge',
      description: 'Rate-limited 3 repeated failed authentication attempts from Frankfurt, DE.',
      timestamp: 'Oct 23, 2026',
      actor: 'Anonymous / External',
      ip: '203.0.113.88',
      status: 'Warning',
    },
    {
      id: 'act-006',
      category: 'Team',
      action: 'Team Member Invited',
      description: 'Sent workspace invite to kavita.p@acme-corp.internal as Security Engineer.',
      timestamp: 'Oct 22, 2026',
      actor: 'Alex Vance (You)',
      ip: '198.51.100.24',
      status: 'Success',
    },
  ],
};

class AccountService {
  private state: AccountState;
  private listeners: Array<(state: AccountState) => void> = [];

  constructor() {
    this.state = this.loadState();
  }

  subscribe(listener: (state: AccountState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const copy = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(copy);
      } catch (err) {
        console.error('Account state subscriber error:', err);
      }
    });
  }

  private loadState(): AccountState {
    if (typeof window === 'undefined') return INITIAL_ACCOUNT_STATE;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return { ...INITIAL_ACCOUNT_STATE };
  }

  private saveState() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore quota errors in strict private browsing
    }
    this.notify();
  }

  private addAuditLog(
    category: AuditActivityEvent['category'],
    action: string,
    description: string,
    status: AuditActivityEvent['status'] = 'Success'
  ) {
    const newLog: AuditActivityEvent = {
      id: `act-${Date.now()}`,
      category,
      action,
      description,
      timestamp: 'Just now',
      actor: `${this.state.profile.fullName} (You)`,
      ip: '198.51.100.24',
      status,
    };
    this.state.activity = [newLog, ...this.state.activity.slice(0, 49)];
  }

  getState(): AccountState {
    return { ...this.state };
  }

  updateProfile(profileUpdate: Partial<UserProfile>): UserProfile {
    this.state.profile = {
      ...this.state.profile,
      ...profileUpdate,
    };
    this.addAuditLog('Profile', 'Profile Updated', 'Modified personal or professional profile fields.');
    this.saveState();
    return { ...this.state.profile };
  }

  requestEmailChange(newEmail: string): { success: boolean; message: string } {
    if (!newEmail || !newEmail.includes('@') || !newEmail.includes('.')) {
      return { success: false, message: 'Please enter a valid RFC-compliant email address.' };
    }
    if (newEmail.toLowerCase() === this.state.profile.email.toLowerCase()) {
      return { success: false, message: 'New email cannot be identical to your current email address.' };
    }

    this.state.profile.pendingEmail = newEmail;
    this.addAuditLog(
      'Security',
      'Email Change Requested',
      `Verification link dispatched to ${newEmail}. Current address remains active until confirmation.`
    );
    this.saveState();
    return {
      success: true,
      message: `A verification link has been sent to ${newEmail}. Your active account address remains ${this.state.profile.email} until you verify the new address.`,
    };
  }

  cancelPendingEmail(): void {
    const pending = this.state.profile.pendingEmail;
    this.state.profile.pendingEmail = null;
    this.addAuditLog('Security', 'Email Change Canceled', `Canceled pending change to ${pending || 'new address'}.`);
    this.saveState();
  }

  resendEmailVerification(): { success: boolean; message: string } {
    if (!this.state.profile.pendingEmail) {
      return { success: false, message: 'No pending email address change found.' };
    }
    return {
      success: true,
      message: `Verification code resent to ${this.state.profile.pendingEmail}.`,
    };
  }

  changePassword(currentPass: string, newPass: string): { success: boolean; message: string } {
    if (currentPass.length < 6) {
      return { success: false, message: 'Current password is required to authorize credential modification.' };
    }
    if (newPass.length < 10) {
      return { success: false, message: 'New password must contain at least 10 characters.' };
    }

    this.state.security.lastPasswordChange = 'Just now';
    this.addAuditLog('Security', 'Password Changed', 'User password successfully updated with high entropy.');
    this.saveState();
    return { success: true, message: 'Password updated successfully. All active sessions have been re-validated.' };
  }

  toggleMfa(enable: boolean): { success: boolean; message: string } {
    this.state.security.mfaEnabled = enable;
    this.state.security.mfaMethod = enable ? 'authenticator_app' : 'none';
    this.addAuditLog(
      'Security',
      enable ? 'MFA Enabled' : 'MFA Disabled',
      enable ? 'Time-based OTP authenticator app configured.' : 'Multi-factor authentication was disabled.'
    );
    this.saveState();
    return {
      success: true,
      message: enable ? 'Two-Factor Authentication is now active on your account.' : 'Two-Factor Authentication disabled.',
    };
  }

  generateRecoveryCodes(): string[] {
    const codes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
      Math.random().toString(36).substring(2, 6).toUpperCase()
    );
    this.state.security.recoveryCodesRemaining = 8;
    this.addAuditLog('Security', 'Recovery Codes Regenerated', 'Previous 8 emergency backup codes invalidated.');
    this.saveState();
    return codes;
  }

  revokeSession(sessionId: string): { success: boolean; message: string } {
    const session = this.state.sessions.find((s) => s.id === sessionId);
    if (!session) return { success: false, message: 'Session not found.' };
    if (session.isCurrent) return { success: false, message: 'Cannot revoke your active session from this panel.' };

    this.state.sessions = this.state.sessions.filter((s) => s.id !== sessionId);
    this.addAuditLog('Security', 'Session Revoked', `Revoked device session: ${session.device} (${session.ip}).`);
    this.saveState();
    return { success: true, message: `Terminated session on ${session.device}.` };
  }

  revokeAllOtherSessions(): { success: boolean; message: string } {
    const count = this.state.sessions.filter((s) => !s.isCurrent).length;
    this.state.sessions = this.state.sessions.filter((s) => s.isCurrent);
    this.addAuditLog('Security', 'All Other Sessions Terminated', `Signed out of ${count} remote devices.`);
    this.saveState();
    return { success: true, message: `Successfully revoked ${count} other sessions.` };
  }

  createApiKey(name: string, scopes: string[], expiryDays: number): { key: ApiKey; rawSecret: string } {
    const cleanPrefix = 'hf_live_' + Math.random().toString(36).substring(2, 6);
    const rawSecret = cleanPrefix + '_' + Array.from({ length: 24 }, () => Math.random().toString(36)[2] || 'x').join('');
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + expiryDays);

    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: name.trim() || 'New API Key',
      prefix: cleanPrefix,
      scopes: scopes.length ? scopes : ['read:findings'],
      createdAt: 'Today',
      lastUsedAt: null,
      status: 'active',
      expiresAt: expiresDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    this.state.apiKeys = [newKey, ...this.state.apiKeys];
    this.addAuditLog('API', 'API Key Created', `Created key "${newKey.name}" with scopes: ${newKey.scopes.join(', ')}.`);
    this.saveState();

    return { key: newKey, rawSecret };
  }

  revokeApiKey(keyId: string): { success: boolean; message: string } {
    const target = this.state.apiKeys.find((k) => k.id === keyId);
    if (!target) return { success: false, message: 'API Key not found.' };

    target.status = 'revoked';
    target.expiresAt = 'Revoked';
    this.addAuditLog('API', 'API Key Revoked', `Permanently revoked credential: "${target.name}" (${target.prefix}).`);
    this.saveState();
    return { success: true, message: `API Key "${target.name}" has been revoked.` };
  }

  createWebhook(url: string, events: string[]): { success: boolean; webhook?: WebhookEndpoint; message: string } {
    if (!url.startsWith('https://')) {
      return { success: false, message: 'Webhook endpoint URL must start with https:// for security.' };
    }

    const newWebhook: WebhookEndpoint = {
      id: `wh-${Date.now()}`,
      url: url.trim(),
      events: events.length ? events : ['finding.detected'],
      createdAt: 'Today',
      status: 'healthy',
      signingSecret: 'whsec_' + Math.random().toString(36).substring(2, 14) + '...',
    };

    this.state.webhooks = [newWebhook, ...this.state.webhooks];
    this.addAuditLog('API', 'Webhook Endpoint Created', `Configured webhook ${newWebhook.url}`);
    this.saveState();
    return { success: true, webhook: newWebhook, message: 'Webhook endpoint registered successfully.' };
  }

  deleteWebhook(id: string): { success: boolean; message: string } {
    const target = this.state.webhooks.find((w) => w.id === id);
    if (!target) return { success: false, message: 'Webhook not found.' };

    this.state.webhooks = this.state.webhooks.filter((w) => w.id !== id);
    this.addAuditLog('API', 'Webhook Endpoint Removed', `Deleted webhook: ${target.url}`);
    this.saveState();
    return { success: true, message: 'Webhook removed.' };
  }

  updateSubscriptionPlan(planId: 'free' | 'pro' | 'enterprise', interval: 'monthly' | 'annual'): { success: boolean; message: string } {
    const planNames = {
      free: 'Community Starter',
      pro: 'Enterprise Security Workbench',
      enterprise: 'Custom Enterprise Suite',
    };

    this.state.subscription.id = planId;
    this.state.subscription.name = planNames[planId];
    this.state.subscription.billingInterval = interval;
    this.state.subscription.status = 'active';

    this.addAuditLog('Billing', 'Plan Tier Updated', `Changed plan to ${planNames[planId]} (${interval}).`);
    this.saveState();
    return { success: true, message: `Subscription plan updated to ${planNames[planId]} (${interval}). Simulated billing update recorded.` };
  }

  updatePaymentMethod(brand: string, last4: string, expiryMonth: number, expiryYear: number): { success: boolean; message: string } {
    this.state.subscription.paymentMethod = {
      brand,
      last4,
      expiryMonth,
      expiryYear,
    };
    this.addAuditLog('Billing', 'Payment Method Updated', `Added default payment method ending in •••• ${last4}.`);
    this.saveState();
    return { success: true, message: 'Payment card updated successfully.' };
  }

  cancelSubscription(): { success: boolean; message: string } {
    this.state.subscription.status = 'canceled';
    this.addAuditLog('Billing', 'Subscription Canceled', 'Subscription marked canceled at end of current billing period.');
    this.saveState();
    return { success: true, message: 'Subscription canceled. Your entitlements will remain active until the end of the billing term.' };
  }

  toggleIntegration(id: string, connect: boolean, accountName?: string): { success: boolean; message: string } {
    const integ = this.state.integrations.find((i) => i.id === id);
    if (!integ) return { success: false, message: 'Integration not found.' };

    integ.connected = connect;
    if (connect) {
      integ.accountName = accountName || 'connected-org';
      integ.lastSync = 'Just now';
    } else {
      integ.accountName = null;
      integ.lastSync = null;
    }

    this.addAuditLog('Security', connect ? 'App Connected' : 'App Disconnected', `${connect ? 'Linked' : 'Unlinked'} ${integ.name}.`);
    this.saveState();
    return { success: true, message: `${integ.name} ${connect ? 'connected' : 'disconnected'} successfully.` };
  }

  inviteTeamMember(name: string, email: string, role: TeamRole): { success: boolean; message: string } {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Valid corporate email address required.' };
    }

    const newMember: TeamMember = {
      id: `tm-${Date.now()}`,
      name: name.trim() || email.split('@')[0],
      email: email.trim(),
      role,
      status: 'Invited',
      joinedAt: 'Pending Accept',
    };

    this.state.team = [...this.state.team, newMember];
    this.state.subscription.usage.teamMembersCount = this.state.team.length;
    this.addAuditLog('Team', 'Team Invite Sent', `Dispatched workspace invitation to ${newMember.email} as ${role}.`);
    this.saveState();
    return { success: true, message: `Invitation sent to ${newMember.email}.` };
  }

  updateTeamMemberRole(id: string, role: TeamRole): { success: boolean; message: string } {
    const member = this.state.team.find((m) => m.id === id);
    if (!member) return { success: false, message: 'Member not found.' };

    member.role = role;
    this.addAuditLog('Team', 'Role Updated', `Changed role for ${member.name} to ${role}.`);
    this.saveState();
    return { success: true, message: `Updated ${member.name}'s role to ${role}.` };
  }

  removeTeamMember(id: string): { success: boolean; message: string } {
    const member = this.state.team.find((m) => m.id === id);
    if (!member) return { success: false, message: 'Member not found.' };
    if (member.role === 'Owner') return { success: false, message: 'Workspace Owner cannot be removed.' };

    this.state.team = this.state.team.filter((m) => m.id !== id);
    this.state.subscription.usage.teamMembersCount = this.state.team.length;
    this.addAuditLog('Team', 'Member Removed', `Removed ${member.name} (${member.email}) from team.`);
    this.saveState();
    return { success: true, message: `Removed ${member.name} from organization.` };
  }

  updatePrivacyPreferences(prefs: Partial<PrivacyPreferences>): PrivacyPreferences {
    this.state.privacy = {
      ...this.state.privacy,
      ...prefs,
    };
    this.addAuditLog('Privacy', 'Privacy Settings Updated', 'Modified analytics telemetry and data retention preferences.');
    this.saveState();
    return { ...this.state.privacy };
  }

  updateNotificationPreferences(prefs: Partial<NotificationPreferences>): NotificationPreferences {
    this.state.notifications = {
      ...this.state.notifications,
      ...prefs,
    };
    this.addAuditLog('Profile', 'Notifications Updated', 'Modified in-app and email communication preferences.');
    this.saveState();
    return { ...this.state.notifications };
  }

  updateUserPreferences(prefs: Partial<UserPreferences>): UserPreferences {
    this.state.preferences = {
      ...this.state.preferences,
      ...prefs,
    };
    this.addAuditLog('Profile', 'Preferences Updated', 'Updated visual theme, time zone, and display metrics.');
    this.saveState();
    return { ...this.state.preferences };
  }

  generateDataExportJson(): string {
    const exportBundle = {
      exportVersion: '2.4.0',
      exportedAt: new Date().toISOString(),
      account: {
        profile: this.state.profile,
        subscription: {
          id: this.state.subscription.id,
          name: this.state.subscription.name,
          billingInterval: this.state.subscription.billingInterval,
          status: this.state.subscription.status,
        },
        securitySettings: {
          mfaEnabled: this.state.security.mfaEnabled,
          passkeysEnabled: this.state.security.passkeysEnabled,
        },
        activeApiKeys: this.state.apiKeys.map((k) => ({
          name: k.name,
          prefix: k.prefix,
          scopes: k.scopes,
          createdAt: k.createdAt,
          status: k.status,
        })),
        connectedIntegrations: this.state.integrations.filter((i) => i.connected).map((i) => ({
          provider: i.provider,
          name: i.name,
          account: i.accountName,
        })),
        preferences: this.state.preferences,
        recentAuditLogs: this.state.activity.slice(0, 20),
      },
      notice: 'HealForge Personal Data Export. Generated per GDPR/CCPA portability request in simulated prototype mode.',
    };

    this.addAuditLog('Privacy', 'Account Data Exported', 'Full JSON archive of account parameters downloaded.');
    this.saveState();
    return JSON.stringify(exportBundle, null, 2);
  }

  deactivateAccount(): { success: boolean; message: string } {
    this.addAuditLog('Security', 'Account Deactivated', 'Account frozen temporarily; API keys and webhook triggers suspended.');
    this.saveState();
    return {
      success: true,
      message: 'Account has been deactivated. Workflows and API keys are paused. Log in anytime to restore full access.',
    };
  }

  deleteAccount(): { success: boolean; message: string } {
    this.state = { ...INITIAL_ACCOUNT_STATE };
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
    return {
      success: true,
      message: 'Account data and credentials successfully purged from local workspace.',
    };
  }

  resetToDefaults(): void {
    this.state = { ...INITIAL_ACCOUNT_STATE };
    this.saveState();
  }
}

export const accountService = new AccountService();

export function useAccountState(): AccountState {
  const [accountState, setAccountState] = useState<AccountState>(() => accountService.getState());

  useEffect(() => {
    return accountService.subscribe((updated) => {
      setAccountState(updated);
    });
  }, []);

  return accountState;
}

