# @shadow/adapter-otel

Turn the OpenTelemetry traces an agent **already emits** into Shadow evidence —
so any instrumented agent (LangGraph, Google ADK, Claude Code, an MCP server,
any OpenAI-compatible agent) can be governed by Shadow without adopting a new
SDK. This is the integration that moves Shadow from "our demo" to **any agent
system's trust layer.**

## Use

```js
import { otelToEvents } from "@shadow/adapter-otel";
import { createSession, appendEvent, sealSession } from "shadow-attest-core";

const events = otelToEvents(spans, { sessionId, agent });   // OTel spans → Shadow events
const s = createSession({ agent, models, environmentFingerprint, keyId, privateKey });
for (const e of events.slice(0, -1)) appendEvent(s, e);     // seal appends session_end
const bundle = sealSession(s);                              // signed, verifiable evidence
```

## What it does

- Maps OTel **GenAI + MCP semantic-convention** spans onto Shadow's **frozen**
  event vocabulary — never adds new event types:
  - `gen_ai.operation.name = chat|text_completion|generate_content` (or any
    `gen_ai.request.model`) → `model_output` (actor `model`)
  - `execute_tool` / `mcp tools/call` / any `gen_ai.tool.name` → `tool_result`
    (actor `tool`); error status → `tool_error`
  - other spans → `tool_call` (actor `agent`); error status → `error`
- Preserves each span's OTel identity — `trace_id` / `span_id` / `parent_span_id`
  — in `extensions.otel`, so the 3D audit trace can render nested and parallel
  agent branches. Shadow keeps its own audit identity; OTel ids are carried
  alongside, not trusted as truth.
- Pure functions; no signing here — the events feed attest-core, which signs.

## Tested

`test/adapter-otel.test.js` — mapping correctness + a full round-trip proving an
OTel trace becomes a signed bundle that `verifyBundle` accepts (5 tests).

## Scope

`mapSpan` covers the common GenAI/MCP operations. Extend the map for provider-
specific span shapes as needed; keep every new mapping onto an existing event
type (the wire schema is frozen at Bundle v1).
