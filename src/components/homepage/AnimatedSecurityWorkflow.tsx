import React, { useState, useEffect } from 'react';

interface WorkflowStage {
  id: string;
  name: string;
  icon: string;
  annotation: string;
  detail: string;
  simulatedStatus: string;
  isCheckpoint?: boolean;
}

const STAGES: WorkflowStage[] = [
  {
    id: 'detect',
    name: 'Detect',
    icon: 'search_check',
    annotation: 'Semgrep AST Rules',
    detail: 'Repository commits scanned for unvalidated parameters and vulnerable sinks.',
    simulatedStatus: 'Source detected (payments-api:42)',
  },
  {
    id: 'analyze',
    name: 'Analyze',
    icon: 'neurology',
    annotation: 'Taint Flow Solver',
    detail: 'Inter-procedural propagation proves reachable path from ?query= to database executor.',
    simulatedStatus: 'Taint path mapped (CVE-2024-2149)',
  },
  {
    id: 'generate',
    name: 'Generate Patch',
    icon: 'auto_fix_high',
    annotation: 'Semantic Synthesizer',
    detail: 'Synthesizes parameterized prepared statements without hallucinated modules.',
    simulatedStatus: 'Patch proposed (AST #9402: +12, -5)',
  },
  {
    id: 'review',
    name: 'Human Review',
    icon: 'rate_review',
    annotation: 'Governance Checkpoint',
    detail: 'Pipeline pauses at this checkpoint. Developer inspects diff and approves sandbox test.',
    simulatedStatus: 'Awaiting human sign-off (PAUSED)',
    isCheckpoint: true,
  },
  {
    id: 'verify',
    name: 'Verify',
    icon: 'verified',
    annotation: 'gVisor microVM',
    detail: 'Ephemeral container replays exploit payload and runs 1,420 regression tests.',
    simulatedStatus: 'Verification passed (Exit Code: 0)',
  },
];

export const AnimatedSecurityWorkflow: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const isPausedAtReview = activeStep === 3;

  // Choreographed step progression with deliberate pause at Human Review stage (index 3)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (activeStep === 3) {
      // Pause longer at Human Review checkpoint
      timeout = setTimeout(() => {
        setActiveStep(4);
      }, 5000);
    } else {
      timeout = setTimeout(() => {
        setActiveStep((prev) => (prev + 1) % 5);
      }, 3200);
    }

    return () => clearTimeout(timeout);
  }, [activeStep]);

  return (
    <div className="w-full flex flex-col gap-12">
      {/* Split Section: Left Visual Technical Graph + Right Interactive Connected Stages */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left-Side Animated Technical Illustration (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="relative rounded-2xl bg-surface-dark p-6 border border-outline/20 text-surface-bright overflow-hidden shadow-xl">
            {/* Ambient Background Grid */}
            <div className="absolute inset-0 bg-tech-grid-dense opacity-20 pointer-events-none" />
            <div className="absolute -top-12 -left-12 w-64 h-64 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

            {/* Illustration Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-outline/20">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <span className="font-label-ui text-xs text-surface-bright uppercase tracking-wider">
                  Live AST Taint Flow Topology
                </span>
              </div>
              <span className="font-mono text-[10px] text-primary-fixed bg-primary/20 px-2 py-0.5 rounded">
                STAGE {activeStep + 1} OF 5
              </span>
            </div>

            {/* Animated SVG Technical Circuit */}
            <div className="relative h-64 w-full flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 320 220" fill="none">
                <defs>
                  <linearGradient id="mintGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#20b68e" />
                    <stop offset="100%" stopColor="#76f9cd" />
                  </linearGradient>
                  <linearGradient id="redGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D9383A" />
                    <stop offset="100%" stopColor="#ffdad6" />
                  </linearGradient>
                </defs>

                {/* Circuit Connector Paths */}
                {/* Path 1: Ingress (40, 110) to AST Root (110, 60) */}
                <path
                  d="M 40 110 C 70 110, 80 60, 110 60"
                  stroke={activeStep >= 0 ? '#20b68e' : '#2e3d37'}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className={activeStep >= 0 ? 'animate-data-flow' : ''}
                />

                {/* Path 2: AST Root (110, 60) to Vulnerable Sink (190, 60) */}
                <path
                  d="M 110 60 L 190 60"
                  stroke={activeStep >= 1 ? (activeStep >= 2 ? '#20b68e' : '#D9383A') : '#2e3d37'}
                  strokeWidth="2.5"
                  className={activeStep >= 1 ? 'animate-data-flow' : ''}
                />

                {/* Path 3: Remediation Bypass (110, 60) down to Sanitizer (150, 160) */}
                <path
                  d="M 110 60 C 110 120, 120 160, 150 160"
                  stroke={activeStep >= 2 ? '#20b68e' : '#2e3d37'}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className={activeStep >= 2 ? 'animate-data-flow' : ''}
                />

                {/* Path 4: Sanitizer (150, 160) to Human Checkpoint (220, 160) */}
                <path
                  d="M 150 160 L 220 160"
                  stroke={activeStep >= 3 ? '#20b68e' : '#2e3d37'}
                  strokeWidth="2"
                  className={activeStep >= 3 ? 'animate-data-flow' : ''}
                />

                {/* Path 5: Human Checkpoint to Verified Enclave (280, 110) */}
                <path
                  d="M 220 160 C 250 160, 260 110, 280 110"
                  stroke={activeStep >= 4 ? '#20b68e' : '#2e3d37'}
                  strokeWidth="2.5"
                  className={activeStep >= 4 ? 'animate-data-flow' : ''}
                />

                {/* Node 1: Ingress Source (40, 110) */}
                <circle
                  cx="40"
                  cy="110"
                  r="14"
                  fill="#111d19"
                  stroke="#20b68e"
                  strokeWidth="2"
                />
                <circle cx="40" cy="110" r="5" fill="#76f9cd" className="animate-pulse" />
                <text x="40" y="140" fill="#bbcac2" fontSize="9" fontFamily="monospace" textAnchor="middle">
                  HTTP ?query=
                </text>

                {/* Node 2: AST Node (110, 60) */}
                <circle
                  cx="110"
                  cy="60"
                  r="16"
                  fill="#111d19"
                  stroke={activeStep >= 1 ? '#20b68e' : '#50625c'}
                  strokeWidth="2"
                />
                <text x="110" y="63" fill="#ffffff" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                  AST
                </text>
                <text x="110" y="40" fill="#bbcac2" fontSize="9" fontFamily="monospace" textAnchor="middle">
                  BinaryExpr
                </text>

                {/* Node 3: Vulnerable Sink (190, 60) */}
                <circle
                  cx="190"
                  cy="60"
                  r="18"
                  fill="#111d19"
                  stroke={activeStep < 2 ? '#D9383A' : '#50625c'}
                  strokeWidth="2"
                  className={activeStep < 2 ? 'animate-pulse' : ''}
                />
                <text
                  x="190"
                  y="64"
                  fill={activeStep < 2 ? '#D9383A' : '#50625c'}
                  fontSize="10"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {activeStep < 2 ? 'SQLi' : 'PURGED'}
                </text>

                {/* Node 4: Sanitized Node (150, 160) */}
                <rect
                  x="134"
                  y="146"
                  width="32"
                  height="28"
                  rx="6"
                  fill="#111d19"
                  stroke={activeStep >= 2 ? '#20b68e' : '#50625c'}
                  strokeWidth="2"
                />
                <text x="150" y="163" fill="#76f9cd" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  $1,$2
                </text>
                <text x="150" y="190" fill="#bbcac2" fontSize="9" fontFamily="monospace" textAnchor="middle">
                  AST #9402
                </text>

                {/* Node 5: Human Review Gate (220, 160) */}
                <circle
                  cx="220"
                  cy="160"
                  r="16"
                  fill="#111d19"
                  stroke={activeStep === 3 ? '#E86327' : activeStep > 3 ? '#20b68e' : '#50625c'}
                  strokeWidth="2"
                  className={activeStep === 3 ? 'animate-pulse' : ''}
                />
                <text
                  x="220"
                  y="164"
                  fill={activeStep === 3 ? '#E86327' : activeStep > 3 ? '#20b68e' : '#bbcac2'}
                  fontSize="9"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {activeStep === 3 ? 'PAUSE' : 'GATE'}
                </text>
                <text x="220" y="190" fill="#bbcac2" fontSize="9" fontFamily="monospace" textAnchor="middle">
                  Approval
                </text>

                {/* Node 6: Verification Shield (280, 110) */}
                <polygon
                  points="280,95 296,104 296,122 280,132 264,122 264,104"
                  fill="#111d19"
                  stroke={activeStep >= 4 ? '#0284C7' : '#50625c'}
                  strokeWidth="2"
                  className={activeStep >= 4 ? 'animate-pulse' : ''}
                />
                <text
                  x="280"
                  y="116"
                  fill={activeStep >= 4 ? '#76f9cd' : '#50625c'}
                  fontSize="12"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ✓
                </text>
                <text x="280" y="146" fill="#bbcac2" fontSize="9" fontFamily="monospace" textAnchor="middle">
                  gVisor Safe
                </text>
              </svg>
            </div>

            {/* Live Telemetry Status Box */}
            <div className="mt-4 p-3 rounded-lg bg-[#0a1411] border border-outline/20 font-mono text-xs space-y-1">
              <div className="flex items-center justify-between text-secondary-fixed-dim">
                <span>Active Stage:</span>
                <span className="text-white font-bold">{STAGES[activeStep].name}</span>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <span>Telemetry:</span>
                <span
                  className={
                    activeStep === 3
                      ? 'text-status-high font-bold'
                      : activeStep === 4
                      ? 'text-status-success font-bold'
                      : 'text-primary-fixed'
                  }
                >
                  {STAGES[activeStep].simulatedStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: 5 Connected Interactive Stages (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex flex-col space-y-3">
            {STAGES.map((stage, idx) => {
              const isActive = activeStep === idx;
              const isPast = activeStep > idx;

              return (
                <div
                  key={stage.id}
                  onClick={() => setActiveStep(idx)}
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer relative overflow-hidden ${
                    isActive
                      ? stage.isCheckpoint
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-primary/10 border-primary shadow-md ring-1 ring-primary/30'
                      : isPast
                      ? 'bg-surface-card border-border-subtle hover:border-primary/30'
                      : 'bg-surface-card/60 border-border-subtle/60 opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* Active Indicator Bar on Left */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all ${
                      isActive
                        ? stage.isCheckpoint
                          ? 'bg-amber-500'
                          : 'bg-primary'
                        : isPast
                        ? 'bg-status-success/60'
                        : 'bg-transparent'
                    }`}
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                          isActive
                            ? stage.isCheckpoint
                              ? 'bg-amber-500 text-white font-bold'
                              : 'bg-primary text-on-primary font-bold'
                            : isPast
                            ? 'bg-status-success/20 text-status-success'
                            : 'bg-surface-container text-text-muted'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{stage.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-headline-sm text-text-primary text-sm font-bold">
                            {idx + 1}. {stage.name}
                          </h4>
                          {stage.isCheckpoint && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 font-bold border border-amber-500/30">
                              GOVERNANCE CHECKPOINT
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-label-code-sm text-text-muted">
                          {stage.annotation}
                        </span>
                      </div>
                    </div>

                    <div className="text-right sm:self-center">
                      <span
                        className={`inline-block text-[11px] font-label-code-sm px-2 py-0.5 rounded ${
                          isActive
                            ? stage.isCheckpoint
                              ? 'bg-amber-500/20 text-amber-700 font-bold'
                              : 'bg-primary/20 text-primary font-bold'
                            : isPast
                            ? 'text-status-success bg-emerald-50'
                            : 'text-text-muted bg-surface-container'
                        }`}
                      >
                        {isActive
                          ? stage.isCheckpoint && isPausedAtReview
                            ? 'PAUSED FOR APPROVAL...'
                            : 'PROCESSING...'
                          : isPast
                          ? 'COMPLETE'
                          : 'QUEUED'}
                      </span>
                    </div>
                  </div>

                  <p className="text-body-sm text-text-secondary mt-2 pl-12 leading-relaxed">
                    {stage.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
