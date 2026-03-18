import { callClaude } from "../claude"
import { GeneratedFile } from "./codeAgent"

const SYSTEM = `You are a compliance and governance expert for software systems. 
Analyze the code changes and check against common compliance frameworks.

Check for:
- GDPR: PII handling, data retention, consent mechanisms
- SOC2: Access controls, audit logging, encryption at rest/transit
- OWASP ASVS: Authentication, session management, input validation
- CIS Benchmarks: Container security, K8s hardening, network policies
- NIST: Least privilege, defense in depth, secure defaults

Output ONLY valid JSON:
{
  "passed": true | false,
  "frameworks_checked": ["GDPR", "SOC2", "OWASP", "CIS", "NIST"],
  "violations": [
    {
      "framework": "<framework name>",
      "control": "<control ID or name>",
      "severity": "critical" | "high" | "medium" | "low",
      "description": "<what is violated>",
      "remediation": "<how to fix>"
    }
  ],
  "compliant_items": ["<what is already compliant>"],
  "compliance_score": 0-100,
  "summary": "<one paragraph executive summary>"
}`

export interface ComplianceViolation {
  framework: string
  control: string
  severity: "critical" | "high" | "medium" | "low"
  description: string
  remediation: string
}

export interface ComplianceReport {
  passed: boolean
  frameworks_checked: string[]
  violations: ComplianceViolation[]
  compliant_items: string[]
  compliance_score: number
  summary: string
}

export class ComplianceAgent {
  async run(files: GeneratedFile[], issueContext: string): Promise<ComplianceReport> {
    console.log("📋 ComplianceAgent: checking compliance frameworks...")
    const codeBlock = files.map((f) => `// FILE: ${f.path}\n${f.content}`).join("\n\n")
    const raw = await callClaude(
      SYSTEM,
      `Issue context:\n${issueContext}\n\nCode to check:\n${codeBlock}`
    )
    try {
      return JSON.parse(raw) as ComplianceReport
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0]) as ComplianceReport
      throw new Error("ComplianceAgent: failed to parse response")
    }
  }
}
