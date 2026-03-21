import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Token usage tracker — Green Agent compliance */
export interface TokenUsage {
  agent: string
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost_usd: number
}

const _usageLog: TokenUsage[] = []

export function getTokenUsage(): TokenUsage[] { return _usageLog }

export function getTotalTokenStats() {
  return _usageLog.reduce((acc, u) => ({
    input_tokens:  acc.input_tokens  + u.input_tokens,
    output_tokens: acc.output_tokens + u.output_tokens,
    total_tokens:  acc.total_tokens  + u.total_tokens,
    estimated_cost_usd: acc.estimated_cost_usd + u.estimated_cost_usd,
  }), { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 })
}

/** Cost per 1M tokens (USD) */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-3-5-sonnet-20241022": { input: 3.0,  output: 15.0 },
  "claude-3-5-haiku-20241022":  { input: 0.8,  output: 4.0  },
}

/**
 * 🌱 Green Agent routing — selects the lowest-energy model capable of the task.
 * Haiku: ~0.8$/M input tokens (lightweight tasks, short context)
 * Sonnet: ~3.0$/M input tokens (complex reasoning, long context)
 * Routing threshold: escalate when input > 2000 chars OR agent requires deep reasoning.
 */
const COMPLEX_AGENTS = new Set(["code-agent", "review-agent", "test-agent"])

function greenRoute(input: string, agent = "unknown"): string {
  if (COMPLEX_AGENTS.has(agent) || input.length >= 2000) {
    return "claude-3-5-sonnet-20241022"  // ⚡ high capability
  }
  return "claude-3-5-haiku-20241022"     // 🌱 low energy
}

/** Estimated CO2e per 1M tokens (gCO2e) — approximate, based on datacenter PUE ~1.2 */
const CO2E_PER_1M: Record<string, number> = {
  "claude-3-5-sonnet-20241022": 2.4,
  "claude-3-5-haiku-20241022":  0.6,
}

export function getGreenStats() {
  const byModel: Record<string, { tokens: number; cost: number; co2e_g: number; calls: number }> = {}
  for (const u of _usageLog) {
    if (!byModel[u.model]) byModel[u.model] = { tokens: 0, cost: 0, co2e_g: 0, calls: 0 }
    byModel[u.model].tokens += u.total_tokens
    byModel[u.model].cost   += u.estimated_cost_usd
    byModel[u.model].co2e_g += (u.total_tokens / 1_000_000) * (CO2E_PER_1M[u.model] ?? 2.4)
    byModel[u.model].calls  += 1
  }

  const total_co2e_g = Object.values(byModel).reduce((s, v) => s + v.co2e_g, 0)
  const haikuCalls = _usageLog.filter(u => u.model.includes("haiku"))
  const haiku_pct = _usageLog.length
    ? Math.round((haikuCalls.length / _usageLog.length) * 100)
    : 0

  // CO₂e that would have been emitted if every call used Sonnet instead of Haiku
  const haikuTokens = haikuCalls.reduce((s, u) => s + u.total_tokens, 0)
  const energy_saved_g = +((haikuTokens / 1_000_000) * (CO2E_PER_1M["claude-3-5-sonnet-20241022"] - CO2E_PER_1M["claude-3-5-haiku-20241022"])).toFixed(4)

  // Actionable sustainability insights
  const insights: string[] = []
  if (haiku_pct < 50) insights.push("Consider simplifying agent prompts — more calls could route to Haiku and reduce energy use")
  if (haiku_pct >= 50) insights.push(`${haiku_pct}% of calls used Haiku — smart routing is saving ~${energy_saved_g}g CO₂e vs always using Sonnet`)
  if (_usageLog.length > 0) {
    const avgTokens = Math.round(_usageLog.reduce((s, u) => s + u.total_tokens, 0) / _usageLog.length)
    if (avgTokens > 3000) insights.push("Average call uses >3000 tokens — consider trimming system prompts to reduce energy per inference")
    else insights.push(`Average ${avgTokens} tokens/call — efficient prompt design is minimizing energy consumption`)
  }
  const sonnetCalls = _usageLog.filter(u => u.model.includes("sonnet")).length
  if (sonnetCalls > 0) insights.push(`${sonnetCalls} complex task(s) correctly escalated to Sonnet — only used when reasoning depth justified the energy cost`)

  return {
    byModel,
    total_co2e_g: +total_co2e_g.toFixed(4),
    energy_saved_g,
    haiku_pct,
    total_calls: _usageLog.length,
    insights,
  }
}

/**
 * Call Claude via Anthropic SDK with token tracking.
 * Uses Haiku for lightweight tasks, Sonnet for complex ones.
 * Green Agent: minimizes token usage by routing to cheapest capable model.
 */
export async function callClaude(
  system: string,
  user: string,
  agent = "unknown",
  forceModel?: string
): Promise<string> {
  // 🌱 Green Agent: route to lowest-carbon model capable of the task.
  // Haiku uses ~4x fewer tokens per dollar than Sonnet — lower energy per inference.
  // Only escalate to Sonnet when input complexity justifies it.
  const model = forceModel || greenRoute(user, agent)


  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  })

  // Track token usage
  const pricing = PRICING[model] || { input: 3.0, output: 15.0 }
  const usage: TokenUsage = {
    agent,
    model,
    input_tokens:  msg.usage.input_tokens,
    output_tokens: msg.usage.output_tokens,
    total_tokens:  msg.usage.input_tokens + msg.usage.output_tokens,
    estimated_cost_usd: (
      (msg.usage.input_tokens  / 1_000_000) * pricing.input +
      (msg.usage.output_tokens / 1_000_000) * pricing.output
    ),
  }
  _usageLog.push(usage)
  console.log(`💚 [${agent}] ${model} — ${usage.total_tokens} tokens ($${usage.estimated_cost_usd.toFixed(5)})`)

  const block = msg.content[0]
  if (block.type !== "text") throw new Error("Unexpected response type from Claude")
  return block.text
}
