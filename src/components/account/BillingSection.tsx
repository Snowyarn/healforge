import React, { useState } from 'react';
import type { SubscriptionPlan } from '../../types/account';
import { accountService } from '../../services/accountService';
import { UpdatePaymentModal, ModalBackdrop } from './AccountModals';

interface BillingSectionProps {
  subscription: SubscriptionPlan;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const BillingSection: React.FC<BillingSectionProps> = ({ subscription, onTriggerToast }) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>(subscription.billingInterval);

  const plans = [
    {
      id: 'free' as const,
      name: 'Community Starter',
      priceMonthly: 0,
      priceAnnual: 0,
      desc: 'For individual researchers evaluating AST taint graphs.',
      features: ['50 AST Scans / mo', '120 Sandbox Minutes', 'Community Forum Support', '1 Team Seat'],
    },
    {
      id: 'pro' as const,
      name: 'Security Pro',
      priceMonthly: 120,
      priceAnnual: 1152,
      desc: 'For fast-moving engineering teams needing automated PR fixes.',
      features: ['500 AST Scans / mo', '1,200 Sandbox Minutes', 'gVisor MicroVM Isolation', '25 Team Seats', 'Priority SLAs'],
    },
    {
      id: 'enterprise' as const,
      name: 'Enterprise Workbench',
      priceMonthly: 450,
      priceAnnual: 4320,
      desc: 'For high-compliance enterprises needing custom AST rules & on-prem runners.',
      features: ['Unlimited AST Scans', 'Dedicated Sandboxes', 'Custom AST Rewrite Rules', 'SOC2 / HIPAA Compliance', 'Dedicated TAM'],
    },
  ];

  const handleSwitchPlan = (planId: 'free' | 'pro' | 'enterprise') => {
    const res = accountService.updateSubscriptionPlan(planId, billingInterval);
    onTriggerToast({
      type: 'success',
      title: 'Plan Updated',
      message: res.message,
    });
  };

  const handleSavePaymentMethod = (
    brand: string,
    last4: string,
    expiryMonth: number,
    expiryYear: number
  ) => {
    accountService.updatePaymentMethod(brand, last4, expiryMonth, expiryYear);
    onTriggerToast({
      type: 'success',
      title: 'Payment Method Saved',
      message: `Updated default billing payment method to ${brand} •••• ${last4}.`,
    });
  };

  const handleCancelSubscription = () => {
    const res = accountService.cancelSubscription();
    setIsCancelModalOpen(false);
    onTriggerToast({
      type: 'warning',
      title: 'Subscription Cancelled',
      message: res.message,
    });
  };

  const handleDownloadInvoice = (invoiceId: string, amount: string, date: string) => {
    const receiptContent = `===================================================
HEALFORGE AUTONOMOUS SECURITY WORKBENCH
OFFICIAL RECEIPT / TAX INVOICE
===================================================
Invoice Number:   ${invoiceId}
Transaction Date: ${date}
Billed To:        Acme Corp (Alex Vance)
Address:          100 Market St, Suite 400, San Francisco, CA 94105
Payment Method:   ${subscription.paymentMethod ? `${subscription.paymentMethod.brand} ending in ${subscription.paymentMethod.last4}` : 'Credit Card'}
Status:           PAID IN FULL

DESCRIPTION                                   AMOUNT
---------------------------------------------------
HealForge Enterprise Security Workbench       ${amount}
(AST Taint Analysis & gVisor microVMs)

Subtotal:                                     ${amount}
Taxes & VAT (0.00%):                         $0.00
---------------------------------------------------
Total Paid (USD):                             ${amount}
===================================================
Thank you for securing your codebase with HealForge.
Support: support@healforge.dev
===================================================`;

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HealForge-Receipt-${invoiceId}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    onTriggerToast({
      type: 'info',
      title: 'Receipt Downloaded',
      message: `Downloaded receipt document for ${invoiceId}.`,
    });
  };

  const scansPercentage = Math.round(
    (subscription.usage.scansUsed / subscription.usage.scansLimit) * 100
  );
  const sandboxPercentage = Math.round(
    (subscription.usage.sandboxMinutesUsed / subscription.usage.sandboxMinutesLimit) * 100
  );
  const apiPercentage = Math.round(
    (subscription.usage.apiCallsUsed / subscription.usage.apiCallsLimit) * 100
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h2 className="text-lg font-bold font-headline-sm text-text-primary">
            Subscription Plans & Quota Limits
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Manage your organization tier, compute consumption, payment methods, and billing receipts.
          </p>
        </div>

        {subscription.status === 'active' && (
          <button
            onClick={() => setIsCancelModalOpen(true)}
            className="text-xs text-status-critical hover:underline"
          >
            Cancel Subscription
          </button>
        )}
      </div>

      {/* Current Plan Overview Card */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                ACTIVE TIER
              </span>
              <span className="text-xs text-text-muted">Renews on {subscription.nextRenewal}</span>
            </div>
            <h3 className="text-2xl font-bold font-headline-sm text-text-primary mt-2">
              {subscription.name}
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Billed {subscription.billingInterval}ly at ${subscription.priceAnnual}/year. (Includes 20% annual commitment discount).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">credit_card</span>
              <span>Payment Details</span>
            </button>
          </div>
        </div>

        {/* Resource Consumption Meters */}
        <div className="mt-6 pt-6 border-t border-border-subtle/60 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-text-secondary font-medium">AST Vulnerability Scans</span>
              <span className="font-mono text-text-primary font-semibold">
                {subscription.usage.scansUsed} / {subscription.usage.scansLimit}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(scansPercentage, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-text-muted mt-1 block">{scansPercentage}% utilized this cycle</span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-text-secondary font-medium">Sandbox Compute Minutes</span>
              <span className="font-mono text-text-primary font-semibold">
                {subscription.usage.sandboxMinutesUsed} / {subscription.usage.sandboxMinutesLimit} min
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
              <div
                className="h-full bg-[#0284c7] rounded-full transition-all"
                style={{ width: `${Math.min(sandboxPercentage, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-text-muted mt-1 block">{sandboxPercentage}% utilized this cycle</span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-text-secondary font-medium">API Calls Ingestion</span>
              <span className="font-mono text-text-primary font-semibold">
                {subscription.usage.apiCallsUsed.toLocaleString()} / {subscription.usage.apiCallsLimit.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
              <div
                className="h-full bg-primary-fixed-dim rounded-full transition-all"
                style={{ width: `${Math.min(apiPercentage, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-text-muted mt-1 block">{apiPercentage}% utilized this cycle</span>
          </div>
        </div>
      </div>

      {/* Plan Comparison & Upgrades */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
              Available Subscription Tiers
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Scale your AST security scanning and parallel sandbox execution capacity.
            </p>
          </div>

          {/* Monthly / Annual Toggle */}
          <div className="flex items-center bg-surface-container p-1 rounded-xl border border-border-subtle">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                billingInterval === 'monthly'
                  ? 'bg-surface-card text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                billingInterval === 'annual'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>Annual</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-white/20">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = subscription.id === p.id;
            const price =
              billingInterval === 'annual'
                ? Math.round(p.priceAnnual / 12)
                : p.priceMonthly;

            return (
              <div
                key={p.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border-subtle bg-surface-container/20 hover:border-border-strong'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-text-primary">{p.name}</h4>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-on-primary">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">{p.desc}</p>

                  <div className="my-4">
                    <span className="text-2xl font-bold font-headline-sm text-text-primary">
                      ${price}
                    </span>
                    <span className="text-xs text-text-muted font-mono"> / month</span>
                    {billingInterval === 'annual' && p.priceAnnual > 0 && (
                      <span className="text-[10px] text-text-muted block mt-0.5 font-mono">
                        Billed ${p.priceAnnual}/yr
                      </span>
                    )}
                  </div>

                  <ul className="space-y-2 text-xs text-text-secondary">
                    {p.features.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[16px]">
                          check
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-border-subtle/50">
                  <button
                    disabled={isCurrent}
                    onClick={() => handleSwitchPlan(p.id)}
                    className={`w-full py-2 rounded-xl text-xs font-semibold transition-all ${
                      isCurrent
                        ? 'bg-surface-container text-text-muted cursor-default'
                        : 'bg-primary hover:bg-primary-container text-on-primary'
                    }`}
                  >
                    {isCurrent ? 'Current Plan' : `Switch to ${p.name}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Method & Invoices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Payment Card Info */}
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui mb-3">
              Default Payment Method
            </h3>

            {subscription.paymentMethod ? (
              <div className="p-4 rounded-xl bg-surface-container/40 border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">
                      credit_card
                    </span>
                    <span className="font-semibold text-xs text-text-primary">
                      {subscription.paymentMethod.brand} •••• {subscription.paymentMethod.last4}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-status-success bg-status-success/10 px-2 py-0.5 rounded">
                    Default
                  </span>
                </div>
                <div className="text-[11px] text-text-muted font-mono">
                  Expires {subscription.paymentMethod.expiryMonth}/{subscription.paymentMethod.expiryYear}
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-muted">No card configured.</div>
            )}
          </div>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="mt-4 w-full py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle text-xs font-semibold text-text-primary transition-all"
          >
            Update Payment Card
          </button>
        </div>

        {/* Invoice History */}
        <div className="md:col-span-2 bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
            Invoicing & Payment Receipts
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                  <th className="pb-2 font-medium">Invoice ID</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 font-mono text-[11px]">
                {subscription.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="py-2.5 font-semibold text-text-primary">{inv.id}</td>
                    <td className="py-2.5 text-text-muted">{inv.date}</td>
                    <td className="py-2.5 text-text-primary font-semibold">{inv.amount}</td>
                    <td className="py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-status-success/10 text-status-success">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-sans">
                      <button
                        onClick={() => handleDownloadInvoice(inv.id, inv.amount, inv.date)}
                        className="text-xs text-primary hover:underline font-semibold flex items-center justify-end gap-1 ml-auto"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Update Payment Modal */}
      <UpdatePaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSave={handleSavePaymentMethod}
      />

      {/* Cancel Subscription Modal */}
      <ModalBackdrop
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Subscription Plan"
        subtitle="Downgrade to Community Starter"
      >
        <div className="space-y-4">
          <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-xl flex items-start gap-3">
            <span className="material-symbols-outlined text-status-warning text-[20px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="text-xs text-status-warning leading-relaxed">
              Canceling will downgrade your workspace to the Community Starter tier at the end of the current billing cycle ({subscription.nextRenewal}). Your sandbox minutes will decrease from 1,200 to 120 minutes/month.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              onClick={() => setIsCancelModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
            >
              Keep My Plan
            </button>
            <button
              onClick={handleCancelSubscription}
              className="px-4 py-2 rounded-lg bg-status-critical text-white text-xs font-semibold hover:bg-status-critical/90 transition-all"
            >
              Confirm Cancellation
            </button>
          </div>
        </div>
      </ModalBackdrop>
    </div>
  );
};
