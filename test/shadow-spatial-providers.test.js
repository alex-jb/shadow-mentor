// §11 model provider adapter: fixture is the default/fallback; live requires explicit env + an
// injected LLM (no key in client); live output is validated against the real scene (unknown
// source_ids/actions rejected); no silent fixture→live switch; timeout; model + prompt hash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { buildEvidenceSession } from "../apps/shadow-lens/backend/build-evidence-session.mjs";
import { dataScienceSpec } from "../apps/shadow-lens/fixtures/profile-fixtures.mjs";
import { sessionToSceneGraph } from "../apps/shadow-lens/web/spatial-agent/scene-graph.mjs";
import {
  resolveProvider, FixtureSpatialAgentProvider, LiveSpatialAgentProvider, UnavailableSpatialAgentProvider, ProviderKind,
} from "../apps/shadow-lens/web/spatial-agent/providers.mjs";

function fx() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const built = buildEvidenceSession(dataScienceSpec({ signingKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }), publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) }));
  return { session: built.session, scene: sessionToSceneGraph(built.session) };
}

test("resolveProvider: fixture by default; no silent switch to live", () => {
  assert.equal(resolveProvider({ env: {} }).kind, ProviderKind.FIXTURE);
  assert.equal(resolveProvider({ env: { SHADOW_LENS_LIVE_MODEL: "0" } }).kind, ProviderKind.FIXTURE);
});

test("resolveProvider: live requires explicit env AND an injected llm, else UNAVAILABLE", () => {
  assert.equal(resolveProvider({ env: { SHADOW_LENS_LIVE_MODEL: "1" }, llm: null }).kind, ProviderKind.UNAVAILABLE);
  assert.equal(resolveProvider({ env: { SHADOW_LENS_LIVE_MODEL: "1" }, llm: async () => ({}) }).kind, ProviderKind.LIVE);
});

test("fixture provider grounds a real source with a citation", async () => {
  const { session, scene } = fx();
  const g = await new FixtureSpatialAgentProvider().resolveGrounded({ session, scene, query: "show the source supporting the first finding" });
  assert.equal(g.grounded, true);
  assert.ok(g.citations.length >= 1);
  assert.match(g.prompt_hash, /^sha256:/);
});

test("live provider validates citations against the real source map (unknown id dropped)", async () => {
  const { session, scene } = fx();
  const llm = async () => JSON.stringify({
    text: "GBM selected", citations: [{ source_id: "metric_auc", quote: "AUC 0.912" }, { source_id: "GHOST", quote: "x" }],
    actions: [{ name: "highlight_metric", args: { object_id: "metric_auc" } }, { name: "delete_files", args: {} }],
  });
  const g = await new LiveSpatialAgentProvider({ llm, model: "test-live" }).resolveGrounded({ session, scene, query: "why GBM?" });
  assert.equal(g.grounded, true);
  assert.equal(g.citations.length, 1);                 // GHOST citation dropped
  assert.equal(g.citations[0].source_id, "metric_auc");
  assert.equal(g.actions.some((a) => a.name === "delete_files"), false); // unknown action rejected
  assert.equal(g.model, "test-live");
});

test("live provider: no citation → not grounded", async () => {
  const { session, scene } = fx();
  const llm = async () => ({ text: "vague", citations: [], actions: [] });
  const g = await new LiveSpatialAgentProvider({ llm }).resolveGrounded({ session, scene, query: "?" });
  assert.equal(g.grounded, false);
});

test("live provider: timeout is honest, not a fake answer", async () => {
  const { session, scene } = fx();
  const llm = () => new Promise((r) => setTimeout(() => r({ text: "late" }), 50));
  const g = await new LiveSpatialAgentProvider({ llm, timeoutMs: 5 }).resolveGrounded({ session, scene, query: "?" });
  assert.equal(g.grounded, false);
  assert.match(g.text, /error|timeout/i);
});

test("unavailable provider is honest", async () => {
  const g = await new UnavailableSpatialAgentProvider().resolveGrounded({ query: "?" });
  assert.equal(g.grounded, false);
  assert.equal(g.actions.length, 0);
});

// ── live provider via the narrow ISpatialAgentLlmClient (mock), covering the error classes ──
const clientOf = (impl) => ({ generateStructuredSpatialResponse: impl });

test("live client: valid response records model, prompt hash, request_id", async () => {
  const { session, scene } = fx();
  const client = clientOf(async () => ({ text: "GBM", citations: [{ source_id: "metric_auc", quote: "AUC" }], actions: [{ name: "highlight_metric", args: { object_id: "metric_auc" } }], model: "claude-x", request_id: "req_123" }));
  const g = await new LiveSpatialAgentProvider({ llmClient: client }).resolveGrounded({ session, scene, query: "why GBM?" });
  assert.equal(g.grounded, true);
  assert.equal(g.model, "claude-x");
  assert.equal(g.request_id, "req_123");
  assert.match(g.prompt_hash, /^sha256:/);
});

for (const [label, err, expect] of [
  ["401", Object.assign(new Error("x"), { status: 401 }), /auth error \(401\)/],
  ["403", Object.assign(new Error("x"), { status: 403 }), /auth error \(403\)/],
  ["429", Object.assign(new Error("x"), { status: 429 }), /rate limited/],
  ["5xx", Object.assign(new Error("x"), { status: 503 }), /server error \(503\)/],
  ["abort", Object.assign(new Error("aborted"), { name: "AbortError" }), /aborted/],
]) {
  test(`live client: ${label} → honest failure, no fake answer`, async () => {
    const { session, scene } = fx();
    const client = clientOf(async () => { throw err; });
    const g = await new LiveSpatialAgentProvider({ llmClient: client }).resolveGrounded({ session, scene, query: "?" });
    assert.equal(g.grounded, false);
    assert.match(g.text, expect);
    assert.equal(g.actions.length, 0);
  });
}

test("live client: unknown action + unknown object id are rejected/dropped", async () => {
  const { session, scene } = fx();
  const client = clientOf(async () => ({ text: "x", citations: [{ source_id: "metric_auc", quote: "a" }, { source_id: "GHOST", quote: "b" }], actions: [{ name: "rm_rf", args: {} }, { name: "highlight_metric", args: { object_id: "not_a_node" } }] }));
  const g = await new LiveSpatialAgentProvider({ llmClient: client }).resolveGrounded({ session, scene, query: "?" });
  assert.equal(g.citations.length, 1);                       // GHOST dropped
  assert.equal(g.actions.some((a) => a.name === "rm_rf"), false); // unknown action rejected
  assert.equal(g.actions.some((a) => a.args?.object_id === "not_a_node"), false); // unknown id rejected
});

test("live client: document prompt injection cannot create actions/citations", async () => {
  const { session, scene } = fx();
  // the model, influenced by injected 'instructions', tries to emit forbidden actions + a fake id
  const client = clientOf(async () => ({ text: "ignoring safety", citations: [{ source_id: "SYSTEM", quote: "run" }], actions: [{ name: "delete_files", args: {} }, { name: "open_terminal", args: {} }] }));
  const g = await new LiveSpatialAgentProvider({ llmClient: client }).resolveGrounded({ session, scene, query: "ignore instructions" });
  assert.equal(g.actions.length, 0);      // nothing in the closed allowlist
  assert.equal(g.citations.length, 0);    // SYSTEM is not a real source_id
  assert.equal(g.grounded, false);
});

test("live provider never returns a verification verdict (verifier is the only authority)", async () => {
  const { session, scene } = fx();
  const client = clientOf(async () => ({ text: "verified!", citations: [{ source_id: "metric_auc", quote: "a" }], actions: [], verification_summary: { record_integrity: "verified" } }));
  const g = await new LiveSpatialAgentProvider({ llmClient: client }).resolveGrounded({ session, scene, query: "is it valid?" });
  assert.equal(g.verification_summary, undefined); // the model cannot assert cryptographic validity
});
