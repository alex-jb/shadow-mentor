# Shadow — Security Hardening & Standards Integration Brief (for Claude Code)

> Extends SHADOW_V3_CLAUDE_CODE_BRIEF.md. Derived from a threat-class review of tamper-evident logging systems (truncation / equivocation / canonicalization / replay) and the supply-chain-attestation ecosystem (in-toto, DSSE, Sigstore, Rego policy).
> Priority is strict. **P0 runs before the Wednesday 2026-07-16 demo** and touches ONLY new test files — zero changes to the frozen demo path. Everything else is post-Wednesday.
> Global rules unchanged: additive · no history rewrite · every change adds tests · forbidden-phrases lint stays green · do not modify the frozen attestation/bundle schema without a `schema_version` bump + back-compat test · do not touch the credit-council verdict path.

---

## P0 — Two attack tests, BEFORE Wednesday (new test files only)

Rationale: these two validate that the demo's core claim ("tamper-evident") holds against the two most common ways this class of system is broken. If either fails, it is a real bug and outranks any launch feature. If both pass, they become launch/paper claims. Neither test modifies product code — they exercise existing `verifyBundle` / chain-verify surfaces.

### S1. Truncation-attack test → `test/truncation-attack.test.js`

The known weakness: with plaintext events + their tags, an attacker deletes events from the **tail** of the chain; the surviving prefix and its tags remain internally consistent, so a naive verifier returns green. The malicious activity was in the deleted tail.

- Build a sealed bundle of N events (use the existing demo/synthetic bundle builder).
- Attack A — tail truncation: remove the last K events from the event array. Assert `verifyBundle` returns `ok:false`. The expected mechanism is a length/count commitment: the sealed header must bind the event count (or the batch root must cover a declared entry count). If verification currently returns `ok:true`, THIS IS A REAL BUG — stop and report it before adding more asserts.
- Attack B — mid-chain truncation + re-seal-attempt: remove events but leave `prev_hash` pointers dangling; assert detection with a precise `{seq, reason, impact}` naming the break point.
- Attack C — empty-tail edge: truncate to zero events after `session_start`; assert graceful `ok:false`, not a crash.
- If N-count is NOT currently bound into the signed header: implement the minimal fix — add `event_count` (and optionally `final_seq`) to the signed header shape. **This is a schema change → bump `schema_version`, add a back-compat test proving old bundles without the field still verify under their own version.** Do this as its own commit, clearly labeled, and re-run the full suite. If time before Wednesday is tight, DO NOT ship the schema change hastily — instead mark the test `.skip` with a `TODO(security): count-binding` and report to Alex, so the demo isn't destabilized. The honest disclosure ("we found this, here's the fix in flight") is itself fine; a rushed schema change 48h before demo is not.

### S2. JSON-canonicalization parity test → `test/jcs-canonicalization.test.js`

The known weakness: signing serializes JSON one way; a verifier in another language/library re-serializes differently → either brittle false-negatives, or (worse) a tolerant re-parse that lets two byte-different-but-semantically-equal payloads collide.

- Construct payloads that hit every classic JCS (RFC 8785) divergence point: mixed-case and out-of-order object keys; numbers as `1`, `1.0`, `1e0`, `10e-1`; negative zero; non-ASCII / unicode-escape strings (`"café"` vs `"caf\u00e9"`); nested objects with reordered keys; empty object vs null.
- Assert the canonical byte string produced by the signing path equals the canonical byte string produced by EACH verifier surface (Node `session.js`, CLI, `verify.html` WebCrypto path via a headless harness or a ported pure-JS check, and the Python verifier). Byte-identical across all, or the test fails.
- If the codebase is NOT using an RFC 8785 canonicalizer today (i.e. it relies on bare `JSON.stringify` ordering): this test will expose it. The fix is to route all signing+verifying through a single JCS implementation. **This may also be a schema-adjacent change** — if so, same discipline as S1 (bump + back-compat, or `.skip` + report rather than rush).
- Add one adversarial case: two payloads that differ only in key order but must produce the SAME signature-input, and one pair that differ semantically and must produce DIFFERENT signature-input. Neither may let a tampered payload verify against an original's signature.

**P0 acceptance:** both files exist; either they pass (→ launch claims: "defends against truncation"; "RFC 8785 canonical, byte-identical across Node / browser / Python"), or the failure is cleanly reported with the fix scoped and NOT rushed into the demo path. Full suite still green or greens with the accompanying fix.

---

## P1 — Threat-model documentation (post-Wednesday, before Aug 2)

### S3. `docs/THREAT_MODEL.md` — the seven-class table
One table, one row per attack class, three columns: *Attack · Defeated by · NOT defeated by (and why)*. Rows:
1. **Mid-chain tamper** — hash chain — (defeated at all trust levels)
2. **Tail truncation** — event-count / final-seq binding (S1) — (a verifier that ignores count)
3. **Reordering / replay** — `prev_hash` linkage + a dedicated replay test (S4) — —
4. **Equivocation / split-view** — LOG_ANCHORED (public transparency log) — SELF_SIGNED and TIME_ANCHORED (key holder can present divergent chains). Use the term "equivocation" explicitly — it signals domain fluency to auditors and reviewers.
5. **Operator re-signs history** — TIME_ANCHORED (forward) + LOG_ANCHORED (past) — SELF_SIGNED
6. **Key compromise** — external anchors preserve pre-compromise bundles — SELF_SIGNED bundles signed after compromise (all void). State plainly: "SELF_SIGNED security ≤ the security of the local private-key file."
7. **Content poisoning (indirect prompt injection in the recorded session)** — NOTHING in Shadow; out of scope by design — be explicit: **Shadow attests integrity (the record wasn't altered), NOT content authenticity (the recorded agent behavior was benign).** This boundary must be stated in README too, or auditors will over-read a green verify as "this agent run was clean."
8. **High-load event loss** — crash-safe pending buffer (M2.2) + a stress test (S5) — silent drop if the buffer is bypassed.

### S4. Replay test → `test/replay-attack.test.js`
Move a valid event from seq j to seq i≠j; assert `verifyBundle` fails with a replay-appropriate reason code. If no such reason code exists in the 10 stable codes, add one (`event_position_mismatch` or similar) — a reason-code addition is not a schema bump, but update the reason-code registry + drift test.

### S5. High-load / loss stress test → `test/session-load-loss.test.js`
Seal a session under rapid append (reuse the 10k-event harness, tightened timing); assert `event_count` in the sealed header equals events actually appended — no silent loss. If loss is possible under the FileStore path, document the durability guarantee precisely in `spec/EVIDENCE_BUNDLE.md`.

### S6. `SECURITY.md` key-management section
Add: where keys live (`~/.shadow/keys`), rotation procedure (reuse the `key_id` grace-window pattern already in the older attestation CLI), compromise playbook (which trust levels survive), and the one-sentence honest ceiling from row 6. Auditor's first question; answer it in the repo.

---

## P2 — Standards integration (post-launch, v3.0.x → v3.1; highest strategic value)

### S7. Adopt DSSE + in-toto envelope (ITE-6) as the OUTER wrapper
Do NOT reinvent the envelope. Wrap the existing evidence bundle as the `predicate` of an in-toto Statement, signed with a DSSE envelope.
- Benefit: `cosign verify-attestation` and `gh attestation verify` can consume Shadow bundles; the entire SLSA/Sigstore supply-chain toolchain verifies you for free; "we don't invent a format — we use in-toto / DSSE / ITE-6" is a stronger Show-HN and paper line than any bespoke schema.
- Implementation: additive outer layer. The inner bundle format is unchanged (back-compat preserved); a new `--envelope dsse` output mode and a verifier that unwraps DSSE → validates in-toto Statement → hands the predicate to the existing `verifyBundle`. Add cross-tool parity tests (verify the same artifact with Shadow's verifier AND `cosign`).
- Add an `in-toto / ITE-6` row to `docs/STANDARDS_MAP.md` alongside the EU AI Act Art. 12 and ISO/IEC 24970 rows. This moves Shadow from "another signing format" to "a citizen of the attestation standards ecosystem."

### S8. Policy layer via Rego/CUE (v3.1 direction)
Add optional policy evaluation over a verified bundle, mirroring `cosign verify-attestation --type ... --policy`.
- Ship 3 example policies in `policies/`: "every `refuse_to_serve` decision has a corresponding OFAC/screening event"; "every high-risk decision carries a `human_approval` event"; "no `file_write` outside a declared workspace glob."
- Reuse the OPA/Rego ecosystem — do not write a policy engine. This upgrades Shadow from "integrity check" to "programmable compliance gate," which is exactly what a bank's control framework wants, and it composes with S7 (policy runs on the verified predicate).

### S9. Optional injection-flagging at capture (v3.1)
Provide an optional integration point in the Claude Code adapter: if an injection-detection hook (e.g. an open-source PostToolUse detector) flags a tool result, record `injection_flagged: true` on that evidence event.
- This closes the narrative gap from THREAT_MODEL row 7: Shadow still doesn't guarantee content is clean, but it can *record that suspicion was raised at capture time*, so an auditor knows which events to scrutinize. "Signed integrity + flagged suspicion" is the complete, honest story.
- Keep it optional and clearly labeled as a third-party detector; Shadow's own guarantee remains integrity-only.

---

## Out of scope (do not build)
- HSM / KMS integration (document the local-key ceiling instead; KMS is a deployment concern).
- Writing a policy engine (use OPA/Rego).
- Writing an injection detector (integrate an existing one, optionally).
- Any change to the credit-council verdict path or the frozen inner schema without a version bump.

## Definition of done
- [ ] `truncation-attack.test.js` + `jcs-canonicalization.test.js` land before Wednesday — passing, or failure cleanly reported with fix scoped and NOT rushed into the demo path
- [ ] `THREAT_MODEL.md` seven-class table published; README states the integrity-vs-content-authenticity boundary
- [ ] replay + load-loss tests green; SECURITY.md key section added
- [ ] DSSE/in-toto envelope mode verifiable by `cosign`; STANDARDS_MAP has the in-toto row
- [ ] 3 example Rego policies + optional injection-flag capture hook (v3.1)
