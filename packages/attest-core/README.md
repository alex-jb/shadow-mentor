# shadow-attest-core

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
npm install shadow-attest-core
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
} from "shadow-attest-core";

// v3 M1.2 streaming session API
import {
  EVENT_TYPES,
  createSession,
  appendEvent,
  sealSession,
  verifyBundle,
} from "shadow-attest-core";

// v3 M3 external anchoring — RFC 3161 TSA + Sigstore Rekor
import {
  TRUST_LEVELS,
  trustLevelRank,
  requestTimestamp,
  verifyRfc3161Anchor,
  verifyCmsSignature,
  validateCmsCertChain,
  submitRekorEntry,
  verifyRekorAnchor,
} from "shadow-attest-core";

// Optional sub-entries
import { computeBatchRootHash } from "shadow-attest-core/batch";
```

## Quickstart: per-decision attestation

```js
import { generateKeyPairSync } from "node:crypto";
import { buildAttestation, verifyAttestation } from "shadow-attest-core";

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
import { createSession, appendEvent, sealSession, verifyBundle } from "shadow-attest-core";

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

## v3 M3 external anchoring — trust levels

A signed bundle is only as strong as the assumption that the operator's signing
key wasn't used to silently rewrite history. External anchoring closes that
gap by binding the bundle to a third party.

Five trust levels, ranked lowest to highest:

| Level | What it means | Adversary defeated |
|---|---|---|
| `SELF_SIGNED` | Ed25519 signature verifies + hash chain intact | External tamperer (A1). Operator with the private key can still rewrite. |
| `TIME_ANCHORED_STRUCTURAL` | RFC 3161 TSA anchor's messageImprint matches batch_root | A1. A2 (operator-insider) narrowed — response bytes match, but TSA signature not verified. |
| `LOG_ANCHORED_STRUCTURAL` | Sigstore Rekor entry body's payload hash matches batch_root | A1. A2 narrowed — Rekor received the entry, inclusion + SET not verified. |
| `TIME_ANCHORED` | Plus TSA's CMS SignedData signature verifies (optionally against a CA trust store) | A2 defeated for tampering after `genTime`. |
| `LOG_ANCHORED` | Plus Rekor inclusion proof + SET signature verify | A2 defeated + publicly witnessed. Even a compromised operator can't silently rewrite. |

**A3 (agent-itself, lying at emission time) is not defeated by any level.** See
[`../../docs/THREAT_MODEL.md`](../../docs/THREAT_MODEL.md) for the full
adversary catalog.

### Anchor a batch to a free RFC 3161 TSA

```js
import { requestTimestamp, verifyBundle, TRUST_LEVELS } from "shadow-attest-core";

// After sealSession returns a bundle...
const anchor = await requestTimestamp({
  batchRootHex: bundle.batch_root,
  tsaUrl: "https://freetsa.org/tsr",  // or any RFC 3161-compliant TSA
});
bundle.external_anchors = [anchor];

// Verify with anchor check
const result = verifyBundle(bundle, {
  publicKey,
  checkAnchors: "full",             // "structural" | "full" | false
  caTrustStorePem: [/* PEM CA root(s) */],  // optional; omit for structural chain
});
// result.trustLevel === TRUST_LEVELS.TIME_ANCHORED (or TIME_ANCHORED_STRUCTURAL on fallback)
```

### Anchor a batch to Sigstore Rekor (publicly witnessed)

```js
import { submitRekorEntry, verifyBundle, TRUST_LEVELS } from "shadow-attest-core";

// Requires the current Rekor public key. Fetch once:
//   curl https://rekor.sigstore.dev/api/v1/log/publicKey
const rekorPubKey = /* the PEM string above */;

const anchor = await submitRekorEntry({
  batchRootHex: bundle.batch_root,
  signatureBase64: bundle.signatures[0].signature,
  publicKeyPem,  // the same Ed25519 pubkey your bundle was signed with
});
bundle.external_anchors.push(anchor);

const result = verifyBundle(bundle, {
  publicKey,
  checkAnchors: "full",
  rekorPubKey,
});
// result.trustLevel === TRUST_LEVELS.LOG_ANCHORED
```

### CLI

```bash
npx shadow-verify bundle.json \
  --public-key operator.pub.pem \
  --check-anchors full \
  --ca-trust /etc/ssl/certs/ca-certificates.crt
```

Exit codes: 0 verified · 1 verification failed · 2 usage error · 3 I/O error.

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
