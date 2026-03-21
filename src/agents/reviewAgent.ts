import { callClaude } from "../claude"
import { GeneratedFile } from "./codeAgent"
import { SecurityReport } from "./securityAgent"

const SYSTEM = `You are a principal engineer doing a final code review before merge.
Output ONLY valid JSON:
{
  "approved": true,
  "comments": ["<inline comment>"],
  "mr_title": "<concise MR title>",
  "mr_description": "<full markdown MR description with sections: ## Summary, ## Changes, ## Security, ## Testing>"
}`

export interface ReviewResult {
  approved: boolean
  comments: string[]
  mr_title: string
  mr_description: string
}

export class ReviewAgent {
  async run(
    codeFiles: GeneratedFile[],
    testFiles: GeneratedFile[],
    security: SecurityReport
  ): Promise<ReviewResult> {
    console.log("👁️  ReviewAgent: reviewing code and preparing MR...")
    const codeBlock = codeFiles.map((f) => `// FILE: ${f.path}\n${f.content}`).join("\n\n")
    const prompt = `Security report:\n${JSON.stringify(security, null, 2)}\n\nCode:\n${codeBlock}`
    const raw = await callClaude(SYSTEM, prompt, "review-agent")
    try {
      return JSON.parse(raw) as ReviewResult
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0]) as ReviewResult
      throw new Error("ReviewAgent: failed to parse response")
    }
  }
}
