// POST /api/shadow-lens-analyze
// The real source-bound pipeline as an HTTP surface (Section 9). OCR runs natively
// (Unity ML Kit) and POSTs the source_map here; this endpoint runs source-bound analysis,
// seals a REAL server-side attest-core bundle, verifies, and returns a contract-valid
// Shadow Lens session. Coordinates never come from the model (it cites source_ids;
// resolveClaims gates the rest). Signing is server-side; clients never hold the key.
//
// P0 guards: CORS allow-list (never *), POST-only, body size cap, strict shape. `mode:
// "fixture"` (or a `findings` array) runs the pipeline WITHOUT an LLM so it's testable +
// works offline; live mode needs ANTHROPIC_API_KEY. Server key from env
// SHADOW_LENS_PRIVATE_KEY/PUBLIC_KEY, else an ephemeral demo key (returned + labeled).
import { generateKeyPairSync } from "node:crypto";
import { validateImageInput } from "../apps/shadow-lens/backend/input-guards.mjs";
import { analyzeSourceBound, makeClaudeLlm, computeSourceMapHash } from "../apps/shadow-lens/backend/analyze.mjs";
import { buildShadowLensSession } from "../apps/shadow-lens/backend/build-session.mjs";

const DEFAULT_ORIGINS = (process.env.SHADOW_LENS_ALLOWED_ORIGINS || "https://shadow-mentor-phi.vercel.app,http://localhost:8127")
  .split(",").map((s) => s.trim()).filter(Boolean);

function applyCors(req, res) {
  const origin = req.headers?.origin;
  // allow-list only — never reflect arbitrary origins, never echo Origin: null
  if (origin && origin !== "null" && DEFAULT_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

function serverKeys() {
  if (process.env.SHADOW_LENS_PRIVATE_KEY && process.env.SHADOW_LENS_PUBLIC_KEY) {
    return { priv: process.env.SHADOW_LENS_PRIVATE_KEY, pub: process.env.SHADOW_LENS_PUBLIC_KEY, ephemeral: false };
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }), ephemeral: true };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body ?? {};
  const { source_map, capture, device, build, reviewers, reviewer_interaction, decision, findings, mode, capture_image_base64 } = body;

  if (!Array.isArray(source_map) || source_map.length === 0) {
    return res.status(400).json({ error: "source_map (array from the OCR layer) is required" });
  }
  // if a raw capture image is (optionally) included, guard it by magic bytes + size
  if (capture_image_base64) {
    const chk = validateImageInput({ base64: capture_image_base64 });
    if (!chk.ok) return res.status(400).json({ error: `capture image rejected: ${chk.error}` });
  }
  if (!capture || typeof capture.capture_sha256 !== "string") {
    return res.status(400).json({ error: "capture.capture_sha256 is required (hash the frame client-side)" });
  }

  // 1 — source-bound analysis. Fixture/precomputed path (testable, offline) vs live LLM.
  let analysisResult;
  try {
    if (Array.isArray(findings) || mode === "fixture") {
      const llm = async () => ({ findings: Array.isArray(findings) ? findings : [] });
      analysisResult = await analyzeSourceBound(source_map, { llm, model: "fixture" });
    } else {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return res.status(503).json({ error: "live analysis needs ANTHROPIC_API_KEY; POST `findings` or `mode:'fixture'` for the offline pipeline" });
      analysisResult = await analyzeSourceBound(source_map, { llm: makeClaudeLlm({ apiKey: key }) });
    }
  } catch (err) {
    return res.status(502).json({ error: `analysis failed: ${err?.message ?? String(err)}` });
  }
  if (analysisResult.source_map_hash !== computeSourceMapHash(source_map)) {
    return res.status(500).json({ error: "source_map_hash mismatch" });
  }

  // 2 — seal a real bundle server-side + verify.
  const k = serverKeys();
  const built = buildShadowLensSession({
    session_id: body.session_id || `sls-${capture.capture_id || "cap"}`,
    device: device || { platform: "unity-xreal", runtime_mode: "UNITY_XREAL", tracking_mode: "6dof", camera_mode: "xreal-eye" },
    build: build || { app_commit: process.env.VERCEL_GIT_COMMIT_SHA || "server" },
    capture, sourceMap: source_map, analysisResult, reviewers: reviewers || null,
    reviewer_interaction: reviewer_interaction || null, decision: decision || null,
    signingKeyPem: k.priv, publicKeyPem: k.pub,
  });

  return res.status(200).json({
    session: built.session,
    verification: built.session.verification,
    contract_valid: built.valid,
    contract_errors: built.validation_errors,
    analysis: { source_bound: analysisResult.source_bound_count, rejected: analysisResult.rejected_count, coverage_pct: analysisResult.source_coverage_pct },
    public_key_pem: k.pub,
    signing_key: k.ephemeral ? "ephemeral-demo (set SHADOW_LENS_PRIVATE_KEY/PUBLIC_KEY for a stable key)" : "server-configured",
  });
}
