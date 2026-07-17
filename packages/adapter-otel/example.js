// packages/adapter-otel/example.js
// ─────────────────────────────────────────────────────────────────
// Runnable end-to-end: a realistic OpenTelemetry agent trace becomes a signed,
// independently-verifiable Shadow evidence bundle — and a post-hoc edit is
// caught. This is the thing you SEE working (the tests prove it; this shows it).
//
//   node packages/adapter-otel/example.js
//
// The point: an agent instrumented with the standard OTel GenAI/MCP conventions
// needs no Shadow SDK. Export its spans, run them through this adapter, and the
// run is governed — provenance chained, signed, and checkable by anyone with the
// public key.
// ─────────────────────────────────────────────────────────────────
import { generateKeyPairSync } from "node:crypto";
import { otelToEvents } from "./index.js";
import { createSession, appendEvent, sealSession, verifyBundle } from "../attest-core/session.js";

// ── 1. A sample trace: a loan-review agent, as an OTel exporter would emit it ──
// (five spans of one trace `t-42`: think, read the file, search a registry that
//  errors, then answer — the shape any GenAI/MCP-instrumented agent produces.)
const trace = [
  { name: "chat", trace_id: "t-42", span_id: "a1",
    start_time_unix_nano: 1_700_000_000_000_000_000n, end_time_unix_nano: 1_700_000_001_000_000_000n,
    attributes: { "gen_ai.operation.name": "chat", "gen_ai.provider.name": "anthropic",
      "gen_ai.request.model": "claude-opus-4-8", "gen_ai.usage.input_tokens": 1840, "gen_ai.usage.output_tokens": 210 } },
  { name: "execute_tool Read", trace_id: "t-42", span_id: "a2", parent_span_id: "a1",
    start_time_unix_nano: 1_700_000_001_200_000_000n, end_time_unix_nano: 1_700_000_001_500_000_000n,
    attributes: { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "Read",
      "gen_ai.tool.description": "read the applicant's tax return PDF", "gen_ai.tool.call.id": "c-01" } },
  { name: "tools/call", trace_id: "t-42", span_id: "a3", parent_span_id: "a1",
    start_time_unix_nano: 1_700_000_001_700_000_000n, end_time_unix_nano: 1_700_000_002_100_000_000n,
    attributes: { "mcp.method.name": "tools/call", "mcp.tool.name": "sanctions_list_lookup", "mcp.server.name": "compliance" },
    status: { code: 2, message: "upstream 503" } },
  { name: "tools/call", trace_id: "t-42", span_id: "a4", parent_span_id: "a1",
    start_time_unix_nano: 1_700_000_002_300_000_000n, end_time_unix_nano: 1_700_000_002_600_000_000n,
    attributes: { "mcp.method.name": "tools/call", "mcp.tool.name": "sanctions_list_lookup", "mcp.server.name": "compliance" } },
  { name: "chat", trace_id: "t-42", span_id: "a5", parent_span_id: "a1",
    start_time_unix_nano: 1_700_000_002_800_000_000n, end_time_unix_nano: 1_700_000_003_400_000_000n,
    attributes: { "gen_ai.operation.name": "chat", "gen_ai.provider.name": "anthropic",
      "gen_ai.response.model": "claude-opus-4-8", "gen_ai.response.finish_reasons": ["stop"],
      "gen_ai.usage.input_tokens": 2600, "gen_ai.usage.output_tokens": 320 } },
];

const line = "─".repeat(72);
console.log(`\n${line}\n OpenTelemetry trace  →  signed Shadow evidence\n${line}`);
console.log(` in: ${trace.length} spans, trace_id=${trace[0].trace_id}\n`);

// ── 2. Map the spans onto Shadow's frozen event vocabulary ──
const events = otelToEvents(trace, { sessionId: "loan-review-42", agent: "loan-review-agent" });
console.log(" mapped events (frozen vocabulary; OTel identity carried in extensions.otel):");
for (const e of events) {
  const otel = e.extensions?.otel?.span_id ? ` [span ${e.extensions.otel.span_id}]` : "";
  const detail = e.payload?.tool ? ` ${e.payload.tool}` : e.payload?.request_model || e.payload?.response_model
    ? ` ${e.payload.request_model || e.payload.response_model}` : "";
  console.log(`   ${String(e.event_type).padEnd(14)} actor=${String(e.actor).padEnd(7)}${detail}${otel}`);
}

// ── 3. Sign it with attest-core (a fresh key stands in for an HSM/KMS) ──
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const session = createSession({
  agent: { name: "loan-review-agent", version: "1.4.0" },
  models: [{ model_id: "claude-opus-4-8", provider: "anthropic" }],
  environmentFingerprint: { os: process.platform, node_version: process.version },
  keyId: "example-key-2026", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
  sessionId: "loan-review-42",
});
// append every mapped event except the trailing session_end (seal adds its own),
// preserving OTel identity + timestamps
for (const e of events.slice(0, -1)) {
  appendEvent(session, { event_type: e.event_type, actor: e.actor, payload: e.payload, ts_utc: e.ts_utc, extensions: e.extensions });
}
const bundle = sealSession(session);
const sig0 = bundle.signatures?.[0];
console.log(`\n sealed bundle: ${bundle.events.length} events · batch_root ${String(bundle.batch_root ?? "").slice(0, 16)}… · signed ${sig0 ? `${sig0.algorithm} key_id=${sig0.key_id}` : "no"}`);

// ── 4. Anyone with the public key verifies it ──
const pub = publicKey.export({ type: "spki", format: "pem" });
const ok = verifyBundle(bundle, { publicKey: pub });
console.log(` verifyBundle → ${ok.ok ? "OK ✓  (record intact, signature valid)" : "FAILED ✕ " + ok.reason}`);

// ── 5. Now edit a signed event, the way tampering would — and watch it break ──
const target = bundle.events.find((e) => e.event_type === "model_output") ?? bundle.events[1];
target.payload_hash = target.payload_hash.slice(0, -1) + (target.payload_hash.slice(-1) === "0" ? "1" : "0");
const after = verifyBundle(bundle, { publicKey: pub });
console.log(`\n tamper: edited ${target.event_type} (seq ${target.seq}) after signing`);
console.log(` verifyBundle → ${after.ok ? "OK (unexpected!)" : "FAILED ✕  " + (after.reason || "chain broken") + (after.seq != null ? " at seq " + after.seq : "")}`);
console.log(`${line}\n a real agent's OTel run, signed and independently checkable — no Shadow SDK\n in the agent. Swap the fresh key for an HSM/KMS and publish the public key.\n${line}\n`);
