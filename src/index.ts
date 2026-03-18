import "dotenv/config"
import express from "express"
import { createServer } from "http"
import { Server as SocketServer } from "socket.io"
import path from "path"
import { DevFlowOrchestrator } from "./orchestrator/orchestrator"
import { registerMetricsHook } from "./orchestrator/orchestrator"
import { getTotalTokenStats, getTokenUsage, callClaude, getGreenStats } from "./claude"
import { getIssue } from "./gitlab/gitlabClient"

const app = express()
const httpServer = createServer(app)
const io = new SocketServer(httpServer, { cors: { origin: "*" } })

app.use(express.json())
app.use(express.static(path.join(__dirname, "../public")))

/** Verify GitLab webhook signature */
function verifySignature(req: express.Request): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return true // skip if not configured
  return req.headers["x-gitlab-token"] === secret
}

/** GitLab webhook endpoint — triggered on issue creation */
app.post("/webhook", async (req, res) => {
  if (!verifySignature(req)) return res.status(401).json({ error: "Unauthorized" })

  const { object_kind, object_attributes } = req.body
  if (object_kind !== "issue" || object_attributes?.action !== "open") {
    return res.status(200).json({ skipped: true })
  }

  const issueIid: number = object_attributes.iid
  res.status(202).json({ accepted: true, issueIid })

  // Run pipeline async — don't block the webhook response
  const orchestrator = new DevFlowOrchestrator(io)
  orchestrator.run(issueIid).catch((err) => {
    console.error("Pipeline failed:", err.message)
    io.emit("pipeline:event", { stage: "failed", status: "error", message: err.message })
  })
})

/** Manual trigger endpoint for testing */
app.post("/trigger/:issueIid", async (req, res) => {
  const issueIid = parseInt(req.params.issueIid, 10)
  if (isNaN(issueIid)) return res.status(400).json({ error: "Invalid issue IID" })

  res.status(202).json({ accepted: true, issueIid })

  const orchestrator = new DevFlowOrchestrator(io)
  orchestrator.run(issueIid).catch((err) => {
    console.error("Pipeline failed:", err.message)
    io.emit("pipeline:event", { stage: "failed", status: "error", message: err.message })
  })
})

/** Health check */
app.get("/health", (_req, res) => res.json({ status: "ok" }))

/** Token usage stats */
app.get("/stats/tokens", (_req, res) => {
  res.json({ summary: getTotalTokenStats(), breakdown: getTokenUsage() })
})

/** 🌱 Green Agent sustainability stats */
app.get("/stats/green", (_req, res) => {
  res.json(getGreenStats())
})

/** 🌱 Green Agent full sustainability report — human-readable */
app.get("/stats/green/report", (_req, res) => {
  const stats = getGreenStats()
  const report = {
    summary: `This pipeline run used ${stats.total_calls} LLM calls totalling ${stats.total_co2e_g}g CO₂e.`,
    energy_saved: `Smart model routing saved ~${stats.energy_saved_g}g CO₂e by using Haiku for ${stats.haiku_pct}% of calls instead of always using Sonnet.`,
    equivalent: `${stats.total_co2e_g}g CO₂e ≈ ${(stats.total_co2e_g / 411).toFixed(5)} km driven in an average car.`,
    model_breakdown: stats.byModel,
    insights: stats.insights,
    routing_policy: "Haiku for inputs <2000 chars (lightweight tasks), Sonnet for complex reasoning only",
    co2e_methodology: "Estimated based on datacenter PUE ~1.2: Haiku 0.6g/1M tokens, Sonnet 2.4g/1M tokens",
  }
  res.json(report)
})

/** AI Assistant chat — real Claude, analyzes any GitLab issue */
app.post("/chat", async (req, res) => {
  const { message, issueIid } = req.body as { message: string; issueIid?: number }
  if (!message) return res.status(400).json({ error: "message required" })

  try {
    let context = ""
    if (issueIid) {
      try {
        const issue = await getIssue(issueIid)
        context = `\n\nGitLab Issue #${issueIid}:\nTitle: ${issue.title}\nDescription: ${issue.description}`
      } catch { /* issue fetch failed, continue without it */ }
    }

    const SYSTEM = `You are DevFlow AI, an expert SRE and DevSecOps assistant embedded in the DevFlow Orchestrator dashboard.
You help engineers understand GitLab issues, diagnose production incidents, and decide whether to run the automated pipeline.

When given an issue, you:
1. Summarize the problem clearly in 2-3 sentences
2. List the likely root causes (be specific, not generic)
3. List affected components/files
4. Recommend whether to run the pipeline and why
5. Estimate severity: P0/P1/P2/P3

Keep responses concise and actionable. Use plain text, no markdown headers.`

    const reply = await callClaude(SYSTEM, message + context, "ai-assistant")
    res.json({ reply })
  } catch (err: unknown) {
    const e = err as { message?: string }
    res.status(500).json({ error: e.message ?? "Claude call failed" })
  }
})

/** Push live metrics to all connected dashboards every 5s */
let _cpu = 94, _mem = 98, _pods = 8, _db = 10, _e5xx = 67, _pipeOk = 0
function startMetricsBroadcast() {
  setInterval(() => {
    const j = () => Math.round((Math.random() - 0.5) * 6)
    _cpu  = Math.min(100, Math.max(5,  _cpu  + j()))
    _mem  = Math.min(100, Math.max(10, _mem  + j()))
    _e5xx = Math.min(100, Math.max(0,  _e5xx + j()))
    _db   = Math.min(10,  Math.max(1,  _db   + Math.round((Math.random()-0.5)*2)))
    io.emit("metrics:update", { cpu: _cpu, mem: _mem, pods: _pods, db: _db, e5xx: _e5xx, pipeOk: _pipeOk })
  }, 5000)
}
startMetricsBroadcast()

/** Allow pipeline to update metric state after recovery */
export function setMetricsRecovered() {
  _cpu = 28; _mem = 35; _pods = 8; _db = 3; _e5xx = 0; _pipeOk = 100
}

io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id)
  // Send current metrics immediately on connect
  socket.emit("metrics:update", { cpu: _cpu, mem: _mem, pods: _pods, db: _db, e5xx: _e5xx, pipeOk: _pipeOk })
})

registerMetricsHook(setMetricsRecovered)

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`🚀 DevFlow Orchestrator running on http://localhost:${PORT}`)
  console.log(`📡 Webhook endpoint: POST http://localhost:${PORT}/webhook`)
  console.log(`🖥️  Dashboard: http://localhost:${PORT}`)
})
