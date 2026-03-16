import "dotenv/config"
import fs from "fs"
import path from "path"
import readline from "readline"

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, r))

async function setup() {
  console.log("\n🔀 DevFlow Orchestrator — Setup\n")

  const token = await ask("GitLab Personal Access Token (api scope): ")
  const projectId = await ask("GitLab Project ID: ")
  const webhookSecret = await ask("Webhook Secret (press Enter to skip): ")
  const anthropicKey = await ask("Anthropic API Key: ")
  const port = await ask("Port [3000]: ") || "3000"

  const env = [
    `GITLAB_TOKEN=${token}`,
    `GITLAB_API_URL=https://gitlab.com/api/v4`,
    `GITLAB_PROJECT_ID=${projectId}`,
    `WEBHOOK_SECRET=${webhookSecret}`,
    `ANTHROPIC_API_KEY=${anthropicKey}`,
    `PORT=${port}`,
  ].join("\n")

  fs.writeFileSync(path.join(process.cwd(), ".env"), env)
  rl.close()

  console.log("\n✅ .env file created!")
  console.log("👉 Run: npm run dev\n")
}

setup().catch(console.error)
