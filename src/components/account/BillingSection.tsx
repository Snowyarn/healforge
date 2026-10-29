import React from 'react';
import { accountService } from '../../services/accountService';

interface BillingSectionProps {
  subscription?: { name?: string } | null;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

/**
 * Billing — HONEST NOT-CONFIGURED STATE.
 *
 * No payment provider credentials exist in this deployment. HealForge does not
 * store card data, does not fabricate plans/invoices, and does not simulate
 * payments. This section states that plainly and explains operator setup.
 */
export const BillingSection: React.FC<BillingSectionProps> = ({ onTriggerToast }) => {
  const handleAttempt = async (action: string) => {
    const res = await accountService.updateSubscriptionPlan();
    onTriggerToast({
      type: 'warning',
      title: `${action} Unavailable`,
      message: res.message,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold font-headline-sm text-text-primary">Billing & Subscription</h2>
        <p className="text-xs text-text-muted mt-0.5">
          Plan management, payment methods and invoice history.
        </p>
      </div>

      {/* Not-configured banner */}
      <div className="bg-surface-card border border-status-high/30 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-status-high/10 text-status-high flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-[28px]">credit_card_off</span>
        </div>
        <h3 className="text-base font-bold font-headline-sm text-text-primary mt-4">
          Billing is not configured
        </h3>
        <p className="text-body-sm text-text-secondary mt-2 max-w-md mx-auto leading-relaxed">
          No payment provider credentials are configured in this deployment. HealForge never stores card
          numbers or CVC codes, does not fabricate invoices, and will not simulate a subscription — so this
          section shows a truthful empty state instead.
        </p>
        <div className="mt-5 inline-flex items-start gap-2 bg-surface-canvas border border-border-subtle rounded-xl px-4 py-3 text-left max-w-lg">
          <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">settings_suggest</span>
          <div className="text-[11px] text-text-secondary leading-relaxed">
            <span className="font-semibold text-text-primary">Operator setup:</span> configure a payment
            provider (e.g. Stripe) in the backend secret store and set its credentials as server-side
            environment variables. This UI switches to real plan management once the provider responds.
          </div>
        </div>
      </div>

      {/* Disabled action buttons with honest reasons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Change Plan', icon: 'swap_vert', action: 'Plan Change' },
          { label: 'Update Payment Method', icon: 'credit_card', action: 'Payment Update' },
          { label: 'Cancel Subscription', icon: 'block', action: 'Cancellation' },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={() => handleAttempt(btn.action)}
            className="bg-surface-card border border-border-subtle rounded-2xl p-4 text-left hover:border-status-high/40 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="material-symbols-outlined text-text-muted text-[20px] group-hover:text-status-high">
                {btn.icon}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted bg-surface-container px-1.5 py-0.5 rounded">
                disabled
              </span>
            </div>
            <p className="text-xs font-semibold text-text-primary mt-2.5">{btn.label}</p>
            <p className="text-[11px] text-text-muted mt-0.5">Requires a configured payment provider</p>
          </button>
        ))}
      </div>

      {/* Data handling note */}
      <div className="bg-surface-canvas border border-border-subtle rounded-2xl p-5">
        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-2">
          How HealForge handles payment data
        </h4>
        <ul className="text-body-sm text-text-secondary space-y-1.5 list-disc pl-4">
          <li>No card numbers, CVC codes or bank data are ever stored — not client-side, not server-side.</li>
          <li>No invoices, charges or plan states are fabricated for demonstration purposes.</li>
          <li>When a provider is configured, payments flow entirely through the provider's hosted flow.</li>
        </ul>
      </div>
    </div>
  );
};
