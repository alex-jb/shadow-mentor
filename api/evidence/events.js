// POST /api/evidence/events
//
// Generic HTTP ingest for v3 evidence bundles. Accepts a full session
// (header + ordered event list) in a single request body and returns a
// signed, chain-verified bundle matching spec/evidence-bundle.schema.json.
//
// Stateless — the server holds no session state between requests. The
// caller accumulates events in-process (via shadow-attest-core, an OTel
// pipeline, or a custom emitter), then POSTs the whole session for signing.
//
// Server holds the Ed25519 signing key via SHADOW_ATTESTATION_ED25519_PRIVATE_KEY.
// Deployers who want the "signing daemon separate from agent" boundary should
// front this endpoint with a mutual-TLS proxy or run the signing separately.
//
// Body shape:
//   {
//     "session": {
//       "agent": { "name": "...", "version": "..." },
//       "models": [{ "model_id": "...", "provider": "..." }],
//       "environment_fingerprint": { "os": "...", "node_version": "..." },
//       "key_id": "prod-2026-Q3",
//       "session_id": "..."          // optional; else random or Idempotency-Key-derived
//     },
//     "events": [
//       { "event_type": "user_message", "actor": "user", "payload": {...} },
//       { "event_type": "model_call",   "actor": "model", "payload": {...} },
//       ...
//     ]
//   }
//
// Request headers of note:
//   - Idempotency-Key: <string> — Stripe-style. When session.session_id is
//     absent, the server derives one from SHA-256(Idempotency-Key)[:32] so
//     retries with the same key + same body produce byte-identical bundles.
//     Explicit session.session_id in the body always wins over the header.
//
// Response 200:
//   Body:
//     {
//       "bundle": { bundle_version: 1, ... },
//       "session_id": "<mirror of bundle.header.session_id for correlation>",
//       "verify_hint": "..."
//     }
//   Headers:
//     X-Shadow-Bundle-Version: 1       (bundle wire-format version)
//     X-Shadow-Session-Id: <session_id>
//
// Response 400 — structural validation failed.
// Response 413 — events array exceeds MAX_EVENTS_PER_REQUEST.
// Response 500 — server signing key not configured.

import { createHash } from "node:crypto";
import {
  createSession,
  appendEvent,
  sealSession,
  EVENT_TYPES,
} from "../../packages/attest-core/session.js";

const MAX_EVENTS_PER_REQUEST = 5000;
const BUNDLE_WIRE_VERSION = "1";
const ALLOWED_ACTORS = new Set(["agent", "user", "model", "tool", "system"]);

function deriveSessionIdFromIdempotencyKey(key) {
  return createHash("sha256").update(String(key)).digest("hex").slice(0, 32);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only",
      curl_example: "curl -X POST -H 'Content-Type: application/json' -d @body.json /api/evidence/events",
    });
  }

  const PRIVATE_KEY_PEM = process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY || null;
  const KEY_ID_DEFAULT = process.env.SHADOW_ATTESTATION_KEY_ID || "dev-v1";
  if (!PRIVATE_KEY_PEM) {
    return res.status(500).json({
      error: "server signing key not configured",
      remediation: "set SHADOW_ATTESTATION_ED25519_PRIVATE_KEY env var (PEM) and SHADOW_ATTESTATION_KEY_ID",
      docs: "packages/attest-core/README.md",
    });
  }

  const body = req.body ?? {};
  const { session: sessionInput, events: eventList } = body;

  if (!sessionInput || typeof sessionInput !== "object") {
    return res.status(400).json({ error: "session required", got: typeof sessionInput });
  }
  if (!Array.isArray(eventList)) {
    return res.status(400).json({ error: "events must be an array", got: typeof eventList });
  }
  if (eventList.length === 0) {
    return res.status(400).json({ error: "events array must contain at least one event" });
  }

  // F2 — DoS defense: reject oversized event batches BEFORE structural loops.
  if (eventList.length > MAX_EVENTS_PER_REQUEST) {
    return res.status(413).json({
      error: "too many events in one request",
      max_events_per_request: MAX_EVENTS_PER_REQUEST,
      got: eventList.length,
      remediation: "split the session into multiple requests or use partial-bundle sealing library-side",
    });
  }

  // Structural validation before we bother signing.
  const {
    agent,
    models,
    environment_fingerprint,
    key_id,
    session_id: bodySessionId,
    started_at_utc,
  } = sessionInput;

  if (!agent || !agent.name || !agent.version) {
    return res.status(400).json({ error: "session.agent.name and session.agent.version required" });
  }
  if (!environment_fingerprint || !environment_fingerprint.os || !environment_fingerprint.node_version) {
    return res.status(400).json({ error: "session.environment_fingerprint.os and .node_version required" });
  }

  for (let i = 0; i < eventList.length; i++) {
    const ev = eventList[i];
    if (!ev || typeof ev !== "object") {
      return res.status(400).json({ error: `event at index ${i} must be an object`, index: i });
    }
    if (!EVENT_TYPES.includes(ev.event_type)) {
      return res.status(400).json({
        error: `unknown event_type "${ev.event_type}" at index ${i}`,
        allowed: EVENT_TYPES,
        index: i,
      });
    }
    if (!ALLOWED_ACTORS.has(ev.actor)) {
      return res.status(400).json({
        error: `unknown actor "${ev.actor}" at index ${i}`,
        allowed: [...ALLOWED_ACTORS],
        index: i,
      });
    }
  }

  // F3 — Idempotency-Key → session_id derivation (only when body doesn't
  // specify session_id explicitly). Body wins over header per Stripe convention.
  let effectiveSessionId = bodySessionId;
  const idempotencyKey = req.headers?.["idempotency-key"];
  if (!effectiveSessionId && idempotencyKey) {
    effectiveSessionId = deriveSessionIdFromIdempotencyKey(idempotencyKey);
  }

  let bundle;
  try {
    const s = createSession({
      agent,
      models: Array.isArray(models) ? models : [],
      environmentFingerprint: environment_fingerprint,
      keyId: key_id ?? KEY_ID_DEFAULT,
      privateKey: PRIVATE_KEY_PEM,
      sessionId: effectiveSessionId,
      startedAtUtc: started_at_utc,
    });

    for (const ev of eventList) {
      appendEvent(s, {
        event_type: ev.event_type,
        actor: ev.actor,
        payload: ev.payload ?? {},
        payload_ref: ev.payload_ref,
        extensions: ev.extensions,
        ts_utc: ev.ts_utc,
      });
    }

    bundle = sealSession(s);
  } catch (err) {
    return res.status(400).json({
      error: "session build failed",
      reason: err.message,
    });
  }

  // F4 + F7 — mirror session_id at top level for client correlation + version
  // header so clients don't have to parse the body to know wire-format age.
  const finalSessionId = bundle?.header?.session_id ?? null;
  res.setHeader("X-Shadow-Bundle-Version", BUNDLE_WIRE_VERSION);
  if (finalSessionId) res.setHeader("X-Shadow-Session-Id", finalSessionId);

  return res.status(200).json({
    bundle,
    session_id: finalSessionId,
    verify_hint: "verify offline with shadow-attest-core verifyBundle() or the drag-in verify.html at the repo root",
  });
}
