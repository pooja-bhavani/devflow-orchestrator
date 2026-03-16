import "dotenv/config"
import { DevFlowOrchestrator } from "./orchestrator/orchestrator"

const issueIid = parseInt(process.argv[2] || "2", 10)
const orch = new DevFlowOrchestrator()
orch.run(issueIid)
  .then((r) => console.log("🎉 Done:", r))
  .catch((e: Error) => console.error("❌", e.message))
