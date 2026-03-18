import { callClaude } from "../claude"

const SYSTEM = `You are a senior SRE and DevSecOps engineer. Analyze the GitLab issue and identify root causes.

Output ONLY valid JSON:
{
  "severity": "P0" | "P1" | "P2" | "P3",
  "category": "performance" | "security" | "reliability" | "compliance" | "feature" | "bug",
  "root_causes": ["<specific root cause>"],
  "affected_components": ["<file or service>"],
  "fix_strategy": ["<concrete fix step>"],
  "estimated_effort": "low" | "medium" | "high",
  "risks": ["<risk if not fixed>"],
  "goal": "<detailed actionable goal for the fix agent — include exact files to read, exact changes to make, exact steps to follow>"
}`

export interface RootCauseAnalysis {
  severity: "P0" | "P1" | "P2" | "P3"
  category: "performance" | "security" | "reliability" | "compliance" | "feature" | "bug"
  root_causes: string[]
  affected_components: string[]
  fix_strategy: string[]
  estimated_effort: "low" | "medium" | "high"
  risks: string[]
  goal: string
}

export class RootCauseAgent {
  async run(issueTitle: string, issueDescription: string, projectContext?: string): Promise<RootCauseAnalysis> {
    console.log("🔍 RootCauseAgent: analyzing issue...")
    const context = projectContext ? `\n\nProject context:\n${projectContext}` : ""
    const raw = await callClaude(
      SYSTEM,
      `Issue Title: ${issueTitle}\n\nIssue Description:\n${issueDescription}${context}`
    )
    try {
      return JSON.parse(raw) as RootCauseAnalysis
    } catch {
      // fallback if Claude wraps in markdown
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0]) as RootCauseAnalysis
      throw new Error("RootCauseAgent: failed to parse response")
    }
  }
}
