# aex-attestation/v2 — final status report

Branch: `security/attestation-unambiguous-envelope-v2` (base `ada7de2` = V10 HEAD). Not merged, not
published. This is a bounded fix for the v1 signing-envelope ambiguity; XR/Unity/voice/APK untouched.

## Status flags

| Flag | Value | Basis |
|---|---|---|
| V1-AMBIGUITY-CONFIRMED | **true** | reproduced from real signing bytes; `legacy-v1-signing-ambiguity-characterization.test.js` (6 pass) |
| V2-NAMED-ENVELOPE-IMPLEMENTED | **true** | `attestation-v2.js`; field + binding names inside signed bytes (`V2-NAMED-ENVELOPE` test) |
| V2-STRICT-SCHEMA-ENFORCED | **true** | hash/timestamp/ident/bindings validators fail before signing |
| V1-BYTES-UNCHANGED | **true** | v1 source diff = 2 additive `export` keywords only; `attestation-v1-backcompat-fixtures.test.js` re-signs to pinned sigs |
| V1-VERIFICATION-PRESERVED | **true** | pinned v1 HMAC/Ed25519/chained proofs still verify (7 pass) |
| NO-SILENT-V1-TO-V2-RELABEL | **true** | v2 verifier rejects v1 proofs; dispatch routes by explicit `version` |
| V2-DEFAULT-FOR-NEW-SIGNING | **true** | `signAttestation()` preferred entry defaults to v2; v1 callers untouched |
| PRODUCTION-DEFAULT-SECRET-REJECTED | **true** | `assertSecureSecret` throws `ERR_INSECURE_DEFAULT_SECRET` in prod; secret never logged |
| NODE-BROWSER-CANONICAL-PARITY | **true** | tested: the verify.html inline-canonicalize mirror + WebCrypto reproduces the v2 golden canonical text + SHA-256 (`attestation-v2-golden-parity.test.js`) |
| CSHARP-CANONICAL-PARITY | **authored, not runtime-executed here** | `csharp-parity/` byte-pinned to the golden vector; no .NET SDK in this env (README states run cmd) |
| NO-NEW-CRYPTO-DEPENDENCY | **true** | only `node:crypto` + existing `canonicalize` |
| FULL-SUITE-GREEN | **true** | 1975 tests, 1972 pass, 0 fail, 3 pre-existing skips |
| INDEPENDENT-CRYPTO-AUDIT-COMPLETED | **false** | no external cryptographer review has been performed |
| PRODUCTION-READY | **false** | pending independent audit + C# runtime parity run + rollout of the prod secret |

## What shipped

- `packages/attest-core/attestation-v2.js` — v2 named-envelope sign/verify, strict schema, prod guard,
  explicit version dispatch, `signAttestation` preferred entry.
- Exposed 2 v1 key helpers (`export` only) so v2 reuses them; re-exported v2 from `lib/attestation.js`.
- `index.js` export surface + `attest-core` package `2.2.0 → 2.3.0` (declared, **not published**).
- Golden vectors + generator + Node parity test + standalone C# canonicalizer/harness.
- Pinned v1 backward-compat fixtures + tests.
- Docs: ambiguity analysis, signed-field inventory, v2 format spec, v1→v2 migration, this report.

## Tests added (+35)

characterization 6 · v2 security 17 · golden parity 5 · v1 backcompat 7.

## Explicitly NOT done (out of scope / gated)

- Not merged to main; not npm-published; no release created.
- No key rotation (not required — v1 stays valid).
- C# parity not executed here (no .NET SDK); harness + pinned expectation provided.
- No independent cryptographic audit → `INDEPENDENT-CRYPTO-AUDIT-COMPLETED = false`,
  `PRODUCTION-READY = false`.

## Post-merge review gates (before resuming V11)

1. v2 signs all security-relevant field names — ✅ (`V2-NAMED-ENVELOPE` + golden names check).
2. old v1 fixtures byte-for-byte unchanged — ✅ (re-sign reproduces pinned sigs; v1 diff additive only).
3. Node / browser / C# canonical bytes identical — Node ✅ (golden test), browser ✅ (verify.html mirror +
   WebCrypto reproduces the v2 golden text + digest), C# ✅ by construction / pending one `dotnet run`
   where a SDK exists.
