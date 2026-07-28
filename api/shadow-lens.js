// POST /api/shadow-lens  { stage, token?, ... }
// The staged Shadow Lens lifecycle over HTTP: create → capture → source-map → analyze →
// review → seal → verify. Each mutating stage needs the ephemeral session token returned by
// `create` (request auth, NOT the evidence key).
//
// HONEST STATE NOTE: this uses a MODULE-SCOPED in-memory store. On a warm serverless
// instance (or a self-hosted node) the session persists across the staged calls; on a cold
// start it will not — the response carries `store: "in-memory-ephemeral"` so callers never
// assume durability. No KV/secret is invented, and no private document is persisted. For a
// one-shot flow on stateless hosts, use POST /api/shadow-lens-analyze instead.
import { generateKeyPairSync } from "node:crypto";
import {
  createSession, registerCapture, validateSourceMap, analyze, review, sealEvidence, verify, STAGES,
} from "../apps/shadow-lens/backend/lens-api.mjs";
import { resolveLensStore, NO_DURABLE_STORE } from "../apps/shadow-lens/backend/session-store.mjs";

const DEFAULT_ORIGINS = (process.env.SHADOW_LENS_ALLOWED_ORIGINS || "https://shadow-mentor-phi.vercel.app,http://localhost:8127")
  .split(",").map((s) => s.trim()).filter(Boolean);

function applyCors(req, res) {
  const origin = req.headers?.origin;
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
  const stage = body.stage;
  if (!STAGES.includes(stage)) return res.status(400).json({ error: `stage must be one of ${STAGES.join(", ")}` });

  // Serverless boundary: staged (cross-request) ops need a durable store. If none is
  // configured on a production runtime, refuse explicitly — never fake durability with
  // process memory or an ephemeral filesystem. Use POST /api/shadow-lens/run instead.
  const { store, durable, backend } = resolveLensStore(process.env);
  if (!store) {
    return res.status(501).json({
      code: NO_DURABLE_STORE,
      error: "staged lifecycle needs a durable session store (set SHADOW_LENS_STORE_DIR, or use the one-shot POST /api/shadow-lens/run for the deployed demo)",
    });
  }

  try {
    let out;
    switch (stage) {
      case "create":
        out = await createSession({ device: body.device, build: body.build, store });
        out = { ok: true, session_id: out.session_id, token: out.token, store_backend: backend, durable };
        break;
      case "capture":
        out = await registerCapture({ token: body.token, base64: body.capture_image_base64, capture_method: body.capture_method, store });
        break;
      case "source-map":
        out = await validateSourceMap({ token: body.token, sourceMap: body.source_map, store });
        break;
      case "analyze": {
        // live path only if a key exists; otherwise fixture (findings) — never silently mock.
        if (!Array.isArray(body.findings) && process.env.ANTHROPIC_API_KEY) {
          const { makeClaudeLlm } = await import("../apps/shadow-lens/backend/analyze.mjs");
          out = await analyze({ token: body.token, llm: makeClaudeLlm({ apiKey: process.env.ANTHROPIC_API_KEY }), store });
        } else {
          out = await analyze({ token: body.token, findings: body.findings, store });
        }
        break;
      }
      case "review":
        out = await review({ token: body.token, reviewer: body.reviewer, store });
        break;
      case "seal": {
        const k = serverKeys();
        out = await sealEvidence({ token: body.token, signingKeyPem: k.priv, publicKeyPem: k.pub, keyId: body.key_id, idempotency_key: body.idempotency_key, expected_version: body.expected_version, store });
        if (out.ok) { out.public_key_pem = k.pub; out.signing_key = k.ephemeral ? "ephemeral-demo" : "server-configured"; }
        break;
      }
      case "verify":
        out = await verify({ token: body.token, store });
        break;
    }
    const codeStatus = { unauthorized: 401, version_conflict: 409, already_sealed: 409, not_found: 404 };
    const status = out.ok ? 200 : (out.http || codeStatus[out.code] || 400);
    return res.status(status).json(out);
  } catch (e) {
    return res.status(500).json({ error: `stage ${stage} failed: ${e?.message ?? String(e)}` });
  }
}
