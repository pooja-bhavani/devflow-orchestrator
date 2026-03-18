import { callClaude } from "../claude"

const SYSTEM = `You are a senior software architect. Analyze the GitLab issue and produce a structured JSON implementation spec.
Output ONLY valid JSON — no markdown, no explanation:
{
  "summary": "<one-line summary>",
  "tasks": ["<task1>", "<task2>"],
  "files": ["<relative file path>"],
  "acceptance_criteria": ["<testable criterion>"]
}`

export interface Spec {
  summary: string
  tasks: string[]
  files: string[]
  acceptance_criteria: string[]
}

export class SpecAgent {
  async run(issueTitle: string, issueDescription: string): Promise<Spec> {
    console.log("🧠 SpecAgent: analyzing issue...")
    const raw = await callClaude(SYSTEM, `Issue: ${issueTitle}\n\n${issueDescription}`, "spec-agent")
    return JSON.parse(raw) as Spec
  }
}
