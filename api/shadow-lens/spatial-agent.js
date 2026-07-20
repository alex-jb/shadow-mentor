// POST /api/shadow-lens/spatial-agent — the hardened Shadow spatial-agent endpoint (§8).
// Reuses the Shadow Lens security posture (allowlisted CORS, reject Origin: null, POST-only,
// strict payload limit, magic-byte screenshot validation, no-store, prompt-hash logging). The
// SERVER builds the real signed session + scene graph from a profile fixture and grounds every
// answer against them — the client-supplied scene_graph/screenshot are UNTRUSTED visual context
// only. Document text + query can never change tool routing (closed vocabulary). No signing key
// or model key is ever exposed. No live LLM is wired here (fixture/deterministic grounding);
// a live model would slot into agent-core under the SAME tool + validation constraints.
import crypto from "node:crypto";
import { generateKeyPairSync } from "node:crypto";
import { validateImageInput } from "../../apps/shadow-lens/backend/input-guards.mjs";
import { buildEvidenceSession } from "../../apps/shadow-lens/backend/build-evidence-session.mjs";
import { dataScienceSpec, codingAgentSpec } from "../../apps/shadow-lens/fixtures/profile-fixtures.mjs";
import { sessionToSceneGraph } from "../../apps/shadow-lens/web/spatial-agent/scene-graph.mjs";
import { runSpatialAgent } from "../../apps/shadow-lens/web/spatial-agent/agent-core.mjs";

const DEFAULT_ORIGINS = (process.env.SHADOW_LENS_ALLOWED_ORIGINS || "https://shadow-mentor-phi.vercel.app,http://localhost:8127")
  .split(",").map((s) => s.trim()).filter(Boolean);
const MAX_BODY = 6_000_000; // strict — a screenshot fits; anything larger is rejected

function applyCors(req, res) {
  const origin = req.headers?.origin;
  if (origin && origin !== "null" && DEFAULT_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

// Build a real signed session for the requested profile (banking uses the existing analyze path;
// data-science/coding use the generic evidence builder). Server-side keys only.
function buildProfileSession(profile) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const k = { signingKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }), publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) };
  const spec = profile === "coding-agent-v1" ? codingAgentSpec(k) : dataScienceSpec(k);
  const built = buildEvidenceSession(spec);
  return { session: built.session, bundle: built.bundle, publicKeyPem: k.publicKeyPem };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const raw = JSON.stringify(req.body ?? {});
  if (raw.length > MAX_BODY) return res.status(413).json({ error: "payload too large" });
  const body = req.body ?? {};

  // Load branch — the client fetches the SERVER-built real session + scene graph (source of truth).
  if (body.load === true) {
    const profile = ["banking-v1", "data-science-v1", "coding-agent-v1"].includes(body.profile) ? body.profile : "data-science-v1";
    try {
      const { session, publicKeyPem } = buildProfileSession(profile === "banking-v1" ? "data-science-v1" : profile);
      const scene = sessionToSceneGraph(session);
      return res.status(200).json({ session_id: session.session_id, profile: scene.profile_id, scene, public_key_pem: publicKeyPem, verification: session.verification });
    } catch (e) {
      return res.status(500).json({ error: `load failed: ${e?.message ?? String(e)}` });
    }
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return res.status(400).json({ error: "query required" });

  // screenshot is optional + untrusted; if present, validate its magic bytes (never trust type)
  if (body.screenshot_base64) {
    const chk = validateImageInput({ base64: body.screenshot_base64 });
    if (!chk.ok) return res.status(400).json({ error: `screenshot rejected: ${chk.error}` });
  }

  const profile = ["data-science-v1", "coding-agent-v1"].includes(body.profile) ? body.profile : "data-science-v1";
  const prompt_hash = "sha256:" + crypto.createHash("sha256").update(query).digest("hex");
  const model = "deterministic-fixture";
  console.log(`[spatial-agent] model=${model} profile=${profile} prompt_hash=${prompt_hash}`);

  const t0 = Date.now();
  try {
    const { session, bundle, publicKeyPem } = buildProfileSession(profile);
    const scene = sessionToSceneGraph(session);              // SERVER source of truth (not client's)
    const r = runSpatialAgent({ session, scene, bundle, publicKeyPem, query, current_mode: body.current_mode });
    return res.status(200).json({
      text: r.text,
      citations: r.citations,
      actions: r.actions,                                    // already validated against the scene
      verification_summary: r.verification_summary,
      grounded: r.grounded,
      model,
      latency_ms: Date.now() - t0,
      scene_object_count: scene.objects.length,
    });
  } catch (e) {
    return res.status(500).json({ error: `spatial-agent failed: ${e?.message ?? String(e)}` });
  }
}
