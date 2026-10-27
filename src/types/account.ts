export type SettingsSectionId =
  | 'overview'
  | 'profile'
  | 'email'
  | 'security'
  | 'sessions'
  | 'billing'
  | 'api-keys'
  | 'privacy'
  | 'notifications'
  | 'integrations'
  | 'team'
  | 'preferences'
  | 'activity'
  | 'support'
  | 'danger-zone';

export interface UserProfile {
  fullName: string;
  displayName: string;
  username: string;
  email: string;
  isEmailVerified: boolean;
  pendingEmail: string | null;
  phone: string;
  location: string;
  bio: string;
  jobTitle: string;
  role: string;
  organization: string;
  department: string;
  expertise: string[];
  skills: string[];
  githubUrl: string;
  websiteUrl: string;
  linkedinUrl: string;
  avatarInitials: string;
}

export interface AuthEvent {
  id: string;
  event: string;
  timestamp: string;
  location: string;
  ip: string;
  status: 'success' | 'warning' | 'failed';
}

export interface SecuritySettings {
  mfaEnabled: boolean;
  mfaMethod: 'authenticator_app' | 'none';
  passkeysEnabled: boolean;
  passkeyCount: number;
  recoveryCodesRemaining: number;
  lastPasswordChange: string;
  recentAuthEvents: AuthEvent[];
}

export interface ActiveSession {
  id: string;
  isCurrent: boolean;
  device: string;
  browser: string;
  os: string;
  location: string;
  ip: string;
  lastActive: string;
  signInTime: string;
}

export interface SubscriptionUsage {
  scansUsed: number;
  scansLimit: number;
  sandboxMinutesUsed: number;
  sandboxMinutesLimit: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
  teamMembersCount: number;
  teamMembersLimit: number;
}

export interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'Paid' | 'Pending';
  pdfUrl: string;
}

export interface SubscriptionPlan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  status: 'active' | 'trialing' | 'canceled';
  billingInterval: 'monthly' | 'annual';
  priceMonthly: number;
  priceAnnual: number;
  nextRenewal: string;
  trialEndsAt: string | null;
  usage: SubscriptionUsage;
  entitlements: string[];
  paymentMethod: {
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  } | null;
  billingAddress: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  invoices: Invoice[];
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  status: 'active' | 'revoked';
  expiresAt: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  createdAt: string;
  status: 'healthy' | 'degraded' | 'disabled';
  signingSecret: string;
}

export interface PrivacyPreferences {
  telemetryOptIn: boolean;
  productUpdates: boolean;
  marketingEmails: boolean;
  crashReporting: boolean;
  dataRetentionMonths: number;
}

export interface NotificationPreferences {
  securityAlertsInApp: boolean;
  securityAlertsEmail: boolean;
  patchGeneratedInApp: boolean;
  patchGeneratedEmail: boolean;
  sandboxCompletedInApp: boolean;
  sandboxCompletedEmail: boolean;
  credentialChangesEmail: boolean;
  billingAlertsEmail: boolean;
  weeklyDigest: boolean;
}

export interface ConnectedIntegration {
  id: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'slack' | 'jira';
  name: string;
  icon: string;
  description: string;
  connected: boolean;
  accountName: string | null;
  scope: string | null;
  lastSync: string | null;
}

export type TeamRole = 'Owner' | 'Admin' | 'Security Engineer' | 'Developer' | 'Viewer';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: 'Active' | 'Invited';
  joinedAt: string;
}

export interface UserPreferences {
  theme: 'system' | 'dark' | 'light';
  timezone: string;
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  timeFormat: '24h' | '12h';
  density: 'comfortable' | 'compact';
  reducedMotion: boolean;
  defaultLanding: 'home' | 'dashboard' | 'vulnerabilities';
}

export interface AuditActivityEvent {
  id: string;
  category: 'Auth' | 'Profile' | 'Security' | 'API' | 'Billing' | 'Team' | 'Privacy';
  action: string;
  description: string;
  timestamp: string;
  actor: string;
  ip: string;
  status: 'Success' | 'Warning' | 'Failed';
}

export interface AccountState {
  profile: UserProfile;
  security: SecuritySettings;
  sessions: ActiveSession[];
  subscription: SubscriptionPlan;
  apiKeys: ApiKey[];
  webhooks: WebhookEndpoint[];
  privacy: PrivacyPreferences;
  notifications: NotificationPreferences;
  integrations: ConnectedIntegration[];
  team: TeamMember[];
  preferences: UserPreferences;
  activity: AuditActivityEvent[];
}
