import { Server as SocketServer } from "socket.io"
import {
  getIssue,
  commentOnIssue,
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

interface AttemptStats {
  attempt: number
  failed: number
  resolved: number
}

export class DevFlowOrchestrator {
  private io?: SocketServer

  constructor(io?: SocketServer) {
    this.io = io
  }

  private emit(event: PipelineEvent) {
    console.log(`[${event.stage}] ${event.status}: ${event.message}`)
    this.io?.emit("pipeline:event", event)
  }

  private log(stage: PipelineStage, msg: string) {
    this.emit({ stage, status: "running", message: msg })
  }

  async run(issueIid: number): Promise<{ workflowId: number | null; finalStatus: string }> {
    const stats: AttemptStats = { attempt: 0, failed: 0, resolved: 0 }

    const runAttempt = async (): Promise<{ workflowId: number | null; finalStatus: string }> => {
      stats.attempt++

      // Stage 1: Fetch issue
      this.log("init", `Attempt #${stats.attempt} — Fetching issue #${issueIid} from GitLab...`)
      const issue = await getIssue(issueIid)
      this.emit({ stage: "init", status: "done", message: `Issue: ${issue.title}` })

      await commentOnIssue(issueIid,
        `🤖 **DevFlow Orchestrator** — Attempt #${stats.attempt} starting\n\nPipeline: RCA → Spec → Code → Security → Compliance → Tests → Review → Deploy → MR`)

      // Stage 2: RCA
      this.log("duo_workflow", "🔍 Running root cause analysis with Claude...")
      const rcaAgent = new RootCauseAgent()
      const rca = await rcaAgent.run(issue.title, issue.description)

      this.log("duo_workflow", `🔍 RCA complete — Severity: ${rca.severity} | Category: ${rca.category}`)
      for (const rc of rca.root_causes) {
        this.log("duo_workflow", `⚠️  Root cause: ${rc}`)
      }
      for (const comp of rca.affected_components) {
        this.log("duo_workflow", `📁 Affected: ${comp}`)
      }
      for (const step of rca.fix_strategy) {
        this.log("duo_workflow", `🔧 Fix step: ${step}`)
      }
      this.log("duo_workflow", `⚡ Estimated effort: ${rca.estimated_effort}`)

      // Spec agent
      this.log("duo_workflow", "🧠 SpecAgent: generating implementation spec...")
      const specAgent = new SpecAgent()
      const spec = await specAgent.run(issue.title, issue.description)
      this.log("duo_workflow", `🧠 Spec ready — ${spec.tasks.length} task(s), ${spec.files.length} file(s)`)
      for (const task of spec.tasks) {
        this.log("duo_workflow", `  📋 ${task}`)
      }

      // Trigger Duo workflow in background
      let workflowId: number | null = null
      this.log("duo_workflow", "🦾 Triggering GitLab Duo Agent workflow...")
      try {
        const { id, status: initialStatus } = await triggerDuoWorkflow(rca.goal, issueIid)
        workflowId = id
        this.emit({ stage: "duo_workflow", status: "done",
          message: `🦾 Duo workflow #${id} started (${initialStatus})` })
      } catch (err: unknown) {
        const e = err as { message?: string }
        this.emit({ stage: "duo_workflow", status: "done",
          message: `⚠️  Duo workflow unavailable (${e.message}) — running local agent pipeline` })
      }

      // Stage 3: Local agent pipeline
      this.log("polling", "⚙️  Starting local agent pipeline...")

      // Code agent
      this.log("polling", "💻 CodeAgent: generating production-ready fixes...")
      const codeAgent = new CodeAgent()
      const codeFiles = await codeAgent.run(spec)
      this.log("polling", `✅ CodeAgent: generated ${codeFiles.length} file(s)`)
      for (const f of codeFiles) {
        this.log("polling", `  ✏️  ${f.path} (${f.content.split("\n").length} lines)`)
      }

      // Security agent
      this.log("polling", "🔒 SecurityAgent: scanning for OWASP Top 10 vulnerabilities...")
      const secAgent = new SecurityAgent()
      const security = await secAgent.run(codeFiles)
      const secStatus = security.passed ? "✅ PASSED" : `❌ FAILED — ${security.severity} severity`
      this.log("polling", `🔒 SecurityAgent: ${secStatus}`)
      if (security.issues.length > 0) {
        for (const iss of security.issues) {
          this.log("polling", `  ⚠️  [${iss.location}] ${iss.issue}`)
          this.log("polling", `     Fix: ${iss.fix}`)
        }
        stats.failed += security.issues.length
      } else {
        this.log("polling", "  ✅ No security vulnerabilities found")
        stats.resolved++
      }

      // Compliance agent
      this.log("polling", "📋 ComplianceAgent: checking GDPR / SOC2 / OWASP ASVS / CIS / NIST...")
      const compAgent = new ComplianceAgent()
      const compliance = await compAgent.run(codeFiles, `${issue.title}\n${issue.description}`)
      this.log("polling", `📋 ComplianceAgent: score ${compliance.compliance_score}/100 — ${compliance.passed ? "✅ PASSED" : "❌ FAILED"}`)
      this.log("polling", `  Frameworks: ${compliance.frameworks_checked.join(", ")}`)
      if (compliance.violations.length > 0) {
        for (const v of compliance.violations) {
          this.log("polling", `  ⚠️  [${v.framework} ${v.control}] ${v.severity}: ${v.description}`)
          stats.failed++
        }
      } else {
        this.log("polling", "  ✅ All compliance checks passed")
        stats.resolved++
      }

      // Test agent
      this.log("polling", "🧪 TestAgent: generating Jest test suite...")
      const testAgent = new TestAgent()
      const testFiles = await testAgent.run(codeFiles, spec)
      this.log("polling", `✅ TestAgent: generated ${testFiles.length} test file(s)`)
      for (const t of testFiles) {
        this.log("polling", `  🧪 ${t.path}`)
      }

      // Review agent
      this.log("polling", "👁️  ReviewAgent: final code review + MR preparation...")
      const reviewAgent = new ReviewAgent()
      const review = await reviewAgent.run(codeFiles, testFiles, security)
      this.log("polling", `👁️  ReviewAgent: ${review.approved ? "✅ APPROVED" : "❌ CHANGES REQUESTED"}`)
      for (const comment of review.comments) {
        this.log("polling", `  💬 ${comment}`)
      }
      this.log("polling", `  📝 MR title: ${review.mr_title}`)

      // Deploy agent
      this.log("polling", "🚀 DeployAgent: generating Dockerfile + K8s manifests + CI/CD config...")
      const deployAgent = new DeployAgent()
      const deployPlan = await deployAgent.run(codeFiles, security, compliance, issue.title)
      this.log("polling", `✅ DeployAgent: generated ${deployPlan.files.length} deployment file(s)`)
      for (const f of deployPlan.files) {
        this.log("polling", `  🐳 ${f.path}`)
      }
      this.log("polling", `  �� Health check: ${deployPlan.health_check_url}`)
      for (const step of deployPlan.rollback_steps) {
        this.log("polling", `  🔄 Rollback: ${step}`)
      }

      // Poll Duo workflow if started
      let finalStatus = "finished"
      if (workflowId !== null) {
        this.log("polling", `⚙️  Polling GitLab Duo workflow #${workflowId}...`)
        try {
          finalStatus = await pollWorkflow(workflowId, (_status, step) => {
            if (/^❌/.test(step)) { stats.failed++; this.io?.emit("pipeline:stats", { ...stats }) }
            if (/^✅/.test(step)) { stats.resolved++; this.io?.emit("pipeline:stats", { ...stats }) }
            this.log("polling", step)
          })
        } catch (err: unknown) {
          const e = err as { message?: string }
          this.log("polling", `⚠️  Duo workflow polling ended: ${e.message}`)
          finalStatus = "finished"
        }
      }

      // Stage 4: Done
      const tokenStats = getTotalTokenStats()
      this.emit({ stage: "done", status: "done",
        message: `✅ Pipeline complete — ${stats.failed} issue(s) found, ${stats.resolved} resolved | ${tokenStats.total_tokens.toLocaleString()} tokens used` })

      _setMetricsRecovered?.()

      await commentOnIssue(issueIid,
        `✅ **DevFlow Orchestrator** completed!\n\n` +
        `**RCA:** ${rca.severity} ${rca.category} — ${rca.root_causes.join("; ")}\n\n` +
        `**Security:** ${security.passed ? "✅ Passed" : `❌ ${security.severity} severity`} — ${security.issues.length} issue(s)\n\n` +
        `**Compliance:** ${compliance.compliance_score}/100 — ${compliance.violations.length} violation(s)\n\n` +
        `**MR:** ${review.mr_title}\n\n` +
        `💚 **Green Agent** — Tokens: ${tokenStats.total_tokens.toLocaleString()} | Cost: $${tokenStats.estimated_cost_usd.toFixed(4)}`)

      return { workflowId, finalStatus }
    }

    return runAttempt()
  }
}
