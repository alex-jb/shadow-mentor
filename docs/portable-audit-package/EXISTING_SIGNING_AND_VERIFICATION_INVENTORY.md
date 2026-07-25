# Existing signing & verification inventory

> Discovery baseline: `shadow-mentor` branch `feat/shadow-flow-export-cli` @ `213ebe66`
> (contains runOneShot, evidence bundle, shadow-attest-core, shadow-verify, and the
> Flow export CLI). All paths repo-relative. Read-only inspection, 2026-07-24.
> Machine-readable twin: `signing-inventory.json`.

## 1 · Evidence events & bundle (`packages/attest-core/session.js`, `spec/evidence-bundle.schema.json`)

- **Event record** (literal key order): `{seq, ts_utc, event_type, actor, payload_hash, payload_ref, prev_hash, extensions}`. `payload_ref` is *outside* the signed shape (GDPR erasure without chain break). `payload_hash = sha256(canonicalize(payload))`.
- **Vocabulary drift (real):** code `EVENT_TYPES` = 18 entries (adds `prompt, tool_error, subagent_stop, turn_end, pre_compact`); the JSON Schema enum is frozen at the original 13 with `additionalProperties:false`. `docs/reference/banking-decision.bundle.json` (uses `prompt`) passes `verifyBundle` but would fail the schema. `verifyBundle` never validates against the schema.
- **Bundle** = `shadow-evidence/v1`, `bundle_version: 1`. Required: `bundle_version, spec_version, header, events, batch_root, signatures`; optional `external_anchors` (and `sealAndAnchor` can emit `anchor_errors[]`, undeclared by the schema — drift).
- **Header** requires `session_id, session_started_at_utc, agent{name,version,identity_ref}, environment_fingerprint{os,node_version,hostname_hash}, schema_versions{bundle,attest_core}`; `models[] = {model_id, provider, sampling_params_hash}`.
- **Hash chain:** seq-0 seed = `sha256(canonicalize(header with session_ended_at_utc forced null))`; each event's own hash = `sha256(canonicalize(signedShape(event)))`; `prev_hash` links.
- **batch_root** = sha256 over the *concatenated raw 32-byte digests* of all event hashes (flat, not a Merkle tree despite the schema's wording).
- **Signature:** exactly one Ed25519 signature over the raw 32 bytes of `batch_root`, base64url; block `{algorithm, key_id, signature, signed_at_utc}`. `verifyBundle` reads **only `signatures[0]`** — the schema's multi-signature rotation story is not implemented.
- **verifyBundle** failure reasons (closed set): `public_key_missing, bundle_missing, bundle_unsupported_version, events_not_array, signatures_missing, seq_gap, prev_hash_mismatch, batch_root_mismatch, signatures_unsupported_algorithm, signature_verification_failed`. Success → `{ok:true, trustLevel, anchors}`.

## 2 · Canonicalization (`packages/attest-core/attestation.js: canonicalize`)

`shadow-canon/1` = hand-rolled JCS-lite: objects sorted-keys recursively, arrays in order, primitives `JSON.stringify`. Documented divergences from RFC 8785 (`test/jcs-canonicalization.test.js`): `-0` collides with `0`; number normalization is JS-native. A stricter `canonicalizeJson()` exists in `anchors.js` (Rekor only). A byte-identical Python re-implementation exists (`python/shadow_verify/`), pinned cross-language.

## 3 · Ed25519 keys (`bin/generate-attestation-keypair.mjs`, attest-core)

- Generation: `generateKeyPairSync("ed25519")`, PKCS#8 PEM private (0600) + SPKI PEM public (0644); refuse-overwrite unless `--force`; exit 0/1/2. Env-block emission for deployment.
- Accepted inputs: PEM everywhere; raw 32-byte seeds accepted **base64** in `attestation.js` but **hex** in `attestation-batch.js` (two incompatible raw encodings — drift).
- `key_id`: opaque string; resolution is out-of-band (`GET /api/attestation-info`). Rotation is a convention (key_id bound into payloads, grace windows); **revocation/expiry: ABSENT** (no CRL/OCSP/not_after anywhere in the evidence stack).

## 4 · Attestation envelope (`aex-attestation/v1`)

- Emits `version, mode, request_commitment, output_commitment, model_id, completed_at_utc, previous_hash, key_id, [14 optional *_sha256 fields], signature`. **Schema/code drift:** `spec/attestation.schema.json` requires `spec_version` (+ `schema_version: 2`); code emits `version`.
- Signing payload is a positional `|`-join, optional fields appended only when truthy (append-only back-compat). Consequence: field names are not tagged into the payload, and a stripped optional field (e.g. `dictionary_hash`) still verifies — binding is tamper-evident only when present.
- `previous_hash` chain: `computeAttestationHash = sha256(canonicalize(attestation incl. signature))`; `verifyChain` checks linkage (not signatures — by design). Batch: `batchSignAttestations` signs `[batch_id, root_hash, count].join("|")`, hex signature.

## 5 · Verifiers

| Surface | Path | Inputs | Exit/verdict | Offline |
|---|---|---|---|---|
| CLI (bundle) | `bin/shadow-verify.mjs` | bundle.json + `--public-key` PEM; `--json`; `--check-anchors off/structural/full`; `--ca-trust`; `--profile banking-v1` | `0` verified · `1` failed · `2` usage · `3` I/O · `4` verified-but-profile-non-conformant | yes (no network, no creds) |
| CLI (packet) | `bin/evidence-packet.mjs` | + `--payloads` (enables value-level profile checks shadow-verify cannot do) | same 0–4 scheme | yes |
| Browser | `verify.html` (+ `verify/` modules, locales EN/zh-CN) | paste bundle + public PEM; load release manifest | on-page states; "Analytical correctness: not judged" | yes (WebCrypto, zero network) |
| Python | `python/shadow_verify/` | bundle + public key | parity-pinned with Node | yes |
| Chain/attn | `bin/verify-chain.mjs`, `bin/verify-attestation.mjs` | attestations (+ env-var key fallbacks) | documented codes | yes |

- **Trust posture** = verifier **output**, never a bundle field: `TRUST_LEVELS = SELF_SIGNED < TIME_ANCHORED_STRUCTURAL < LOG_ANCHORED_STRUCTURAL < TIME_ANCHORED < LOG_ANCHORED` (`anchors.js`). shadow-verify `--json` surfaces it as `trust_level`.
- Anchors: only network-touching code is `anchors.js` (`requestTimestamp` TSA, `submitRekorEntry`) — opt-in via `sealAndAnchor`; anchor *verification* is offline. (`packages/attest-core/README.md` "no outbound HTTP anywhere" claim is contradicted by these two opt-in fetches — drift to note.)
- **Schema/code drift (anchors):** schema enum `rfc3161-tsa | sigstore-rekor | custom`; code emits/dispatches `kind:"rekor"` with fields the schema forbids.

## 6 · Signed-manifest package precedent (the key reuse target)

`verify/verify-manifest.mjs` + `verify/build-acceptance.mjs` + `verify/build-wednesday-package.mjs`:
- `VERIFY_MANIFEST_VERSION = "shadow-verify-manifest-v1"`; manifest = `{manifest_version, verifier_version, commit_sha, built_at, canonicalization_version:"shadow-canon/1", supported_profiles[], assets[]{path,sha256}, release_public_key_fingerprint, signature}`.
- `signManifest` = Ed25519 over the canonical manifest **minus `signature`**; `verifyManifestSignature` → `{ok, reason ∈ MANIFEST_MALFORMED | MANIFEST_SIGNATURE_MISSING | MANIFEST_SIGNATURE_FAILED | OK}`; `checkAssets(manifest, loadedAssets)` compares per-asset SHA-256.
- Shipped example: `verify-acceptance/wednesday-package/` (verify.html + locales + valid/tampered bundles + bilingual verification reports + verifier-integrity report + manifest + deliberate mismatch manifest). Signed with an explicit **fixture release key** ("not production-signed").
- Known limitation: `checkAssets` validates listed assets only — it does not reject *extra* files in a package (one-way completeness).

## 7 · Other package producers (manifest present, unsigned)

- `scripts/gen-acceptance-package.mjs` → 17 files + `MANIFEST.json` (`generated_from, build_commit, contract_version, record_integrity, tamper_detected, flow_zip, files[]`) — **no per-file hashes, no signature**; ships a real sealed bundle + deliberately tampered twin + failure result; test-pinned (`pristine_verified`, `tamper_detected`, no `PRIVATE KEY` in transcript).
- `scripts/gen-spatial-acceptance.mjs` → per-case JSON + legend manifest — unsigned.

## 8 · Producers relevant to package members

| Member candidate | Existing producer | Contract | Deterministic/offline |
|---|---|---|---|
| presentation | `bin/shadow-flow-export.mjs` (@213ebe66) | `shadow-flow-export/1.0` | yes — byte-deterministic, bare-env tested, forbids `first_failure/downstream/approval/trust_posture/signature/physical` keys |
| evidence bundle | `createSession→appendEvent→sealSession` / `bin/otel-to-bundle.mjs` / `scripts/gen-acceptance-package.mjs` | `shadow-evidence/v1` | seal is sync/offline; `ts_utc`/`signed_at_utc` default to wall clock (caller-overridable except `signed_at_utc`) |
| attestation | `buildAttestation` (used by `api/loan-council.js`) | `aex-attestation/v1` | offline; wall-clock default |
| verification result | `bin/shadow-verify.mjs --json`; bilingual precedent `verification-report.{en,zh-CN}.json` | verifier output (derived) | yes |
| runtime provenance | acceptance `MANIFEST.json` (`build_commit` via `git rev-parse`), verify-manifest (`verifier_version, commit_sha`) | ad hoc | yes |
| signed manifest | `verify/verify-manifest.mjs` | `shadow-verify-manifest-v1` | yes given fixed `built_at` |

## 9 · runOneShot (`api/shadow-lens/run.js`) — why it is NOT the package path

Composes the **Lens session** pipeline (capture → source_map → analyze → review → seal → verify → `exportFlowScenes`), returns `shadow-lens-session/1.0` + bundle **in-memory** (writes no files, per-request store). Its Flow scenes manifest declares `generated_from: "shadow-lens-session/1.0"` — a different lineage from `shadow-flow-export/1.0`; the two Flow pipelines do not interoperate. Fixture mode is offline; live mode needs `ANTHROPIC_API_KEY`; signing key from env or **ephemeral** (`signing_key: "ephemeral-demo…"` label in output). A third exporter, `lib/flow-export.js` (`shadow-flow-export-v1.0`, hyphen-v), serves the loan-council path and must not be confused with `shadow-flow-export/1.0`.

## 10 · First Failure / downstream / Human Review / Approval / trust posture — ground truth

- `first_failure`, `downstream`, `trust_posture`: **ABSENT** as Core fields; exist only as forbidden keys in the flow-export CLI and prose. Closest analogues: verifier `{seq, reason, impact}` failure triple + `failedSeq` (chain break ⇒ that link and all later links unverified — the Unity `ShadowAuditChainData.BrokenAtSeq` cascade mirrors this), and the Web contract's fully modeled `firstFailure/downstream` (display-side only).
- **Human Review**: `human_approval` is a first-class event type (actor `user`); `lib/reviewer-interaction.js` defines the payload (`decision ∈ approved|modified|rejected`, `reviewer_id?`, `override_rationale` required for modified/rejected); `banking-v1` profile requires the event and recommends verified reviewer interaction (payload-level, needs `--payloads`).
- **Approval**: an event slot, not a state field ("Shadow never implements the gate").
- **Trust posture**: verifier output `trustLevel` only.

## 11 · Sensitive-field surface (for the package privacy boundary)

1. Event payloads (inline in OTel-produced bundles: tool descriptions, span names; `retainRaw` copies every attribute into the signed event).
2. `file_read/file_write/shell_exec` payloads: file paths, commands, cwd.
3. `header.agent.identity_ref` — designed to carry real identity; **inside the signed shape, cannot be redacted post-hoc**.
4. `human_approval`/`reviewer_interaction` payloads: `reviewer_id`, free-text `override_rationale` (off-chain, hash-bound — redactable via `payload_ref` nulling).
5. `environment_fingerprint.os/node_version` plaintext; `hostname_hash` optional.
6. HMAC mode: verifier must hold the signing secret (dev-only); `DEFAULT_SECRET` fallback exists.
7. Only the flow-export CLI scans its artifact for credentials/private paths — **no equivalent scan exists on the evidence-bundle path**.
