import React, { useState } from 'react';
import type { NotificationPreferences } from '../../types/account';
import { accountService } from '../../services/accountService';

interface NotificationsSectionProps {
  notifications: NotificationPreferences;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  notifications: initialNotifications,
  onTriggerToast,
}) => {
  const [notifications, setNotifications] = useState<NotificationPreferences>(initialNotifications);

  const handleToggle = (key: keyof NotificationPreferences) => {
    const updated = {
      ...notifications,
      [key]: !notifications[key],
    };
    setNotifications(updated);
    accountService.updateNotificationPreferences(updated);
    onTriggerToast({
      type: 'success',
      title: 'Notification Setting Updated',
      message: 'Your notification dispatch preferences have been saved.',
    });
  };

  const notificationRows: {
    title: string;
    description: string;
    inAppKey?: keyof NotificationPreferences;
    emailKey?: keyof NotificationPreferences;
  }[] = [
    {
      title: 'Critical Vulnerability Flagged',
      description: 'Triggered when AST taint tracking confirms an exploitable critical CWE sink.',
      inAppKey: 'securityAlertsInApp',
      emailKey: 'securityAlertsEmail',
    },
    {
      title: 'Autonomous Patch Synthesized',
      description: 'Triggered when an AST code repair candidate is staged and ready for human review.',
      inAppKey: 'patchGeneratedInApp',
      emailKey: 'patchGeneratedEmail',
    },
    {
      title: 'gVisor Sandbox Test Run Completed',
      description: 'Triggered when regression test suites finish executing inside isolated microVMs.',
      inAppKey: 'sandboxCompletedInApp',
      emailKey: 'sandboxCompletedEmail',
    },
    {
      title: 'Security & Credential Modifications',
      description: 'Dispatched on password changes, MFA alterations, or new API key generations.',
      emailKey: 'credentialChangesEmail',
    },
    {
      title: 'Billing, Quota & Renewal Alerts',
      description: 'Notifies when AST scan quota hits 80% or annual invoice receipts are issued.',
      emailKey: 'billingAlertsEmail',
    },
    {
      title: 'Weekly Executive Remediation Digest',
      description: 'Summary of resolved vulnerabilities, MTTR metrics, and pending pull requests.',
      emailKey: 'weeklyDigest',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold font-headline-sm text-text-primary">
          Notifications & Communication Channels
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Select which security engine events dispatch in-app notifications or corporate emails.
        </p>
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <th className="pb-3 font-medium">Event Type</th>
                <th className="pb-3 font-medium text-center w-24">In-App</th>
                <th className="pb-3 font-medium text-center w-24">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {notificationRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-container/20 transition-colors">
                  <td className="py-4 pr-4">
                    <div className="font-semibold text-text-primary text-xs">{row.title}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{row.description}</div>
                  </td>

                  {/* In App Toggle */}
                  <td className="py-4 text-center">
                    {row.inAppKey ? (
                      <button
                        onClick={() => row.inAppKey && handleToggle(row.inAppKey)}
                        className={`w-9 h-5 rounded-full transition-colors relative inline-block ${
                          notifications[row.inAppKey] ? 'bg-primary' : 'bg-surface-container-high'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                            notifications[row.inAppKey] ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="text-text-muted text-[11px]">—</span>
                    )}
                  </td>

                  {/* Email Toggle */}
                  <td className="py-4 text-center">
                    {row.emailKey ? (
                      <button
                        onClick={() => row.emailKey && handleToggle(row.emailKey)}
                        className={`w-9 h-5 rounded-full transition-colors relative inline-block ${
                          notifications[row.emailKey] ? 'bg-primary' : 'bg-surface-container-high'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                            notifications[row.emailKey] ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="text-text-muted text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
