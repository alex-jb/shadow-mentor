// POST /api/shadow-lens/run  — the AUTHORITATIVE deployed demo path.
// Runs the COMPLETE pipeline in ONE serverless invocation (no cross-request state):
//   validate input → register capture → validate source_map → analyze → review →
//   build real evidence → seal → verify → generate Flow exports → return complete session.
// Because everything happens in a single request against a throwaway in-process store, this
// is safe on serverless. The staged /api/shadow-lens endpoints are for local dev / tests /
// future persistent-store deployments; on a serverless prod runtime with no durable store
// they refuse with PERSISTENT_SESSION_STORE_NOT_CONFIGURED rather than fake durability.
import { generateKeyPairSync } from "node:crypto";
import { InMemoryLensStore } from "../../apps/shadow-lens/backend/session-store.mjs";
import {
  createSession, registerCapture, validateSourceMap, analyze, review, sealEvidence, verify,
} from "../../apps/shadow-lens/backend/lens-api.mjs";
import { exportFlowScenes } from "../../apps/shadow-lens/flow/export-session.mjs";

const DEFAULT_ORIGINS = (process.env.SHADOW_LENS_ALLOWED_ORIGINS || "https://shadow-mentor-phi.vercel.app,http://localhost:8127")
  .split(",").map((s) => s.trim()).filter(Boolean);

function applyCors(req, res) {
  const origin = req.headers?.origin;
  if (origin && origin !== "null" && DEFAULT_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin");
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

// Pure orchestration (exported for tests) — one throwaway store, no shared process memory.
export async function runOneShot(body, { serverKey } = {}) {
  const { source_map, capture, device, build, findings, mode, reviewer, capture_image_base64 } = body || {};
  if (!Array.isArray(source_map) || source_map.length === 0) return { http: 400, error: "source_map (from the OCR layer) is required" };

  const store = new InMemoryLensStore();               // per-request; nothing crosses requests
  const c = await createSession({ device, build, store });
  const token = c.token;

  // capture: prefer a raw image (guard + hash); else accept a precomputed sha256.
  let cap;
  if (capture_image_base64) {
    cap = await registerCapture({ token, base64: capture_image_base64, store });
    if (!cap.ok) return { http: 400, error: `capture rejected: ${cap.error}` };
  } else if (typeof capture?.capture_sha256 === "string" && /^sha256:[0-9a-f]{64}$/.test(capture.capture_sha256)) {
    // no raw image supplied — the client hashed the frame itself; normalize to the contract shape.
    const full = {
      capture_id: capture.capture_id || `cap_${c.session_id.slice(4, 12)}`,
      capture_sha256: capture.capture_sha256,
      capture_method: capture.capture_method || "xreal-eye-still",
    };
    await store.update(c.session_id, { stage: "captured", capture: full, session_version: 1 });
    cap = { ok: true, capture: full };
  } else {
    return { http: 400, error: "capture_image_base64 or capture.capture_sha256 is required" };
  }

  const sm = await validateSourceMap({ token, sourceMap: source_map, store });
  if (!sm.ok) return { http: 400, error: sm.error };

  // analyze: fixture (findings/mode) is offline+testable; live needs a key (never a silent mock).
  let an;
  if (Array.isArray(findings) || mode === "fixture") {
    an = await analyze({ token, findings: findings || [], store });
  } else if (process.env.ANTHROPIC_API_KEY) {
    const { makeClaudeLlm } = await import("../../apps/shadow-lens/backend/analyze.mjs");
    an = await analyze({ token, llm: makeClaudeLlm({ apiKey: process.env.ANTHROPIC_API_KEY }), store });
  } else {
    return { http: 503, error: "live analysis needs ANTHROPIC_API_KEY; pass findings or mode:'fixture' for the offline pipeline" };
  }
  if (!an.ok) return { http: an.http || 400, error: an.error, code: an.code };

  if (reviewer) { const rv = await review({ token, reviewer, store }); if (!rv.ok) return { http: 400, error: rv.error, code: rv.code }; }

  const k = serverKey || serverKeys();
  const seal = await sealEvidence({ token, signingKeyPem: k.priv, publicKeyPem: k.pub, keyId: "run", store });
  if (!seal.ok) return { http: 500, error: seal.error, code: seal.code };
  const ver = await verify({ token, store });
  const flow = exportFlowScenes(seal.session);

  return {
    http: 200,
    session: seal.session,
    verification: seal.session.verification,
    contract_valid: seal.valid,
    analysis: an.analysis,
    verify: { contract_valid: ver.contract_valid, record_integrity: ver.record_integrity },
    flow: { manifest: flow.manifest, scenes: flow.scenes },
    public_key_pem: k.pub,
    signing_key: k.ephemeral ? "ephemeral-demo (set SHADOW_LENS_PRIVATE_KEY/PUBLIC_KEY for a stable key)" : "server-configured",
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const out = await runOneShot(req.body ?? {}, {});
    const { http, ...rest } = out;
    return res.status(http).json(rest);
  } catch (e) {
    return res.status(500).json({ error: `run failed: ${e?.message ?? String(e)}` });
  }
}
