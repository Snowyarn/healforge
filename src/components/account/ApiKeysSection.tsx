import React, { useState } from 'react';
import type { ApiKey, WebhookEndpoint } from '../../types/account';
import { accountService } from '../../services/accountService';
import { CreateApiKeyModal, RevealApiKeyModal, AddWebhookModal } from './AccountModals';

interface ApiKeysSectionProps {
  apiKeys: ApiKey[];
  webhooks: WebhookEndpoint[];
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({
  apiKeys,
  webhooks,
  onTriggerToast,
}) => {
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [isRevealKeyOpen, setIsRevealKeyOpen] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState('');
  const [revealedName, setRevealedName] = useState('');
  const [isAddWebhookOpen, setIsAddWebhookOpen] = useState(false);

  const handleCreateKey = async (name: string, scopes: string[], expiryDays: number) => {
    const result = await accountService.createApiKey(name, scopes, expiryDays);
    setRevealedSecret(result.rawSecret ?? '');
    setRevealedName(name);
    setIsRevealKeyOpen(true);
    onTriggerToast({
      type: 'success',
      title: 'API Token Created',
      message: `Token "${name}" issued. Copy and store the secret now.`,
    });
  };

  const handleRevokeKey = async (keyId: string) => {
    const res = await accountService.revokeApiKey(keyId);
    onTriggerToast({
      type: res.success ? 'success' : 'warning',
      title: res.success ? 'API Key Revoked' : 'Error',
      message: res.message,
    });
  };

  const handleAddWebhook = async (url: string, events: string[]) => {
    const res = await accountService.createWebhook(url, events);
    onTriggerToast({
      type: res.success ? 'success' : 'warning',
      title: res.success ? 'Webhook Created' : 'Failed',
      message: res.message,
    });
  };

  const handleDeleteWebhook = async (id: string) => {
    const res = await accountService.deleteWebhook(id);
    onTriggerToast({
      type: res.success ? 'info' : 'warning',
      title: 'Webhook Deleted',
      message: res.message,
    });
  };

  const handlePingWebhook = (url: string) => {
    onTriggerToast({
      type: 'info',
      title: 'Webhook Ping Sent',
      message: `Simulated ping payload delivered to ${url} (HTTP 200 OK, latency: 48ms).`,
    });
  };

  const curlSnippet = `curl -X GET "https://api.healforge.dev/v1/findings?severity=Critical" \\
  -H "Authorization: Bearer hf_live_YOUR_TOKEN" \\
  -H "Content-Type: application/json"`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h2 className="text-lg font-bold font-headline-sm text-text-primary">
            API Keys & Developer Settings
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Authenticate Antigravity CLI daemons, CI/CD pipelines, and custom security scripts.
          </p>
        </div>

        <button
          onClick={() => setIsCreateKeyOpen(true)}
          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Create New API Key</span>
        </button>
      </div>

      {/* Active API Keys Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Personal Access Tokens
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <th className="pb-2 font-medium">Key Name</th>
                <th className="pb-2 font-medium">Prefix</th>
                <th className="pb-2 font-medium">Scopes</th>
                <th className="pb-2 font-medium">Created / Expires</th>
                <th className="pb-2 font-medium">Last Used</th>
                <th className="pb-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {apiKeys.map((key) => {
                const isRevoked = key.status === 'revoked';
                return (
                  <tr key={key.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="py-3 font-semibold text-text-primary">
                      <div className="flex items-center gap-2">
                        <span>{key.name}</span>
                        {isRevoked && (
                          <span className="text-[10px] bg-status-critical/10 text-status-critical px-1.5 py-0.2 rounded font-mono">
                            Revoked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-text-muted">{key.prefix}••••••••</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((s) => (
                          <span
                            key={s}
                            className="font-mono text-[10px] bg-surface-container text-text-secondary px-1.5 py-0.5 rounded border border-border-subtle"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-[11px] text-text-muted">
                      <div>{key.createdAt}</div>
                      <div className="text-[10px] text-text-muted/80">{key.expiresAt}</div>
                    </td>
                    <td className="py-3 text-[11px] text-text-muted font-mono">
                      {key.lastUsedAt || 'Never'}
                    </td>
                    <td className="py-3 text-right">
                      {!isRevoked ? (
                        <button
                          onClick={() => handleRevokeKey(key.id)}
                          className="text-xs text-status-critical hover:underline font-semibold"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhooks Section */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
              Automated Webhook Endpoints
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Receive real-time signed JSON payloads when vulnerabilities or AST patches are synthesized.
            </p>
          </div>
          <button
            onClick={() => setIsAddWebhookOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add_link</span>
            <span>Add Webhook</span>
          </button>
        </div>

        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="p-4 rounded-xl bg-surface-container/30 border border-border-subtle space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span className="font-mono text-xs font-semibold text-text-primary">{wh.url}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePingWebhook(wh.url)}
                    className="px-2.5 py-1 rounded bg-surface-card hover:bg-surface-container border border-border-subtle text-[11px] font-semibold text-text-primary transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">bolt</span>
                    Test Ping
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    className="p-1 rounded text-text-muted hover:text-status-critical transition-colors"
                    title="Delete webhook"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap text-xs text-text-muted">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px]">Triggers:</span>
                  {wh.events.map((ev) => (
                    <span
                      key={ev}
                      className="font-mono text-[10px] bg-surface-card px-1.5 py-0.5 rounded border border-border-subtle text-text-secondary"
                    >
                      {ev}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] font-mono text-text-muted">
                  {wh.deliveryConfigured === false
                    ? 'Registered — delivery worker not configured (events recorded, not delivered)'
                    : 'Registered'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Developer API Documentation Quickstart */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Developer API Quickstart
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          HealForge REST APIs operate over HTTPS with standard Bearer authentication headers. Use your active token to automate vulnerability exports into internal SIEM or CI pipelines.
        </p>

        <div className="p-4 rounded-xl bg-surface-dark border border-outline/20 font-mono text-xs text-primary-fixed overflow-x-auto relative group">
          <button
            onClick={() => {
              navigator.clipboard.writeText(curlSnippet);
              onTriggerToast({
                type: 'info',
                title: 'Copied to Clipboard',
                message: 'cURL example snippet copied.',
              });
            }}
            className="absolute right-3 top-3 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-sans flex items-center gap-1 transition-all"
          >
            <span className="material-symbols-outlined text-[12px]">content_copy</span>
            Copy
          </button>
          <pre className="whitespace-pre">{curlSnippet}</pre>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-surface-container/40 border border-border-subtle">
            <span className="font-semibold text-text-primary block mb-0.5">Rate Limits</span>
            <span className="text-text-muted">5,000 requests per hour per issued token. Burst limit: 200 req/sec.</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container/40 border border-border-subtle">
            <span className="font-semibold text-text-primary block mb-0.5">Interactive OpenAPI Specs</span>
            <a
              href="#docs"
              onClick={(e) => {
                e.preventDefault();
                onTriggerToast({
                  type: 'info',
                  title: 'API Reference',
                  message: 'Full OpenAPI v3.1 schema specification available in docs.',
                });
              }}
              className="text-primary hover:underline font-semibold"
            >
              Explore Swagger / OpenAPI Docs →
            </a>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateApiKeyModal
        isOpen={isCreateKeyOpen}
        onClose={() => setIsCreateKeyOpen(false)}
        onCreate={handleCreateKey}
      />
      <RevealApiKeyModal
        isOpen={isRevealKeyOpen}
        secret={revealedSecret}
        keyName={revealedName}
        onClose={() => setIsRevealKeyOpen(false)}
      />
      <AddWebhookModal
        isOpen={isAddWebhookOpen}
        onClose={() => setIsAddWebhookOpen(false)}
        onAdd={handleAddWebhook}
      />
    </div>
  );
};
