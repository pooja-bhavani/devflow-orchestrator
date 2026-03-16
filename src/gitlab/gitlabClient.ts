import axios from "axios"

const api = axios.create({
  baseURL: process.env.GITLAB_API_URL || "https://gitlab.com/api/v4",
  headers: { "PRIVATE-TOKEN": process.env.GITLAB_TOKEN },
})

const PROJECT = process.env.GITLAB_PROJECT_ID

export interface GitLabIssue {
  iid: number
  title: string
  description: string
}

export async function getIssue(iid: number): Promise<GitLabIssue> {
  const { data } = await api.get(`/projects/${PROJECT}/issues/${iid}`)
  return { iid: data.iid, title: data.title, description: data.description || "" }
}

export async function commentOnIssue(iid: number, body: string): Promise<void> {
  await api.post(`/projects/${PROJECT}/issues/${iid}/notes`, { body })
}

export async function createBranch(name: string, ref = "main"): Promise<void> {
  await api.post(`/projects/${PROJECT}/repository/branches`, { branch: name, ref })
}

export async function commitFiles(
  branch: string,
  message: string,
  files: { path: string; content: string }[]
): Promise<void> {
  const actions = files.map((f) => ({
    action: "create" as const,
    file_path: f.path,
    content: f.content,
  }))
  await api.post(`/projects/${PROJECT}/repository/commits`, {
    branch,
    commit_message: message,
    actions,
  })
}

export async function createMR(
  sourceBranch: string,
  title: string,
  description: string
): Promise<string> {
  const { data } = await api.post(`/projects/${PROJECT}/merge_requests`, {
    source_branch: sourceBranch,
    target_branch: "main",
    title,
    description,
    remove_source_branch: true,
  })
  return data.web_url
}

/** Trigger a GitLab Duo Agent Platform workflow and poll until done */
export async function triggerDuoWorkflow(
  goal: string,
  issueIid: number
): Promise<{ id: number; status: string }> {
  const { data } = await api.post("/ai/duo_workflows/workflows", {
    project_id: PROJECT,
    goal,
    issue_id: issueIid,
    workflow_definition: "developer/v1",
    start_workflow: true,
    allow_agent_to_request_user: false,
    environment: "ambient",
  })
  return { id: data.id, status: data.status }
}

/** Extract all step messages from ui_chat_log — the authoritative ordered log */
function extractSteps(checkpoints: Record<string, unknown>[]): string[] {
  const latest = checkpoints[0]
  if (!latest) return []

  const cv = (latest?.checkpoint as Record<string, unknown>)?.channel_values as Record<string, unknown> | undefined
  if (!cv) return []

  const logs = cv["ui_chat_log"] as unknown[]
  if (!Array.isArray(logs)) return []

  return logs.map((item) => {
    if (typeof item === "string") return item
    if (typeof item !== "object" || item === null) return null
    const msg = item as Record<string, unknown>
    const content = (msg.content as string || "").trim()
    if (!content) return null

    // Classify by content
    if (content.startsWith("Starting Flow")) return `🚀 ${content}`
    if (content.startsWith("Run git command")) return `🔧 ${content}`
    if (content.startsWith("Read file") || content.includes("read_file")) return `📖 ${content}`
    if (content.startsWith("Search files") || content.startsWith("Search for")) return `🔍 ${content}`
    if (content.includes("list_dir") || content.startsWith("List ")) return `📁 ${content}`
    if (content.startsWith("Create branch")) return `🌿 ${content}`
    if (content.startsWith("Create merge request")) return `🔀 ${content}`
    if (content.includes("edit_file") || content.startsWith("Edit file")) return `✏️  ${content}`
    if (content.includes("create_file") || content.startsWith("Create file")) return `🔧 ${content}`
    // Only mark as error if it's a standalone error line, not a description containing the word
    if (/^(error|failed|exception|oomkilled|crashloop)/i.test(content)) return `❌ ${content}`
    // Resolution/success lines
    if (/^(fixed|resolved|applied|updated|created|written|succeeded|complete)/i.test(content)) return `✅ ${content}`
    // CVE / warning lines
    if (/^(warn|cve-|critical:|high:)/i.test(content)) return `⚠️  ${content}`
    return `🤖 ${content}`
  }).filter(Boolean) as string[]
}

/** Poll workflow status until finished or failed, emitting each new step */
export async function pollWorkflow(
  workflowId: number,
  onStep: (status: string, step: string) => void,
  timeoutMs = 900_000
): Promise<string> {
  const start = Date.now()
  const terminal = new Set(["finished", "failed", "stopped"])
  let emittedCount = 0

  while (Date.now() - start < timeoutMs) {
    const { data } = await api.get(`/ai/duo_workflows/workflows/${workflowId}`)

    try {
      const cp = await api.get(`/ai/duo_workflows/workflows/${workflowId}/checkpoints`)
      const checkpoints: Record<string, unknown>[] = Array.isArray(cp.data) ? cp.data : []
      if (checkpoints.length > 0) {
        const steps = extractSteps(checkpoints)
        for (let i = emittedCount; i < steps.length; i++) {
          onStep(data.status, steps[i])
          // small delay so UI renders each line individually
          await new Promise((r) => setTimeout(r, 80))
        }
        emittedCount = steps.length
      }
    } catch { /* ignore */ }

    if (terminal.has(data.status)) return data.status
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error("Workflow timed out after 15 minutes")
}
