import { readFileSync } from "fs"
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const axios = require("axios")

// Load env
const envFile = readFileSync(".env", "utf8")
const env = {}
for (const line of envFile.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
}

const TOKEN = env.GITLAB_TOKEN
const PROJECT = env.GITLAB_PROJECT_ID || "79558990"
const BASE = "https://gitlab.com/api/v4"

const api = axios.create({
  baseURL: BASE,
  headers: { "PRIVATE-TOKEN": TOKEN },
})

const files = [
  "src/orchestrator/orchestrator.ts",
  "src/gitlab/gitlabClient.ts",
  "src/agents/securityAgent.ts",
  "src/agents/testAgent.ts",
  "src/claude.ts",
  ".gitlab-ci.yml",
  "scripts/run-pipeline.mjs",
  "README.md",
]

const actions = files.map((f) => ({
  action: "update",
  file_path: f,
  content: readFileSync(f, "utf8"),
}))

console.log("Pushing", actions.length, "files to GitLab main...")

try {
  const { data } = await api.post(`/projects/${PROJECT}/repository/commits`, {
    branch: "main",
    commit_message: "docs: improve README with sequential testing instructions",
    actions,
  })
  console.log("✅ Committed:", data.id, data.title)
  console.log("   URL:", data.web_url)
} catch (err) {
  console.error("❌ Error:", err.response?.data || err.message)
}
