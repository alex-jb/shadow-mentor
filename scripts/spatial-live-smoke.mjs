// scripts/spatial-live-smoke.mjs
// §3 — a SEPARATELY GATED live smoke test. Runs ONE grounded question against a real LLM ONLY
// when explicitly configured (SHADOW_LENS_LIVE_MODEL=1 + a server-side key). Never runs in
// ordinary CI (the Node suite does not import this). Reports "LIVE TEST NOT CONFIGURED" and exits
// 0 when unavailable — it is a smoke check, not a required test. No key is printed.
//   SHADOW_LENS_LIVE_MODEL=1 ANTHROPIC_API_KEY=… npm run shadow-lens:spatial-live-smoke
import { generateKeyPairSync } from "node:crypto";
import { buildEvidenceSession } from "../apps/shadow-lens/backend/build-evidence-session.mjs";
import { dataScienceSpec } from "../apps/shadow-lens/fixtures/profile-fixtures.mjs";
import { sessionToSceneGraph } from "../apps/shadow-lens/web/spatial-agent/scene-graph.mjs";
import { runSpatialAgent } from "../apps/shadow-lens/web/spatial-agent/agent-core.mjs";
import { resolveProvider, ProviderKind } from "../apps/shadow-lens/web/spatial-agent/providers.mjs";
import { validateActions } from "../apps/shadow-lens/web/spatial-agent/client-actions.mjs";

const provider = resolveProvider({ env: process.env });
if (provider.kind !== ProviderKind.LIVE) {
  console.log("LIVE TEST NOT CONFIGURED — set SHADOW_LENS_LIVE_MODEL=1 and a server-side ANTHROPIC_API_KEY.");
  console.log(`(resolved provider: ${provider.kind})`);
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const k = { signingKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }), publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) };
const built = buildEvidenceSession(dataScienceSpec(k));   // sanitized signed fixture
const scene = sessionToSceneGraph(built.session);
const query = "Why was this model selected? Cite the metric.";

console.log("LIVE SMOKE — one grounded question against the configured live provider…");
const t0 = Date.now();
const r = await runSpatialAgent({ session: built.session, scene, bundle: built.bundle, publicKeyPem: k.publicKeyPem, query, provider });
const ms = Date.now() - t0;

const rejected = validateActions(r.actions, scene).rejected;
console.log(`  model=${r.model} grounded=${r.grounded} citations=${r.citations.length} actions=${r.actions.length} latency=${ms}ms`);
console.log(`  answer: ${r.text.slice(0, 160)}`);
const ok = r.grounded && r.citations.length >= 1 && rejected.length === 0;
console.log(ok ? "LIVE SMOKE PASSED (grounded, cited, all actions valid)" : "LIVE SMOKE FAILED (ungrounded / no citation / invalid action)");
process.exit(ok ? 0 : 1);
