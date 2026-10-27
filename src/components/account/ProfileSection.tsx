import React, { useState } from 'react';
import type { UserProfile } from '../../types/account';
import { accountService } from '../../services/accountService';

interface ProfileSectionProps {
  initialProfile: UserProfile;
  onTriggerToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  initialProfile,
  onTriggerToast,
}) => {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [newExpertise, setNewExpertise] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleTextChange = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleAddExpertise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpertise.trim() || profile.expertise.includes(newExpertise.trim())) return;
    setProfile((prev) => ({
      ...prev,
      expertise: [...prev.expertise, newExpertise.trim()],
    }));
    setNewExpertise('');
    setIsSaved(false);
  };

  const handleRemoveExpertise = (tag: string) => {
    setProfile((prev) => ({
      ...prev,
      expertise: prev.expertise.filter((t) => t !== tag),
    }));
    setIsSaved(false);
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.trim() || profile.skills.includes(newSkill.trim())) return;
    setProfile((prev) => ({
      ...prev,
      skills: [...prev.skills, newSkill.trim()],
    }));
    setNewSkill('');
    setIsSaved(false);
  };

  const handleRemoveSkill = (tag: string) => {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((t) => t !== tag),
    }));
    setIsSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    accountService.updateProfile(profile);
    setIsSaved(true);
    onTriggerToast({
      type: 'success',
      title: 'Profile Updated',
      message: 'Your personal and professional details have been successfully saved.',
    });
  };

  const handleReset = () => {
    setProfile(initialProfile);
    setIsSaved(false);
    onTriggerToast({
      type: 'info',
      title: 'Profile Reset',
      message: 'Reverted uncommitted profile edits.',
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
      {/* Header with Save status */}
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
        <div>
          <h2 className="text-lg font-bold font-headline-sm text-text-primary">
            Personal & Professional Profile
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Manage your public identity, engineering roles, and security domain expertise.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-surface-container border border-border-subtle transition-all"
          >
            Reset
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isSaved ? 'check' : 'save'}
            </span>
            <span>{isSaved ? 'Saved' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Basic Identity */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Personal Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Full Legal Name
            </label>
            <input
              type="text"
              required
              value={profile.fullName}
              onChange={(e) => handleTextChange('fullName', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              required
              value={profile.displayName}
              onChange={(e) => handleTextChange('displayName', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Username Handle
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-text-muted font-mono text-xs">@</span>
              <input
                type="text"
                required
                value={profile.username}
                onChange={(e) => handleTextChange('username', e.target.value)}
                className="w-full pl-7 pr-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-mono transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => handleTextChange('phone', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">
            Geographic Location & Timezone
          </label>
          <input
            type="text"
            value={profile.location}
            onChange={(e) => handleTextChange('location', e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">
            Professional Bio
          </label>
          <textarea
            rows={3}
            value={profile.bio}
            onChange={(e) => handleTextChange('bio', e.target.value)}
            placeholder="Describe your security focus, AST research, or engineering specializations..."
            className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all leading-relaxed"
          />
        </div>
      </div>

      {/* Section 2: Professional Role & Organization */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Professional Role & Organization
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Official Job Title
            </label>
            <input
              type="text"
              required
              value={profile.jobTitle}
              onChange={(e) => handleTextChange('jobTitle', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Developer / Security Role
            </label>
            <select
              value={profile.role}
              onChange={(e) => handleTextChange('role', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
            >
              <option value="Security Engineer">Security Engineer</option>
              <option value="AppSec Lead">AppSec Lead</option>
              <option value="Staff Software Engineer">Staff Software Engineer</option>
              <option value="DevSecOps Architect">DevSecOps Architect</option>
              <option value="CISO / Security Director">CISO / Security Director</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Organization Name
            </label>
            <input
              type="text"
              required
              value={profile.organization}
              onChange={(e) => handleTextChange('organization', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Department / Business Unit
            </label>
            <input
              type="text"
              value={profile.department}
              onChange={(e) => handleTextChange('department', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-label-ui transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Areas of Expertise & Technical Skills */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Domain Expertise & Technical Skills
        </h3>

        {/* Expertise Tags */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-2">
            Security Expertise Areas
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.expertise.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveExpertise(tag)}
                  className="hover:text-status-critical transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 max-w-md">
            <input
              type="text"
              placeholder="Add expertise (e.g. Memory Safety, OAuth 2.0)..."
              value={newExpertise}
              onChange={(e) => setNewExpertise(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container border border-border-subtle text-xs outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleAddExpertise}
              disabled={!newExpertise.trim()}
              className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold border border-border-subtle disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        {/* Technical Skills */}
        <div className="pt-3 border-t border-border-subtle/50">
          <label className="block text-xs font-semibold text-text-secondary mb-2">
            Languages & Technologies
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container text-text-primary border border-border-subtle text-xs font-mono"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-status-critical transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 max-w-md">
            <input
              type="text"
              placeholder="Add language or tool (e.g. Rust, eBPF)..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container border border-border-subtle text-xs outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleAddSkill}
              disabled={!newSkill.trim()}
              className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold border border-border-subtle disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Section 4: Public Links & Portfolio */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-label-ui">
          Online Presence & Profiles
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              GitHub URL
            </label>
            <input
              type="url"
              value={profile.githubUrl}
              onChange={(e) => handleTextChange('githubUrl', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-mono transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Personal Website
            </label>
            <input
              type="url"
              value={profile.websiteUrl}
              onChange={(e) => handleTextChange('websiteUrl', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-mono transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              LinkedIn Profile
            </label>
            <input
              type="url"
              value={profile.linkedinUrl}
              onChange={(e) => handleTextChange('linkedinUrl', e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary outline-none text-text-primary text-xs font-mono transition-all"
            />
          </div>
        </div>
      </div>
    </form>
  );
};
