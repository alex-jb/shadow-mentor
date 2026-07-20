# Shadow Lens — HTTP API

Two surfaces, one pipeline. The difference is **where session state lives**.

## `POST /api/shadow-lens/run` — the authoritative deployed path (one-shot)

Runs the **complete** pipeline in a **single request** against a throwaway in-process store,
so it is safe on serverless (nothing crosses requests):

```
validate input → register capture → validate source_map → analyze → review →
build real evidence → seal → verify → generate Flow exports → return the complete session
```

Request (fixture / offline):
```json
{
  "source_map": [{ "source_id": "L1", "text": "DTI: 0.41", "bounding_box_normalized": {"x":0.1,"y":0.3,"w":0.4,"h":0.03}, "confidence": 0.95 }],
  "capture": { "capture_sha256": "sha256:<64hex>" },
  "device": { "platform": "unity-xreal", "runtime_mode": "UNITY_XREAL", "tracking_mode": "6dof", "camera_mode": "xreal-eye" },
  "build": { "app_commit": "…" },
  "findings": [{ "claim": "DTI over ceiling", "source_ids": ["L1"], "quote": "DTI: 0.41", "severity": "warn", "confidence": 0.9 }],
  "reviewer": { "decision": "approved" }
}
```
- Pass `capture_image_base64` instead of a precomputed `capture` to have the server magic-byte
  guard + hash the frame.
- Omit `findings` and set `ANTHROPIC_API_KEY` to run live source-bound analysis (never a silent mock).
- Response: `{ session, verification, contract_valid, analysis, verify, flow, public_key_pem, signing_key }`.

**Use this for the deployed demo.**

## `POST /api/shadow-lens` — staged lifecycle (dev / tests / persistent-store deployments)

Seven stages over a **durable** session store, each gated by the ephemeral session token from
`create`: `create → capture → source-map → analyze → review → seal → verify`.

- `seal` is **idempotent** (`idempotency_key` replays the pristine bundle; a re-seal without it
  is refused — the pristine bundle is never overwritten) and supports `expected_version`
  optimistic concurrency (a stale version returns `409 version_conflict`).
- **Serverless boundary:** in-memory / single-host file stores are **not durable** across
  serverless instances. On a production runtime with no durable store configured, every staged
  call returns:
  ```json
  { "code": "PERSISTENT_SESSION_STORE_NOT_CONFIGURED" }   // HTTP 501
  ```
  It never fakes durability with process memory or an ephemeral filesystem. Configure a durable
  store with `SHADOW_LENS_STORE_DIR=/path` (durable on a single-instance host), or use
  `/api/shadow-lens/run` for the stateless deployed path.

## Signing keys

Server-side only. `SHADOW_LENS_PRIVATE_KEY` / `SHADOW_LENS_PUBLIC_KEY` (PEM) for a stable key,
else an ephemeral demo key is generated per process and labeled as such in the response. The
private key **never** leaves the server; the session token is request auth only and can never
sign a bundle.
