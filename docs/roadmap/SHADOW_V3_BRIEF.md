# Shadow v3 — Agent Evidence Layer ("Flight Recorder") — Engineering Brief for Claude Code

> Prerequisite: the v2.0 brief (SHADOW_CLAUDE_CODE_BRIEF.md) P0 tasks are closed — SIVE findings fixed, README single-identity, ARCHITECTURE.md, frozen attestation schema v2, packages/attest-core extracted. Do not start M1 below until those are merged.
> Work milestones strictly in order. Target ship date for v3.0.0 public launch: 2026-08-02 (EU AI Act Annex III enforcement date).

## One-sentence product definition (use this everywhere)

**A flight recorder for AI agents: one npm install, and every agent session produces a signed, chained, independently verifiable evidence bundle.**

Debug observability (LangSmith/Langfuse/Datadog) tells engineers *why the agent broke*. Shadow proves to an auditor *what the agent did — and that nobody rewrote the record afterward*. We do the second thing only.

## Strategic constraints (read before coding)

1. **We are a reference implementation, not a platform.** No dashboards, no hosted SaaS, no runtime policy enforcement (that is PromptHalo/Salt territory). Core deliverables: a library, a CLI verifier, a static HTML verifier, adapters, and a spec document.
2. **Standards-alignment is the moat.** Schema fields map explicitly to EU AI Act Article 12(2)(a–c) record purposes; track ISO/IEC DIS 24970 and prEN 18229-1 drafts; ingest OpenTelemetry GenAI semantic-convention spans. Publish the mapping as a doc — it is a marketing asset.
3. **"Verify without trusting us"** is the product promise. Anyone must be able to verify an evidence bundle offline with an open-source verifier and zero Shadow infrastructure.
4. **Language discipline:** always "tamper-evident record", never "legally admissible", never "court-proof", never "Article 12 compliant" (we say "designed to support Article 12 record-keeping obligations"). Add this to a lint list checked in CI over all docs.
5. Credit/loan council code stays in the repo as `verticals/credit/` — frozen, used only as the ICAIF case study. No new work there.

---

## M1 — Evidence bundle format + core (week 1)

### M1.1 Session evidence bundle spec
- New doc `spec/EVIDENCE_BUNDLE.md` + JSON Schema `spec/evidence-bundle.schema.json` (`bundle_version: 1`).
- A bundle = one agent session: header (agent identity/version, model ids, environment fingerprint, session start/end, schema versions) + ordered event chain + batch root + signatures + optional external anchors.
- Per-event record (the atom): `{seq, ts_utc, event_type, actor, payload_hash, payload_ref?, prev_hash, extensions{}}`.
  - `event_type` enum v1: `session_start`, `user_message`, `model_call`, `model_output`, `tool_call`, `tool_result`, `file_read`, `file_write`, `shell_exec`, `network_request`, `human_approval`, `error`, `session_end`.
  - Payloads stored separately (content-addressed, `sha256:` refs) so the chain stays small and PII redaction never breaks hashes: redact the payload store, keep the hash — absence is detectable, content is removable. Document this GDPR-vs-immutability design explicitly in the spec; it is a differentiator.
- **Article 12 mapping table** inside the spec: for each event type, which Art. 12(2) purpose it serves — (a) risk/substantial-modification identification, (b) post-market monitoring, (c) deployer operational monitoring. Also map to OTel GenAI semconv attribute names where they exist.
- Signing: reuse attest-core Ed25519 + hash chain + batch root exactly as-is. Key MUST live outside the agent process (separate signer daemon or OS keychain); the agent never holds the signing key. Document the trust boundary with a diagram.

### M1.2 attest-core additions
- `createSession()`, `appendEvent()`, `sealSession()` streaming API (events signed as they occur, not at session end — a crashed session must still yield a valid partial chain; add a crash-recovery test).
- Publish `shadow-attest-core` and `@shadow/evidence` to npm (scoped, MIT). Python verifier package mirrors read/verify only.
- Acceptance: 10k-event synthetic session seals and verifies in < 5s; kill -9 mid-session leaves a verifiable partial bundle; mutating any payload byte or reordering any event fails verification with a precise error (seq + reason).

---

## M2 — Capture adapters (week 2)

Priority order matters: the Claude Code adapter is the launch wedge.

### M2.1 Claude Code hooks adapter (`@shadow/adapter-claude-code`)
- Implement via Claude Code hooks (PreToolUse/PostToolUse/Stop etc. — read the current hooks docs at docs.claude.com before coding; do not code from memory).
- One-command setup: `npx shadow-record init` writes the hook config; every subsequent Claude Code session auto-produces `~/.shadow/sessions/<id>.bundle`.
- Map: tool invocations → `tool_call`/`tool_result`; file edits → `file_write` with diff hash; bash → `shell_exec` with command + exit code; user prompts → `user_message` (payload hashed, content stored locally only).
- Acceptance: record a real Claude Code session that edits 3 files and runs tests; verify the bundle; tamper with one recorded file-diff payload; verifier pinpoints it.

### M2.2 OpenTelemetry GenAI adapter (`@shadow/adapter-otel`)
- A minimal OTLP/HTTP receiver (or processor plugin) that consumes GenAI semantic-convention spans and emits evidence events. This makes every LangChain/LlamaIndex/agent-SDK app already instrumented with OTel a zero-code-change source.
- Document explicitly: OTel span → evidence event field mapping; what is lost (OTel is mutable telemetry; we add the integrity layer).

### M2.3 Generic HTTP ingest
- `POST /api/evidence/events` (batch), same contract as the library — for anything that can send JSON. Replaces/generalizes the old `/api/attest`.

---

## M3 — External anchoring as a first-class feature (week 3)

- RFC 3161 TSA client: request a timestamp token over each batch root; configurable TSA URL; store token in bundle anchors. Ship with a default free TSA configured and documented.
- Sigstore Rekor adapter: append batch root to the public transparency log; store inclusion proof.
- Verifier checks anchors and reports three trust levels in its output: `SELF_SIGNED` (chain intact, key holder could re-sign history), `TIME_ANCHORED` (existed no later than T), `LOG_ANCHORED` (publicly witnessed). Never present SELF_SIGNED as more than it is.
- `docs/THREAT_MODEL.md` updated: adversaries = external tamperer / operator-insider / agent itself; which trust level defeats which. Note eIDAS-qualified timestamps as the EU-strength upgrade path (interface supports pluggable TSA; do not implement eIDAS QTSP integration yet).

## M4 — Verification UX (week 3, parallel)

- `shadow-verify <bundle>` CLI: exit codes for CI, human-readable report, `--json` for machines.
- **Single-file static HTML verifier** (`verify.html`, WebCrypto, no network, no build step): drag a bundle in, get a green/red report. This is what you send an auditor. Must work offline from a USB stick.
- GitHub Action: `shadow-verify` on PR — "this PR's agent-generated changes carry a valid evidence bundle."
- Acceptance: a person with no Shadow context verifies a bundle from verify.html alone in under 60 seconds.

## M5 — Forensic replay (weeks 4–5) — feeds IEEE VR

- `demos/replay/`: consumes an evidence bundle, renders the session as a timeline — 2D web view first (virtual-scrolled event lane, payload inspect, chain-status per event), then the existing XR chain-corridor rebound onto bundle data (blocks = events; tamper demo now uses a *real* recorded Claude Code session, not synthetic loans).
- Multi-reviewer annotation stub: reviewers mark events (compliance/security/quality lenses) and annotations are themselves appended as signed events — the 5-persona idea landing in its correct home. Keep minimal: three lens presets, free-text notes, signed.
- IEEE VR framing: "spatial forensic replay of cryptographically attested agent trajectories."

## M6 — Docs + launch (week 6, ship 2026-08-02)

- README rewrite (repo top level now = evidence layer): opening line pattern — Article 12 requires automatic event recording for high-risk AI systems; a log that can be silently altered has no evidentiary value; Shadow makes agent records tamper-evident and independently verifiable. Then: 90-second quickstart (Claude Code adapter), verify.html screenshot, trust-levels table, standards-mapping link, "what Shadow is NOT" section (not observability, not policy enforcement, not legal advice).
- `docs/STANDARDS_MAP.md`: field-by-field mapping to Art. 12(2), OTel GenAI semconv, and tracked drafts (ISO/IEC DIS 24970, prEN 18229-1) with a "will revise when finalized" note.
- Comparison doc: Shadow vs debug observability (LangSmith/Langfuse/Datadog) vs runtime governance (policy gates) — one honest table, no trash talk.
- Launch assets: Show HN draft ("Show HN: A flight recorder for Claude Code — signed, tamper-evident session evidence"), 2-min screencast script (record session → tamper → verify.html turns red).
- Versioning: tag `v3.0.0`. Changelog boring by design.

---

## Explicitly out of scope

- Hosted service, dashboards, user accounts, billing.
- Runtime blocking/approval gates (record `human_approval` events if the host emits them; never implement the gate).
- eIDAS QTSP integration, zk-proofs, post-quantum signatures (note FIPS 204 as future work in THREAT_MODEL.md only).
- Any new work under `verticals/credit/` beyond keeping tests green.
- Claims lint list (CI-enforced forbidden phrases): "legally admissible", "court-proof", "Article 12 compliant", "guarantees compliance", "tamper-proof" (we are tamper-*evident*).

## Definition of done

- [ ] `npx shadow-record init` → real Claude Code session → valid bundle, zero manual steps
- [ ] verify.html verifies and pinpoints tampering, fully offline
- [ ] Three trust levels implemented and honestly labeled; RFC 3161 + Rekor anchoring working
- [ ] OTel GenAI adapter ingests a third-party agent trace end-to-end
- [ ] STANDARDS_MAP.md published; claims lint green in CI
- [ ] Replay demo runs on a real recorded session (2D + XR), tamper demo included
- [ ] v3.0.0 tagged 2026-08-02 with Show HN draft ready

---

## Appendix — additional hygiene commitments (2026-07-11 update)

Five items added after the initial brief. Two are v3.0 launch-blockers; three shipped in v2.0.0-rc3 as pre-M1 hygiene.

### v3.0 launch-blockers (implement during M6 launch prep)

1. **npm publish `--provenance`** — publish `shadow-attest-core` and `@shadow/adapter-*` packages with `npm publish --provenance` so the published tarballs carry a Sigstore-signed build attestation. "The package that helps you prove what your agent did is itself proven at build time" is a free consistency win, and it forecloses a supply-chain critique in the first HN comment.

2. **Verifier error format standardized** — every verification error emitted by `shadow-attest-core`, the `shadow-verify` CLI, and `verify.html` MUST be a structured object with the exact shape:
   ```
   { seq: <event index or null>, reason: <machine-readable code>, impact: <human sentence> }
   ```
   The XR replay demo (X5) reads this shape verbatim for its floating captions; `verify.html` renders it in its report; the CLI prints all three fields. A drift test in `test/verifier-error-format.test.js` will pin the shape across surfaces. When ready to implement, port the current ad-hoc error strings in `lib/attestation.js` verify path to `throw` structured errors that all consumers destructure identically.

### Shipped in v2.0.0-rc3 (pre-M1 hygiene)

3. **SECURITY.md + disclosure channels** — GitHub Security Advisories + `xji1@mail.yu.edu`. In-scope: attestation-integrity attacks, chain-modification attacks, dependency-transitive crypto vulnerabilities. Out-of-scope: operator private-key compromise, demo endpoint DoS.

4. **CI matrix expanded to Windows + macOS** — the `node` job now runs on `ubuntu-latest`, `windows-latest`, and `macos-latest`. `scripts/run-tests.mjs` replaces the bash-glob-dependent `node --test test/*.test.js` so PowerShell / cmd.exe environments do not silently skip tests.

5. **README top-of-page zero-telemetry declaration** — Shadow does not phone home. Verifiable by source grep; documented on the README's status line above the fold. A recorder that silently sends usage data undermines its own trust story.
