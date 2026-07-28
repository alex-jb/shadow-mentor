// apps/shadow-lens/web/spatial-agent/llm-client.mjs
// §2 — the narrow server-side LLM client interface for the spatial agent, and ONE real adapter
// reusing the repo's existing @anthropic-ai/sdk (the same SDK makeClaudeLlm uses — no duplicate).
// Provider-specific code is isolated here. Server-side ONLY: the key comes from a server env var
// and is never returned to a client. Output is forced to strict JSON via tool-use; no hidden
// chain-of-thought is requested. The client returns {text, citations, actions, model, request_id};
// the LiveSpatialAgentProvider validates it against the real scene.

/**
 * @typedef {Object} SpatialLlmRequest
 * @property {string} systemPrompt
 * @property {string} query
 * @property {string} sceneContext           // fenced source_id: text lines (UNTRUSTED DATA)
 * @property {string[]} allowedTools
 * @property {string[]} allowedActions
 * @property {object} schema                 // JSON Schema for the structured response
 * @property {AbortSignal} [timeoutSignal]
 *
 * ISpatialAgentLlmClient:
 *   generateStructuredSpatialResponse(req: SpatialLlmRequest)
 *     => Promise<{ text:string, citations:{source_id,quote}[], actions:{name,args}[], model:string, request_id?:string }>
 */

export class AnthropicSpatialAgentLlmClient {
  constructor({ apiKey, model = "claude-haiku-4-5" } = {}) {
    if (!apiKey) throw new Error("AnthropicSpatialAgentLlmClient requires a server-side apiKey");
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateStructuredSpatialResponse({ systemPrompt, query, sceneContext, allowedTools, allowedActions, schema, timeoutSignal }) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });
    // tool-use forces strict JSON; the closed action/tool names are pinned into the schema.
    const tool = {
      name: "record_spatial_response",
      description: "Answer ONLY from the evidence; cite source_ids that exist; use only allowed actions.",
      input_schema: schema ?? {
        type: "object",
        properties: {
          text: { type: "string" },
          citations: { type: "array", items: { type: "object", properties: { source_id: { type: "string" }, quote: { type: "string" } }, required: ["source_id", "quote"] } },
          actions: { type: "array", items: { type: "object", properties: { name: { type: "string", enum: allowedActions ?? [] }, args: { type: "object" } }, required: ["name"] } },
        },
        required: ["text", "citations", "actions"],
      },
    };
    const system = systemPrompt +
      `\nAllowed actions: ${(allowedActions ?? []).join(", ")}. Allowed tools: ${(allowedTools ?? []).join(", ")}. ` +
      "Do NOT include reasoning or chain-of-thought. Never invent source_ids.";
    const resp = await client.messages.create({
      model: this.model, max_tokens: 700, system,
      tools: [tool], tool_choice: { type: "tool", name: "record_spatial_response" },
      messages: [{ role: "user", content: `${sceneContext}\n\nQUESTION: ${query}` }],
    }, timeoutSignal ? { signal: timeoutSignal } : undefined);
    const block = (resp.content ?? []).find((b) => b.type === "tool_use");
    const out = block?.input ?? { text: "", citations: [], actions: [] };
    return { text: String(out.text ?? ""), citations: out.citations ?? [], actions: out.actions ?? [], model: this.model, request_id: resp.id };
  }
}
