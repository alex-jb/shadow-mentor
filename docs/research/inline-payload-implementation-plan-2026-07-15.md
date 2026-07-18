# Inline-payload implementation plan · 2026-07-15

**Purpose:** turn the Task D verdict from N (fingerprint only) to Y (fingerprint + literal raw content preservation). Estimated cost: 1-2 days after Wed 7/15 demo.

**Why this is now first-priority engineering:** the 2026-07-15 auditor-professional positioning verdict names AI-provenance preservation as Shadow's core value ("Prove what the AI originally produced, before a human changed it"). Today's code produces a cryptographic fingerprint but not the raw content, which means the literal reading of the value proposition is unmet. Closing this gap turns a partial claim into a full one and unlocks the stronger hero copy for Show HN + ICAIF + README v3.0.

**Blast radius:** attest-core schema is v1.0-frozen since 2026-07-10. Any change here must add fields optionally, not break existing bundles. All 1,504 tests must stay green. Every existing bundle must still verify with the new code.

---

## The current design

Look at `packages/attest-core/session.js:210-234`:

```js
const payload = event.payload ?? {};
const payloadHash = sha256Hex(canonicalBytes(payload));
const payloadRef = event.payload_ref === null
  ? null
  : (event.payload_ref ?? `sha256:${payloadHash}`);

const record = {
  seq: session.events.length,
  ts_utc: event.ts_utc ?? new Date().toISOString(),
  event_type: event.event_type,
  actor: event.actor,
  payload_hash: payloadHash,
  payload_ref: payloadRef,
  prev_hash: session._lastEventHash,
  extensions: event.extensions ?? {},
};
```

The `record` object does not include `payload`. The store persists `{ kind: "event", event: record }`. The raw content is dropped at emission time.

---

## The proposed design · additive side-car payload store

**Guiding principle:** the on-chain event record stays exactly as it is today (payload_hash + payload_ref only). We add a **separate** payload-content store that is content-addressed by the same hash. The bundle then optionally embeds a `payloads` map keyed by `sha256:<hex>` at serialization time.

**Why side-car and not inline in the event record?** three reasons:

1. Backward compatibility. Every v1 bundle that lacks `payloads` still verifies exactly as it does today.
2. Content-addressing. Two events that produced identical AI output (rare but possible with tool retries) share one payload entry.
3. GDPR erasure. The chain remains intact if a specific payload is later evicted for Art. 17 compliance; the payload_hash still binds to whatever the payload was.

### New optional field on the bundle root

```js
{
  bundle_version: 1,
  spec_version: "shadow-evidence/v1",
  header: {...},
  events: [...],           // unchanged
  batch_root: "...",       // unchanged
  signatures: [...],       // unchanged
  payloads: {              // NEW · optional
    "sha256:<hex>": {
      encoding: "utf8" | "base64",
      content: "..."       // raw payload content
    },
    ...
  }
}
```

### New attest-core function signature

```js
appendEvent(session, event, { inlinePayload: true })
```

- Default `{ inlinePayload: false }` preserves current behavior (hash only, no side-car write). All 1,504 existing tests pass unchanged.
- When `inlinePayload: true`, appendEvent additionally writes the canonicalized payload bytes into `session._payloads[payloadRef]` keyed by `sha256:<hex>`.
- At `sealSession`, if `session._payloads` is non-empty, it becomes the `payloads` map on the sealed bundle.

### Verifier extension

`verifyBundle` gets an optional stronger check: if `bundle.payloads` is present, for every event whose `payload_ref` starts with `sha256:`, look up the payload content, re-compute its SHA-256, and confirm it matches `payload_hash`. If any mismatch, fail verification with a new reason: `payload_content_mismatch`.

Bundles without `payloads` verify exactly as today (fingerprint-only mode).

### Adapter wiring

`packages/adapter-claude-code/lib/handler.js` gets a new flag: `SHADOW_INLINE_PAYLOAD=1` env var, defaulting to on for local dev / off for enterprise (privacy default). When on, the adapter calls `appendEvent(session, mappedEvent, { inlinePayload: true })`.

### Threat model impact

- **Positive:** the "prove what AI originally produced" claim becomes literal, not fingerprint-based. Auditor can reconstruct raw AI output byte-for-byte from the bundle alone.
- **Negative:** bundles carrying raw AI output can contain PII / secrets / confidential business logic. This must be flagged loudly in README and threat model. The `inlinePayload: false` default protects operators who forget.
- **GDPR:** the side-car design supports Art. 17 erasure by evicting a specific payload entry. The event chain does not break; verification still passes as long as the event's `payload_hash` is not being re-checked against a missing content entry.

---

## Test surface added

1. Contract test: `appendEvent(session, event, { inlinePayload: true })` writes payload to `session._payloads`. Assert exact bytes preserved.
2. Contract test: sealed bundle carries `payloads` map when at least one event was appended with inline flag.
3. Contract test: `verifyBundle` on a bundle with `payloads` recomputes SHA-256 for each and passes.
4. Adversarial test: tamper with one entry in `bundle.payloads` while keeping the event chain intact. Verifier must return `payload_content_mismatch`.
5. Back-compat test: seal a bundle without inline flag; verify passes with no `payloads` field present (fingerprint-only mode still works).
6. GDPR-erasure test: after seal, remove one entry from `bundle.payloads`, verify chain still passes (weaker: fingerprint-only for that event).
7. Adapter test: `SHADOW_INLINE_PAYLOAD=1` produces a bundle with `payloads`; `SHADOW_INLINE_PAYLOAD` unset produces the current fingerprint-only bundle.

Estimated new test count: ~15.

---

## Rollout sequence

**Day 1 (post-demo):** implement `appendEvent({ inlinePayload })` + `session._payloads` accumulation + sealed bundle carrying `payloads` map + 5 contract tests. All existing 1,504 tests still green (default-off).

**Day 2:** extend `verifyBundle` with content-mismatch check + tamper test + GDPR erasure test + adapter env flag wiring + adversarial test suite pass. Ship as v2.1.0 (minor bump because it is additive).

**Day 3 (optional cleanup):** update README + POSITIONING_PROVENANCE.md to unlock Candidate C hero copy (the stronger "preserves the AI's original artifact" phrasing). Refresh Show HN draft. Notify Lora that the gap is closed.

---

## Alternatives considered

- **Store raw payload inline in every event record.** Rejected: breaks payload_ref content-addressing benefit, defeats GDPR erasure, inflates event size for events with large payloads (e.g., a Write tool with a 100KB file).
- **External payload store keyed by session_id, not embedded in bundle.** Rejected: violates the "bundle is self-contained and USB-portable" property that verify.html trades on. An auditor would need two files instead of one.
- **Off-chain payload store with signed pointer.** Rejected: adds infrastructure Shadow refuses to build. The whole product story is "no Shadow server required."

Side-car map embedded in the bundle root is the only design that keeps the bundle self-contained, keeps events unchanged, and supports GDPR erasure.

---

## Explicit non-goals

- Compressing large payloads. Out of scope for v2.1.0. If payload sizes become a problem in dogfooding, add compression in v2.2.
- Streaming payload append (for very long shell outputs). Out of scope; v2.1.0 assumes payloads fit in memory at emission time.
- Selective inline (only inline for `tool_call` events, hash-only for `model_output`). Out of scope; the caller decides via `inlinePayload` per call.
