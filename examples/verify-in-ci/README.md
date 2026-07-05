# Verify Shadow attestations in your bank's CI

Drop-in workflow for a bank whose audit posture requires that every Shadow decision be re-verified in CI before it can be filed to the compliance record. Uses the public HTTP verifier shipped in Shadow v1.5.2 — `POST /api/verify-attestation`.

## What this catches

- A tampered response body (a downstream service edited the verdict after signing)
- A silent model swap (the response says it was signed by `claude-sonnet-4-6` but the signature doesn't match a payload with that model_id)
- Wrong key material (someone re-signed with a different Ed25519 keypair)
- A response from a stale key that was rotated out of the accepted set

## Files

- [`verify.yml`](./verify.yml) — GitHub Actions workflow. Drop it in `.github/workflows/` in the bank's audit-log repo.
- [`verify.sh`](./verify.sh) — POSIX shell verifier. Called by the workflow but also runnable standalone from an on-call laptop.

## Setup (one-time)

1. Store the Shadow deployment's Ed25519 **public key** as a GitHub Actions secret named `SHADOW_ATTESTATION_PUBLIC_KEY` (paste the PEM including `-----BEGIN PUBLIC KEY-----` headers).
2. Store the Shadow deployment's base URL as a repo variable named `SHADOW_URL` (e.g. `https://your-shadow.internal.bank.com`).
3. Commit the two files below to `.github/workflows/verify.yml` and `scripts/verify-shadow.sh` in the audit-log repo.

Only the **public** half of the keypair goes into CI. The Shadow deployment holds the private key. Bank CI can verify, cannot forge. This is the whole point of the Ed25519 posture — separation of "who signs" and "who verifies."

## What runs

For every persisted response file under `audit-log/**/*.json`, the workflow:

1. Strips the `attestation` field from the response body.
2. Extracts the persisted `request` field (Shadow decisions are logged as `{request, response_body_including_attestation}`).
3. POSTs to `/api/verify-attestation` with the attestation + request + response-minus-attestation + the CI-stored public key.
4. Fails the CI run if `ok: false` — the reason field names which of the three failure modes hit.

## Exit codes

- 0 — every file verified `ok: true`
- 1 — at least one file returned `ok: false`; CI blocks the merge
- 2 — HTTP transport error (Shadow endpoint unreachable; retry-worthy)

## Why bother

Regulators asking "how do you know the response you filed today is the same one Shadow generated?" get a concrete answer: "the CI job in commit `<sha>` proved every file's Ed25519 signature verified against the public key `<key_id>`, and the CI logs are themselves timestamped by GitHub." One layer of independent attestation, no bank engineer in the loop, deterministic outcome.
