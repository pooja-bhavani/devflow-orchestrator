import { writeFileSync } from "fs"

const content = `import { Server as SocketServer } from "socket.io"
import {
  getIssue,
  commentOnIssue,
  createBranch,
  commitFiles,
  createMR,
  triggerDuoWorkflow,
  pollWorkflow,
} from "../gitlab/gitlabClient"
import { RootCauseAgent } from "../agents/rootCauseAgent"
import { SpecAgent } from "../agents/specAgent"
import { CodeAgent } from "../agents/codeAgent"
import { SecurityAgent } from "../agents/securityAgent"
import { ComplianceAgent } from "../agents/complianceAgent"
import { TestAgent } from "../agents/testAgent"
import { ReviewAgent } from "../agents/reviewAgent"
import { DeployAgent } from "../agents/deployAgent"
import { getTotalTokenStats } from "../claude"

let _setMetricsRecovered: (() => void) | undefined

export function registerMetricsHook(fn: () => void) {
  _setMetricsRecovered = fn
}

export type PipelineStage = "init" | "duo_workflow" | "polling" | "done" | "failed"

export interface PipelineEvent {
  stage: PipelineStage
  status: "running" | "done" | "error"
  message: string
  data?: unknown
}

export class DevFlowOrchestrator {
  private io?: SocketServer

  constructor(io?: SocketServer) {
    this.io = io
  }

  private emit(event: PipelineEvent) {
    console.log(\`[\${event.stage}] \${event.status}: \${event.message}\`)
    this.io?.emit("pipeline:event", event)
  }

  private log(stage: PipelineStage, msg: string) {
    this.emit({ stage, status: "running", message: msg })
  }

  async run(issueIid: number): Promise<{ workflowId: number | null; finalStatus: string }> {
    this.log("init", \`Fetching issue #\${issueIid} from GitLab...\`)
    const issue = await getIssue(issueIid)
    this.emit({ stage: "init", status: "done", message: \`Issue: \${issue.title}\` })

    await commentOnIssue(issueIid,
      \`## 🤖 DevFlow Orchestrator — Pipeline Started\\n\\n\` +
      \`**Issue:** \${issue.title}\\n\\n\` +
      \`**Pipeline:** RCA → Spec → Code → Security → Compliance → Tests → Review → Deploy\\n\\n\` +
      \`_Running all 8 agents now. Each agent will post its results below._\`)

    // ── [1/7] RCA
    this.log("duo_workflow", "🔍 Running root cause analysis...")
    const rcaAgent = new RootCauseAgent()
    const rca = await rcaAgent.run(issue.title, issue.description)
    this.log("duo_workflow", \`🔍 RCA complete — \${rca.severity} | \${rca.category}\`)

    await commentOnIssue(issueIid,
      \`## 🔍 [1/7] Root Cause Analysis\\n\\n\` +
      \`**Severity:** \${rca.severity} | **Category:** \${rca.category}\\n\\n\` +
      \`### Root Causes\\n\${rca.root_causes.map((r: string) => \`- \${r}\`).join("\\n")}\\n\\n\` +
      \`### Affected Components\\n\${rca.affected_components.map((c: string) => \`- \\\`\${c}\\\`\`).join("\\n")}\\n\\n\` +
      \`### Fix Strategy\\n\${rca.fix_strategy.map((s: string, i: number) => \`\${i + 1}. \${s}\`).join("\\n")}\\n\\n\` +
      \`**Estimated Effort:** \${rca.estimated_effort}\`)

    // ── [2/7] Spec
    this.log("duo_workflow", "🧠 Generating implementation spec...")
    const specAgent = new SpecAgent()
    const spec = await specAgent.run(issue.title, issue.description)
    this.log("duo_workflow", \`🧠 Spec ready — \${spec.tasks.length} tasks, \${spec.files.length} files\`)

    await commentOnIssue(issueIid,
      \`## 🧠 [2/7] Implementation Spec\\n\\n\` +
      \`**Summary:** \${spec.summary}\\n\\n\` +
      \`### Tasks\\n\${spec.tasks.map((t: string, i: number) => \`\${i + 1}. \${t}\`).join("\\n")}\\n\\n\` +
      \`### Files to Modify\\n\${spec.files.map((f: string) => \`- \\\`\${f}\\\`\`).join("\\n")}\\n\\n\` +
      \`### Acceptance Criteria\\n\${spec.acceptance_criteria.map((a: string) => \`- \${a}\`).join("\\n")}\`)

    // ── [3/7] Code
    this.log("polling", "💻 Generating production-ready code fixes...")
    const codeAgent = new CodeAgent()
    const codeFiles = await codeAgent.run(spec)
    this.log("polling", \`✅ CodeAgent: \${codeFiles.length} file(s) generated\`)

    await commentOnIssue(issueIid,
      \`## 💻 [3/7] Code Generation\\n\\n\` +
      \`Generated **\${codeFiles.length}** file(s):\\n\\n\` +
      codeFiles.map((f: { path: string; content: string }) =>
        \`### \\\`\${f.path}\\\`\\n\\\`\\\`\\\`typescript\\n\${f.content.slice(0, 800)}\${f.content.length > 800 ? "\\n// ... (truncated)" : ""}\\n\\\`\\\`\\\`\`
      ).join("\\n\\n"))

    // ── [4/7] Security
    this.log("polling", "🔒 Scanning for OWASP Top 10 vulnerabilities...")
    const secAgent = new SecurityAgent()
    const security = await secAgent.run(codeFiles)
    this.log("polling", \`🔒 Security: \${security.passed ? "✅ PASSED" : \`❌ \${security.severity}\`}\`)

    await commentOnIssue(issueIid,
      \`## 🔒 [4/7] Security Scan\\n\\n\` +
      \`**Result:** \${security.passed ? "✅ PASSED" : "❌ FAILED"} | **Severity:** \${security.severity}\\n\\n\` +
      (security.issues.length > 0
        ? \`### Issues Found\\n\${security.issues.map((i: { location: string; issue: string; fix: string }) => \`- **[\${i.location}]** \${i.issue}\\n  - Fix: \${i.fix}\`).join("\\n")}\`
        : \`### ✅ No vulnerabilities found\`) +
      \`\\n\\n**Summary:** \${security.summary}\`)

    // ── [5/7] Compliance
    this.log("polling", "📋 Checking GDPR / SOC2 / OWASP ASVS / CIS / NIST...")
    const compAgent = new ComplianceAgent()
    const compliance = await compAgent.run(codeFiles, \`\${issue.title}\\n\${issue.description}\`)
    this.log("polling", \`📋 Compliance: \${compliance.compliance_score}/100\`)

    await commentOnIssue(issueIid,
      \`## 📋 [5/7] Compliance Check\\n\\n\` +
      \`**Score:** \${compliance.compliance_score}/100 | **Result:** \${compliance.passed ? "✅ PASSED" : "❌ FAILED"}\\n\\n\` +
      \`**Frameworks:** \${compliance.frameworks_checked.join(", ")}\\n\\n\` +
      (compliance.violations.length > 0
        ? \`### Violations\\n\${compliance.violations.map((v: { framework: string; control: string; severity: string; description: string }) => \`- **[\${v.framework} \${v.control}]** \${v.severity}: \${v.description}\`).join("\\n")}\`
        : \`### ✅ All compliance checks passed\`) +
      \`\\n\\n**Summary:** \${compliance.summary}\`)

    // ── [6/7] Tests
    this.log("polling", "🧪 Generating Jest test suite...")
    const testAgent = new TestAgent()
    const testFiles = await testAgent.run(codeFiles, spec)
    this.log("polling", \`✅ TestAgent: \${testFiles.length} test file(s)\`)

    await commentOnIssue(issueIid,
      \`## 🧪 [6/7] Test Suite\\n\\n\` +
      \`Generated **\${testFiles.length}** test file(s):\\n\\n\` +
      testFiles.map((f: { path: string; content: string }) =>
        \`### \\\`\${f.path}\\\`\\n\\\`\\\`\\\`typescript\\n\${f.content.slice(0, 600)}\${f.content.length > 600 ? "\\n// ... (truncated)" : ""}\\n\\\`\\\`\\\`\`
      ).join("\\n\\n"))

    // ── [7/7] Review + Deploy
    this.log("polling", "👁️  Final code review + MR preparation...")
    const reviewAgent = new ReviewAgent()
    const review = await reviewAgent.run(codeFiles, testFiles, security)
    this.log("polling", \`👁️  Review: \${review.approved ? "✅ APPROVED" : "❌ CHANGES REQUESTED"}\`)

    this.log("polling", "🚀 Generating deployment configs...")
    const deployAgent = new DeployAgent()
    const deployPlan = await deployAgent.run(codeFiles, security, compliance, issue.title)
    this.log("polling", \`✅ DeployAgent: \${deployPlan.files.length} deployment file(s)\`)

    // ── Auto-create branch, commit generated files, open MR
    let mrUrl: string | null = null
    try {
      const branchName = \`devflow/issue-\${issueIid}-fix\`
      try {
        await createBranch(branchName)
        this.log("polling", \`🌿 Creating branch \${branchName}...\`)
      } catch {
        this.log("polling", \`🌿 Branch \${branchName} already exists — reusing\`)
      }
      const allFiles = [...codeFiles, ...testFiles, ...deployPlan.files]
      await commitFiles(branchName, \`fix: DevFlow auto-fix for issue #\${issueIid}\`, allFiles)
      this.log("polling", \`📦 Committing \${allFiles.length} generated file(s)...\`)
      mrUrl = await createMR(branchName, review.mr_title, review.mr_description)
      this.log("polling", \`🔀 MR created: \${mrUrl}\`)
    } catch (err: unknown) {
      const e = err as { message?: string }
      this.log("polling", \`⚠️  MR creation failed: \${e.message}\`)
    }

    // ── Trigger Duo workflow (best-effort)
    let workflowId: number | null = null
    try {
      const { id, status: initialStatus } = await triggerDuoWorkflow(rca.goal, issueIid)
      workflowId = id
      this.emit({ stage: "duo_workflow", status: "done",
        message: \`🦾 Duo workflow #\${id} started (\${initialStatus})\` })
    } catch (err: unknown) {
      const e = err as { message?: string }
      this.emit({ stage: "duo_workflow", status: "done",
        message: \`⚠️  Duo workflow unavailable (\${e.message}) — local pipeline complete\` })
    }

    let finalStatus = "finished"
    if (workflowId !== null) {
      try {
        finalStatus = await pollWorkflow(workflowId, (_status, step) => {
          this.log("polling", step)
        })
      } catch {
        finalStatus = "finished"
      }
    }

    // ── Final summary
    const tokenStats = getTotalTokenStats()
    this.emit({ stage: "done", status: "done",
      message: \`✅ Pipeline complete — \${tokenStats.total_tokens.toLocaleString()} tokens used\` })

    _setMetricsRecovered?.()

    const mrLine = mrUrl
      ? \`**MR:** [\${review.mr_title}](\${mrUrl})\`
      : \`**MR:** \${review.mr_title}\`

    await commentOnIssue(issueIid,
      \`## ✅ DevFlow Orchestrator — Pipeline Complete\\n\\n\` +
      \`| Agent | Result |\\n\` +
      \`|-------|--------|\\n\` +
      \`| 🔍 Root Cause Analysis | \${rca.severity} — \${rca.category} |\\n\` +
      \`| 🧠 Spec | \${spec.tasks.length} tasks, \${spec.files.length} files |\\n\` +
      \`| 💻 Code | \${codeFiles.length} file(s) generated |\\n\` +
      \`| 🔒 Security | \${security.passed ? "✅ Passed" : \`❌ \${security.severity}\`} — \${security.issues.length} issue(s) |\\n\` +
      \`| 📋 Compliance | \${compliance.compliance_score}/100 — \${compliance.violations.length} violation(s) |\\n\` +
      \`| 🧪 Tests | \${testFiles.length} test file(s) |\\n\` +
      \`| 👁️ Review | \${review.approved ? "✅ Approved" : "❌ Changes requested"} |\\n\` +
      \`| 🚀 Deploy | \${deployPlan.files.length} deployment file(s) |\\n\\n\` +
      mrLine + \`\\n\\n\` +
      \`💚 **Green Agent** — \${tokenStats.total_tokens.toLocaleString()} tokens | \${tokenStats.estimated_cost_usd.toFixed(4)} | \` +
      \`Health check: \\\`\${deployPlan.health_check_url}\\\`\`)

    return { workflowId, finalStatus }
  }
}
`

writeFileSync("src/orchestrator/orchestrator.ts", content, "utf8")
console.log("✅ orchestrator.ts written successfully")
console.log("Lines:", content.split("\n").length)
