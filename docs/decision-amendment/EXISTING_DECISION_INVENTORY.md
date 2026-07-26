# Existing Decision Inventory

Status: discovery only. Machine-readable form: `decision-inventory.json`.
Sources (read-only): Core `feat/shadow-portable-package-supersession` @
`8fae7e7`; Web `shadow-web-audit-room` @ `d7935bf`; control plane @ `0ef772b`.
All paths are repo-relative to the named repository.

## A. Core — decision-adjacent contracts and primitives

### A1. `reviewer_interaction` (lib/reviewer-interaction.js) — the existing decision-amendment primitive
- `REVIEWER_DECISIONS = ["approved", "modified", "rejected"]` (frozen, L12).
- Shape: `{ decision, reviewer_id?, review_duration_ms?, override_rationale?, modified_fields? }`.
- **CAAT rule (L33–37): `override_rationale` REQUIRED when decision is `modified` or `rejected`.** This is the load-bearing "override requires a reason" invariant, already tested.
- Producer: Shadow Lens backend (`apps/shadow-lens/backend/lens-api.mjs` L110–121; `build-session.mjs` L42–45 wraps it into a `human_approval` evidence event). Consumers: `lib/enforce-banking-profile.js` (check kind `reviewer_interaction_verified`), `lib/evidence-packet.js`, Lens spatial-agent tools.
- Signed: only transitively (hash-bound as a `human_approval` event payload; contents off-chain, redactable via `payload_ref`). Immutable: once the bundle is sealed. No schema version string, no own timestamp, no case binding, no signature of its own — a payload object, not an artifact.
- Actor: `reviewer_id` optional unverified free string (Lens defaults to literal `"reviewer-1"`). Authorization: none.
- Sensitive: `reviewer_id`, free-text `override_rationale` (flagged as PII in `docs/portable-audit-package/PACKAGE_SECURITY_MODEL.md`).
- Tests: `test/reviewer-interaction.test.js`, `test/shadow-lens-staged-api.test.js` ("modified/rejected review requires override_rationale (CAAT)"), `test/banking-profile.test.js`.
- Reuse suitability: **high for vocabulary and the reason-required rule; unusable as-is as a signed artifact** (no signature, no binding, no identity).
- Known live defect to respect (not fix here): `apps/shadow-lens/backend/build-session.mjs` L44/L80 hardcode `approved: true` / `human_review: "approved"` regardless of the actual `modified`/`rejected` decision.

### A2. `human_approval` evidence event (shadow-evidence/v1)
- `packages/attest-core/session.js`: event shape `{ seq, ts_utc, event_type, actor, payload_hash, payload_ref, prev_hash, extensions }`; `EVENT_TYPES` includes `human_approval` (present in both code and `spec/evidence-bundle.schema.json`). `ACTOR_TYPES = ["agent","user","model","tool","system"]` — a role class, not an identity.
- No `HUMAN_REVIEW`, `OVERRIDE`, `APPROVAL`, `REJECTION`, or `ESCALATION` event type exists. Adding one requires a `bundle_version` bump (frozen enum), and the enum is already drifted between code (18 types) and schema (13) — a documented trap.
- Signed collectively (per-event `prev_hash` chain → `batch_root` → single Ed25519, base64url); immutable after seal; `header.agent.identity_ref` is the only human-identity field in the signed evidence shape and is NOT post-hoc redactable; the package assembler refuses it without `--allow-identity-ref`.
- Reuse suitability: good as an *optional companion recording* of a decision during a live session; **wrong as the decision contract** — sealed bundles cannot accept post-hoc decisions, and decisions here are session-time evidence, not case dispositions.

### A3. Banking Evidence Profile v1 (spec/banking-evidence-profile-v1.json)
- Field `human_review` (level `required`): `event_present` check for `human_approval`; reg hooks "Reg B (human judgment)", "CFPB Circular 2022-03", "SR 26-2 (effective challenge)".
- Field `reviewer_interaction` (level `recommended`): `reviewer_interaction_verified` check. Statuses: `present | missing | n/a | unknown` (honest `unknown` without payloads).
- Reuse: the profile is the existing "was a human in the loop" checker; a decision-amendment contract must not weaken it and can eventually point at signed decision members as stronger evidence.

### A4. Council verdict + escalation (lib/run-loan-council.js)
- Resolver: any `block` → block; else any `escalate` → escalate; else `approve`. Verdicts: `"block" | "escalate" | "approve"`; response `schema_version: "1.1.0-mode-a"`.
- `escalate` is a **terminal output** — "human review may apply" — with no artifact anywhere recording what the human then did. This unresolved-escalation gap is precisely what the decision-amendment contract closes.
- Related: `presentation_order` anti-anchoring shuffle for "the human-reviewer view"; `lib/memory.js` outcome enum `approved / blocked / escalated / null`; `lib/audit-ingested.mjs` `decide()` action ∈ `{escalate, abstain, seal}`.
- Tests: `test/run-loan-council.test.js`, `test/verdict-invariance.test.js`, others.

### A5. Portable package + supersession (lib/portable-audit-package.mjs, lib/portable-audit-package-chain.mjs)
- Versions: `shadow-portable-audit-package/1.0` and `/1.1`; canon `shadow-canon/1`; provenance `shadow-audit-package-provenance/1.0`/`1.1`; relation `shadow-package-supersession/1`; markers closed at `["FIXTURE_SUCCESSOR"]`.
- Members (closed roles): `presentation`, `evidence`, `attestation` (optional), `verification-derived`, `provenance`, `public-key`. Manifest signed Ed25519 over `canonicalize(manifest minus signature)`; `package_id = sha256(sorted member sha256s)`; members hash-bound via `assets[] {path, role, schema_version, byte_size, sha256}`.
- `supersedes` block (closed key set — unknown key = `SUPERSESSION_MALFORMED`): `relation`, `predecessor_package_id`, `predecessor_manifest_sha256` (over prior manifest FILE bytes incl. signature), `predecessor_manifest_version`, `predecessor_case_id` (same-case enforced 3×), `predecessor_evidence_session_id`, `marker`. **No reason, no actor, no back-pointer.**
- Chain verifier: closed 16-code vocabulary (`PREDECESSOR_NOT_SUPPLIED` … `PACKAGE_INVALID`), verdicts `SUPERSESSION_VALID`/`SUPERSESSION_FAILED`, local heads only, forks reported never resolved, boundary statement denies global-latest.
- Source comment (chain L26–27): "never Human Review or Approval (no such semantics exist in this contract)". Test `test/shadow-audit-package-chain.test.js:339` pins `marker: "APPROVED"` as non-parsing.
- `docs/portable-audit-package/PACKAGE_SUPERSESSION_ADR.md` L43/L104–105 explicitly reserves the path: "A review/approval package is just a future successor with a new relation value in the same signed slot"; "Future Human Review / Approval work extends the relation/marker vocabularies in a new bounded increment."
- Fixture-only signing enforced (`keyProvenance !== "fixture"` throws); `built_at` is fixture-deterministic, never wall clock; atomic writes; predecessor immutability enforced by CLI.
- Reuse suitability: **the target binding, signing, immutability, and chain machinery are exactly reusable.** Missing: decision content member, actor block, reason slot, decision timestamps.

### A6. Attestation (aex-attestation/v1) + chains
- `packages/attest-core/attestation.js` — `key_id` only, no human identity; positional signing payload with untagged optional append (documented weakness); attestation chain via `previous_hash` (linkage-only verification).
- Four distinct chain mechanisms exist in Core (evidence events, attestation chain, package supersession, dictionary-registry lifecycle). Only the dictionary registry has a `superseded_by` back-pointer + `status ∈ active|superseded|retired` (`lib/schemas/reason-code-dictionary-registry.json`, resolver `lib/enforce-dictionary-governance.js`).
- `lib/schemas/reason-code-dictionary.json` signature block has `signer_name` / `signer_role` / `signed_at_utc` / `signature_hmac_sha256` — all literal `"PLACEHOLDER"`: the closest existing precedent for a *named human signer*, unimplemented.

### A7. Derived-view precedent (`VERIFIER_DISAGREEMENT`)
- The verification-derived member ships a claim the verifier independently re-derives and compares canonically; any disagreement is `VERIFIER_DISAGREEMENT`. **Directly reusable pattern for shipping a decision-state claim that consumers must re-derive.**

### A8. First Failure / downstream / trust posture
- Business first-failure and downstream impact are classified `MISSING` in Core (`contract-gap.json`) and "never synthesized". `first_failure|downstream|approval|trust_posture|signature|physical` are FORBIDDEN keys in the flow-export presentation member (`bin/shadow-flow-export.mjs` L86, pinned by test).
- Trust posture (`TRUST_LEVELS`, `packages/attest-core/anchors.js`) is verifier output only, never a stored field.

## B. Web — display-only decision concepts (shadow-web-audit-room @ d7935bf)

- Semantic statuses (presentation layer, `src/tokens/tokens.ts`): `REQUIRES_HUMAN_REVIEW`, `HUMAN_REVIEW_RECORDED`, `APPROVAL_NOT_PRESENT`, `APPROVAL_PRESENT`, `ABSTAINED` — with a11y strings pinning "recorded ≠ approval" and "approval stamp is never verification green".
- Separate `HumanReview { status, reason, reviewer }` and `Approval { status }` interfaces, separately rendered (`src/components/HumanReviewApproval.tsx`). Flow adapter never upgrades approval (`APPROVAL_NOT_PRESENT` hardcoded) and maps only `recommendation === "REVIEW"` → `REQUIRES_HUMAN_REVIEW`.
- Four disjoint closed vocabularies (package failure codes / web verification states incl. `VERIFIED_FIXTURE_KEY` never collapsed to `VERIFIED` / chain codes + verdicts + 8 node states / semantic statuses). Chain derivation local-only, recomputed on render, never persisted; forks render as `FORK_BRANCH` with no head badge; three disclosure strings deny global-latest, registry existence, and chronology-from-import-order.
- Effective selection is an explicit operator click ("Use in Audit Room") — no automatic effective-package concept exists.
- No review/override/approval/rejection affordance, stub, or disabled button exists anywhere; ten distinct "Web must not" statements across ADR-001/ADR-002/limitations docs/source comments, including "the browser cannot sign anything" and PEM rejection of any PRIVATE KEY block.
- Untrusted text: React text nodes only, no sanitizer needed, XSS canary e2e; IndexedDB stores immutable member bytes; no quota-degradation path for packages (hard `storage_error`).

## C. Control plane (@ 0ef772b)

- `CONTRACT_REGISTRY.md` registers `shadow-portable-audit-package` 1.0/1.1, `shadow-package-supersession/1`, `shadow-audit-package-provenance/1.1`; row for `/1` states: "Only marker value is FIXTURE_SUCCESSOR — a neutral fixture successor marker, never Human Review / Approval / Rejection; **future review/approval vocabulary requires a new bounded increment + ADR**."
- Gate G8 (INTEGRATION_GATES.md): supersession-timeline consumption "FULLY SATISFIED 2026-07-26" and "Human Review / Override / Approval / Rejection remain NOT authorized … Does NOT authorize Human Review or Approval mutation."
- This discovery task is the named pending increment (PROGRAM_STATUS.md / handoffs/web.json): "Perform a Core-owned Decision Amendment Contract discovery … Discovery only — no implementation."
- Actor model: none. All approver references are free text; the only principal ever named is `Alex`; gate table approver column is `Human (Alex)` ×8. No roles, tenancy, or authorization records. Review JSONs are hand-shaped and unvalidated; the only machine-enforced vocabulary is the 8-value workstream `lifecycle`.
- Registration governance for the eventual contract: new registry row + new ADR + evidence pointer in the owning repo (registry rules 2–3).

## D. Gap summary (what a decision-amendment contract must add)

1. Signed decision artifact (today: unsigned payload object only).
2. Actor block with identity class + role (today: optional free-string `reviewer_id`).
3. Reason code + bounded signed reason text in signed bytes (today: `override_rationale` off-chain).
4. Decision-type vocabulary at the package-relation level (today: single neutral `FIXTURE_SUCCESSOR`; `"APPROVED"` actively pinned out).
5. Decision timestamps (today: fixture `built_at` only; no `decided_at`).
6. Target-object binding finer than package (today: package + case + session only; no Council-decision/voice/event addressing).
7. Escalation → resolution closure (today: `escalate` is terminal).
8. Fork/conflict semantics for competing decisions (chain fork detection exists; decision-level conflict vocabulary does not).
9. Separation-of-duties representation (today: nothing).
10. Non-fixture signing path (today: `operator`/`production` provenances defined but unreachable) — out of scope for the next increment, path must not be blocked.
