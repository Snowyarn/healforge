import React, { useState } from 'react';
import type { TeamMember, TeamRole } from '../../types/account';
import { accountService } from '../../services/accountService';
import { InviteTeamMemberModal, ModalBackdrop } from './AccountModals';

interface TeamSectionProps {
  team: TeamMember[];
  organizationName: string;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const TeamSection: React.FC<TeamSectionProps> = ({
  team,
  organizationName,
  onTriggerToast,
}) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [lastInvite, setLastInvite] = useState<{ email: string; url: string } | null>(null);

  const handleInvite = async (name: string, email: string, role: TeamRole) => {
    setLastInvite(null);
    const res = await accountService.inviteTeamMember(name, email, role);
    onTriggerToast({
      type: res.success ? 'success' : 'warning',
      title: res.success ? 'Invitation Created' : 'Error',
      message: res.message,
    });
    if (res.success && res.inviteUrl) {
      // The server shows this link ONCE (the token is stored hashed). Surface it
      // for manual delivery because email delivery is not configured.
      setLastInvite({ email, url: res.inviteUrl });
    }
  };

  const handleRoleChange = async (id: string, newRole: TeamRole) => {
    const res = await accountService.updateTeamMemberRole(id, newRole);
    onTriggerToast({
      type: res.success ? 'success' : 'warning',
      title: 'Role Updated',
      message: res.message,
    });
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    const res = await accountService.removeTeamMember(memberToRemove.id);
    setMemberToRemove(null);
    onTriggerToast({
      type: res.success ? 'info' : 'warning',
      title: 'Member Removed',
      message: res.message,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h2 className="text-lg font-bold font-headline-sm text-text-primary">
            Team & Organization Workspace
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Manage collaborators, assign role-based permissions (RBAC), and invite security engineers.
          </p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          <span>Invite Team Member</span>
        </button>
      </div>

      {/* Workspace Banner (real data only — no invented seat counts or IDs) */}
      <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-surface-dark text-primary-fixed flex items-center justify-center font-bold text-lg">
            {(organizationName || 'HF').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-text-primary">{organizationName}</h3>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {team.length} member{team.length === 1 ? '' : 's'} • role-based access control enforced server-side
            </p>
          </div>
        </div>

        <div className="text-xs text-text-muted">
          Email delivery: not configured
        </div>
      </div>

      {/* One-time invitation link (email delivery not configured — manual handoff) */}
      {lastInvite && (
        <div className="p-5 rounded-2xl bg-status-warning/5 border border-status-warning/25">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-status-warning">share</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-text-primary">Invitation link for {lastInvite.email} (shown once)</h4>
              <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                Email delivery is not configured in this deployment. Copy this link and deliver it to the invitee over a
                channel you trust. It expires after 7 days, binds to the invited email address, and can only be used once.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate px-3 py-2 rounded-lg bg-surface-container border border-border-subtle text-[11px] font-mono text-text-secondary">
                  {lastInvite.url}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(lastInvite.url);
                    onTriggerToast({ type: 'success', title: 'Copied', message: 'Invitation link copied to clipboard.' });
                  }}
                  className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-[11px] font-semibold transition-all"
                >
                  Copy
                </button>
              </div>
            </div>
            <button
              onClick={() => setLastInvite(null)}
              className="text-text-muted hover:text-text-primary p-1"
              title="Dismiss"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Team Members Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Workspace Members ({team.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <th className="pb-2 font-medium">Member</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Joined</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {team.map((member) => {
                const isOwner = member.role === 'Owner';
                return (
                  <tr key={member.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="py-3">
                      <div className="font-semibold text-text-primary">{member.name}</div>
                      <div className="text-[11px] text-text-muted font-mono">{member.email}</div>
                    </td>

                    <td className="py-3">
                      {isOwner ? (
                        <span className="font-semibold text-xs text-text-primary">Owner</span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as TeamRole)}
                          className="px-2.5 py-1 rounded bg-surface-container border border-border-subtle text-xs font-label-ui text-text-primary outline-none focus:border-primary transition-colors"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Security Engineer">Security Engineer</option>
                          <option value="Developer">Developer</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                      )}
                    </td>

                    <td className="py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          member.status === 'Active'
                            ? 'bg-status-success/10 text-status-success'
                            : 'bg-status-warning/10 text-status-warning'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>

                    <td className="py-3 text-[11px] text-text-muted font-mono">{member.joinedAt}</td>

                    <td className="py-3 text-right">
                      {!isOwner && (
                        <button
                          onClick={() => setMemberToRemove(member)}
                          className="text-text-muted hover:text-status-critical transition-colors p-1"
                          title="Remove team member"
                        >
                          <span className="material-symbols-outlined text-[18px]">person_remove</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      <InviteTeamMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={handleInvite}
      />

      {/* Remove Member Confirmation Modal */}
      <ModalBackdrop
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title="Remove Team Member"
        subtitle={`Revoke access for ${memberToRemove?.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Are you sure you want to remove <strong className="text-text-primary">{memberToRemove?.name}</strong> ({memberToRemove?.email}) from the workspace? They will lose access to all staged patches and microVM verification reports.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              onClick={() => setMemberToRemove(null)}
              className="px-4 py-2 rounded-lg text-xs font-label-ui text-text-secondary hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmRemoveMember}
              className="px-4 py-2 rounded-lg bg-status-critical text-white text-xs font-semibold hover:bg-status-critical/90 transition-all"
            >
              Remove Member
            </button>
          </div>
        </div>
      </ModalBackdrop>
    </div>
  );
};
