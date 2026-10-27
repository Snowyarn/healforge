import React from 'react';
import type { ConnectedIntegration } from '../../types/account';
import { accountService } from '../../services/accountService';

interface IntegrationsSectionProps {
  integrations: ConnectedIntegration[];
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const IntegrationsSection: React.FC<IntegrationsSectionProps> = ({
  integrations,
  onTriggerToast,
}) => {
  const handleToggleConnect = (item: ConnectedIntegration) => {
    if (item.connected) {
      const res = accountService.toggleIntegration(item.id, false);
      onTriggerToast({
        type: 'info',
        title: 'Integration Disconnected',
        message: res.message,
      });
    } else {
      const demoAccount = item.provider === 'github' ? 'acme-corp' : `${item.provider}-org-auth`;
      const res = accountService.toggleIntegration(item.id, true, demoAccount);
      onTriggerToast({
        type: 'success',
        title: 'Integration Connected',
        message: res.message,
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold font-headline-sm text-text-primary">
          Connected Applications & Integrations
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Link HealForge with your source code hosts, alert channels, and issue tracking software.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => (
          <div
            key={item.id}
            className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
              item.connected
                ? 'bg-surface-card border-border-subtle shadow-sm'
                : 'bg-surface-card/60 border-border-subtle/60'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      item.connected
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface-container text-text-muted'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[26px]">
                      {item.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-text-primary font-headline-sm">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                          item.connected
                            ? 'bg-status-success/10 text-status-success border border-status-success/20'
                            : 'bg-surface-container text-text-muted border border-border-subtle'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.connected ? 'bg-status-success' : 'bg-text-muted'
                          }`}
                        />
                        {item.connected ? 'Active' : 'Disconnected'}
                      </span>
                      {item.accountName && (
                        <span className="text-[11px] font-mono text-text-muted">
                          {item.accountName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleConnect(item)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    item.connected
                      ? 'bg-surface-container hover:bg-status-critical/10 border border-border-subtle hover:border-status-critical/30 text-text-secondary hover:text-status-critical'
                      : 'bg-primary hover:bg-primary-container text-on-primary shadow-sm'
                  }`}
                >
                  {item.connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>

              <p className="text-xs text-text-secondary mt-3 leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-border-subtle/50 flex items-center justify-between text-[11px] text-text-muted">
              <span>{item.scope ? `Scopes: ${item.scope}` : 'No permissions granted'}</span>
              <span>{item.lastSync ? `Synced ${item.lastSync}` : 'Never synced'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
