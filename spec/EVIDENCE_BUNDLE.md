# Shadow evidence bundle — spec v1

> Bundle format v1 · spec tag `shadow-evidence/v1` · JSON Schema `spec/evidence-bundle.schema.json` · targets EU AI Act Article 12 record-keeping obligations.

## One-sentence definition

An **evidence bundle** is the tamper-evident record of one AI agent session: a header identifying who ran the agent with what models on what host, an ordered chain of signed events describing what happened, a batch root that binds all events together, one or more signatures over the batch root, and optional external time anchors that let a third party verify the record existed no later than a specific moment.

## Why this exists

Debug observability tools (LangSmith, Langfuse, Datadog GenAI) tell engineers *why* an agent broke. They store mutable telemetry designed for iteration. When the question shifts from "why did it break" to "prove nobody rewrote this record afterward", the answer requires cryptographic integrity, not more telemetry. That is the evidence bundle's only job.

EU AI Act Article 12(2) requires high-risk AI systems to automatically record events sufficient to identify substantial modifications (12(2)(a)), enable post-market monitoring (12(2)(b)), and support operational monitoring by the deployer (12(2)(c)). The standards defining what a compliant record must look like are still in draft (ISO/IEC DIS 24970, prEN 18229-1). Shadow does not claim any regulation is satisfied. Shadow produces a record with cryptographic integrity properties an auditor can independently verify without trusting the operator.

## Design constraints (read before implementing)

1. **The chain, not the record, is the primary integrity object.** Any single event's authenticity is verifiable in isolation via signature, but tamper detection at scale requires the chain: reordering, insertion, and deletion are only caught when the chain is walked.
2. **Payloads are stored separately from event records** and referenced by content hash. This lets an operator honor a GDPR erasure request by deleting the payload store without invalidating the chain. The event record keeps the `payload_hash`; the `payload_ref` becomes null. An auditor sees "content redacted" but knows exactly how many events happened and in what order.
3. **Signing keys live outside the agent process.** The agent emits events into a local queue; a separate signer daemon (or OS keychain-backed helper) reads the queue and produces signatures. The agent never holds the private key. This is the "insider at the bank" threat model boundary — an adversary with agent-code access still cannot forge signatures.
4. **Crashed sessions produce valid partial bundles.** Events are signed as they occur, not at session end. If the agent crashes mid-session, the bundle is missing a `session_end` event but is otherwise verifiable. Missing tail is detectable and reportable.
5. **Additive extensions only.** The event-type enum is frozen at bundle_version 1. New per-event metadata flows through the `extensions` object on each event. Adding a new top-level bundle field requires bumping bundle_version and shipping a migration.

## Bundle structure

```
{
  "bundle_version": 1,
  "spec_version": "shadow-evidence/v1",
  "header": {
    "session_id": "<UUIDv7>",
    "session_started_at_utc": "<RFC 3339>",
    "session_ended_at_utc": "<RFC 3339 or null on crash>",
    "agent": { "name": "claude-code", "version": "1.2.3", "identity_ref": "gh:alex-jb" },
    "models": [ { "model_id": "anthropic:claude-sonnet-4-6-20260101", "provider": "anthropic", "sampling_params_hash": "<sha256>" } ],
    "environment_fingerprint": { "os": "darwin-25.3.0", "node_version": "24.14.1", "hostname_hash": "<sha256 or null>" },
    "schema_versions": { "bundle": 1, "attest_core": "2.0.0" }
  },
  "events": [
    { "seq": 0, "event_type": "session_start", "actor": "system", "payload_hash": "<sha256>", "payload_ref": "sha256:<hex>", "prev_hash": "<sha256 of header>", "ts_utc": "...", "extensions": {} },
    { "seq": 1, "event_type": "user_message", "actor": "user", ... },
    { "seq": 2, "event_type": "model_call", "actor": "model", ... },
    ...
    { "seq": N, "event_type": "session_end", "actor": "system", ... }
  ],
  "batch_root": "<sha256 of concatenated event hashes>",
  "signatures": [
    { "algorithm": "ed25519", "key_id": "prod-2026-Q3", "signature": "<base64url>", "signed_at_utc": "..." }
  ],
  "external_anchors": [
    { "kind": "rfc3161-tsa", "batch_root": "<hex>", "anchor_ref": "<b64url TSR>", "anchored_at_utc": "..." }
  ]
}
```

## Event types (enum frozen at bundle_version 1)

| Event type | Actor | Purpose | Notes |
|---|---|---|---|
| `session_start` | system | Marks the beginning of the session. Payload contains the header + a session-init nonce for uniqueness. `seq=0`. | Exactly one per bundle. `prev_hash` for seq=1 is this event's hash. |
| `user_message` | user | User prompt or query into the agent. Payload contains the message content. | Content is hashed; `payload_ref` may be null if the operator has redacted the message. |
| `model_call` | model | Agent invokes a model. Payload contains the request (messages, tools, sampling params). Extensions include `model_id` (must match header manifest). | Paired with a subsequent `model_output` when the call completes. |
| `model_output` | model | Model responds. Payload contains the output. Extensions include latency, token counts, provider-reported cost. | Paired with the preceding `model_call`. |
| `tool_call` | agent | Agent invokes a tool. Payload contains tool name + args. Extensions include a `call_id` bound to the eventual `tool_result`. | |
| `tool_result` | tool | Tool returns. Payload contains the result. Extensions include the same `call_id`. | |
| `file_read` | agent | Agent reads a file. Payload contains file path + read range. Extensions include the sha256 of the file contents as observed. | Optional — many agents will skip these; include when file-read matters for the audit story. |
| `file_write` | agent | Agent writes a file. Payload contains file path + before/after hashes + optional unified-diff hash. | The diff itself is stored in the payload store. |
| `shell_exec` | agent | Agent runs a shell command. Payload contains the command + working directory + exit code + stdout/stderr hashes. | |
| `network_request` | agent | Agent makes an outbound network request. Payload contains URL + method + request-body hash + response-status + response-body hash. | Optional — enable when network activity is part of the auditable surface. |
| `human_approval` | user | A human explicitly approved (or rejected) an action. Payload contains the approver identity + the action ref + outcome. | Records that a HITL gate fired; Shadow never *implements* the gate. |
| `error` | agent | An agent-observed failure. Payload contains error class + message + optional stack-hash. | Emit at least one before crashing so tail is verifiable. |
| `session_end` | system | Marks graceful session termination. Payload contains a summary (event count, duration). | Optional but recommended. Absence means the session crashed; the partial bundle still verifies. |

## Article 12 mapping

For each event type, which Article 12(2) purpose it primarily serves:

| Event type | 12(2)(a) substantial-modification identification | 12(2)(b) post-market monitoring | 12(2)(c) deployer operational monitoring |
|---|:-:|:-:|:-:|
| `session_start` | ● | ● | ● |
| `user_message` |   |   | ● |
| `model_call` | ● | ● | ● |
| `model_output` | ● | ● | ● |
| `tool_call` | ● |   | ● |
| `tool_result` | ● |   | ● |
| `file_read` |   |   | ● |
| `file_write` | ● | ● | ● |
| `shell_exec` |   | ● | ● |
| `network_request` |   | ● | ● |
| `human_approval` | ● | ● | ● |
| `error` |   | ● | ● |
| `session_end` |   |   | ● |

Shadow does not claim the record produced satisfies Article 12; Shadow claims the record is tamper-evident at the moment of verification, which is a prerequisite the standards drafts consistently require.

## OpenTelemetry GenAI semantic-convention mapping

Where OTel GenAI semconv (2025 draft) has an equivalent attribute, evidence-bundle events map as follows:

| Evidence field | OTel GenAI attribute |
|---|---|
| `header.models[].model_id` | `gen_ai.request.model` |
| `header.models[].provider` | `gen_ai.system` |
| `event.extensions.usage.input_tokens` | `gen_ai.usage.input_tokens` |
| `event.extensions.usage.output_tokens` | `gen_ai.usage.output_tokens` |
| `event.extensions.finish_reason` | `gen_ai.response.finish_reasons` |
| `event.ts_utc` | span start/end time |

The `@shadow/adapter-otel` package (M2.2, week 2) ingests OTel spans and emits evidence events using this mapping. What is lost in the OTel → evidence direction: mutable telemetry semantics. OTel spans can be edited by pipelines; evidence bundle events cannot without breaking the chain.

## Signing model

Signing reuses `@shadow/attest-core` primitives without change:

1. Each event is canonicalized (stable-order JSON) and its own sha256 hash computed.
2. The event's `prev_hash` is set to the previous event's own hash (or `sha256(canonical(header))` for `seq=0`).
3. The `batch_root` is set to `sha256(hash_0 || hash_1 || ... || hash_N)`.
4. One or more signatures are produced over `batch_root` using Ed25519 (or HMAC-SHA-256 for dev/back-compat).
5. Signatures live in the `signatures[]` array; each has an `algorithm`, `key_id`, and base64url-encoded `signature`.
6. Verifiers reconstruct the chain, recompute `batch_root`, and verify each signature against the resolved public key for its `key_id`.

Verification returns three trust levels (see `docs/THREAT_MODEL.md` when it lands with M3):

- `SELF_SIGNED` — chain intact and signature valid; operator could still have re-signed history after the fact.
- `TIME_ANCHORED` — chain intact + at least one RFC 3161 timestamp token witnesses existence at time T.
- `LOG_ANCHORED` — chain intact + at least one Sigstore Rekor inclusion proof publicly witnesses the batch root.

Never present `SELF_SIGNED` as more than it is. This is the language-discipline rule from `docs/roadmap/SHADOW_V3_BRIEF.md` §Strategic constraints #4.

## Streaming API contract (implementation target for M1.2)

```js
import { createSession, appendEvent, sealSession } from "@shadow/evidence";

const session = createSession({
  agent: { name: "claude-code", version: "1.2.3" },
  models: [{ model_id: "anthropic:claude-sonnet-4-6-20260101", provider: "anthropic" }],
  environmentFingerprint: { os: "darwin-25.3.0", node_version: "24.14.1" },
  keyId: "prod-2026-Q3",
});

appendEvent(session, {
  event_type: "user_message",
  actor: "user",
  payload: { text: "..." },
});

// ... many more appends ...

const bundle = sealSession(session); // returns the signed evidence bundle
```

Each `appendEvent` extends the chain and appends a signature (or defers to the signer daemon). `sealSession` finalizes the `session_end` event, computes the final `batch_root`, and produces the top-level signature array. A crashed session leaves the last-good state on disk; the recovery API produces a valid partial bundle from disk state.

## Redaction

The operator honors a GDPR erasure request by:

1. Locating the event(s) whose payload references the redacted subject.
2. Deleting the payload content from the local payload store.
3. Setting `payload_ref` to null on the affected events.
4. Recomputing the batch root **is not required** — the event's `payload_hash` is unchanged; only the reference is removed.

**Why this works:** `payload_ref` is not part of the signed record shape. The chain hash for each event is computed over `{seq, ts_utc, event_type, actor, payload_hash, prev_hash, extensions}` — `payload_ref` is unsigned metadata. This lets the operator null it without breaking the chain, while `payload_hash` (which is signed) still binds the record to the specific content that used to be there.

The verifier reports the affected events as "content redacted" and continues to verify chain integrity. An auditor sees exactly which events had content redacted and when.

This is the load-bearing difference between Shadow and mutable observability: redaction is a first-class operation preserving auditability, not a shortcut that silently rewrites history.

## What Shadow is not

- **Not observability.** Shadow does not visualize agent metrics or debug agent state. Use LangSmith / Langfuse / Datadog for that.
- **Not policy enforcement.** Shadow does not block, approve, or otherwise gate agent actions. Record a `human_approval` event when the host system emits one; never *implement* the gate.
- **Not legal advice.** Shadow produces a record with cryptographic integrity properties. Whether that record has evidentiary value under a specific rule of evidence in a specific jurisdiction is a legal determination Shadow does not make.

## Related specs

- `spec/attestation.schema.json` — v2 signed attestation record used by Shadow's credit-decision council. The evidence bundle format reuses attest-core primitives; a per-decision attestation is a specialized single-event bundle at conceptual level.
- `docs/roadmap/SHADOW_V3_BRIEF.md` — full v3 roadmap (M1 through M6).
- `docs/CITATION_MAP.md` — regulatory-citation-to-test mapping used by the v1.5 credit-decision vertical; the same evidence-bundle event chain can carry citation references via `extensions.citations[]`.

## Change log

| Version | Date | Change |
|---|---|---|
| v1 | 2026-07-10 | Initial spec. `bundle_version: 1`. Event enum frozen at 13 types. Payload separation + redaction path. Article 12 mapping table. OTel GenAI mapping table. Signing model reuses attest-core Ed25519 + hash-chain + batch root. |
