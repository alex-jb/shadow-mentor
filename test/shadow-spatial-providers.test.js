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
