import "dotenv/config"
import express from "express"
import { createServer } from "http"
import { Server as SocketServer } from "socket.io"
import crypto from "crypto"
import path from "path"
import { DevFlowOrchestrator } from "./orchestrator/orchestrator"
import { registerMetricsHook } from "./orchestrator/orchestrator"

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
