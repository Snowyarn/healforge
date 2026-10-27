import React, { useState, useEffect } from 'react';

interface CinematicHeroVisualProps {
  onOpenWorkbench?: () => void;
}

export const CinematicHeroVisual: React.FC<CinematicHeroVisualProps> = ({ onOpenWorkbench }) => {
  // Automated animation phase cycling: 0: Detect, 1: Taint Solver, 2: Patch Diff, 3: Verified Sandbox
  const [activePhase, setActivePhase] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActivePhase((prev) => (prev + 1) % 4);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-border-strong/40 bg-[#0c1613] shadow-2xl">
      {/* Background Cinematic Illustration Asset */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <img
          src="/images/healforge-cinematic-hero.png"
          alt="HealForge Autonomous Security Network"
          className="w-full h-full object-cover object-center opacity-40 scale-105 filter contrast-125 brightness-90"
          loading="eager"
        />
        {/* Subtle Depth Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1613] via-[#0c1613]/70 to-[#0c1613]/40" />
        <div className="absolute inset-0 bg-tech-grid opacity-30" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Foreground Interactive Visual Canvas */}
      <div className="relative z-10 p-5 sm:p-6 lg:p-7 flex flex-col gap-5">
        {/* Top Control Bar / Telemetry */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-status-critical/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-status-medium/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-status-success/80" />
            <span className="font-label-code-sm text-secondary-fixed-dim ml-2 font-mono">
              HealForge Engine v2.4 // Target: <span className="text-white">payments-api</span>
            </span>
          </div>

          {/* Stepper Phase Indicators */}
          <div className="flex items-center gap-1.5 font-label-code-sm text-[11px]">
            {['Detect', 'Solve AST', 'Patch', 'Verified'].map((name, i) => (
              <button
                key={name}
                onClick={() => setActivePhase(i)}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                  activePhase === i
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'text-text-muted hover:text-white bg-white/5'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Layer 1: Vulnerable Code Panel with Laser Scanline */}
        <div className="relative rounded-xl bg-surface-dark/95 border border-white/10 p-4 shadow-lg overflow-hidden backdrop-blur-sm">
          {/* Laser scan line running vertically */}
          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scanline pointer-events-none z-20 opacity-70" />

          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-status-critical text-[16px]">bug_report</span>
              <span className="font-label-code-sm text-surface-bright font-mono">
                backend/handlers/reports.go
              </span>
              <span className="text-[10px] bg-status-critical/20 text-status-critical border border-status-critical/30 px-1.5 py-0.2 rounded font-mono">
                CVE-2024-2149
              </span>
            </div>
            <span className="text-[11px] font-label-code-sm text-text-muted font-mono">Go • AST Node #142</span>
          </div>

          {/* Code block */}
          <div className="font-mono text-[11px] sm:text-xs leading-relaxed space-y-1 overflow-x-auto text-secondary-fixed-dim">
            <div className="text-text-muted select-none">
              <span className="inline-block w-6 text-right pr-2">42</span>
              <span>func GetUserReports(db *sql.DB, query string) error &#123;</span>
            </div>
            <div
              className={`p-1.5 rounded transition-all duration-300 ${
                activePhase === 0
                  ? 'bg-status-critical/25 text-status-critical border border-status-critical/40 font-bold'
                  : 'text-status-critical/90 bg-status-critical/10'
              }`}
            >
              <span className="inline-block w-6 text-right pr-2 select-none">- 44</span>
              <span>queryString := fmt.Sprintf("SELECT * FROM reports WHERE q='%s'", query)</span>
            </div>
            <div
              className={`p-1.5 rounded transition-all duration-300 ${
                activePhase >= 2
                  ? 'bg-status-success/25 text-status-success border border-status-success/40 font-bold'
                  : 'hidden'
              }`}
            >
              <span className="inline-block w-6 text-right pr-2 select-none">+ 45</span>
              <span>stmt := `SELECT * FROM reports WHERE q=$1`; db.Query(stmt, query)</span>
            </div>
            <div className="text-text-muted select-none">
              <span className="inline-block w-6 text-right pr-2">46</span>
              <span>  return db.Query(queryString)</span>
            </div>
          </div>
        </div>

        {/* SVG Connector & Data Flow Pathway */}
        <div className="relative h-6 flex items-center justify-center">
          <svg className="w-full h-6" viewBox="0 0 400 24" fill="none">
            <path
              d="M 50 0 L 50 12 L 200 12 L 350 12 L 350 24"
              stroke="#20b68e"
              strokeWidth="1.5"
              strokeOpacity="0.3"
            />
            <path
              d="M 50 0 L 50 12 L 200 12 L 350 12 L 350 24"
              stroke="#76f9cd"
              strokeWidth="1.5"
              className="animate-data-flow"
            />
          </svg>
        </div>

        {/* Layer 2: Split Workbench Details — AST Graph on Left, Sandbox on Right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Box A: AST Taint Solver Pipeline */}
          <div
            className={`p-4 rounded-xl bg-surface-dark/95 border transition-all duration-300 ${
              activePhase === 1
                ? 'border-primary ring-1 ring-primary/40 shadow-lg bg-surface-dark'
                : 'border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-label-ui text-surface-bright flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">neurology</span>
                AST Semantic Taint Solver
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  activePhase === 1
                    ? 'bg-primary text-on-primary font-bold animate-pulse'
                    : 'text-text-muted bg-white/5'
                }`}
              >
                {activePhase === 1 ? 'SOLVING SINK' : 'ANALYZED'}
              </span>
            </div>

            {/* AST Graph Nodes Visual */}
            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-[#0a1411] border border-white/5">
                <span className="text-secondary-fixed-dim">Source: HTTP ?query=</span>
                <span className="text-[#0284C7] bg-sky-950/60 px-1.5 py-0.5 rounded text-[10px]">
                  Taint Ingress
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#0a1411] border border-primary/20">
                <span className="text-secondary-fixed-dim">Transform: BinaryExpr</span>
                <span className="text-primary-fixed bg-emerald-950/60 px-1.5 py-0.5 rounded text-[10px]">
                  AST Mutation #9402
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#0a1411] border border-status-critical/20">
                <span className="text-secondary-fixed-dim">Target Sink: db.Query</span>
                <span className="text-status-success bg-emerald-950/60 px-1.5 py-0.5 rounded text-[10px]">
                  Parameterized
                </span>
              </div>
            </div>
          </div>

          {/* Box B: Isolated gVisor Sandbox Container */}
          <div
            className={`p-4 rounded-xl bg-surface-dark/95 border transition-all duration-300 ${
              activePhase === 3
                ? 'border-status-success ring-1 ring-status-success/40 shadow-lg'
                : 'border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-label-ui text-surface-bright flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary-fixed text-[16px]">terminal</span>
                gVisor Sandbox: <code className="text-primary-fixed font-mono font-bold">sb-88f2a1</code>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-status-success/20 text-status-success border border-status-success/30">
                PID 9402
              </span>
            </div>

            {/* Terminal Log Snippet */}
            <div className="p-2.5 rounded bg-[#07100d] border border-white/5 font-mono text-[10px] space-y-1.5 text-secondary-fixed-dim">
              <div className="flex justify-between text-text-muted">
                <span>[00:00.89] seccomp profile applied</span>
                <span className="text-status-success">PASS</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>[00:01.56] exploit payload replay</span>
                <span className="text-status-success">BLOCKED</span>
              </div>
              <div className="flex justify-between text-surface-bright font-bold pt-1 border-t border-white/5">
                <span>[00:06.74] regression test suite</span>
                <span className="text-status-success">1,420/1,420 GREEN</span>
              </div>
            </div>

            {/* Proof Digest Seal */}
            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-text-muted">
              <span>SHA-256 Attestation:</span>
              <span className="text-primary-fixed font-bold truncate max-w-[130px]">e3b0c44298fc1c...</span>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-white/10">
          <div className="flex items-center gap-2 text-text-muted font-label-code-sm">
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
            <span>Interactive product simulation • Zero host execution</span>
          </div>

          {onOpenWorkbench && (
            <button
              onClick={onOpenWorkbench}
              className="px-3.5 py-1.5 rounded-full bg-primary/20 hover:bg-primary text-primary-fixed hover:text-on-primary font-label-ui transition-all flex items-center gap-1.5 text-xs border border-primary/30"
            >
              <span>Inspect Live in Workbench</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
