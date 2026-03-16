import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Call Claude claude-3-5-sonnet via Anthropic SDK.
 * Keeps token usage minimal for Green Agent compliance.
 */
export async function callClaude(system: string, user: string): Promise<string> {
  const msg = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: user }],
  })
  const block = msg.content[0]
  if (block.type !== "text") throw new Error("Unexpected response type from Claude")
  return block.text
}
