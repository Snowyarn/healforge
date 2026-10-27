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

  const handleInvite = (name: string, email: string, role: TeamRole) => {
    const res = accountService.inviteTeamMember(name, email, role);
    onTriggerToast({
      type: res.success ? 'success' : 'warning',
      title: res.success ? 'Invitation Dispatched' : 'Error',
      message: res.message,
    });
  };

  const handleRoleChange = (id: string, newRole: TeamRole) => {
    const res = accountService.updateTeamMemberRole(id, newRole);
    onTriggerToast({
      type: res.success ? 'success' : 'warning',
      title: 'Role Updated',
      message: res.message,
    });
  };

  const confirmRemoveMember = () => {
    if (!memberToRemove) return;
    const res = accountService.removeTeamMember(memberToRemove.id);
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

      {/* Workspace Banner */}
      <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-surface-dark text-primary-fixed flex items-center justify-center font-bold text-lg">
            AC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-text-primary">{organizationName}</h3>
              <span className="text-[10px] font-mono bg-surface-container text-text-muted px-2 py-0.5 rounded">
                slug: acme-corp
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Workspace ID: hf_org_99214 • Enterprise Tier (25 Seats Available)
            </p>
          </div>
        </div>

        <div className="text-xs text-text-muted font-mono">
          {team.length} of 25 seats filled
        </div>
      </div>

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
