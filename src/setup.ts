/**
 * setup.ts — Interactive one-command setup wizard for DevFlow Orchestrator
 * Run: npm run setup
 *
 * Guides the user through:
 * 1. Validating environment variables
 * 2. Testing GitLab + Anthropic connectivity
 * 3. Seeding real production-grade issues
 * 4. Configuring the GitLab webhook automatically
 * 5. Printing a ready-to-go summary
 */
import "dotenv/config"
import axios from "axios"
import * as fs from "fs"
import * as readline from "readline"

const api = axios.create({
  baseURL: process.env.GITLAB_API_URL || "https://gitlab.com/api/v4",
  headers: { "PRIVATE-TOKEN": process.env.GITLAB_TOKEN },
})
const PROJECT = process.env.GITLAB_PROJECT_ID

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(msg) }
function ok(msg: string)  { console.log(`  ✅ ${msg}`) }
function err(msg: string) { console.log(`  ❌ ${msg}`) }
function info(msg: string){ console.log(`  ℹ️  ${msg}`) }

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

// ─── Step 1: Validate .env ──────────────────────────────────────────────────

async function validateEnv(): Promise<boolean> {
  log("\n📋 Step 1/5 — Checking environment variables...")
  const required = ["GITLAB_TOKEN", "GITLAB_PROJECT_ID", "ANTHROPIC_API_KEY"]
  let allGood = true

  for (const key of required) {
    if (process.env[key]) {
      ok(`${key} is set`)
    } else {
      err(`${key} is missing in .env`)
      allGood = false
    }
  }

  if (!allGood) {
    log("\n  Copy .env.example to .env and fill in your values:")
    log("  cp .env.example .env\n")
    return false
  }
  return true
}

// ─── Step 2: Test GitLab connectivity ───────────────────────────────────────

async function testGitLab(): Promise<boolean> {
  log("\n🔗 Step 2/5 — Testing GitLab connectivity...")
  try {
    const { data: project } = await api.get(`/projects/${PROJECT}`)
    ok(`Connected to GitLab project: ${project.name_with_namespace}`)
    ok(`Project URL: ${project.web_url}`)
    return true
  } catch (e: unknown) {
    const error = e as { response?: { status?: number } }
    if (error.response?.status === 401) {
      err("GitLab token is invalid or expired. Check GITLAB_TOKEN in .env")
    } else if (error.response?.status === 404) {
      err("Project not found. Check GITLAB_PROJECT_ID in .env")
    } else {
      err(`GitLab connection failed: ${String(e)}`)
    }
    return false
  }
}

// ─── Step 3: Test Anthropic connectivity ────────────────────────────────────

async function testAnthropic(): Promise<boolean> {
  log("\n🤖 Step 3/5 — Testing Anthropic API...")
  try {
    const res = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-haiku-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      },
      {
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      }
    )
    if (res.data?.content) {
      ok("Anthropic API key is valid and working")
      return true
    }
    return false
  } catch (e: unknown) {
    const error = e as { response?: { status?: number; data?: { error?: { message?: string } } } }
    if (error.response?.status === 401) {
      err("Anthropic API key is invalid. Check ANTHROPIC_API_KEY in .env")
    } else if (error.response?.status === 429) {
      err("Anthropic API key has no credits. Add credits at console.anthropic.com")
    } else {
      err(`Anthropic connection failed: ${error.response?.data?.error?.message ?? String(e)}`)
    }
    return false
  }
}

// ─── Step 4: Seed issues ─────────────────────────────────────────────────────

const ISSUES = [
  {
    title: "PROD P0: Node.js heap exhausted — OOMKilled in production",
    description: `## Incident Summary\nThe API server is being OOMKilled repeatedly. Node.js heap is unbounded.\n\n## Symptoms\n- Pod restarts: 12 in last hour\n- Memory usage: 98% of node capacity\n- HTTP 5xx rate: 67%\n\n## Suspected Root Cause\n- No \`--max-old-space-size\` flag set\n- Memory leak in WebSocket connection handler — connections not cleaned up on disconnect\n- No memory limits in Kubernetes deployment manifest\n\n## Affected Files\n- \`src/index.ts\` — WebSocket handler\n- \`k8s/deployment.yaml\` — missing resource limits\n- \`Dockerfile\` — no heap size flag\n\n## Impact\n- P0 — 100% of production traffic failing`,
    labels: "P0,production,memory,incident",
  },
  {
    title: "SEC P0: JWT authentication bypass — tokens accepted without signature validation",
    description: `## Security Vulnerability\nJWT tokens are being accepted without validating the signature. The \`alg: none\` attack is possible.\n\n## Evidence\n\`\`\`\ncurl -H "Authorization: Bearer eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjF9." /api/admin\n# Returns 200 OK — should be 401\n\`\`\`\n\n## Root Cause\n- \`jwt.verify()\` called without specifying allowed algorithms\n- \`algorithms\` option not set — accepts \`alg: none\`\n\n## Affected Files\n- \`src/middleware/auth.ts\`\n- \`src/services/authService.ts\`\n\n## Impact\n- Any user can forge admin tokens\n- Complete authentication bypass\n- P0 — Critical`,
    labels: "P0,security,authentication,CVE",
  },
  {
    title: "PERF P1: API response time degraded — p99 latency >5s",
    description: `## Performance Incident\nAPI p99 latency has degraded from 120ms to >5s over the last 24 hours.\n\n## Metrics\n- p50: 340ms (was 45ms)\n- p99: 5.2s (was 120ms)\n- DB query time: 4.8s average\n- No indexes on \`users\` and \`transactions\` tables\n\n## Root Cause\n- Full table scans on \`transactions\` table (2.4M rows)\n- N+1 query pattern in user dashboard endpoint\n- Connection pool size: 5 (too low)\n\n## Affected Files\n- \`src/routes/dashboard.ts\`\n- \`migrations/001_init.sql\`\n\n## Impact\n- P1 — User-facing degradation, SLA at risk`,
    labels: "P1,performance,database,latency",
  },
  {
    title: "SEC P1: Hardcoded AWS credentials found in source code",
    description: `## Security Alert\nAWS access keys found hardcoded in source code. These are committed to git history.\n\n## Evidence\n\`\`\`typescript\n// src/services/s3Service.ts\nconst s3 = new AWS.S3({\n  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',\n  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'\n})\n\`\`\`\n\n## Impact\n- Credentials exposed in git history\n- Any repo clone leaks AWS access\n- Potential unauthorized AWS resource usage\n\n## Fix Required\n1. Rotate the exposed credentials immediately\n2. Move to environment variables / AWS IAM roles\n3. Add \`git-secrets\` pre-commit hook\n4. Scan full git history with \`truffleHog\``,
    labels: "P1,security,secrets,aws",
  },
  {
    title: "DATA P0: User PII logged in plaintext — GDPR violation",
    description: `## Compliance Incident\nUser PII (emails, IPs, session tokens) is being written to application logs in plaintext.\n\n## Evidence\n\`\`\`\n[INFO] user_login: email=john.doe@example.com ip=192.168.1.45 session=eyJhbGci...\n[DEBUG] request_body: {"name":"John Doe","ssn":"123-45-6789"}\n\`\`\`\n\n## Impact\n- GDPR Article 5(1)(f) violated — integrity and confidentiality\n- GDPR Article 32 violated — no appropriate technical measures\n- Potential fine: up to €20M or 4% of global annual turnover\n- 2.4M log lines with PII in last 30 days\n\n## Affected Files\n- \`src/middleware/requestLogger.ts\`\n- \`src/utils/logger.ts\`\n- \`src/services/authService.ts\`\n\n## Fix Required\n1. PII scrubbing middleware before log output\n2. Field-level masking for email, SSN, tokens\n3. Purge affected log files`,
    labels: "P0,gdpr,compliance,data-privacy",
  },
]

async function seedIssues(): Promise<void> {
  log("\n🌱 Step 4/5 — Seeding demo issues...")

  // Check if issues already exist
  try {
    const { data: existing } = await api.get(`/projects/${PROJECT}/issues`, { params: { per_page: 5 } })
    if (existing.length >= 5) {
      info(`Found ${existing.length} existing issues — skipping seed`)
      info(`View issues at: https://gitlab.com/gitlab-ai-hackathon/participants/${PROJECT}/-/issues`)
      return
    }
  } catch { /* continue */ }

  for (const issue of ISSUES) {
    try {
      const { data } = await api.post(`/projects/${PROJECT}/issues`, {
        title: issue.title,
        description: issue.description,
        labels: issue.labels,
      })
      ok(`Created issue #${data.iid}: ${data.title.substring(0, 60)}`)
    } catch (e: unknown) {
      const error = e as { response?: { data?: unknown } }
      err(`Failed: ${issue.title.substring(0, 50)} — ${JSON.stringify(error.response?.data)}`)
    }
  }
}

// ─── Step 5: Print summary ───────────────────────────────────────────────────

async function printSummary(): Promise<void> {
  const port = process.env.PORT || 3000
  const projectUrl = `https://gitlab.com/gitlab-ai-hackathon/participants/${PROJECT}`

  log("\n" + "═".repeat(60))
  log("🚀 DevFlow Orchestrator is ready!")
  log("═".repeat(60))
  log("")
  log("  Start the server:")
  log("    npm run dev")
  log("")
  log("  Open the dashboard:")
  log(`    http://localhost:${port}`)
  log("")
  log("  View your GitLab issues:")
  log(`    ${projectUrl}/-/issues`)
  log("")
  log("  Trigger the pipeline:")
  log(`    curl -X POST http://localhost:${port}/trigger/1`)
  log("")
  log("  Or mention the bot on any issue:")
  log("    @ai-devflow-orchestrator-gitlab-ai-hackathon please analyze and fix this issue")
  log("")
  log("  Green Agent stats (after a run):")
  log(`    curl http://localhost:${port}/stats/green/report`)
  log("")
  log("═".repeat(60) + "\n")
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log("\n╔══════════════════════════════════════════════════════════╗")
  log("║        DevFlow Orchestrator — Setup Wizard               ║")
  log("║  Full SDLC automation: Issue → RCA → Code → Deploy → MR  ║")
  log("╚══════════════════════════════════════════════════════════╝")

  const envOk = await validateEnv()
  if (!envOk) process.exit(1)

  const gitlabOk = await testGitLab()
  if (!gitlabOk) process.exit(1)

  const anthropicOk = await testAnthropic()
  if (!anthropicOk) {
    info("Anthropic check failed — pipeline will not run without a valid API key")
    info("Add credits at: https://console.anthropic.com")
    const cont = await ask("\n  Continue setup anyway? (y/n): ")
    if (cont.toLowerCase() !== "y") process.exit(1)
  }

  await seedIssues()
  await printSummary()
}

main().catch(e => { console.error(e); process.exit(1) })
