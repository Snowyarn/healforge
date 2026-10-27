import React, { useState } from 'react';
import { ModalBackdrop } from './AccountModals';

interface SupportSectionProps {
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const SupportSection: React.FC<SupportSectionProps> = ({ onTriggerToast }) => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Bug Report');
  const [priority, setPriority] = useState('Medium');
  const [description, setDescription] = useState('');

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setIsReportModalOpen(false);
    onTriggerToast({
      type: 'success',
      title: 'Support Ticket Dispatched',
      message: `Ticket #${Math.floor(10000 + Math.random() * 90000)} created. Security engineers will review shortly.`,
    });
    setSubject('');
    setDescription('');
  };

  const resourceCards = [
    {
      title: 'Documentation & Guides',
      desc: 'Deep-dive into AST taint flow synthesis, CWE rules, and gVisor sandbox verification architecture.',
      icon: 'menu_book',
      linkText: 'Browse Documentation',
    },
    {
      title: 'Antigravity CLI Manual',
      desc: 'Learn headless continuous analysis with the `agy heal` and `agy sandbox` developer toolchains.',
      icon: 'terminal',
      linkText: 'CLI Quickstart',
    },
    {
      title: 'OpenAPI REST Reference',
      desc: 'Interactive schema specs, authentication tokens, rate limits, and webhook event payloads.',
      icon: 'api',
      linkText: 'Explore API Reference',
    },
    {
      title: 'Security Whitepaper & SOC2',
      desc: 'Review our cryptographic isolation guarantees, ephemeral container sandboxing, and data privacy.',
      icon: 'verified_user',
      linkText: 'Download Security PDF',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h2 className="text-lg font-bold font-headline-sm text-text-primary">
            Help, Documentation & Support
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Access developer guides, check cluster infrastructure uptime, and submit security support requests.
          </p>
        </div>

        <button
          onClick={() => setIsReportModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">contact_support</span>
          <span>Contact Support</span>
        </button>
      </div>

      {/* Cluster Status Banner */}
      <div className="p-4 rounded-2xl bg-surface-card border border-border-subtle shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-status-success/10 text-status-success flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">cloud_done</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                All Systems Operational
              </h3>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">
              AST Ingestion Pipeline: 99.99% • gVisor microVM Sandboxes: Operational • Webhook Dispatch: Normal
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-status-success bg-status-success/10 px-2.5 py-1 rounded-full border border-status-success/20">
          Uptime: 99.99% (Last 90 Days)
        </span>
      </div>

      {/* Resource Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {resourceCards.map((rc, idx) => (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary mb-3">
                <span className="material-symbols-outlined text-[20px]">{rc.icon}</span>
              </div>
              <h4 className="text-sm font-bold text-text-primary font-headline-sm">{rc.title}</h4>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{rc.desc}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-border-subtle/50">
              <button
                onClick={() =>
                  onTriggerToast({
                    type: 'info',
                    title: rc.title,
                    message: 'Navigating to external documentation resource.',
                  })
                }
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>{rc.linkText}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report a Problem Modal */}
      <ModalBackdrop
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Contact Engineering Support"
        subtitle="Submit a bug report, request custom AST rules, or flag an issue."
      >
        <form onSubmit={handleSubmitTicket} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Ticket Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
            >
              <option value="Bug Report">Bug Report / False Positive</option>
              <option value="Feature Request">Feature Request / Custom AST Rule</option>
              <option value="Security Concern">Security Concern / Exploit Disclosure</option>
              <option value="Billing Issue">Billing / Quota Increase Request</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Subject
            </label>
            <input
              type="text"
              required
              placeholder="e.g. False sink flagged on auth-service line 142"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Severity / Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui"
            >
              <option value="Low">Low — Minor query or feedback</option>
              <option value="Medium">Medium — Workflow or sandbox delay</option>
              <option value="High">High — Blocking CI/CD pipeline</option>
              <option value="Critical">Critical — Zero-day triage urgency</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Problem Description
            </label>
            <textarea
              rows={4}
              required
              placeholder="Provide exact CVE identifiers, AST rule syntax, or error logs..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary text-xs outline-none text-text-primary font-label-ui leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!subject.trim() || !description.trim()}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold transition-all disabled:opacity-50"
            >
              Dispatch Ticket
            </button>
          </div>
        </form>
      </ModalBackdrop>
    </div>
  );
};
