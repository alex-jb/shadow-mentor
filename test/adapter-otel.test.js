// test/adapter-otel.test.js
// Contract tests for the OpenTelemetry GenAI/MCP → Shadow adapter: correct
// mapping onto the frozen event vocabulary, and a full round-trip proving an
// OTel trace becomes a signed, verifiable Shadow bundle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import { mapSpan, otelToEvents } from "../packages/adapter-otel/index.js";
import { createSession, appendEvent, sealSession, verifyBundle } from "../packages/attest-core/session.js";

const SPANS = [
  { name: "chat", trace_id: "t1", span_id: "s1", start_time_unix_nano: 1000n, end_time_unix_nano: 2000n,
    attributes: { "gen_ai.operation.name": "chat", "gen_ai.provider.name": "anthropic",
      "gen_ai.request.model": "claude-opus-4-8", "gen_ai.usage.input_tokens": 120, "gen_ai.usage.output_tokens": 40 } },
  { name: "execute_tool Read", trace_id: "t1", span_id: "s2", parent_span_id: "s1",
    start_time_unix_nano: 2100n, end_time_unix_nano: 2300n,
    attributes: { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "Read", "gen_ai.tool.call.id": "c1" } },
  { name: "tools/call", trace_id: "t1", span_id: "s3", parent_span_id: "s1",
    start_time_unix_nano: 2400n, end_time_unix_nano: 2500n,
    attributes: { "mcp.method.name": "tools/call", "mcp.tool.name": "search", "mcp.server.name": "shadow" },
    status: { code: 2 } },
];

test("mapSpan: chat span → model_output, actor model, preserves OTel identity", () => {
  const e = mapSpan(SPANS[0]);
  assert.equal(e.event_type, "model_output");
  assert.equal(e.actor, "model");
  assert.equal(e.payload.request_model, "claude-opus-4-8");
  assert.equal(e.payload.input_tokens, 120);
  assert.equal(e.extensions.otel.span_id, "s1");
  assert.equal(e.extensions.otel.trace_id, "t1");
});

test("mapSpan: execute_tool span → tool_result, actor tool", () => {
  const e = mapSpan(SPANS[1]);
  assert.equal(e.event_type, "tool_result");
  assert.equal(e.actor, "tool");
  assert.equal(e.payload.tool, "Read");
  assert.equal(e.extensions.otel.parent_span_id, "s1");
});

test("mapSpan: error status on an MCP tool span → tool_error", () => {
  const e = mapSpan(SPANS[2]);
  assert.equal(e.event_type, "tool_error");
  assert.equal(e.actor, "tool");
});

test("mapSpan: emits a W3C traceparent (version-trace-span-flags) in extensions.otel", () => {
  const e = mapSpan(SPANS[0]);
  assert.equal(e.extensions.otel.traceparent, "00-t1-s1-01");
  // absent when there's no span id to build one from
  const noSpan = mapSpan({ name: "x", trace_id: "t1", attributes: { "gen_ai.request.model": "m" } });
  assert.equal(noSpan.extensions.otel.traceparent, undefined);
});

test("otelToEvents: session_start first, session_end last, spans ordered by start", () => {
  const ev = otelToEvents(SPANS, { sessionId: "otel-1", agent: "claude-code" });
  assert.equal(ev[0].event_type, "session_start");
  assert.equal(ev[ev.length - 1].event_type, "session_end");
  assert.equal(ev[1].actor, "model");   // s1 is earliest
  assert.equal(ev[2].payload.tool, "Read");
});

test("mapSpan: version tolerance — legacy token names, schema_url stamp, mapping version, opt-in raw", () => {
  const legacy = { name: "chat", trace_id: "t", span_id: "s", schema_url: "https://opentelemetry.io/schemas/1.37.0",
    attributes: { "gen_ai.request.model": "m", "gen_ai.usage.prompt_tokens": 11, "gen_ai.usage.completion_tokens": 7 } };
  const e = mapSpan(legacy);
  assert.equal(e.payload.input_tokens, 11);   // pre-2026 prompt_tokens → input_tokens
  assert.equal(e.payload.output_tokens, 7);   // completion_tokens → output_tokens
  assert.equal(e.extensions.otel.schema_url, "https://opentelemetry.io/schemas/1.37.0");
  assert.equal(e.extensions.otel.adapter_mapping_version, "1.0");
  assert.equal(e.extensions.otel.raw_attributes, undefined);              // off by default
  assert.deepEqual(mapSpan(legacy, { retainRaw: true }).extensions.otel.raw_attributes, legacy.attributes);
});

test("otelToEvents: string/number nano timestamps (exported JSON) sort correctly", () => {
  // real exporters emit huge nanos as strings/numbers, not BigInt — must not throw
  const jsonSpans = [
    { name: "chat", trace_id: "t", span_id: "s2", start_time_unix_nano: "2000",
      attributes: { "gen_ai.operation.name": "chat", "gen_ai.request.model": "m" } },
    { name: "execute_tool", trace_id: "t", span_id: "s1", start_time_unix_nano: 1000,
      attributes: { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "Read" } },
  ];
  const ev = otelToEvents(jsonSpans, { sessionId: "j" });
  assert.equal(ev[1].payload.tool, "Read");   // s1 (t=1000) sorts before s2 (t=2000)
  assert.equal(ev[2].actor, "model");
});

test("round-trip: an OTel trace becomes a signed, verifiable Shadow bundle", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const session = createSession({
    agent: { name: "claude-code", version: "2.1" },
    models: [{ model_id: "claude-opus-4-8", provider: "anthropic" }],
    environmentFingerprint: { os: "darwin", node_version: "v24" },
    keyId: "otel-key", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
  });
  const events = otelToEvents(SPANS, { sessionId: "otel-1" });
  // append the mapped events except the trailing session_end (seal adds it)
  for (const e of events.slice(0, -1)) appendEvent(session, { event_type: e.event_type, actor: e.actor, payload: e.payload });
  const bundle = sealSession(session);
  const v = verifyBundle(bundle, { publicKey: publicKey.export({ type: "spki", format: "pem" }) });
  assert.equal(v.ok, true);
});
