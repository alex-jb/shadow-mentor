// POST /api/evidence/events
//
// Generic HTTP ingest for v3 evidence bundles. Accepts a full session
// (header + ordered event list) in a single request body and returns a
// signed, chain-verified bundle matching spec/evidence-bundle.schema.json.
//
// Stateless — the server holds no session state between requests. The
// caller accumulates events in-process (via @shadow/attest-core, an OTel
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
//       "session_id": "..."          // optional, else random
//     },
//     "events": [
//       { "event_type": "user_message", "actor": "user", "payload": {...} },
//       { "event_type": "model_call", "actor": "model", "payload": {...} },
//       ...
//     ]
//   }
//
// Response 200:
//   {
//     "bundle": { bundle_version: 1, spec_version: "shadow-evidence/v1", ... },
//     "verify_hint": "verify with @shadow/attest-core verifyBundle or verify.html"
//   }
//
// Response 400 on any structural validation failure (missing session/events,
// unknown event_type, unknown actor, or invalid header shape).

import {
  createSession,
  appendEvent,
  sealSession,
  EVENT_TYPES,
} from "../packages/attest-core/session.js";

const ALLOWED_ACTORS = new Set(["agent", "user", "model", "tool", "system"]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

  // Structural validation before we bother signing.
  const { agent, models, environment_fingerprint, key_id, session_id, started_at_utc } = sessionInput;
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

  let bundle;
  try {
    const s = createSession({
      agent,
      models: Array.isArray(models) ? models : [],
      environmentFingerprint: environment_fingerprint,
      keyId: key_id ?? KEY_ID_DEFAULT,
      privateKey: PRIVATE_KEY_PEM,
      sessionId: session_id,
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

  return res.status(200).json({
    bundle,
    verify_hint: "verify offline with @shadow/attest-core verifyBundle() or the drag-in verify.html at the repo root",
  });
}
