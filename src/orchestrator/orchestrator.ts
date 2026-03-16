import { Server as SocketServer } from "socket.io"
import {
  getIssue,
  commentOnIssue,
  triggerDuoWorkflow,
  pollWorkflow,
} from "../gitlab/gitlabClient"

let _setMetricsRecovered: (() => void) | undefined

export function registerMetricsHook(fn: () => void) {
  _setMetricsRecovered = fn
}

export type PipelineStage =
  | "init"
  | "duo_workflow"
  | "polling"
  | "done"
  | "failed"

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

  async run(issueIid: number): Promise<{ workflowId: number; finalStatus: string }> {
    const stats: AttemptStats = { attempt: 0, failed: 0, resolved: 0 }

    const runAttempt = async (): Promise<{ workflowId: number; finalStatus: string }> => {
      stats.attempt++

      this.emit({ stage: "init", status: "running", message: `Attempt #${stats.attempt} — Fetching issue #${issueIid}...` })
      const issue = await getIssue(issueIid)
      this.emit({ stage: "init", status: "done", message: `Issue: ${issue.title}` })

      await commentOnIssue(issueIid,
        `🤖 **DevFlow Orchestrator** — Attempt #${stats.attempt} starting...\n\nPipeline: Diagnose → Fix → Security → Tests → MR`)

      const goal = `
You are a senior DevSecOps engineer and SRE. A production incident has been reported.

**Issue #${issueIid}: ${issue.title}**

${issue.description}

## Your Mission — Complete ALL of the following steps in order:

### Step 1: Diagnose
- Read the Dockerfile, docker-compose-bankapp.yml, app-tier.yml, pom.xml
- Identify root causes: OOMKilled (missing JVM heap flags), HikariCP pool exhaustion, Trivy CVE failures, missing K8s resource limits

### Step 2: Fix Dockerfile
- Add ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
- Update base image to eclipse-temurin:21-jre-alpine (smaller, fewer CVEs)

### Step 3: Fix pom.xml
- Upgrade spring-boot-starter-parent to 3.4.1
- This resolves CVE-2024-38816, CVE-2024-22262, CVE-2023-34055

### Step 4: Fix docker-compose-bankapp.yml
- Add mem_limit: 512m, cpus: '0.5', restart: unless-stopped
- Add healthcheck with wget --spider http://localhost:8080/actuator/health

### Step 5: Fix app-tier.yml (Kubernetes)
- Add resources: requests: {memory: 256Mi, cpu: 250m} limits: {memory: 512Mi, cpu: 500m}
- Add livenessProbe and readinessProbe on /actuator/health
- Set terminationGracePeriodSeconds: 30

### Step 6: Fix application.properties (HikariCP)
- Create src/main/resources/application.properties if not exists
- Set spring.datasource.hikari.maximum-pool-size=5
- Set spring.datasource.hikari.minimum-idle=2
- Set spring.datasource.hikari.connection-timeout=20000
- Set spring.datasource.hikari.idle-timeout=300000
- Set management.endpoints.web.exposure.include=health,metrics,prometheus

### Step 7: Add Prometheus monitoring
- Create k8s/monitoring/prometheus-config.yml with scrape config for bankapp
- Create k8s/monitoring/grafana-dashboard.json with panels for: CPU, Memory, HTTP rate, JVM heap, DB connections

### Step 8: Add GitLab CI pipeline (.gitlab-ci.yml)
- Stages: secret-scan, sast, build, container-scan, deploy
- Use trivy for container scanning
- Deploy stage uses kubectl apply

### Step 9: Commit all fixed files to branch devflow/fix/issue-${issueIid}-prod-incident

### Step 10: Create merge request with title "fix: resolve P0 production incident — OOMKilled, CVEs, DB pool exhaustion"
- MR description must include: Root Cause Analysis, Changes Made, Security fixes (CVEs resolved), Testing steps, Rollback plan

Do NOT skip any step. This is a P0 production incident.
`.trim()

      this.emit({ stage: "duo_workflow", status: "running", message: "Triggering GitLab Duo Agent workflow..." })
      const { id: workflowId, status: initialStatus } = await triggerDuoWorkflow(goal, issueIid)
      this.emit({ stage: "duo_workflow", status: "done", message: `Workflow #${workflowId} started (${initialStatus})` })

      this.emit({ stage: "polling", status: "running", message: "⚙️  GitLab Duo agents starting..." })

      const finalStatus = await pollWorkflow(workflowId, (_status, step) => {
        // Track failures and resolutions from step content
        if (/^❌/.test(step)) {
          stats.failed++
          this.io?.emit("pipeline:stats", { ...stats })
        }
        if (/^✅/.test(step)) {
          stats.resolved++
          this.io?.emit("pipeline:stats", { ...stats })
        }
        this.emit({ stage: "polling", status: "running", message: step })
      })

      if (finalStatus === "finished") {
        this.emit({ stage: "done", status: "done",
          message: `✅ Attempt #${stats.attempt} complete — ${stats.failed} failure(s) detected, ${stats.resolved} resolved` })
        _setMetricsRecovered?.()
        await commentOnIssue(issueIid,
          `✅ **DevFlow Orchestrator** completed on attempt #${stats.attempt}!\n\n` +
          `- ❌ Failures detected: ${stats.failed}\n- ✅ Issues resolved: ${stats.resolved}`)
      } else {
        stats.failed++
        this.io?.emit("pipeline:stats", { ...stats })
        this.emit({ stage: "failed", status: "error",
          message: `❌ Attempt #${stats.attempt} failed (${finalStatus}) — ${stats.failed} failure(s), ${stats.resolved} resolved` })
        await commentOnIssue(issueIid,
          `⚠️ **DevFlow Orchestrator** — Attempt #${stats.attempt} ended: ${finalStatus}`)
        // Auto-retry once
        if (stats.attempt < 2) {
          this.emit({ stage: "failed", status: "error", message: `🔄 Auto-retrying (attempt ${stats.attempt + 1}/2)...` })
          await new Promise(r => setTimeout(r, 3000))
          return runAttempt()
        }
      }

      return { workflowId, finalStatus }
    }

    return runAttempt()
  }
}
