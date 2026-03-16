# 🔀 DevFlow Orchestrator

> **AI-powered multi-agent SDLC automation for GitLab.**  
> A GitLab issue comes in → 5 AI agents collaborate → production-ready code, tests, security scan, and a merge request — automatically.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem

Every developer knows the bottleneck isn't writing code — it's everything around it. Breaking down issues, writing boilerplate, scanning for vulnerabilities, writing tests, creating MRs. These tasks are repetitive, slow, and error-prone.

## The Solution

DevFlow Orchestrator listens for GitLab issue events and runs a **5-agent pipeline powered by Anthropic Claude via GitLab Duo**:

```
GitLab Issue Created
        │
        ▼
  🧠 Spec Agent       → Breaks issue into tasks, files, acceptance criteria
        │
        ▼
  💻 Code Agent       → Generates production-ready TypeScript
        │
        ▼
  🔒 Security Agent   → OWASP Top 10 scan, secrets detection
        │
        ▼
  🧪 Test Agent       → Full Jest test suite with edge cases
        │
        ▼
  👁️  Review Agent    → Code review + writes MR description
        │
        ▼
  🚀 Merge Request    → Auto-created on GitLab, issue commented
```

All stages stream live to a real-time dashboard via WebSocket.

---

## Quick Start (3 steps)

### 1. Install
```bash
git clone https://gitlab.com/gitlab-ai-hackathon/participants/23075558.git
cd devflow-orchestrator
npm install
```

### 2. Configure
```bash
npm run setup
```
This interactive wizard creates your `.env` file. You'll need:
- GitLab Personal Access Token (with `api` scope)
- GitLab Project ID
- Anthropic API Key

### 3. Run
```bash
npm run dev
```

Open **http://localhost:3000** — the dashboard is live.

---

## Triggering the Pipeline

### Automatic (via GitLab Webhook)
1. Go to your GitLab project → Settings → Webhooks
2. URL: `http://your-server:3000/webhook`
3. Secret Token: your `WEBHOOK_SECRET`
4. Trigger: ✅ Issues events
5. Create any new issue → pipeline starts automatically

### Manual (via Dashboard or API)
- **Dashboard**: Enter an Issue IID and click ▶ Run Pipeline
- **API**: `POST /trigger/:issueIid`

---

## Architecture

```
src/
├── index.ts                  # Express server + Socket.io + webhook handler
├── claude.ts                 # Anthropic Claude SDK wrapper
├── setup.ts                  # Interactive setup wizard
├── agents/
│   ├── specAgent.ts          # Issue → JSON spec
│   ├── codeAgent.ts          # Spec → TypeScript files
│   ├── securityAgent.ts      # Code → OWASP security report
│   ├── testAgent.ts          # Code + spec → Jest tests
│   └── reviewAgent.ts        # All → MR title + description
├── orchestrator/
│   └── orchestrator.ts       # Pipeline coordinator + GitLab API calls
└── gitlab/
    └── gitlabClient.ts       # GitLab REST API client

agents/                       # GitLab Duo Agent definitions (YAML)
flows/                        # GitLab Duo Flow definition (YAML)
public/
└── index.html                # Real-time pipeline dashboard
```

---

## GitLab Duo Integration

The `agents/` and `flows/` directories contain native **GitLab Duo Agent Platform** definitions:

| File | Purpose |
|------|---------|
| `agents/spec-agent.yml` | Spec Agent for GitLab Duo |
| `agents/code-agent.yml` | Code Agent for GitLab Duo |
| `agents/security-agent.yml` | Security Agent for GitLab Duo |
| `agents/test-agent.yml` | Test Agent for GitLab Duo |
| `agents/review-agent.yml` | Review Agent for GitLab Duo |
| `flows/devflow.yml` | Full orchestration flow |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITLAB_TOKEN` | GitLab Personal Access Token (api scope) |
| `GITLAB_API_URL` | GitLab API base URL (default: https://gitlab.com/api/v4) |
| `GITLAB_PROJECT_ID` | Your GitLab project ID |
| `WEBHOOK_SECRET` | GitLab webhook secret token |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `PORT` | Server port (default: 3000) |

---

## License

MIT — see [LICENSE](LICENSE)
