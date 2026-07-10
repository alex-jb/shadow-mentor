# @shadow/attest-core

Zero-LLM-dep cryptographic evidence primitives for AI decision attestation and agent session recording.

**Status:** v2.0.0 — physical source lives here. Prior `lib/` paths are back-compat shims.

## What lives here

- Ed25519 (RFC 8032) + HMAC-SHA-256 signing
- Append-only signed-payload contract for per-decision attestation (frozen v2 schema at [`../../spec/attestation.schema.json`](../../spec/attestation.schema.json))
- Batch attestation with SHA-256 batch root — O(1) verification over N decisions
- Hash-chain primitives (`previous_hash` linking) with tamper detection
- **Streaming session API** (v3 M1.2, added 2026-07-10): `createSession` / `appendEvent` / `sealSession` / `verifyBundle` for evidence-bundle recording per [`../../spec/EVIDENCE_BUNDLE.md`](../../spec/EVIDENCE_BUNDLE.md)

## What does NOT live here

- Any LLM SDK (`@anthropic-ai/sdk`, `openai`, `@google/genai`, etc)
- Any HTTP handler
- Any Shadow domain logic (loan council, personas, prompts)

CI enforces the "zero LLM deps" invariant via [`test/attest-core-contract.test.js`](../../test/attest-core-contract.test.js) — the test walks the transitive import graph from this package's entry points and fails on any LLM SDK dependency.

## Install

```bash
npm install @shadow/attest-core
```

Node.js `>= 20` (uses the built-in `node:crypto` Ed25519 API).

## Import surface

```js
// Per-decision attestation
import {
  ATTESTATION_VERSION,
  SIGNATURE_MODES,
  buildAttestation,
  verifyAttestation,
  computeAttestationHash,
} from "@shadow/attest-core";

// v3 M1.2 streaming session API
import {
  EVENT_TYPES,
  createSession,
  appendEvent,
  sealSession,
  verifyBundle,
} from "@shadow/attest-core";

// Optional sub-entries
import { computeBatchRootHash } from "@shadow/attest-core/batch";
import { computeAttestationHash } from "@shadow/attest-core/chain";
```

## Quickstart: per-decision attestation

```js
import { generateKeyPairSync } from "node:crypto";
import { buildAttestation, verifyAttestation } from "@shadow/attest-core";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const attestation = buildAttestation({
  request: { loan_id: "abc-123", credit_score: 740 },
  response: { verdict: "approve", voices: [/*...*/] },
  modelId: "council/deterministic",
  mode: "ed25519",
  privateKey,
  keyId: "prod-2026-Q3",
});

const result = verifyAttestation(attestation,
  { loan_id: "abc-123", credit_score: 740 },
  { verdict: "approve", voices: [/*...*/] },
  { publicKey },
);
// result.ok === true
```

## Quickstart: streaming session (v3 evidence bundle)

```js
import { generateKeyPairSync } from "node:crypto";
import { createSession, appendEvent, sealSession, verifyBundle } from "@shadow/attest-core";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const session = createSession({
  agent: { name: "claude-code", version: "1.2.3" },
  models: [{ model_id: "anthropic:claude-sonnet-4-6", provider: "anthropic" }],
  environmentFingerprint: { os: "darwin-25.3.0", node_version: process.version },
  keyId: "prod-2026-Q3",
  privateKey,
});

appendEvent(session, {
  event_type: "user_message",
  actor: "user",
  payload: { text: "Refactor the auth module." },
});

appendEvent(session, {
  event_type: "tool_call",
  actor: "agent",
  payload: { tool: "grep", args: { pattern: "auth" } },
});

// ... many more ...

const bundle = sealSession(session);
// Ship `bundle` to your evidence store, or hand it to an auditor.

const result = verifyBundle(bundle, { publicKey });
// result.ok === true if the chain is intact and the signature verifies.
```

## Verification acceptance

- 10,000-event synthetic session end-to-end (append + seal + verify) completes in **~69ms on an M-series MacBook** — 72× under the SHADOW_V3_BRIEF acceptance target of 5s. See [`../../test/session-perf-10k.test.js`](../../test/session-perf-10k.test.js).
- Mid-chain tampering (mutated `payload_hash`, event reorder, or event deletion) is detected with the exact `failedSeq` reported.
- GDPR erasure pattern (null `payload_ref`, keep `payload_hash`) preserves chain integrity — see redaction section of [`../../spec/EVIDENCE_BUNDLE.md`](../../spec/EVIDENCE_BUNDLE.md).

## Zero telemetry

This package does not phone home. There are no analytics, no crash reports, no update pings. Verify by grepping the source: no outbound HTTP anywhere.

## Standards alignment

- **Ed25519 signature scheme:** RFC 8032 EdDSA with Curve25519.
- **NIST FIPS 186-5** (2023) approves Ed25519 for federal use.
- **NIST SP 800-57 Part 1 §5.2** for key rotation cadence (rotate at least yearly).
- **EU AI Act Article 12(2)** record-keeping obligations — the evidence-bundle format maps event types to Article 12(2)(a/b/c) purposes; see [`../../spec/EVIDENCE_BUNDLE.md`](../../spec/EVIDENCE_BUNDLE.md#article-12-mapping).
- **OpenTelemetry GenAI semantic conventions** — a documented mapping table shows how OTel spans translate into evidence events.

Shadow does not claim any regulation is satisfied. The record has cryptographic integrity properties auditors can independently verify. The determination of evidentiary value is a legal one.

## License

MIT.
