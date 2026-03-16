import { callClaude } from "../claude"
import { GeneratedFile } from "./codeAgent"

const SYSTEM = `You are an application security expert. Scan the code for OWASP Top 10 vulnerabilities, hardcoded secrets, and insecure patterns.
Output ONLY valid JSON:
{
  "passed": true,
  "severity": "none" | "low" | "medium" | "high" | "critical",
  "issues": [{ "location": "<file:line>", "issue": "<description>", "fix": "<recommendation>" }],
  "summary": "<one paragraph>"
}`

export interface SecurityReport {
  passed: boolean
  severity: "none" | "low" | "medium" | "high" | "critical"
  issues: { location: string; issue: string; fix: string }[]
  summary: string
}

export class SecurityAgent {
  async run(files: GeneratedFile[]): Promise<SecurityReport> {
    console.log("🔒 SecurityAgent: scanning for vulnerabilities...")
    const codeBlock = files.map((f) => `// FILE: ${f.path}\n${f.content}`).join("\n\n")
    const raw = await callClaude(SYSTEM, `Scan this code:\n\n${codeBlock}`)
    return JSON.parse(raw) as SecurityReport
  }
}
