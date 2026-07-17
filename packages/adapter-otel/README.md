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

## See it run

```
node packages/adapter-otel/example.js
```

Takes a realistic five-span agent trace (a loan-review agent: think → read the
tax-return PDF → an MCP sanctions lookup that errors then retries → answer),
maps it to Shadow events, signs it, verifies it, then edits a signed event and
shows verification fail (`prev_hash_mismatch`). The whole point in ~20 lines of
output: a real agent's OTel run, signed and independently checkable, with no
Shadow SDK in the agent.

## Turn a real trace into a verifiable bundle (CLI)

```
node bin/otel-to-bundle.mjs <spans.json> --out bundle.json
# or, to try it with a built-in trace:
node bin/otel-to-bundle.mjs --sample --out bundle.json
```

Reads exported OTel spans (a JSON array), writes a **signed** `bundle.json` plus
its public key, and prints the command to check it with the **shipped** verifier:

```
node bin/shadow-verify.mjs bundle.json --public-key bundle.json.public.pem
#  → ✓ Bundle verified … trust: SELF_SIGNED
```

That closes the loop cross-tool: the adapter's output is verified by the same
CLI a bank runs, not just by an in-process call. The CLI self-verifies before
writing and never emits a bundle that doesn't check. (`--sample` prints its help
with `--help`; timestamps may be BigInt, number, or string.)

## Tested

`test/adapter-otel.test.js` — mapping correctness, exported-JSON timestamp
handling, and a full round-trip proving an OTel trace becomes a signed bundle
that `verifyBundle` accepts (6 tests). The CLI's output is additionally verified
by `bin/shadow-verify.mjs` end-to-end.

## Scope

`mapSpan` covers the common GenAI/MCP operations. Extend the map for provider-
specific span shapes as needed; keep every new mapping onto an existing event
type (the wire schema is frozen at Bundle v1).
