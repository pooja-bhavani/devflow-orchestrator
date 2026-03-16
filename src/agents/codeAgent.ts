import { callClaude } from "../claude"
import { Spec } from "./specAgent"

const SYSTEM = `You are a senior TypeScript engineer. Generate production-ready TypeScript code from the spec.
Rules:
- Follow SOLID principles, add JSDoc on exports, handle errors with try/catch
- Separate each file with exactly: // FILE: <relative-path>
- Output only file contents — no markdown fences, no explanations`

export interface GeneratedFile {
  path: string
  content: string
}

export class CodeAgent {
  async run(spec: Spec): Promise<GeneratedFile[]> {
    console.log("💻 CodeAgent: generating code...")
    const prompt = `Spec:\n${JSON.stringify(spec, null, 2)}`
    const raw = await callClaude(SYSTEM, prompt)
    return parseFiles(raw)
  }
}

function parseFiles(raw: string): GeneratedFile[] {
  const files: GeneratedFile[] = []
  const parts = raw.split(/^\/\/ FILE: (.+)$/m)
  for (let i = 1; i < parts.length; i += 2) {
    files.push({ path: parts[i].trim(), content: parts[i + 1]?.trim() || "" })
  }
  // fallback: if no FILE markers, treat entire output as a single file
  if (files.length === 0 && raw.trim()) {
    files.push({ path: "src/generated/output.ts", content: raw.trim() })
  }
  return files
}
