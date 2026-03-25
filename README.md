# DevFlow Orchestrator

> **You Orchestrate. AI Accelerates.**

> A GitLab issue comes in → 8 AI agents collaborate → root cause diagnosed, code fixed, security scanned, compliance checked, tests written, deployment configured, and a merge request created — automatically.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitLab Duo](https://img.shields.io/badge/GitLab%20Duo-Agent%20Platform-fc6d26)](https://docs.gitlab.com/ee/user/gitlab_duo/)
[![Anthropic Claude](https://img.shields.io/badge/Powered%20by-Anthropic%20Claude-191919)](https://anthropic.com)

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

🎥 **[Watch demo on YouTube](https://youtu.be/-q0eASB_EXY?si=yYR5P4omfXdu9nNX)**

🖥️ **Live dashboard** at `http://localhost:3000` after setup

---

## Quick Start

**Prerequisites:** Node.js 18+, GitLab account, Anthropic API key

```bash
# 1. Clone & install
git clone https://gitlab.com/gitlab-ai-hackathon/participants/23075558.git devflow-orchestrator
cd devflow-orchestrator
npm install

# 2. Configure
cp .env.example .env
# Set: GITLAB_TOKEN, GITLAB_PROJECT_ID, ANTHROPIC_API_KEY

# 3. Setup wizard — validates config, tests connectivity, seeds issues
npm run setup

# 4. Run
npm run dev
```

Open **http://localhost:3000** — dashboard is live.

The setup wizard (`npm run setup`) will:
- Validate all environment variables
- Test GitLab API connectivity
- Test Anthropic API key
- Seed 5 real production issues into your GitLab project
- Print a ready-to-go summary with all commands

---

## Testing Instructions

Follow these steps **in order** to fully test DevFlow Orchestrator.

---

### Step 1 — Run the Pipeline via Script (Quickest)

The fastest way to see all 8 agents in action:

```bash
node scripts/run-pipeline.mjs 6
```

Replace `6` with any GitLab issue IID in your project.

**What to expect:**
- Terminal shows each agent running with elapsed time
- 8 comments posted to the issue on GitLab in sequence
- Branch `devflow/issue-6-fix` created automatically
- Generated TypeScript files committed to the branch
- Merge Request auto-created with full audit trail

Try a different issue to confirm it adapts dynamically:

```bash
node scripts/run-pipeline.mjs 11
```

---

### Step 2 — Verify Results on GitLab

After Step 1 completes, open GitLab and check:

1. **Issues** → open the issue you ran against
   - You should see 8+ agent comments posted in sequence: RCA → Spec → Code → Security → Compliance → Tests → Review → Deploy → Summary
2. **Merge Requests** → a new MR titled `fix(cache): ...` should appear
   - MR description contains full RCA, security scan, compliance score, test coverage, rollback plan
3. **Repository → Branches** → `devflow/issue-{N}-fix` branch exists with committed files

---

### Step 3 — Dashboard (Real-time UI)

Start the server:

```bash
npm run dev
```

Open **http://localhost:3000**, enter an issue IID, click ▶ Run Pipeline.

Watch each agent stream live via WebSocket as it runs.

---

### Step 4 — Duo Workflow (GitLab Comment Trigger)

Trigger the pipeline directly from a GitLab issue comment:

1. Go to GitLab → Issues → open any issue
2. Post this comment:
   ```
   @GitLab-Duo run devflow on this issue
   ```
3. GitLab Duo Workflow triggers automatically
4. Watch the session log — 8 agents run visually in sequence
5. MR gets created from `main` → `production`

---

### Step 5 — CI Pipeline (Manual Trigger)

Trigger via GitLab CI:

1. Go to GitLab → **Build → Pipelines** → latest pipeline
2. Find the `run-pipeline` job (stage: pipeline) → click ▶
3. For any issue: click ▶ on `run-pipeline-any-issue`, set `ISSUE_IID` variable to your issue number

**Expected:** pipeline runs ~2 min, all 8 agent comments posted, MR created.

---

### Step 6 — Webhook (Automatic Trigger)

For fully automatic triggering on every new issue:

1. GitLab project → **Settings → Webhooks**
2. URL: `http://your-server:3000/webhook`
3. Secret: your `WEBHOOK_SECRET` from `.env`
4. Check: ✅ Issues events
5. Create any new issue → pipeline starts automatically within seconds

---

### Step 7 — Green Agent Sustainability Report

Check the final pipeline summary comment on any issue — it includes:

```
💚 Green Agent — CO₂e: ~0.02g | Model routing: 62.5% Haiku | 70% energy saved vs all-Sonnet
```

Or hit the API directly:

```bash
curl http://localhost:3000/stats/green
```

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

## License

MIT — see [LICENSE](LICENSE)
