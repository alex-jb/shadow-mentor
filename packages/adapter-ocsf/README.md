# shadow-adapter-ocsf

Project a **sealed Shadow evidence bundle** onto **OCSF 1.9.0 `record_integrity` events** — the cryptographic audit chain a bank SIEM already ingests, with **zero hashing drift** from the signed bundle.

## Why

OCSF (the Splunk/AWS-backed security-event schema most bank SIEMs consume) shipped **v1.9.0 on 2026-08-03**, adding a `record_integrity` profile: a per-event cryptographic `attestation` (fingerprint + signatures + a tamper-evident `prev_event` / `chain_uid` / `authority_uid` chain) plus an `ai_agent` object with a `charter`.

That is exactly what a sealed Shadow bundle already computes. This adapter maps the two, so the objection *"Shadow uses a bespoke bundle format"* becomes *"Shadow emits the OCSF `record_integrity` profile"* — a procurement checkbox, not a footnote.

It is a **one-way projection**. It never re-signs, re-hashes, or mutates the bundle. `attestation.fingerprint` is computed with attest-core's own `eventOwnHash` — the identical leaf that folds into `batch_root` — so the OCSF projection and the signed bundle can never disagree about a hash.

## Use

```js
import { sealSession } from "shadow-attest-core";
import { bundleToOcsf } from "shadow-adapter-ocsf";

const bundle = sealSession(session);           // your sealed evidence bundle
const { events, warnings } = bundleToOcsf(bundle, {
  charter: "You are a fair-lending compliance council.", // optional: the agent's governing prompt
});
// `events` → ship to your OCSF-consuming SIEM. `warnings` → e.g. missing signatures.
```

## Field mapping (Shadow → OCSF 1.9.0)

| OCSF `attestation` / object | Shadow field | Notes |
|---|---|---|
| `attestation.fingerprint` | `eventOwnHash(event)` | SHA-256 (`algorithm_id: 3`) over the event's signed shape. |
| `attestation.signatures[]` | `signatures[0]` (Ed25519 over `batch_root`) | On the **terminal** event only — the signature attests the whole chain. `batch_root` rides alongside. |
| `attestation.prev_event.fingerprint` | `event.prev_hash` | Content-binding to the prior event's own-hash. Absent on genesis (seq 0). |
| `attestation.chain_uid` | `header.session_id` | The tamper-evident chain identifier. |
| `attestation.authority_uid` | `signatures[0].key_id` | The attesting party (Shadow's signing key). |
| `ai_agent.uid` / `.name` / `.version` | `header.agent.identity_ref` / `.name` / `.version` | The accountable operator, distinct from OCSF's security-sensor `agent`. |
| `ai_agent.charter` | `opts.charter` | The agent's governing system prompt / constitution. |
| `unmapped.shadow_seq` / `shadow_payload_hash` | `event.seq` / `event.payload_hash` | Retrieval keys back to the source bundle. |

## Scope / honesty

- This maps the `record_integrity` + `ai_agent` attributes. It does **not** claim a precise per-event OCSF `class_uid` taxonomy — Shadow's frozen event vocabulary is carried in `type_name` + `metadata.labels`, and mapping each event type to an authoritative OCSF class is a documented follow-up rather than a guess. Consumers relying on `class_uid` should treat these as `base_event`s.
- The full standards context lives in [`docs/STANDARDS_MAP.md`](../../docs/STANDARDS_MAP.md#5-ocsf-190--record_integrity-profile) §5.

## Refs

OCSF 1.9.0 release (`ocsf/ocsf-schema`, PRs #1661 `record_integrity`, #1641 `ai_agent`). RFC 8032 Ed25519.
