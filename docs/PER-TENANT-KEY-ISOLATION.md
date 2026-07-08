# Per-Tenant Key Isolation (Shadow v1.5.27+)

**Reference**: HKDF-SHA-256 per [RFC 5869](https://datatracker.ietf.org/doc/html/rfc5869) — HMAC-based Extract-and-Expand Key Derivation Function.

## What this document is

Every enterprise AI RFP asks: *"how is our data cryptographically isolated from other customers?"* This document is the paste-ready answer for a Shadow-integrated bank RFP response.

## The isolation guarantee

Before Shadow v1.5.27, every attestation was signed with a single master HMAC secret. Any tenant with that secret could verify AND forge for any other tenant. That's not isolation; it's a shared trust anchor.

Shadow v1.5.27 adds tenant-scoped HMAC key derivation via HKDF-SHA-256 (RFC 5869) over `SHADOW_ATTESTATION_HMAC_MASTER_SECRET` + tenant identifier. Each bank receives only its own derived tenant secret. The master secret stays with Shadow.

Concretely:

- Only Shadow holds `SHADOW_ATTESTATION_HMAC_MASTER_SECRET`
- Bank A holds `deriveTenantHmacSecret(master, "bank-a")` and nothing else
- Bank A can verify attestations issued for Bank A
- Bank A CANNOT verify attestations issued for Bank B (signature mismatch by construction)
- Bank A CANNOT recover the master secret from its derived secret (HKDF one-wayness)

This is the answer the RFP question actually wants.

## Design invariants

1. **Derivation is deterministic.** Same master + same `tenant_id` → same derived secret. Shadow does not need a per-tenant state store; keys are re-derived on demand.
2. **Derivation is one-way.** HKDF-SHA-256 provides forward secrecy per RFC 5869. Given a tenant secret, an attacker cannot recover the master.
3. **Tenant IDs are opaque bytes.** A bank may pass `"acme-bank"`, `"tenant-42"`, or a UUID. Shadow does not enforce a specific format. Max length 256 characters.
4. **Fingerprints are publishable.** `tenantSecretFingerprint(secret)` returns a SHA-256 digest (default: first 16 hex chars) that a bank can compare against Shadow's records without exposing the secret material.
5. **Cross-tenant verification fails by construction.** No shared state required. HKDF ensures the derived secrets are cryptographically independent.

## Sample RFP paste

> Shadow signs every audit attestation with a per-tenant HMAC key derived from a master secret via HKDF-SHA-256 (RFC 5869). Only Shadow holds the master secret. Each customer bank receives only its own derived tenant secret. Cross-tenant signature verification fails by construction: the HMAC key used to sign for Bank A is cryptographically independent from the key used to sign for Bank B. Bank A cannot verify Bank B's audit trail, nor can Bank A recover the master secret from its own derived key. Bank A can publish a truncated SHA-256 fingerprint of its tenant secret for out-of-band verification of key rotation events without exposing the secret material.

Sample invocation:

```javascript
import {
  deriveTenantHmacSecret,
  tenantSecretFingerprint,
  resolveTenantSecret,
} from "shadow-mentor/lib/attestation-tenant.js";
import { buildAttestation } from "shadow-mentor/lib/attestation.js";

// Ops layer at Shadow: derive tenant secret from master + tenant_id.
const secretA = deriveTenantHmacSecret(process.env.SHADOW_MASTER_SECRET, "acme-bank");

// Bank A holds only this secret. Fingerprint published in the RFP:
console.log("bank-a fingerprint:", tenantSecretFingerprint(secretA));

// Sign an attestation bound to Bank A:
const attestation = buildAttestation({
  request: loanRequest,
  response: verdict,
  modelId: "anthropic/claude-sonnet-4-5-20250929",
  mode: "hmac-sha256",
  secret: secretA,
});
```

## Back-compat guarantee

Single-tenant deployments existing before v1.5.27 continue to work unchanged. `resolveTenantSecret({ masterSecret, tenantId: null })` returns the master secret verbatim, so callers who don't pass a `tenantId` get the pre-v1.5.27 behavior with zero code change.

## What is NOT in v1.5.27

- **Ed25519 per-tenant keypair derivation.** Ed25519 raw-seed → PKCS#8 PEM helpers vary across Node versions and would benefit from a dedicated `attestation-tenant-ed25519.js` module. Deferred to v1.5.27.1. Single-master Ed25519 mode continues to work; tenant isolation for now requires HMAC mode.
- **Automatic tenant secret rotation.** Rotation is a Shadow ops runbook item: `MASTER_SECRET_V2` → re-derive all tenant secrets → distribute → invalidate `V1`. The rotation event itself is out of scope.
- **API-layer tenant enforcement.** `POST /api/deliberate` does not yet take a `tenant` query param; the caller passes the derived secret directly. API-layer enforcement is v1.5.27.2.

## Test surface

`test/attestation-tenant.test.js` — 20 contract tests. Determinism, per-tenant divergence, per-master divergence, hex length, HKDF-vs-naive-HMAC distinction, fingerprint stability, constant-time verification, back-compat with single-tenant, end-to-end signed attestation verification (positive + negative cross-tenant).

## Related documents

- `docs/GSAR-552-239-7001-PROVENANCE.md` — federal contractor provenance kit
- `docs/GAICF-COMPATIBILITY.md` — GAICF three-layer control matrix
- `docs/JUDGE-CARD.md` — Policy Invariance Score reporting protocol
- `lib/attestation.js` — the underlying attestation build/verify primitives
