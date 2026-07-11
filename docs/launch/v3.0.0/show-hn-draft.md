# Show HN post draft — v3.0.0

**Status: DRAFT. Do not post without Alex's in-conversation sign-off (per `docs/AUTONOMOUS_SESSION_RULES.md` rule 1).**

Fires when v3.0.0 is tagged. Target window per SHADOW_V3_BRIEF: 2026-08-02 (EU AI Act Article 12 enforcement date). Post to Hacker News between 07:00 – 09:00 US Pacific for engineering-hour front-page odds.

---

## Title

**Show HN: A flight recorder for Claude Code — signed, tamper-evident session evidence**

Alternate title options (pick the one that reads most credible on the day):

1. Show HN: Cryptographically attested logs for AI agents (MIT, offline-verifiable)
2. Show HN: Shadow — evidence bundles for AI-agent sessions, no vendor lock-in
3. Show HN: A flight recorder for Claude Code — signed, tamper-evident session evidence

Default: option 3. It names a specific product the reader recognizes (Claude Code) and states the concrete artifact (signed, tamper-evident session evidence). The metaphor "flight recorder" is instantly legible and sets the correct expectation.

## Body

The EU AI Act Article 12 comes into force on 2026-08-02. It requires high-risk AI systems to automatically record events over their lifetime. The regulation is written; the standards that define what a *compliant* record looks like are still in draft (ISO/IEC DIS 24970, prEN 18229-1). Every institution running an AI agent today is generating logs. Almost none of those logs can prove, months later, that nobody rewrote them.

Shadow is one project that makes that proof possible.

It is a small library — `shadow-attest-core` on npm — that gives every AI-agent session a signed, hash-chained record. One `createSession` at the start, one `appendEvent` for every user message / model call / tool call / file write / human approval / error the agent produces, one `sealSession` at the end. Every event carries a SHA-256 of its payload, a signed hash chain link, and an Ed25519 signature over the batch root. The chain is walkable. The signature is verifiable offline. There is no telemetry going back to a vendor.

**Three ways to verify a bundle:**

- Drop it into a static `verify.html` (WebCrypto, no build, no network — works from a USB stick)
- `shadow-verify <bundle> --public-key <pem>` (exit codes for CI)
- GitHub Action reusable composite (`.github/actions/shadow-verify`)

**Acceptance numbers on my M-series MacBook (in the test suite):**

- 10,000-event session seals + verifies in **69 ms** (5-second budget, 72× under)
- kill -9 mid-session leaves a JSONL log that `recoverSession` + `sealPartialBundle` turn into a verifiable partial bundle
- Any byte-tamper, event reorder, or event deletion fails verification with a precise `{failedSeq, reason}`

**Why cryptographic evidence is a distinct category** from what you already have:

- Debug observability (LangSmith / Langfuse / Datadog GenAI) tells engineers *why* the agent broke. Its records are mutable telemetry.
- Runtime governance (PromptHalo / Salt / policy gates) blocks the agent from doing bad things. It sits in the request path.
- Shadow proves, to an auditor months later, that the record of what the agent did *has not been rewritten*.

They are complementary, not competitive. See [docs/COMPARISON.md](https://github.com/alex-jb/shadow-mentor/blob/main/docs/COMPARISON.md) for the honest table.

**Standards alignment:**

- EU AI Act Article 12(1) + (2)(a/b/c) — field-by-field
- OpenTelemetry GenAI semantic conventions — attribute-level mapping
- ISO/IEC DIS 24970 (draft) — placeholder that revises when finalized
- prEN 18229-1 (draft) — same

See [docs/STANDARDS_MAP.md](https://github.com/alex-jb/shadow-mentor/blob/main/docs/STANDARDS_MAP.md).

**What Shadow does not claim:**

- That producing a bundle satisfies any regulation.
- That the bundle is legal evidence.
- That it's SOC 2 audited.
- That it replaces your observability stack, your policy gate, or your compliance officer.

**License:** MIT. **Repo:** https://github.com/alex-jb/shadow-mentor. **Two-minute screencast:** [link on release day, not before]. **`npm install shadow-attest-core`.**

I'm a solo student building this while the EU AI Act enforcement window closes. Feedback on any of the above is welcome. Especially interested in: (1) does the three-category framing land, (2) are the standards mappings useful or do they read as marketing, (3) what's the smallest experiment that would tell you Shadow is either useful or a category error.

## Anticipated top-of-thread questions (draft responses)

**Q: Why not just use Sigstore Rekor?**
A: We do — as one of the external anchoring options. Rekor gives you `LOG_ANCHORED` trust. Shadow's contribution is the format that the anchor witnesses: the per-session evidence bundle with per-event chain and signed batch root. Rekor witnesses the bundle's batch root; the bundle itself is the evidence.

**Q: How is this different from LangSmith?**
A: LangSmith is observability. You use it to iterate on agent quality. Records are mutable, indexed for query, sampled or retention-deleted. Shadow is evidence. You use it to prove, months after the fact, that the record has not been altered. Different job, different design constraints, different audience. Use both.

**Q: What's the actual attack it defends against?**
A: External tampering (chain reordering, silent record edit) is defeated at verification. Operator-side re-signing (the operator has the private key, waits 3 months, edits history, re-signs, backdates) is defeated only with external time anchoring (RFC 3161 TSA token or Rekor inclusion proof). The verifier reports three trust levels: `SELF_SIGNED` (chain intact + signature valid; operator could have re-signed), `TIME_ANCHORED` (existed no later than T), `LOG_ANCHORED` (publicly witnessed).

**Q: How does GDPR erasure work if the record is immutable?**
A: The payload is stored separately from the event. The event carries only a `payload_hash` and a `payload_ref`. To honor an erasure request, the operator deletes the payload content from the local store and nulls the `payload_ref` on the event. The `payload_hash` stays; the chain still verifies; the verifier sees "content redacted." Auditor sees which events had content redacted and when. This is a first-class operation, not a workaround.

**Q: Why should I trust a solo student's implementation for regulatory compliance?**
A: You should not, without your own audit. The code is MIT, the crypto is standard (Ed25519 / SHA-256, no novel primitives), the spec is frozen and public. My claim is that the code is auditable, not that it is audited. If you decide to run it in production, run your own review — start with `spec/EVIDENCE_BUNDLE.md` and `packages/attest-core/session.js`.

**Q: Where is this going?**
A: Named milestones in `docs/roadmap/SHADOW_V3_BRIEF.md`. Next up: M2.1 (Claude Code hooks adapter) and M3 (RFC 3161 + Rekor). v3.0 target is 2026-08-02. Post-launch: hosted verifier as a convenience, MCP integrations, integration with FINRA CAT-style audit trail export.

## Notes for Alex before posting

1. Confirm the repo is public and the badge count in README matches reality on the day.
2. Confirm the two-minute screencast link is live (`docs/launch/v3.0.0/screencast-script.md` is the script; recording is a separate task Alex owns).
3. Do not post between 2026-07-16 and 2026-07-16 EOD — Wednesday capstone demo is the priority.
4. Have the anticipated-questions responses tabbed open in a browser; HN's early hour reward speed of engagement.
5. Reply to first three replies within 30 minutes if possible; that shape of engagement determines the front-page cascade.
