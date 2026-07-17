// packages/adapter-otel/index.js
// ─────────────────────────────────────────────────────────────────
// OpenTelemetry GenAI/MCP → Shadow evidence adapter.
//
// The highest-leverage integration: it lets Shadow ingest the traces ANY
// instrumented agent already emits (LangGraph, Google ADK, Claude Code, an
// MCP server, any OpenAI-compatible agent) and turn them into signed evidence
// — without those systems adopting Shadow's SDK. Shadow stays the source of
// audit truth; this only MAPS spans onto the FROZEN evidence event vocabulary
// (never adds new event types) and preserves each span's OTel identity
// (trace_id / span_id / parent_span_id) in `extensions.otel` so the audit
// trace can show nested + parallel agent branches.
//
// Input: OTel spans as plain objects (the shape a span exporter produces) —
//   { name, attributes:{...}, status?:{code}, trace_id, span_id, parent_span_id?, start_time_unix_nano?, end_time_unix_nano? }
// Output: Shadow event partials { event_type, actor, payload, ts_utc?, extensions }
//   ready for attest-core appendEvent(). Pure functions — no signing here.
//
// Refs: OpenTelemetry Semantic Conventions for GenAI + MCP.
// ─────────────────────────────────────────────────────────────────

const ACTORS = new Set(["agent", "user", "model", "tool", "system"]);

function nanoToIso(nano) {
  if (nano == null) return undefined;
  const ms = Number(BigInt(nano) / 1000000n);
  return new Date(ms).toISOString();
}

// Map one OTel span to ONE Shadow event partial (frozen event vocabulary).
export function mapSpan(span) {
  const a = span.attributes || {};
  const op = a["gen_ai.operation.name"];        // chat | text_completion | embeddings | execute_tool | generate_content ...
  const mcpMethod = a["mcp.method.name"];        // tools/call | resources/read | ...
  const isError = span.status && (span.status.code === 2 || span.status.code === "ERROR");
  const otel = {
    trace_id: span.trace_id, span_id: span.span_id,
    parent_span_id: span.parent_span_id ?? null, name: span.name,
  };
  const ts = nanoToIso(span.end_time_unix_nano ?? span.start_time_unix_nano);

  let event_type, actor, payload;
  if (op === "execute_tool" || mcpMethod === "tools/call" || a["gen_ai.tool.name"]) {
    actor = "tool";
    event_type = isError ? "tool_error" : "tool_result";
    payload = clean({
      tool: a["gen_ai.tool.name"] ?? a["mcp.tool.name"], call_id: a["gen_ai.tool.call.id"],
      description: a["gen_ai.tool.description"], server: a["mcp.server.name"], mcp_method: mcpMethod,
    });
  } else if (op === "chat" || op === "text_completion" || op === "generate_content" || a["gen_ai.request.model"] || a["gen_ai.response.model"]) {
    actor = "model";
    event_type = isError ? "error" : "model_output";
    payload = clean({
      provider: a["gen_ai.provider.name"] ?? a["gen_ai.system"],
      request_model: a["gen_ai.request.model"], response_model: a["gen_ai.response.model"],
      input_tokens: a["gen_ai.usage.input_tokens"], output_tokens: a["gen_ai.usage.output_tokens"],
      finish_reasons: a["gen_ai.response.finish_reasons"], operation: op,
    });
  } else if (mcpMethod) {
    actor = "tool"; event_type = isError ? "tool_error" : "tool_result";
    payload = clean({ mcp_method: mcpMethod, server: a["mcp.server.name"] });
  } else {
    actor = "agent"; event_type = isError ? "error" : "tool_call";
    payload = clean({ span_name: span.name });
  }
  return { event_type, actor, payload, ...(ts ? { ts_utc: ts } : {}), extensions: { otel } };
}

function clean(o) { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) r[k] = v; return r; }

// Ordered Shadow events for a whole trace: session_start, mapped spans (by
// start time), session_end. Feed each to attest-core appendEvent(), then seal.
export function otelToEvents(spans, { sessionId, agent } = {}) {
  const ordered = [...spans].sort((x, y) =>
    Number((x.start_time_unix_nano ?? 0n) - (y.start_time_unix_nano ?? 0n)) || 0);
  const root = ordered.find((s) => !s.parent_span_id) ?? ordered[0];
  const events = [];
  events.push({ event_type: "session_start", actor: "system",
    payload: clean({ session_id: sessionId, agent, trace_id: root?.trace_id }),
    extensions: { otel: { trace_id: root?.trace_id } } });
  for (const s of ordered) {
    const e = mapSpan(s);
    if (!ACTORS.has(e.actor)) e.actor = "agent";
    events.push(e);
  }
  events.push({ event_type: "session_end", actor: "system",
    payload: { event_count: events.length + 1 }, extensions: {} });
  return events;
}

export { ACTORS as SHADOW_ACTORS };
