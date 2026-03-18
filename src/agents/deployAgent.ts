import { callClaude } from "../claude"
import { GeneratedFile } from "./codeAgent"
import { SecurityReport } from "./securityAgent"
import { ComplianceReport } from "./complianceAgent"

const SYSTEM = `You are a senior DevOps engineer. Given fixed code, security report, and compliance report,
generate a complete deployment plan and all required deployment configuration files.

Generate deployment configs for:
- Dockerfile (if not present or needs updating)
- docker-compose.yml (local/staging)
- Kubernetes manifests (deployment.yml, service.yml, hpa.yml)
- GitLab CI/CD pipeline stages for deploy
- Health check and rollback instructions

Rules:
- Always set resource limits and requests on K8s pods
- Always add liveness and readiness probes
- Always use non-root user in Docker
- Always add restart policies
- Separate each file with: // FILE: <relative-path>
- Output only file contents, no markdown fences`

export interface DeployPlan {
  files: GeneratedFile[]
  rollback_steps: string[]
  health_check_url: string
  deployment_notes: string
}

export class DeployAgent {
  async run(
    codeFiles: GeneratedFile[],
    security: SecurityReport,
    compliance: ComplianceReport,
    issueTitle: string
  ): Promise<DeployPlan> {
    console.log("🚀 DeployAgent: generating deployment plan...")

    const secSummary = `Security: ${security.severity} severity, passed=${security.passed}`
    const compSummary = `Compliance score: ${compliance.compliance_score}/100, passed=${compliance.passed}`
    const fileList = codeFiles.map(f => f.path).join(", ")

    const prompt = `Issue: ${issueTitle}
${secSummary}
${compSummary}
Files changed: ${fileList}

Generate deployment configuration for these changes.`

    const raw = await callClaude(SYSTEM, prompt, "deploy-agent")

    // Parse generated files
    const files: GeneratedFile[] = []
    const parts = raw.split(/^\/\/ FILE: (.+)$/m)
    for (let i = 1; i < parts.length; i += 2) {
      files.push({ path: parts[i].trim(), content: parts[i + 1]?.trim() || "" })
    }

    return {
      files,
      rollback_steps: [
        "kubectl rollout undo deployment/devflow",
        "docker-compose down && docker-compose up -d --scale app=0",
        "Revert branch and create hotfix MR",
      ],
      health_check_url: "/health",
      deployment_notes: `Deployment plan generated for: ${issueTitle}`,
    }
  }
}
