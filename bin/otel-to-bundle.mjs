#!/usr/bin/env node
// bin/otel-to-bundle.mjs
//
// Turn exported OpenTelemetry spans (GenAI/MCP semantic conventions) into a
// signed Shadow evidence bundle that `shadow-verify` accepts. This is the tool
// an integrator runs: point it at the spans your already-instrumented agent
// exports, get back a bundle.json that anyone can independently verify — no
// Shadow SDK in the agent itself.
//
// Usage:
//   otel-to-bundle <spans.json> --out <bundle.json> [--pub-out <public.pem>] [--key <private.pem>]
//   otel-to-bundle --sample      --out <bundle.json> [--pub-out <public.pem>]
//
//   <spans.json>   A JSON array of OTel span objects
//                  ({ name, attributes, status?, trace_id, span_id, parent_span_id?,
//                     start_time_unix_nano?, end_time_unix_nano? }).
//   --sample       Use a built-in five-span loan-review trace instead of a file.
//   --out <path>   Where to write the signed bundle JSON (required).
//   --pub-out <p>  Also write the Ed25519 public key (PEM) here, so the bundle
//                  can be handed to shadow-verify. Default: <out>.public.pem.
//   --key <path>   Sign with an existing PKCS#8 Ed25519 private key (PEM). If
//                  omitted, a fresh key is generated (demo/dev; use an HSM/KMS
//                  key in production).
//   --agent <name> Agent name recorded in the header (default: from spans / "otel-agent").
//   --json         Emit a one-line JSON summary to stdout.
//
// Exit codes: 0 ok · 2 usage error · 3 I/O or parse error.
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { generateKeyPairSync, createPrivateKey } from "node:crypto";
import { otelToEvents } from "../packages/adapter-otel/index.js";
import { createSession, appendEvent, sealSession, verifyBundle } from "shadow-attest-core/session";

const SAMPLE = [
  { name: "chat", trace_id: "t-42", span_id: "a1",
    start_time_unix_nano: "1700000000000000000", end_time_unix_nano: "1700000001000000000",
    attributes: { "gen_ai.operation.name": "chat", "gen_ai.provider.name": "anthropic",
      "gen_ai.request.model": "claude-opus-4-8", "gen_ai.usage.input_tokens": 1840, "gen_ai.usage.output_tokens": 210 } },
  { name: "execute_tool Read", trace_id: "t-42", span_id: "a2", parent_span_id: "a1",
    start_time_unix_nano: "1700000001200000000", end_time_unix_nano: "1700000001500000000",
    attributes: { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "Read",
      "gen_ai.tool.description": "read the applicant's tax return PDF", "gen_ai.tool.call.id": "c-01" } },
  { name: "tools/call", trace_id: "t-42", span_id: "a3", parent_span_id: "a1",
    start_time_unix_nano: "1700000001700000000", end_time_unix_nano: "1700000002100000000",
    attributes: { "mcp.method.name": "tools/call", "mcp.tool.name": "sanctions_list_lookup", "mcp.server.name": "compliance" },
    status: { code: 2, message: "upstream 503" } },
  { name: "tools/call", trace_id: "t-42", span_id: "a4", parent_span_id: "a1",
    start_time_unix_nano: "1700000002300000000", end_time_unix_nano: "1700000002600000000",
    attributes: { "mcp.method.name": "tools/call", "mcp.tool.name": "sanctions_list_lookup", "mcp.server.name": "compliance" } },
  { name: "chat", trace_id: "t-42", span_id: "a5", parent_span_id: "a1",
    start_time_unix_nano: "1700000002800000000", end_time_unix_nano: "1700000003400000000",
    attributes: { "gen_ai.operation.name": "chat", "gen_ai.provider.name": "anthropic",
      "gen_ai.response.model": "claude-opus-4-8", "gen_ai.response.finish_reasons": ["stop"],
      "gen_ai.usage.input_tokens": 2600, "gen_ai.usage.output_tokens": 320 } },
];

function die(code, msg) { process.stderr.write(msg + "\n"); process.exit(code); }

function parseArgs(argv) {
  const o = { spans: null, sample: false, out: null, pubOut: null, key: null, agent: null, json: false };
  const r = argv.slice(2);
  for (let i = 0; i < r.length; i++) {
    const a = r[i];
    if (a === "-h" || a === "--help") return { help: true };
    else if (a === "--sample") o.sample = true;
    else if (a === "--out") o.out = r[++i];
    else if (a === "--pub-out") o.pubOut = r[++i];
    else if (a === "--key") o.key = r[++i];
    else if (a === "--agent") o.agent = r[++i];
    else if (a === "--json") o.json = true;
    else if (!a.startsWith("-") && !o.spans) o.spans = a;
    else die(2, `unknown argument: ${a}`);
  }
  return o;
}

const args = parseArgs(process.argv);
if (args.help) { process.stdout.write(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(2, 26).join("\n").replace(/^\/\/ ?/gm, "") + "\n"); process.exit(0); }
if (!args.out) die(2, "otel-to-bundle: --out <bundle.json> is required (see --help)");
if (!args.spans && !args.sample) die(2, "otel-to-bundle: give a <spans.json> file or --sample (see --help)");

let spans;
try { spans = args.sample ? SAMPLE : JSON.parse(readFileSync(args.spans, "utf8")); }
catch (e) { die(3, `otel-to-bundle: cannot read/parse spans: ${e.message}`); }
if (!Array.isArray(spans) || spans.length === 0) die(3, "otel-to-bundle: spans must be a non-empty JSON array");

const agentName = args.agent || spans.find(s => s.attributes?.["gen_ai.agent.name"])?.attributes["gen_ai.agent.name"] || "otel-agent";
const traceId = spans.find(s => s.trace_id)?.trace_id;
const events = otelToEvents(spans, { sessionId: traceId ? `otel-${traceId}` : undefined, agent: agentName });

// key: reuse a supplied one, else generate a fresh demo key
let privatePem, publicPem;
if (args.key) {
  try { privatePem = readFileSync(args.key, "utf8"); publicPem = createPrivateKey(privatePem) && null; }
  catch (e) { die(3, `otel-to-bundle: cannot read --key: ${e.message}`); }
  // derive the public key from the private for the pub-out file
  const { createPublicKey } = await import("node:crypto");
  publicPem = createPublicKey(privatePem).export({ type: "spki", format: "pem" });
} else {
  const kp = generateKeyPairSync("ed25519");
  privatePem = kp.privateKey.export({ type: "pkcs8", format: "pem" });
  publicPem = kp.publicKey.export({ type: "spki", format: "pem" });
}

const session = createSession({
  agent: { name: agentName, version: "otel" },
  models: [...new Set(spans.map(s => s.attributes?.["gen_ai.request.model"] || s.attributes?.["gen_ai.response.model"]).filter(Boolean))]
    .map(m => ({ model_id: m, provider: null })),
  environmentFingerprint: { os: process.platform, node_version: process.version },
  keyId: "otel-to-bundle", privateKey: privatePem,
  sessionId: traceId ? `otel-${traceId}` : undefined,
});
for (const e of events.slice(0, -1)) {
  appendEvent(session, { event_type: e.event_type, actor: e.actor, payload: e.payload, ts_utc: e.ts_utc, extensions: e.extensions });
}
const bundle = sealSession(session);

// self-check before writing — never emit a bundle that doesn't verify
const check = verifyBundle(bundle, { publicKey: publicPem });
if (!check.ok) die(3, `otel-to-bundle: internal error — produced bundle failed self-verification (${check.reason})`);

const pubOut = args.pubOut || `${args.out}.public.pem`;
try {
  writeFileSync(args.out, JSON.stringify(bundle, null, 2) + "\n", "utf8");
  writeFileSync(pubOut, publicPem, "utf8"); chmodSync(pubOut, 0o644);
} catch (e) { die(3, `otel-to-bundle: cannot write output: ${e.message}`); }

if (args.json) {
  process.stdout.write(JSON.stringify({ ok: true, out: args.out, pub_out: pubOut, spans: spans.length, events: bundle.events.length, batch_root: bundle.batch_root, agent: agentName }) + "\n");
} else {
  process.stdout.write(
    `wrote ${args.out}  (${spans.length} spans → ${bundle.events.length} signed events, verified)\n` +
    `wrote ${pubOut}\n\n` +
    `verify it with the shipped verifier:\n` +
    `  node bin/shadow-verify.mjs ${args.out} --public-key ${pubOut}\n`);
}
