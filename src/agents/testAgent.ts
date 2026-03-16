import { callClaude } from "../claude"
import { GeneratedFile } from "./codeAgent"
import { Spec } from "./specAgent"

const SYSTEM = `You are a senior QA engineer specializing in TypeScript and Jest.
Write a complete Jest test suite covering all exported functions, edge cases, and error paths.
Rules:
- Use descriptive test names that read like documentation
- Mock external dependencies (fs, axios, db) with jest.mock()
- No placeholder tests — all tests must be fully implemented
- Output only the test file contents, no markdown fences`

export class TestAgent {
  async run(files: GeneratedFile[], spec: Spec): Promise<GeneratedFile[]> {
    console.log("🧪 TestAgent: generating tests...")
    const codeBlock = files.map((f) => `// FILE: ${f.path}\n${f.content}`).join("\n\n")
    const prompt = `Acceptance criteria:\n${spec.acceptance_criteria.join("\n")}\n\nCode:\n${codeBlock}`
    const raw = await callClaude(SYSTEM, prompt)
    return files.map((f) => ({
      path: f.path.replace(/\.ts$/, ".test.ts").replace("src/", "src/__tests__/"),
      content: raw.trim(),
    }))
  }
}
