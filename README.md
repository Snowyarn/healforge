# HealForge — Autonomous Code Security & Remediation Workbench

HealForge is an autonomous code security analysis and remediation platform. It bridges the gap between vulnerability detection and patch verification through interprocedural Abstract Syntax Tree (AST) taint analysis, automated pull request generation, and ephemeral gVisor microVM sandbox verification.

---

## Current Implementation Status

The project is fully scaffolded and implemented in React 19, TypeScript, Vite, and Tailwind CSS v3, reproducing the approved Google Stitch design specifications across 19 workbench sections:

### 1. Workspace
- **Dashboard:** Unified metrics overview (monitored repositories, recent scans, critical/high findings, pending patches, verified fixes, velocity trends).
- **Repositories & Projects:** Multi-project management view with branch policies, health scores, and vulnerability backlogs.
- **Bug Report:** Security issue triage intake form with validation, PoC evidence attachments, and status tracking.
- **Vulnerabilities:** In-depth findings explorer with CVSS metrics, CWE/CVE mappings, and step-by-step taint tracking.

### 2. AI Security Agent
- **Security Scans:** Multi-engine scan configurator (AST SAST, SBOM dependency auditing, secret detection, container policy audit) with live terminal log streaming.
- **Code Explorer:** Three-panel code investigation environment with file tree navigation, syntax highlighting, and highlighted vulnerable line sinks.
- **Patch Review:** Side-by-side AST mutation diff viewer with syntax conventions, safety rationale, and human-in-the-loop approval actions.
- **Agent Activity:** Progressive timeline tracing multi-stage agent reasoning and tool executions.

### 3. Validation & Results
- **Verification & Sandbox:** Isolated ephemeral gVisor microVM (`runsc`) execution testbed with cryptographic attestation digests.
- **Verified Fixes:** Attestation proof registry documenting 100% test pass rates and zero-regression assurances.
- **Scan History:** Historical scan runs with a differential comparison tool showing delta findings between commits.
- **Security Intelligence:** OWASP Top 10 and MITRE CWE Top 25 density analytics, MTTR tracking, and risk methodologies.
- **Reports & Audit Trail:** Downloadable executive compliance reports and searchable, immutable system activity audit logs.

### 4. Integrations & Settings (Account Center)
- Dedicated 15-domain settings center managing personal profiles, email identity, password & TOTP 2FA, active device sessions, subscription quotas, personal access tokens, webhooks, data export, and organizational RBAC.

### 5. Homepage
- Immersive cinematic landing experience featuring technical storytelling, animated taint-flow node graph, and human review checkpoint.

---

## Tech Stack

- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler:** [Vite 8](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v3](https://tailwindcss.com/) with custom HealForge design system tokens
- **Linter:** [Oxlint](https://oxc.rs/)
- **State & Storage:** LocalStorage-backed reactive service layer with event subscription

---

## Local Setup & Development

### Prerequisites
- Node.js (v20.x or v24.x recommended)
- npm (v10.x or v11.x)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd healforge

# Install dependencies
npm install
```

### Running Locally
```bash
# Start the local development server (http://localhost:5173)
npm run dev

# Expose to local network
npm run dev -- --host
```

### Production Build & Linting
```bash
# Typecheck and build production bundle
npm run build

# Run Oxlint
npm run lint
```

---

## License

Internal Proprietary — All Rights Reserved.
