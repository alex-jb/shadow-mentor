# Portable audit package — contract gap analysis

> Compares full Core evidence against `shadow-flow-export/1.0`, `shadow-web-audit-case/v1`,
> the offline browser verifier (`verify.html`, Core repo — the Web app itself has **zero**
> crypto), and the CLI verifier (`bin/shadow-verify.mjs`).
> Machine-readable twin: `contract-gap.json`. Classifications:
> `DIRECT` (exists, portable as-is) · `DERIVED_REPRODUCIBLY` (recomputable from signed
> inputs by any consumer) · `ADAPTER_REQUIRED` (exists, needs mapping) · `MISSING` ·
> `SECURITY_SENSITIVE` · `PRODUCT_DECISION_REQUIRED` · `NOT_PORTABLE`.

| Field group | In Core evidence | In flow-export/1.0 | In web-audit-case/v1 | Verifiers | Classification | Notes |
|---|---|---|---|---|---|---|
| Case identity | `case_id` (narrative) / `session_id` (bundle) — **no link between them** | `case_id` on export + every row | `case.caseId` | shown | DIRECT + **PRODUCT_DECISION_REQUIRED** | The case↔session binding does not exist anywhere; the signed manifest must create it |
| Council (voices, stances, confidence) | narrative `council[]`; richer `runLoanCouncil` output (verdicts, AA codes, weighted aggregate) | council rows (voice/stance/confidence) | `council.roles[]` | n/a | DIRECT (narrative path) / ADAPTER_REQUIRED (loan-council path) | Two council shapes exist; the package should declare which lineage a member carries |
| First Failure | **ABSENT** as a field; verifier emits `{seq, reason, impact}` + `failedSeq` on chain break | forbidden key (honest absence) | fully modeled (`firstFailure` + validator rules) | derived at verify time | DERIVED_REPRODUCIBLY (integrity failure) / **MISSING** (business first-failure) | Chain-break first failure is recomputable; a *business* first-failure narrative is a Core product decision — never synthesized |
| Downstream impact | ABSENT; cascade implied (break at seq N ⇒ N.. unverified; Unity `BrokenAtSeq` mirrors) | forbidden key | `downstream[]` modeled | derived | DERIVED_REPRODUCIBLY (cascade) / MISSING (business consequences) | Same split as first failure |
| Evidence lineage | bundle `events[]` (seq, prev_hash, payload_hash) | metric/evidence rows (flat, no hashes) | `evidence[]` steps | chain-verified | DIRECT | Payload *contents* are off-chain: including them is SECURITY_SENSITIVE + PRODUCT_DECISION_REQUIRED |
| Citations | `citation_registry` + `citation_check` (loan council); `citation_registry_sha256` (attestation) | `cites` relationships only | `council.sharedEvidence` refs | n/a | ADAPTER_REQUIRED | Hash-commitment exists; full registry needs a mapping decision |
| Human Review | `human_approval` event + `reviewer_interaction` payload (`approved/modified/rejected`, `override_rationale`) | forbidden (absent) | `humanReview{status,reason,reviewer}` | profile check (`banking-v1`, payload-level needs `--payloads`) | DIRECT (event) + ADAPTER_REQUIRED (payload→display) + SECURITY_SENSITIVE (`reviewer_id`, rationale) | |
| Approval | event slot only — no state field | forbidden | `approval.status` (`APPROVAL_PRESENT/NOT_PRESENT`) | profile check | DERIVED_REPRODUCIBLY (presence) | "Shadow never implements the gate" |
| Trust posture | verifier output `trustLevel` only — never stored | forbidden | `trust.posture` (nullable, never defaulted stronger) | emitted (`trust_level`) | DERIVED_REPRODUCIBLY | Package must ship it only inside the derived verification member |
| Hashes (payload/batch/chain) | `payload_hash`, `prev_hash`, `batch_root` | absent by design | display slots (format-checked only) | recomputed | DIRECT | |
| Signatures | `signatures[0]` (Ed25519 over batch_root); attestation `signature` | forbidden key | none | verified | DIRECT | Multi-signature rotation unimplemented (`signatures[0]` only) |
| Public key | PEM artifacts; `key_id`; `/api/attestation-info` discovery; manifest fingerprint | absent | none | required input | DIRECT | Embed as member + fingerprint in manifest; identity trust stays out-of-band |
| Verifier outcome | not stored | absent | `verification.overall` (display) | the output itself | DERIVED_REPRODUCIBLY | Ship as reproducible view; consumers re-derive; disagreement is a display state |
| Model/prompt/tool provenance | `header.models[]`, `sampling_params_hash`, `prompt_sha256` (claude-code adapter), tool *names* only | absent | `provenance[]` (records, display) | shown | DIRECT (model/prompt) / **MISSING** (tool versions — no field exists) | |
| Build/version identity | acceptance `MANIFEST.json.build_commit`; verify-manifest `verifier_version, commit_sha`; `schema_versions` | absent | `fixtureVersion` | manifest check | DIRECT | Feeds `provenance/runtime-manifest.json` |
| Capability claims | none in evidence | forbidden (`physical`) | `capabilityClaims` with `FORBIDDEN_PHYSICAL_CLAIMS = [DEVICE_VALIDATED, PRODUCTION_READY]` hard-erroring | n/a | **NOT_PORTABLE** (as truth) | Authored labels only; physical claims can never ride a package |
| Localization | bilingual verification reports (`verification-report.{en,zh-CN}.json`); verify.html EN/zh-CN | monolingual (adapter writes en=zh) | `LocalizedText{en,zh}` everywhere | bilingual UI | ADAPTER_REQUIRED | Precedent exists for bilingual derived reports |

## Cross-cutting gaps (the honest list)

1. **case_id ↔ session_id binding: MISSING.** The single most load-bearing new field. Belongs in the signed manifest; creating it in Core data structures is a product decision.
2. **Business first-failure/downstream: MISSING from Core.** The Web contract can display them; Core produces only integrity-failure equivalents. No synthesis anywhere.
3. **Two-way package completeness: MISSING.** `checkAssets` is one-way (listed assets only).
4. **Schema/code drifts to resolve before packaging:** event enum 13 (schema) vs 18 (code); attestation `version` vs `spec_version`; anchor `kind:"rekor"` vs schema enum; `anchor_errors[]` undeclared; raw-seed base64 vs hex.
5. **Tool version provenance: MISSING** (names only).
6. **Web-side cryptography: MISSING entirely** — browser verification of a package would be new surface (verify.html is the reference implementation to draw on, in the Core repo).
7. **HMAC-mode artifacts: NOT_PORTABLE** (verifier would need the signing secret).
