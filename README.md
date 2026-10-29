# 🛡️ HealForge — Autonomous Code Security & Remediation Workbench

<p align="center">
  <img src="src/assets/hero.png" alt="HealForge Workbench Hero" width="850" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); max-width: 100%;" />
</p>

<p align="center">
  <strong>Autonomous vulnerability detection, interprocedural AST taint tracking, automated patch synthesis, and ephemeral gVisor microVM verification.</strong>
</p>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x%2F6.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-PostgreSQL_15+-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" /></a>
  <a href="https://gvisor.dev/"><img src="https://img.shields.io/badge/Sandbox-gVisor_runsc-FF6F00?style=for-the-badge&logo=googlecloud&logoColor=white" alt="gVisor microVM" /></a>
  <a href="https://oxc.rs/"><img src="https://img.shields.io/badge/Linter-Oxlint-F59E0B?style=for-the-badge" alt="Oxlint" /></a>
  <img src="https://img.shields.io/badge/Security-Cryptographic_Attestation-10B981?style=for-the-badge&logo=shield" alt="Attestation" />
</p>

---

## 📌 Executive Summary

Modern static application security testing (SAST) tools overwhelm engineering teams with hundreds of noisy, unvalidated vulnerability alerts. **HealForge** closes the loop between **vulnerability discovery** and **production-grade remediation**. 

By uniting **deep Abstract Syntax Tree (AST) taint analysis** with **autonomous patch synthesis** and **isolated microVM sandbox verification (`gVisor runsc`)**, HealForge ensures every proposed fix is mathematically traced, syntax-safe, and cryptographically attested to be **regression-free** before hitting human code review.

---

## 📐 System Architecture & Visual Flowcharts

### 1. Autonomous Remediation Lifecycle

```mermaid
flowchart TD
    classDef sourceStyle fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;
    classDef engineStyle fill:#0f172a,stroke:#8b5cf6,stroke-width:2px,color:#f8fafc;
    classDef agentStyle fill:#1e1b4b,stroke:#ec4899,stroke-width:2px,color:#f8fafc;
    classDef sandboxStyle fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#f8fafc;
    classDef auditStyle fill:#312e81,stroke:#6366f1,stroke-width:2px,color:#f8fafc;

    subgraph INGESTION["1. Repository Ingestion & Scans"]
        A[Git Repository<br/>GitHub / GitLab / Bitbucket]:::sourceStyle --> B[Multi-Engine Security Scanner]:::engineStyle
        B --> C1[AST SAST Engine]:::engineStyle
        B --> C2[SBOM Dependency Audit]:::engineStyle
        B --> C3[Secret & Token Detector]:::engineStyle
        B --> C4[Container Policy Audit]:::engineStyle
    end

    subgraph ANALYSIS["2. Taint Graph & Reachability"]
        C1 & C2 & C3 & C4 --> D[Interprocedural AST Taint Graph]:::engineStyle
        D --> E{Sink Reachable?}:::engineStyle
        E -- No --> F[Mark False Positive / Deprioritize]:::sourceStyle
        E -- Yes --> G[CVSS & CWE Vulnerability Record]:::engineStyle
    end

    subgraph AGENT["3. AI Security Agent & Patch Synthesis"]
        G --> H[AI Remediation Agent]:::agentStyle
        H --> I[AST Mutation Synthesizer]:::agentStyle
        I --> J[Side-by-Side Patch Generation]:::agentStyle
    end

    subgraph VERIFICATION["4. Ephemeral gVisor Sandbox Execution"]
        J --> K[gVisor microVM Container<br/>runsc Sandbox]:::sandboxStyle
        K --> L[Automated Unit & Integration Test Suite]:::sandboxStyle
        K --> M[Syscall Boundary & Regression Check]:::sandboxStyle
        L & M --> N{Zero Regressions &<br/>100% Tests Pass?}:::sandboxStyle
        N -- Failed --> H
        N -- Passed --> O[Cryptographic Attestation Hash<br/>SHA-256 / Ed25519 Digest]:::sandboxStyle
    end

    subgraph PRODUCTION["5. Review & Pull Request Deployment"]
        O --> P[HealForge Patch Review Workbench]:::auditStyle
        P --> Q[Human-in-the-Loop Sign-off]:::auditStyle
        Q --> R[Automated Pull Request<br/>Verified & Merged]:::sandboxStyle
        R --> S[Immutable Compliance Audit Trail<br/>Supabase DB]:::auditStyle
    end
```

---

### 2. Full-Stack Component Interaction

```mermaid
graph LR
    subgraph Client["Frontend Workbench (React 19 + TypeScript + Vite)"]
        UI[Interactive UI Screens<br/>19 Dedicated Views]
        WS[Workbench Reactive Service Layer]
        UI <--> WS
    end

    subgraph CoreEngine["HealForge Agentic Core"]
        AST[AST Taint Analysis Engine]
        SYN[Patch Synthesis Engine]
        VER[Attestation Controller]
    end

    subgraph MicroVM["Verification Sandbox"]
        RUNSC[gVisor runsc microVM]
        TESTS[Regression Test Runner]
        RUNSC --> TESTS
    end

    subgraph Backend["Data & Compliance Layer (Supabase / Postgres 15+)"]
        DB[(Supabase PostgreSQL)]
        RLS[Row Level Security]
        AUDIT[Immutable Audit Trail]
        DB --- RLS
        DB --- AUDIT
    end

    WS <--> CoreEngine
    CoreEngine <--> MicroVM
    WS <--> Backend
    CoreEngine <--> Backend
```

---

## ✨ Key Capabilities & Workbench Modules

HealForge is designed around **19 cohesive workbench modules** divided into 5 operational domains:

```
├── 🏢 Workspace
│   ├── 📊 Dashboard: Unified posture metrics, MTTR velocity, active sandboxes, repo health
│   ├── 📁 Repositories: Branch protection policies, health scores, automated scan triggers
│   ├── 🐛 Bug Report Intake: Security triage form with PoC attachments and automated reproduction
│   └── 🔍 Vulnerabilities: Deep vulnerability catalog with CVSS metrics and CWE/CVE mapping
│
├── 🤖 AI Security Agent
│   ├── ⚡ Security Scans: Multi-engine configurator with live terminal log streaming
│   ├── 🔬 Code Explorer: 3-panel AST investigation environment with line sink highlights
│   ├── 🔄 Patch Review: Side-by-side AST mutation diff viewer with rationale inspection
│   └── ⏱️ Agent Activity: Multi-stage trace logs, timing metrics, and tool execution history
│
├── 🛡️ Validation & Results
│   ├── 🧪 Verification & Sandbox: Ephemeral gVisor microVM runtime testbed with live logs
│   ├── 📜 Verified Fixes: Attestation proof registry documenting zero regressions
│   ├── 📜 Scan History: Historical run deltas and commit-to-commit comparison tools
│   ├── 🧠 Security Intelligence: OWASP Top 10 and CWE Top 25 density analytics
│   └── 📑 Reports & Audit Trail: Cryptographic audit trail and downloadable executive PDFs
│
├── ⚙️ Enterprise Integrations & Account Center
│   ├── 🔑 Personal Access Tokens (PAT) & API Key Management
│   ├── 🔐 TOTP Two-Factor Authentication & Active Session Management
│   ├── 👥 Role-Based Access Control (RBAC): Owner, Admin, Security Engineer, Dev, Viewer
│   └── 🔔 Real-time Webhooks & SIEM / Slack / Jira Event Dispatchers
│
└── 🌐 Immersive Homepage
    └── Cinematic technical showcase featuring animated taint-flow graphs & live telemetry
```

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) | Latest concurrent React primitives and seamless component lifecycle |
| **Language** | [TypeScript 5.x / 6.x](https://www.typescriptlang.org/) | End-to-end type safety, strict compile checks, and robust data schemas |
| **Build & Tooling** | [Vite 8](https://vitejs.dev/) | Lightning-fast HMR and optimized production asset bundling |
| **Styling & Design** | [Tailwind CSS v3](https://tailwindcss.com/) | Bespoke cyber-security aesthetic with dark mode and high-contrast telemetry |
| **Database & Auth** | [Supabase](https://supabase.com/) / [PostgreSQL 15+](https://www.postgresql.org/) | Multi-tenant schema, pgTAP unit tests, and Row Level Security (RLS) |
| **Verification Runtime** | [gVisor `runsc`](https://gvisor.dev/) | Application-level microVM sandbox providing syscall isolation |
| **Code Quality** | [Oxlint](https://oxc.rs/) | Blazing-fast Rust-based static code linter |
| **Architecture** | Reactive Service Layer | Event subscription pattern with synchronized local and cloud state |

---

## 🚀 Quickstart & Local Development

### Prerequisites

Ensure you have the following installed on your development machine:
- **Node.js**: `v20.x` or `v24.x` (LTS recommended)
- **npm**: `v10.x` or `v11.x` (or `pnpm` / `bun`)
- **Docker** / **gVisor** *(optional, for running local microVM sandbox tests)*
- **Supabase CLI** *(optional, for local database migrations)*

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/Rohi56u/healforge.git
cd healforge

# Install frontend dependencies
npm install
```

### 2. Run the Development Server

```bash
# Start Vite development server
npm run dev
```

Visit [`http://localhost:5173`](http://localhost:5173) in your browser.

To expose the development server to your local network:
```bash
npm run dev -- --host
```

### 3. Build & Quality Checks

```bash
# Typecheck with TypeScript and build production bundle
npm run build

# Run fast code linting via Oxlint
npm run lint

# Preview production build locally
npm run preview
```

---

## 🗄️ Database Foundation & Schema Architecture

HealForge includes an enterprise-grade Supabase / PostgreSQL foundation located in `supabase/migrations/`:

```
supabase/
├── migrations/
│   ├── 20261027120000_core_schema.sql           # Workspaces, Scans, Vulnerabilities, Sandboxes, Attestations
│   ├── 20261027120100_functions_and_triggers.sql # Automated status updates, audit triggers, metrics calculation
│   └── 20261027120200_row_level_security.sql    # Multi-tenant tenant-isolation RLS policies
├── tests/
│   ├── 01_schema_structure.test.sql             # pgTAP schema verification
│   ├── 02_security_rls.test.sql                 # Row Level Security isolation test suite
│   ├── 03_immutability_and_dedup.test.sql       # Attestation & audit log tamper resistance
│   └── 04_behavioral_security.test.sql          # State transitions and automated rollback tests
└── seed.sql                                     # Rich demo seeds for instant testing
```

To run the database test suite:
```bash
npm run test:db
```

---

## 🔒 Security Model & Cryptographic Attestation

Every automated remediation synthesized by HealForge undergoes a four-step verification protocol:

1. **AST Taint Path Containment**: Confirms that the mutation breaks the source-to-sink dataflow path without altering unrelated abstract syntax nodes.
2. **Deterministic gVisor microVM Execution**: Evaluates the patch against all existing unit and regression tests in a strictly isolated `runsc` sandbox with filtered system calls.
3. **Attestation Signature Generation**: Computes a cryptographic checksum (`SHA-256` / `Ed25519`) of the patch contents, test logs, container exit codes, and AST diff.
4. **Immutable Audit Registration**: The signature is recorded in an append-only PostgreSQL ledger, ensuring zero tampering prior to human sign-off.

---

## 🗺️ Roadmap

- [x] Multi-engine scan orchestration (AST SAST, SBOM, Secrets, Container).
- [x] Ephemeral sandbox telemetry streaming & attestation digest generator.
- [x] 19-screen workbench UI with full Account Center and RBAC controls.
- [x] Supabase multi-tenant schema with comprehensive RLS and pgTAP test coverage.
- [ ] Direct GitHub App bidirectional integration for real-time PR status checks.
- [ ] Dynamic WebAssembly (Wasm) in-browser AST parser preview.
- [ ] eBPF runtime observability inside live production environments.

---

## 🤝 Contributing

Contributions to **HealForge** are warmly welcomed! Please observe the following workflow:

1. **Fork the Repository** to your own GitHub account.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/amazing-security-feature
   ```
3. **Commit Your Changes**: Follow conventional commit guidelines (`feat:`, `fix:`, `docs:`, `test:`).
   ```bash
   git commit -m "feat(agent): enhance AST mutation validator for prototype pollution"
   ```
4. **Run Verification & Tests**:
   ```bash
   npm run build
   npm run lint
   ```
5. **Open a Pull Request**: Submit your PR with a clear description of the problem solved and test evidence.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) (or Internal Proprietary specifications where designated). See repository headers for details.

---

<p align="center">
  Crafted with precision for modern Application Security & DevSecOps engineering teams.
</p>
