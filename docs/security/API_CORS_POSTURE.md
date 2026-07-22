# API CORS posture

Addresses the 2026-07 deep-audit finding **P1-3** (several endpoints send `Access-Control-Allow-Origin: *`).
This documents the current posture, the invariant tests enforce, and the production requirement. Runtime
behavior is intentionally **not** changed here — the wildcard is acceptable for the current read-only
demo/verification surface, and changing it blindly would break unknown callers.

## Current posture (V11)
Two patterns exist across `api/`:

1. **Wildcard** `Access-Control-Allow-Origin: *` — most endpoints (health, badge, version, verify-chain,
   verify-attestation, deliberate, loan-council, recall, scenarios, calibration, ambient-turn, spatial-render,
   mcp-manifest, scan-analyze, banking-profile, evidence/events, …). Read-only or fixture/analysis endpoints.
2. **Reflected origin + `Vary: Origin`** — the `api/shadow-lens/*` family (run, spatial-agent,
   execution-events) and `shadow-lens.js` / `shadow-lens-analyze.js`. More careful, but reflecting the
   request origin without an allowlist is still effectively open.

**No endpoint sends `Access-Control-Allow-Credentials`.** The dangerous combination — wildcard (or reflected)
origin **plus** credentials — does not exist anywhere. That is the one hard security invariant, and it is
pinned by `test/api-cors-security.test.js` so it cannot regress.

## Invariants enforced by tests
- **No endpoint may combine `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`.**
  Browsers reject it; it is a credential-exfiltration foot-gun.
- **No endpoint uses credentialed CORS at all today.** If one is ever added, it MUST pair with an explicit
  origin allowlist (never wildcard, never bare reflection).

## Production requirement (before any banking deployment)
A production, authenticated, or write-capable deployment MUST:
- Replace `*` (and bare origin reflection) with an **explicit origin allowlist** for any endpoint that
  accepts `Authorization`, `X-Token-Claims`, `Idempotency-Key`, or performs a state change
  (e.g. `loan-council`, `loan-council-from-pdf`, `evidence/events`, `shadow-lens/*`).
- Never enable `Access-Control-Allow-Credentials: true` with a wildcard or reflected origin.
- Keep purely public read-only endpoints (health, badge, version, mcp-manifest, attestation-info) on
  wildcard if desired — they expose no secrets and take no credentials.
- Front the deployment with the platform's auth (the demo endpoints are unauthenticated by design).

## Honest status
- Demo/verification surface: wildcard is **acceptable** and intentional (offline/public, no credentials).
- Production banking surface: **NOT configured** — the origin allowlist is a deployment requirement, not yet
  implemented. This is a documented gap, not a claim of production-readiness.
