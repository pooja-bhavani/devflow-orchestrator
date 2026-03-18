# DevFlow Orchestrator

> **You Orchestrate. AI Accelerates.**
> A GitLab issue comes in → 8 AI agents collaborate → root cause diagnosed, code fixed, security scanned, compliance checked, tests written, deployment configured, and a merge request created — automatically.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitLab Duo](https://img.shields.io/badge/GitLab%20Duo-Agent%20Platform-fc6d26)](https://docs.gitlab.com/ee/user/gitlab_duo/)
[![Anthropic Claude](https://img.shields.io/badge/Powered%20by-Anthropic%20Claude-191919)](https://anthropic.com)
[![Green Agent](https://img.shields.io/badge/Green%20Agent-Token%20Efficient-3fb950)](https://devpost.com/software/devflow-orchestrator)

---

## The Problem

Developers lose **7 hours per week** to manual DevSecOps bottlenecks:

- Security and compliance issues found **after** deployment — too late, too expensive
- AI writes code faster than ever, but **planning, security, compliance, and deployment are still manual**
- Teams use **5+ disconnected tools** with no orchestration
- Every production incident requires manual root cause analysis, fix, review, and deploy cycle

**DevFlow Orchestrator eliminates this entire cycle with one trigger.**

---

## The Solution

DevFlow Orchestrator listens for GitLab issue events and runs an **8-agent pipeline powered by Anthropic Claude via GitLab Duo Agent Platform**. It works on **any issue, any repo, any language** — not a demo, not hardcoded scenarios.

```
GitLab Issue Created
        │
        ▼
🔍 RootCauseAgent    → Diagnoses ANY issue dynamically with Claude
        │
        ▼
🧠 SpecAgent         → Breaks issue into tasks, files, acceptance criteria
        │
        ▼
💻 CodeAgent         → Generates production-ready fixes
        │
        ▼
📋 ComplianceAgent   → GDPR, SOC2, OWASP ASVS, CIS, NIST checks
        │
        ▼
🔒 SecurityAgent     → OWASP Top 10 scan, secrets detection, CVE analysis
        │
        ▼
🧪 TestAgent         → Full Jest test suite with edge cases
        │
        ▼
👁️  ReviewAgent      → Code review + MR description
        │
        ▼
🚀 DeployAgent       → Dockerfile, K8s manifests, CI/CD pipeline
        │
        ▼
✅ Merge Request     → Auto-created with full RCA, security & compliance report
```

All stages stream live to a real-time dashboard via WebSocket.

---

## Demo

🎥 **[Watch 3-minute demo on YouTube](#)** ← add your link here

🖥️ **Live dashboard** at `http://localhost:3000` after setup

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://gitlab.com/gitlab-ai-hackathon/participants/23075558.git devflow-orchestrator
cd devflow-orchestrator
npm install
```

### 2. Configure `.env`
```bash
cp .env.example .env
# Fill in your values:
# GITLAB_TOKEN=glpat-...
# GITLAB_PROJECT_ID=...
# ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Seed GitLab issues (optional)
```bash
npm run setup
```

### 4. Run
```bash
npm run dev
```
Open **http://localhost:3000**

---

## Triggering the Pipeline

### Option A — Dashboard
Enter any GitLab Issue IID → click ▶ Run Pipeline

### Option B — GitLab Webhook (automatic)
1. GitLab project → Settings → Webhooks
2. URL: `http://your-server:3000/webhook`
3. Secret: your `WEBHOOK_SECRET`
4. Trigger: ✅ Issues events
5. Create any issue → pipeline starts automatically

### Option C — API
```bash
curl -X POST http://localhost:3000/trigger/3
```

### Option D — AI Assistant
Type in the chat panel: `analyze issue #3` → Claude diagnoses it → click Run Pipeline

---

## Architecture

```
src/
├── index.ts                    # Express + Socket.io + webhook + /chat endpoint
├── claude.ts                   # Anthropic SDK + Green Agent routing + CO₂e tracking
├── setup.ts                    # Seeds real GitLab issues for demo
├── agents/
│   ├── rootCauseAgent.ts       # Dynamic RCA — works on ANY issue
│   ├── specAgent.ts            # Issue → structured spec
│   ├── codeAgent.ts            # Spec → production code
│   ├── complianceAgent.ts      # GDPR/SOC2/OWASP/CIS/NIST checks
│   ├── securityAgent.ts        # OWASP Top 10 + secrets scan
│   ├── testAgent.ts            # Full test suite generation
│   ├── reviewAgent.ts          # Code review + MR description
│   └── deployAgent.ts          # Dockerfile + K8s + CI/CD generation
├── orchestrator/
│   └── orchestrator.ts         # Pipeline coordinator
└── gitlab/
    └── gitlabClient.ts         # GitLab REST API + Duo workflow client

agents/                         # GitLab Duo Agent Platform YAML definitions
├── spec-agent.yml
├── code-agent.yml
├── compliance-agent.yml
├── security-agent.yml
├── test-agent.yml
├── review-agent.yml
└── deploy-agent.yml

flows/
└── devflow.yml                 # Full 8-agent orchestration flow

public/
└── index.html                  # Real-time dashboard
```

---

## GitLab Duo Agent Platform Integration

8 native GitLab Duo agents + 1 orchestration flow defined in `agents/` and `flows/`:

| Agent YAML | Purpose |
|-----------|---------|
| `spec-agent.yml` | Issue → structured implementation spec |
| `code-agent.yml` | Spec → production-ready code |
| `compliance-agent.yml` | GDPR, SOC2, OWASP ASVS, CIS, NIST |
| `security-agent.yml` | OWASP Top 10, secrets, CVE scanning |
| `test-agent.yml` | Full test suite with edge cases |
| `review-agent.yml` | Code review + MR description |
| `deploy-agent.yml` | Dockerfile, K8s manifests, CI/CD |
| `flows/devflow.yml` | Full orchestration flow |

---

## 🌱 Green Agent — Sustainability

DevFlow Orchestrator tracks and minimizes LLM energy consumption:

- **Smart model routing**: Haiku (~0.6g CO₂e/1M tokens) for lightweight tasks, Sonnet (~2.4g CO₂e/1M tokens) only for complex reasoning
- **Per-agent token tracking**: See exactly which agent used how many tokens
- **CO₂e estimation**: Real-time carbon footprint of every pipeline run
- **Live dashboard**: Green Agent panel shows CO₂e, Haiku%, Sonnet% split
- **API**: `GET /stats/green` for full sustainability breakdown

```json
{
  "total_co2e_g": 0.0142,
  "haiku_pct": 62,
  "byModel": {
    "claude-3-5-haiku-20241022": { "tokens": 8200, "co2e_g": 0.0049, "calls": 5 },
    "claude-3-5-sonnet-20241022": { "tokens": 14800, "co2e_g": 0.0355, "calls": 3 }
  }
}
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /webhook` | GitLab webhook receiver |
| `POST /trigger/:iid` | Manual pipeline trigger |
| `POST /chat` | AI assistant (Claude) |
| `GET /stats/tokens` | Token usage per agent |
| `GET /stats/green` | CO₂e and model routing stats |
| `GET /health` | Health check |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITLAB_TOKEN` | GitLab Personal Access Token (`api` scope) |
| `GITLAB_API_URL` | GitLab API base URL (default: `https://gitlab.com/api/v4`) |
| `GITLAB_PROJECT_ID` | Your GitLab project ID |
| `WEBHOOK_SECRET` | GitLab webhook secret token |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `PORT` | Server port (default: 3000) |

---

## Prize Categories

This project is submitted for:
- 🥇 **Grand Prize** — Full SDLC automation, reacts to triggers, takes real action
- 🤝 **Most Impactful on GitLab & Anthropic** — Native Duo Agent Platform + Claude
- 🌱 **Green Agent Prize** — Token efficiency routing + CO₂e tracking
- 💡 **Most Technically Impressive** — 8-agent pipeline, real-time dashboard, webhook-driven

---

## License

MIT — see [LICENSE](LICENSE)
