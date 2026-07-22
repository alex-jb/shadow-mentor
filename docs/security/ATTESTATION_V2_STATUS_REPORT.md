# aex-attestation/v2 — final security status report

Branch: `security/attestation-unambiguous-envelope-v2` (base `ada7de2` = V10 HEAD). **Not merged, not
published.** Bounded fix for the v1 signing-envelope ambiguity. No XR/Unity-UI/voice/APK/canonical-story
changes. v1 verification support is retained.

## Status flags (accurate)

| Flag | Value | Basis / evidence |
|---|---|---|
| V1-DELIMITER-COLLISION-CONFIRMED | **true** | reproduced from real signing bytes — `legacy-v1-signing-ambiguity-characterization.test.js` |
| V1-OPTIONAL-BINDING-RELABEL-CONFIRMED | **true** | same file (relabel case) |
| V1-NULL-EMPTY-ABSENT-AMBIGUITY-CONFIRMED | **true** | same file (null/empty/absent cases) |
| V2-NAMED-ENVELOPE-IMPLEMENTED | **true** | `attestation-v2.js`; field + binding names inside signed bytes (`V2-NAMED-ENVELOPE` test + golden) |
| V2-STRICT-SCHEMA-IMPLEMENTED | **true** | hash/timestamp/ident/bindings validators fail before signing — `attestation-v2-security.test.js` |
| V2-DEFAULT-SIGNING-ENABLED | **true** | `signAttestation()` preferred entry defaults to v2; v1 callers untouched |
| V1-BACKWARD-VERIFICATION-PRESERVED | **true** | pinned v1 HMAC/Ed25519/chained proofs still verify — `attestation-v1-backcompat-fixtures.test.js` |
| V1-RELEASED-FIXTURES-UNCHANGED | **true** | v1 signing diff is additive-only; re-signing reproduces pinned signatures byte-for-byte |
| NODE-CANONICAL-PARITY-PASSED | **true** | `attestation-v2-golden-parity.test.js` + `canonicalize-golden-vectors.json` |
| BROWSER-CANONICAL-PARITY-PASSED | **true** | verify.html-mirror + WebCrypto reproduce the v2 golden text + SHA-256 (golden-parity test) |
| CSHARP-CANONICAL-PARITY-PASSED | **true — EXECUTED** | Unity 6000.0.23f1 EditMode batch run, 4/4 tests over 19 edge vectors; `packages/attest-core/csharp-parity/evidence/editmode-results.xml` |
| BROWSER-V2-END-TO-END-VERIFICATION-PASSED | **true — EXECUTED** | `verify-v2-candidate.html` in real Chromium: 14/14 cases; `verify-acceptance/v2-candidate/chromium-selftest-result.json` |
| PRODUCTION-DEFAULT-SECRET-ALL-PATHS-REJECTED | **true** | v1 + v2 + API path + batch/session covered — `attestation-default-secret-all-paths.test.js` |
| FULL-SUITE-PASSED | **true** | 1985 tests, 1982 pass, 0 fail, 3 pre-existing skips |
| INDEPENDENT-CRYPTO-AUDIT-COMPLETED | **false** | no external cryptographer review performed |
| PRODUCTION-READY | **false** | pending independent audit; v2 default-signing rollout + prod secret provisioning are deployment steps |

## Gate execution detail

### C# canonical parity — EXECUTED in Unity (not "authored")
Ran the isolated EditMode assembly `ShadowAttest.Parity.Tests` (references only the test framework, no
XREAL SDK, no XR init) against the installed **Unity 6000.0.23f1** editor in batch mode. 4 test methods —
`CSharpCanonicalTextParity`, `CSharpUtf8ByteParity`, `CSharpDigestParity`, `CSharpV2HmacParity` — each
iterating **19 edge vectors** (ASCII, Simplified Chinese, emoji/surrogate pair, null, absent optional
binding, nested key ordering, escaped quote, backslash, newline, tab, U+2028, U+2029, control chars,
arrays, bool, integers, top-level primitives, and a full v2 envelope). Asserts exact equality of canonical
text, UTF-8 byte length, UTF-8 byte hex, and SHA-256. Result: **total=4 passed=4 failed=0**, no compile
errors. Evidence: `packages/attest-core/csharp-parity/evidence/editmode-results.xml`.

The C# canonicalizer hand-rolls JS `JSON.stringify` escaping precisely so U+2028/U+2029 pass through
literally and non-ASCII is not escaped — exactly where a naive `System.Text.Json`/Newtonsoft serializer
would drift. That divergence is the reason parity had to be *executed*, not argued.

### Browser v2 end-to-end verification — EXECUTED in Chromium
`verify-v2-candidate.html` is a NEW versioned artifact (the frozen verifier is unchanged). Self-contained,
strict CSP `default-src 'none'`, no external resources. Ran in real Google Chrome (headless). Console
reported `SELFTEST_RESULT {"passed":14,"total":14,"allPass":true}`:

- valid v2 HMAC accepted · valid v2 multi-binding accepted · valid v2 Ed25519 accepted
- valid v1 accepted **and labeled `LEGACY_AMBIGUOUS_ENVELOPE`**
- rejected: binding relabel · delimiter-boundary mutation · removed binding · altered domain · altered algorithm
- fail-closed (schema): added unknown binding · empty-string binding · malformed bad-hash · empty previous_hash
- altered wire version → "unknown wire version" (explicitly **not** routed into v1 logic)

Recorded: candidate SHA-256 `ea83d46c9c992d8143c1ae7979d5b0ac2e996fd4a3f48b9f13f36c4ef6bd7203`;
page-originated external requests **0** (CSP `default-src 'none'` + no external refs; the only network
lines in the raw browser log are Chrome's own component-updater/DoH traffic, not the document); CSP
violations **0**; console errors **0**; supported wire versions: `aex-attestation/v1 (legacy)`,
`aex-attestation/v2`. Evidence: `verify-acceptance/v2-candidate/`.

### Production default-secret — all public HMAC paths
The guard predicate lives in `secret-guard.js` and is enforced by BOTH signers:
- v1 `buildAttestation` (the path `api/deliberate.js` + `api/loan-council.js` use) now throws
  `ERR_INSECURE_DEFAULT_SECRET` in production with the default/no secret — this was the real gap.
- v2 `buildAttestationV2` / `signAttestation` already enforced it.
- Batch + session signing are **Ed25519-only** (no shared secret) and `createSession` throws for any
  non-ed25519 algorithm, so no HMAC session path can reach the default — pinned by test.
- A valid explicit secret signs **byte-identically** in prod and dev (guard never alters valid bytes), and
  the error never echoes the secret. Evidence: `attestation-default-secret-all-paths.test.js`.

## Tests added (+45 total on this branch)

characterization 6 · v2 security 17 · golden parity 6 · v1 backcompat 7 · default-secret all-paths 9.
Full suite: 1985 total, 1982 pass, 0 fail, 3 pre-existing skips.

## Explicitly NOT done

Not merged; not npm-published (attest-core `2.3.0` declared only); no release; no key rotation (v1 stays
valid); no independent cryptographer review. `INDEPENDENT-CRYPTO-AUDIT-COMPLETED` and `PRODUCTION-READY`
remain **false**. Publishing 2.3.0 is gated on those two + the deployment rollout, not on this branch.
