# verify-v2-candidate.html — Chromium acceptance evidence

Independent, offline browser verifier for `aex-attestation/v2` (candidate). The frozen production verifier
is **not** modified — this is a new versioned artifact.

## What it does
Version dispatch (v1 legacy vs v2), v2 HMAC + Ed25519 verification via WebCrypto over the canonical named
envelope, full v2 strict schema (fail-closed on malformed / unknown / empty bindings), and v1 acceptance
with a `LEGACY_AMBIGUOUS_ENVELOPE` label. Never routes a malformed v2 proof into v1 logic.

## Run status — EXECUTED in real Chromium
Loaded `../../verify-v2-candidate.html` in headless Google Chrome. The on-load self-test drove real
fixtures (v2 HMAC / v2 multi-binding / v2 Ed25519 / v1 legacy) plus 10 mutation/malformed cases.

- **Result: 14/14 passed** — see `chromium-selftest-result.json` (the verbatim console `SELFTEST_RESULT`).
- Candidate SHA-256: see `candidate-sha256.txt`.
- Page-originated external requests: **0** (CSP `default-src 'none'`; no external resources).
- CSP violations: **0**. Console errors: **0**.
- Supported wire versions: `aex-attestation/v1 (legacy)`, `aex-attestation/v2`.

To reproduce: open `verify-v2-candidate.html` in any Chromium and read the page (green = all pass) or the
console `SELFTEST_RESULT` line. No server needed (`file://` works; no external requests).
