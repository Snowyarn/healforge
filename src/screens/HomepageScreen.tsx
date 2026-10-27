import React from 'react';
import type { ScreenId } from '../types';
import { CinematicHeroVisual } from '../components/homepage/CinematicHeroVisual';
import { AnimatedSecurityWorkflow } from '../components/homepage/AnimatedSecurityWorkflow';

interface HomepageScreenProps {
  onLaunchWorkbench: (targetScreen?: ScreenId) => void;
}

export const HomepageScreen: React.FC<HomepageScreenProps> = ({ onLaunchWorkbench }) => {
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body-md selection:bg-primary selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#0c1613]/90 backdrop-blur-md border-b border-white/10 text-surface-bright">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary font-headline-sm font-bold shadow-sm">
              HF
            </div>
            <div>
              <span className="text-headline-sm text-surface-bright font-headline-sm tracking-tight">
                HealForge
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-label-code-sm text-primary-fixed bg-primary/20 px-1.5 py-0.5 rounded font-mono">
                ENGINE v2.4
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-body-sm text-secondary-fixed-dim font-label-ui">
            <a href="#workflow" className="hover:text-surface-bright transition-colors">
              Workflow
            </a>
            <a href="#features" className="hover:text-surface-bright transition-colors">
              Features
            </a>
            <a href="#security" className="hover:text-surface-bright transition-colors">
              Security Model
            </a>
            <a href="#status" className="hover:text-surface-bright transition-colors">
              Status
            </a>
          </nav>

          {/* CTA & User Avatar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onLaunchWorkbench('dashboard')}
              className="px-4 py-2 rounded-full bg-primary text-on-primary font-label-ui text-xs hover:bg-primary-container transition-all shadow-sm flex items-center gap-2"
            >
              <span>Launch Workbench</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>

            <button
              onClick={() => onLaunchWorkbench('account-center')}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center border border-white/20 transition-transform hover:scale-105 active:scale-95"
              title="Open Account & Profile Settings"
              aria-label="Account Settings"
            >
              AV
            </button>
          </div>
        </div>
      </header>

      {/* CINEMATIC HERO SECTION: Left Headline + Right Layered Security Visualization */}
      <section className="relative px-6 pt-12 pb-20 md:pt-16 md:pb-24 bg-[#0a1411] text-surface-bright border-b border-white/10 overflow-hidden">
        {/* Ambient atmospheric depth lighting */}
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] bg-[#0284c7]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-tech-grid opacity-20 pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Column (5 Cols): Confident Typography & Action CTAs */}
          <div className="lg:col-span-5 flex flex-col items-start text-left">
            {/* Status Chip */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-label-code-sm text-primary-fixed mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Autonomous Security Remediation Engine
            </div>

            {/* Confident Headline */}
            <h1 className="text-display-mobile md:text-display font-display tracking-tight leading-[1.1] mb-6 text-white">
              Find vulnerabilities. <br />
              Generate fixes. <br />
              <span className="text-primary-fixed">Verify with evidence.</span>
            </h1>

            {/* Supporting Text */}
            <p className="text-body-md md:text-body-lg text-secondary-fixed-dim mb-8 leading-relaxed font-body-md max-w-lg">
              HealForge automates static taint flow tracing, AST patch synthesis, and ephemeral sandbox
              verification. Eliminate exploitable vulnerability backlogs with mathematically proven pull requests.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => onLaunchWorkbench('dashboard')}
                className="px-6 py-3 rounded-full bg-primary text-on-primary font-label-ui hover:bg-primary-container transition-all flex items-center gap-2 shadow-lg hover:shadow-primary/20 text-sm font-semibold"
              >
                <span>Launch Workbench</span>
                <span className="material-symbols-outlined text-[18px]">launch</span>
              </button>
              <a
                href="#workflow"
                className="px-6 py-3 rounded-full bg-white/5 border border-white/15 text-white font-label-ui hover:bg-white/10 transition-all text-sm flex items-center gap-2"
              >
                <span>Explore the workflow</span>
                <span className="material-symbols-outlined text-[18px]">south</span>
              </a>
            </div>

            {/* Trust Metrics Pill */}
            <div className="mt-10 pt-6 border-t border-white/10 flex items-center gap-6 text-xs font-mono text-secondary-fixed-dim">
              <div>
                <span className="text-white font-bold block text-sm">gVisor v2.9</span>
                <span>MicroVM Sandboxing</span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <span className="text-primary-fixed font-bold block text-sm">100% Deterministic</span>
                <span>AST-Guided Synthesis</span>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Layered Animated Security Product Visual */}
          <div className="lg:col-span-7 w-full">
            <CinematicHeroVisual onOpenWorkbench={() => onLaunchWorkbench('dashboard')} />
          </div>
        </div>
      </section>

      {/* ANIMATED WORKFLOW SECTION: DETECT -> ANALYZE -> GENERATE PATCH -> HUMAN REVIEW -> VERIFY */}
      <section id="workflow" className="px-6 py-24 bg-surface-canvas border-b border-border-subtle">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-body-sm font-label-ui text-primary uppercase tracking-wider block mb-2 font-bold">
              Autonomous Pipeline Architecture
            </span>
            <h2 className="text-headline-lg md:text-display-mobile font-headline-lg text-text-primary tracking-tight">
              Connected Security Workflow
            </h2>
            <p className="text-body-md text-text-secondary mt-3 leading-relaxed">
              Experience the end-to-end journey from source sink detection to gVisor microVM container verification.
              Notice how the pipeline halts at the <strong>Human Review Checkpoint</strong> to ensure full developer
              governance.
            </p>
          </div>

          {/* Interactive Animated Security Workflow Component */}
          <AnimatedSecurityWorkflow />
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="max-w-2xl mb-12">
          <span className="text-body-sm font-label-ui text-primary uppercase tracking-wider block mb-2 font-bold">
            Workbench Architecture
          </span>
          <h2 className="text-headline-lg font-headline-lg text-text-primary tracking-tight">
            Built for enterprise application security teams
          </h2>
          <p className="text-body-md text-text-secondary mt-2">
            Five synchronized workbench modules provide complete visibility into security posture and automated
            remediation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div
            onClick={() => onLaunchWorkbench('vulnerabilities')}
            className="p-6 rounded-xl bg-surface-card border border-border-subtle shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <span className="material-symbols-outlined text-[22px]">bug_report</span>
              </div>
              <h3 className="font-headline-sm text-text-primary mb-2">Vulnerability Taint Analysis</h3>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                Step-by-step taint path visualization with exact source lines, reachability status, CVSS scoring, and
                OWASP Top 10 compliance classification.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-body-sm text-primary font-label-ui">
              <span>Inspect Findings Module</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 2 */}
          <div
            onClick={() => onLaunchWorkbench('patch-review')}
            className="p-6 rounded-xl bg-surface-card border border-border-subtle shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <span className="material-symbols-outlined text-[22px]">code</span>
              </div>
              <h3 className="font-headline-sm text-text-primary mb-2">Human-Governed Patch Review</h3>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                Side-by-side colorized diff viewer with AI agent rationale, AST flow graph impact, and actionable review
                controls (Approve, Reject, or Request Changes).
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-body-sm text-primary font-label-ui">
              <span>Inspect Patch Review</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div
            onClick={() => onLaunchWorkbench('verification')}
            className="p-6 rounded-xl bg-surface-card border border-border-subtle shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <span className="material-symbols-outlined text-[22px]">verified</span>
              </div>
              <h3 className="font-headline-sm text-text-primary mb-2">Isolated Sandbox Verification</h3>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                Live gVisor microVM execution console delivering syscall intercept logs, exploit neutralization checks,
                and exportable cryptographic evidence manifests.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-body-sm text-primary font-label-ui">
              <span>Inspect Sandbox Engine</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div
            onClick={() => onLaunchWorkbench('agent-activity')}
            className="p-6 rounded-xl bg-surface-card border border-border-subtle shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <span className="material-symbols-outlined text-[22px]">neurology</span>
              </div>
              <h3 className="font-headline-sm text-text-primary mb-2">Agent Activity & Telemetry</h3>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                Real-time chronological execution stream with expandable STDOUT traces, multi-stage progress steppers,
                and repository monitoring indicators.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-body-sm text-primary font-label-ui">
              <span>Inspect Agent Streams</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 5 */}
          <div
            onClick={() => onLaunchWorkbench('dashboard')}
            className="p-6 rounded-xl bg-surface-card border border-border-subtle shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <span className="material-symbols-outlined text-[22px]">dashboard</span>
              </div>
              <h3 className="font-headline-sm text-text-primary mb-2">Posture & Velocity Dashboard</h3>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                Central command overview aggregating critical/high vulnerability counts, repository security scores,
                remediation velocity rates, and passing verification metrics.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-body-sm text-primary font-label-ui">
              <span>Open Dashboard</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-xl bg-surface-card border border-border-subtle shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-4">
                <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
              </div>
              <h3 className="font-headline-sm text-text-primary mb-2">Cryptographic Audit Bundles</h3>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                Each verified patch outputs an immutable evidence manifest containing test durations, syscall logs,
                seccomp profiles, and SHA-256 signatures for compliance review.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border-subtle text-xs font-label-code-sm text-text-muted">
              Standard JSON Attestation Format
            </div>
          </div>
        </div>
      </section>

      {/* Security & Operational Status Section */}
      <section id="security" className="px-6 py-20 bg-surface-container-low border-y border-border-subtle">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className="text-body-sm font-label-ui text-primary uppercase tracking-wider block mb-2 font-bold">
              Security Architecture
            </span>
            <h2 className="text-headline-lg font-headline-lg text-text-primary tracking-tight">
              Safety Guarantees & Operational Boundaries
            </h2>
            <p className="text-body-md text-text-secondary mt-3">
              HealForge is designed to analyze and remediate security flaws without introducing risk to developer
              environments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="p-6 rounded-xl bg-surface-card border border-border-subtle">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-primary text-[24px]">shield</span>
                <h3 className="font-headline-sm text-text-primary">Zero Host Code Execution</h3>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                Untrusted code is never compiled, linked, or executed on the host browser machine or developer laptop.
                All execution is confined to isolated microVM sandbox containers with non-root seccomp barriers.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface-card border border-border-subtle">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-primary text-[24px]">rule</span>
                <h3 className="font-headline-sm text-text-primary">AST-Constrained Patch Synthesis</h3>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                Autonomous patches operate strictly within verified abstract syntax tree rules. Hallucinated APIs,
                insecure fallback libraries, or unverified dependencies are rejected by automated policy checkers.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface-card border border-border-subtle">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-primary text-[24px]">verified_user</span>
                <h3 className="font-headline-sm text-text-primary">Human-in-the-Loop Governance</h3>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                Autonomous remediation runs non-destructively in isolated git branches. Direct production merges require
                explicit human approval with review controls.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface-card border border-border-subtle">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-primary text-[24px]">fact_check</span>
                <h3 className="font-headline-sm text-text-primary">Transparent Prototype Status</h3>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                This workbench implementation executes on React 19 + TypeScript. All background scanning, patch
                application, and sandbox traces operate in deterministic mock simulation mode for design and UX validation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Status Table */}
      <section id="status" className="px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-surface-container-low border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">speed</span>
              <h3 className="font-headline-sm text-text-primary text-base">Current Implementation Status</h3>
            </div>
            <span className="text-[11px] font-label-code-sm bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
              Frontend Prototype v2.4
            </span>
          </div>
          <div className="divide-y divide-border-subtle text-body-sm">
            <div className="p-4 sm:flex sm:items-center justify-between">
              <div>
                <span className="font-label-ui text-text-primary block">User Interface & Stitch Fidelity</span>
                <span className="text-text-secondary text-xs">
                  All 5 Google Stitch approved screens fully implemented with responsive Tailwind tokens.
                </span>
              </div>
              <span className="mt-2 sm:mt-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-code-sm text-xs bg-emerald-50 text-status-success border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success" /> Implemented
              </span>
            </div>

            <div className="p-4 sm:flex sm:items-center justify-between">
              <div>
                <span className="font-label-ui text-text-primary block">Cinematic Hero & Animated Workflow</span>
                <span className="text-text-secondary text-xs">
                  Layered SVG & CSS circuit graph with human checkpoint gate and custom cybersecurity hero visual asset.
                </span>
              </div>
              <span className="mt-2 sm:mt-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-code-sm text-xs bg-emerald-50 text-status-success border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success" /> Active
              </span>
            </div>

            <div className="p-4 sm:flex sm:items-center justify-between">
              <div>
                <span className="font-label-ui text-text-primary block">Skeleton Loading System</span>
                <span className="text-text-secondary text-xs">
                  Screen-specific CSS shimmer layouts matching exact component metrics with reduced-motion support.
                </span>
              </div>
              <span className="mt-2 sm:mt-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-code-sm text-xs bg-emerald-50 text-status-success border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success" /> Active
              </span>
            </div>

            <div className="p-4 sm:flex sm:items-center justify-between">
              <div>
                <span className="font-label-ui text-text-primary block">Live Production Security Engine</span>
                <span className="text-text-secondary text-xs">
                  Direct connection to real gVisor microVM cluster and enterprise repository webhooks.
                </span>
              </div>
              <span className="mt-2 sm:mt-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-code-sm text-xs bg-surface-container text-text-muted border border-border-subtle">
                Phase 6 Backend Spec
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Restrained Dark Footer */}
      <footer className="mt-auto bg-surface-dark text-surface-bright py-12 px-6 border-t border-outline/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-on-primary text-xs font-bold">
                HF
              </div>
              <span className="font-headline-sm tracking-tight text-white">HealForge</span>
            </div>
            <p className="text-xs text-secondary-fixed-dim max-w-md leading-relaxed">
              Autonomous code security analysis and remediation workbench prototype. Built with React 19, TypeScript,
              and Tailwind CSS based on approved Google Stitch designs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-secondary-fixed-dim font-label-ui">
            <button
              onClick={() => onLaunchWorkbench('dashboard')}
              className="hover:text-surface-bright transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => onLaunchWorkbench('vulnerabilities')}
              className="hover:text-surface-bright transition-colors"
            >
              Findings
            </button>
            <button
              onClick={() => onLaunchWorkbench('patch-review')}
              className="hover:text-surface-bright transition-colors"
            >
              Patch Review
            </button>
            <button
              onClick={() => onLaunchWorkbench('verification')}
              className="hover:text-surface-bright transition-colors"
            >
              Verification
            </button>
            <button
              onClick={() => onLaunchWorkbench('agent-activity')}
              className="hover:text-surface-bright transition-colors"
            >
              Agent Streams
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-outline/20 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-text-muted gap-4">
          <span>HealForge Security Workbench Prototype. Simulated workflows for design validation.</span>
          <span>Zero Host Code Execution Guarantee</span>
        </div>
      </footer>
    </div>
  );
};
