# Shadow standards map

> **v2 — 2026-08-11.** Field-by-field mapping from the Shadow v3 evidence-bundle format to (1) EU AI Act Article 12 record-keeping obligations, (2) OpenTelemetry GenAI semantic conventions, (3) ISO/IEC DIS 24970 (AI system life-cycle processes, in draft), (4) prEN 18229-1 (European AI Act harmonized standard, in draft), (5) OCSF 1.9.0 `record_integrity` profile (published 2026-08-03), and (6) DSSE/in-toto envelope + L1/L2/L3 conformance levels. Documents that are still in draft carry an inline "will revise when finalized" annotation; §5–§6 are marked "target, not yet emitted."

## Purpose

Auditors, procurement officers, and standards reviewers reach this document to answer one question: *given the standard I'm regulated by, what does Shadow's evidence bundle carry that maps to which clause?* This document is the answer, one traversal, no code archaeology.

Sister documents:
- [`docs/CITATION_MAP.md`](./CITATION_MAP.md) — persona × regulatory citation × test-file triples for the credit-decision vertical.
- [`docs/NIST-AI-600-1-MAP.md`](./NIST-AI-600-1-MAP.md) — Shadow → NIST AI 600-1 (Generative AI Profile) control mapping.
- [`docs/GOVRAMP-MODERATE-MAP.md`](./GOVRAMP-MODERATE-MAP.md) — Shadow → StateRAMP / GovRAMP Moderate control map.
- [`docs/GAICF-COMPATIBILITY.md`](./GAICF-COMPATIBILITY.md) — Shadow → Global AI Compliance Framework compatibility.
- [`spec/EVIDENCE_BUNDLE.md`](../spec/EVIDENCE_BUNDLE.md) — the evidence-bundle spec itself (v1).

## What Shadow claims, and what Shadow does not

Shadow's claim: **the evidence bundle carries the fields the standards require and binds them cryptographically at emission time**. An auditor can independently verify the bundle offline, without trusting the operator.

Shadow does **not** claim any of the below:
- That producing a bundle discharges an operator's obligation under any regulation.
- That the bundle constitutes legal evidence under any specific rule of evidence in any jurisdiction.
- That any specific standard has "certified" or "approved" Shadow. The standards mapped here are either in force (EU AI Act, OTel semconv `1.x`) or in draft (ISO/IEC DIS 24970, prEN 18229-1); Shadow tracks them, does not certify against them.

The determination of whether a Shadow bundle satisfies a specific auditor's threshold is the auditor's call, informed by the mappings below.

---

## 1. EU AI Act Article 12 — Record-keeping obligations

**In force.** Regulation (EU) 2024/1689 published 2024-07-12. Article 12 applies to high-risk AI systems.

### 1.1 Article 12(1) — capacity to automatically record events

> "High-risk AI systems shall technically allow for the automatic recording of events ('logs') over the lifetime of the system."

**Shadow claim:** the streaming session API (`createSession` / `appendEvent` / `sealSession` in `packages/attest-core/session.js`) records events over the full agent-session lifetime. Every event carries a monotonic sequence number and a cryptographic hash chain that survives across restart via the durable store (`packages/attest-core/store-file.js`).

**Bundle fields that satisfy this:** `events[]`, `header.session_started_at_utc`, `header.session_ended_at_utc`, `events[].seq`, `events[].ts_utc`, `batch_root`.

**What is not automatically recorded:** anything the operator's host application does not emit into Shadow. Shadow is the recording *sink*, not the observability agent.

### 1.2 Article 12(2)(a) — identification of situations that may result in the AI system presenting a substantial modification

> "the identification of situations that may result in the AI system presenting a risk within the meaning of Article 79(1) or in a substantial modification"

**Shadow claim:** the event types `model_call`, `model_output`, `tool_call`, `tool_result`, `file_write`, `human_approval`, and `error` carry sufficient state to identify substantial modifications when correlated with the header's `models[]` manifest.

**Bundle fields that satisfy this:** `header.models[]` (model manifest at session start), `events[event_type=model_call].extensions.model_id`, `events[event_type=model_output].extensions.finish_reason`, `events[event_type=file_write].payload_hash`, `events[event_type=human_approval].payload_hash`, `events[event_type=error]`.

**Substantial-modification detection is the auditor's task.** Shadow records; the auditor pattern-matches against the operator's Article 43 conformity assessment baseline.

### 1.3 Article 12(2)(b) — post-market monitoring

> "the facilitation of the post-market monitoring referred to in Article 72"

**Shadow claim:** the append-only event chain plus optional external time anchors (RFC 3161 TSA and Sigstore Rekor per M3, in progress) provide the tamper-evident record post-market monitoring depends on.

**Bundle fields that satisfy this:** `batch_root`, `signatures[]`, `external_anchors[]` (when populated by an operator running with the M3 anchoring adapter — M3 is scheduled for the v3.0.0 launch window).

### 1.4 Article 12(2)(c) — operational monitoring by the deployer

> "the monitoring of the operation of the high-risk AI system referred to in Article 26(5)"

**Shadow claim:** every event carries `ts_utc`, `event_type`, and `actor`, sufficient for the deployer to reconstruct what happened, when, and by which side of the agent-tool-user boundary.

**Bundle fields that satisfy this:** every event's `seq`, `ts_utc`, `event_type`, `actor`, and `payload_hash`. The `header.agent.identity_ref` field binds a session to a specific accountable operator.

### 1.5 Event-type × Article 12 purpose matrix

Reproduced from [`spec/EVIDENCE_BUNDLE.md`](../spec/EVIDENCE_BUNDLE.md#article-12-mapping) for at-a-glance auditor lookup:

| Event type | 12(2)(a) substantial modification | 12(2)(b) post-market monitoring | 12(2)(c) deployer operational monitoring |
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

---

## 2. OpenTelemetry GenAI semantic conventions

**Status:** the OpenTelemetry GenAI conventions are actively developed. As of 2025 the `gen_ai.*` namespace covers request, response, usage, and system attributes; the `gen_ai.agent.*` sub-namespace covers agent-run attributes. These are marked *Experimental* in OTel's conventions repository. Shadow tracks the current release; the mapping table below will revise when the conventions reach *Stable*.

### 2.1 Attribute → evidence-bundle field mapping

| OTel GenAI attribute (namespace) | Shadow evidence field | Notes |
|---|---|---|
| `gen_ai.system` | `header.models[i].provider` | e.g. `"anthropic"`, `"openai"`, `"azure"`, `"local"`. |
| `gen_ai.request.model` | `events[event_type=model_call].extensions.model_id` | Provider-qualified. Must match one of `header.models[].model_id`. |
| `gen_ai.response.model` | `events[event_type=model_output].extensions.model_id` | Records the actual model that responded (may differ under provider fallback). |
| `gen_ai.request.temperature`, `gen_ai.request.top_p`, `gen_ai.request.seed` | `header.models[i].sampling_params_hash` (aggregate) | Shadow hashes the canonicalized sampling params at session start. Per-call overrides ride in `events[event_type=model_call].extensions.sampling_params_delta_hash`. |
| `gen_ai.usage.input_tokens` | `events[event_type=model_output].extensions.usage.input_tokens` | |
| `gen_ai.usage.output_tokens` | `events[event_type=model_output].extensions.usage.output_tokens` | |
| `gen_ai.response.finish_reasons` | `events[event_type=model_output].extensions.finish_reason` | |
| `gen_ai.response.id` | `events[event_type=model_output].extensions.provider_response_id` | |
| `gen_ai.tool.name` | `events[event_type=tool_call].payload.tool` | The tool identifier the agent invoked. |
| `gen_ai.tool.call.id` | `events[event_type=tool_call].extensions.call_id` | Bound to the paired `tool_result` via the same `call_id`. |
| `gen_ai.agent.id` | `header.agent.identity_ref` | Optional; when the host emits an agent identity. |
| `gen_ai.agent.name` | `header.agent.name` | |
| Span start / end timestamps | `events[].ts_utc` | Shadow's timestamp is one per event; OTel span pairs `model_call` + `model_output` in one span with two timestamps. |

### 2.2 What is lost in the OTel → evidence-bundle direction

OTel spans are **mutable telemetry**. Once emitted, an OTel processor can drop, sample, or edit them. Shadow's evidence bundle is **immutable** by design: post-emission edits break the hash chain and fail verification. This is a load-bearing difference, not a bug. The `shadow-adapter-otel` package (M2.2, planned) ingests OTel spans and emits evidence events; it is a one-way pipe.

### 2.3 Draft-stability note

The OTel GenAI conventions are marked *Experimental*. The mapping in §2.1 tracks the 2025 attribute set. When the conventions promote to *Stable* the mapping will revise; the promotion is expected to add attributes rather than rename existing ones, so back-compat for the current mapping is likely.

---

## 3. ISO/IEC DIS 24970 — AI system life-cycle processes

**Status: DRAFT.** ISO/IEC DIS 24970 is under development in ISO/IEC JTC 1/SC 42. The draft is not yet publicly finalized. This section will revise materially when the standard reaches IS (International Standard) status.

**Working alignment (subject to revision when the standard finalizes):**

The draft specifies AI system life-cycle processes including data management, model management, and operations. Shadow's evidence bundle addresses the "operations" life-cycle stage — specifically the recording, retention, and audit of decisions made by a deployed AI system.

**Bundle fields likely to satisfy operations-stage recording requirements:**

- `header` block (agent identity + model manifest + environment fingerprint) → likely maps to "system configuration at operation start" requirements
- `events[event_type=model_call]` + `events[event_type=model_output]` → likely maps to "inference recording" requirements
- `events[event_type=human_approval]` → likely maps to "human-in-the-loop record" requirements
- `signatures[]` + `external_anchors[]` → likely maps to "record integrity" requirements

**Will revise when finalized.** No specific ISO/IEC DIS 24970 clause numbers are cited above because clause numbers are subject to change until the standard is published. This section carries a placeholder framework that will be filled in with authoritative clause-by-clause mapping upon publication.

---

## 4. prEN 18229-1 — European AI Act harmonized standard

**Status: DRAFT.** prEN 18229 is the CEN-CENELEC harmonized standard series being developed to support the EU AI Act. Part 1 addresses core requirements for high-risk AI systems. As with ISO/IEC DIS 24970, the standard is not yet finalized; specific clause numbers below are placeholders.

**Working alignment (subject to revision when the standard finalizes):**

prEN 18229-1 is expected to formalize the technical means by which Article 12 obligations are satisfied. Shadow's mapping to Article 12 (see §1 above) is likely to constitute the substantive content of any prEN 18229-1 mapping, with the standard adding format-specification and record-retention requirements.

**Bundle fields likely to satisfy prEN 18229-1 requirements:**

- Full alignment with §1 (Article 12) mapping
- `bundle_version` + `spec_version` → likely satisfies "record format identification" requirements
- `schema_versions.attest_core` → likely satisfies "signing implementation identification" requirements
- The append-only extension model (`event.extensions` object, `header.models[]` open list) → likely satisfies "forward-compatibility" requirements the harmonized standard is expected to require

**Will revise when finalized.**

---

## 5. OCSF 1.9.0 — `record_integrity` profile

**Status: PUBLISHED, 2026-08-03.** The Open Cybersecurity Schema Framework (OCSF, backed by Splunk/AWS and ingested by most bank SIEMs) released v1.9.0 on 2026-08-03. It added a `record_integrity` profile to `base_event`, an `attestation` object, and an `ai_agent` object. This is the single most direct standard-format expression of what Shadow's evidence bundle already computes.

**What Shadow claims here:** Shadow's bundle carries the exact primitives OCSF's `record_integrity` profile defines — a per-event cryptographic fingerprint, digital signatures, a tamper-evident previous-event chain, and an attesting-authority identifier. An OCSF exporter is therefore a field-mapping layer over primitives that already exist, not new cryptography.

**What Shadow ships today:** the exporter exists — `shadow-adapter-ocsf` (`bundleToOcsf`) projects a sealed bundle to the events below, exposed on three surfaces (library, `POST /api/ocsf-export`, and the `shadow-ocsf` CLI), with a test asserting `attestation.fingerprint` equals attest-core's own `eventOwnHash` so there is zero hashing drift from the signed bundle.

**What Shadow does NOT claim here:** the exporter is **not yet validated against a live OCSF schema-validator or a SIEM ingest**, and it does **not** assert a precise per-event OCSF `class_uid` taxonomy (see §5.3-adjacent note below). "Emits the record_integrity profile" means the attestation + ai_agent attributes are populated per the mapping; full OCSF conformance is claimed only after schema-validator + SIEM round-trip testing.

### 5.1 `attestation` object → Shadow evidence field

| OCSF 1.9.0 field (`record_integrity` / `attestation`) | Shadow evidence field | Notes |
|---|---|---|
| `attestation.fingerprint` | `events[i]` own-hash (SHA-256 over the canonical signed shape) | Per-event content fingerprint. Shadow's own-hash excludes `payload_ref` + `payload`; `payload_hash` is the in-shape authenticator. |
| `attestation.signatures[]` | `signatures[]` (Ed25519 over `batch_root`) | Shadow signs the session-level `batch_root` (SHA-256 root over the ordered per-event own-hashes). The terminal/`session_end` event carries the session signature; each event still carries its own `fingerprint` + `prev_event`. |
| `prev_event.fingerprint` | `events[i].prev_hash` | Content-binding to the previous event's own-hash. Genesis `prev_hash` = header seed hash. |
| `prev_event.uid` / `prev_event.type_uid` | `events[i-1].seq` / `events[i-1].event_type` | Retrieval keys for the prior event. |
| `chain_uid` | `header.session_id` | The tamper-evident chain identifier. |
| `authority_uid` | signing `key_id` (surfaced by `GET /api/attestation-info`) | Identifies the attesting party (Shadow's signing key). |
| `attestation_list` | `external_anchors[]` (RFC 3161 TSA + Rekor, M3, in progress) | Optional additional attestations from external time-anchors when the operator runs the anchoring adapter. |

### 5.2 `ai_agent` object → Shadow header

| OCSF 1.9.0 `ai_agent` attribute | Shadow field | Notes |
|---|---|---|
| `ai_agent.uid` / `ai_agent.name` | `header.agent.identity_ref` / `header.agent.name` | Distinct from OCSF's security-sensor `agent` object; Shadow's accountable operator identity binds here. |
| `ai_agent.charter` | recorded system prompt / persona constitution | Maps when the operator emits the agent's governing prompt as a `prompt` event or header field. Shadow's persona prompts (`lib/run-loan-council.js`) are the credit-vertical charter. |
| `hosted_ai_agent_list` | `header.models[]` + sub-agent events | Where a session spawns sub-agents (`subagent_stop` events), each maps to a hosted-agent entry. |

### 5.3 Why this is the domain-correct provenance format

OCSF `record_integrity` lands natively in the SIEM a bank security team already runs. It converts the objection "Shadow uses a bespoke bundle format" into "Shadow emits the OCSF `record_integrity` profile" — a procurement checkbox rather than a footnote. It is also the reason **C2PA is not the target format**: C2PA is media-provenance (images, video, documents); OCSF is the security-event provenance standard for exactly this domain.

---

## 6. Signature envelope + conformance levels (DSSE / in-toto)

**Status: target, not yet emitted.** Shadow today signs a bespoke Ed25519 bundle. Wrapping the same signature in a **DSSE** (Dead Simple Signing Envelope) / in-toto envelope makes it verifiable by the existing supply-chain toolchain (cosign, in-toto, Sigstore) with no new cryptography — the payload and signature are unchanged, only the envelope framing is standard.

### 6.1 Where Shadow sits today, by conformance level

Adapting the L1/L2/L3 framing that fed OCSF (the `forensic-audit-trail-spec`, archived 2026-08-04 because it "landed upstream in OCSF 1.9.0"):

| Level | Requirement | Shadow status |
|---|---|---|
| **L1** | HMAC/hash chain + canonical JSON (RFC 8785-style) | **Met.** Shadow's hash chain + canonical signed shape already satisfy L1. |
| **L2** | Signed session attestations, ES256/Ed25519 min, public-key discovery | **Substantially met** — Shadow signs with Ed25519 and publishes the key via `GET /api/attestation-info`. **Gap:** the signature is not yet wrapped in a standard DSSE/in-toto envelope. |
| **L3** | SPIFFE/SPIRE identity federation | **Not targeted.** Out of Shadow's independent-verifier scope; belongs to an enforcement/identity kernel, which Shadow deliberately is not (see §6.2). |

### 6.2 The honest positioning consequence

The crypto layer is no longer a differentiator — as of 2026-08-03 it is a **ratified OCSF profile**, and two well-funded governance kernels (OrgKernel, Microsoft Agent Governance Toolkit) occupy the "prove what happened" narrative from **inside** the agent's trust boundary. Shadow's differentiator is the two things they structurally cannot be: (1) **independent verification from outside** that boundary, offline, with no vendor dependency; and (2) **fair-lending reason-code depth** (see [`CITATION_MAP.md`](./CITATION_MAP.md)). Emitting OCSF + DSSE is table stakes to be legible to the buyer; the moat is elsewhere.

---

## 7. NIST AI 600-1 (Generative AI Profile) cross-reference

NIST AI 600-1 mapping is maintained in a dedicated sister document: [`docs/NIST-AI-600-1-MAP.md`](./NIST-AI-600-1-MAP.md). That document reads from the same event-type × record-purpose lens as §1 above; the mappings are additive.

---

## 8. What Shadow does NOT map to

Explicit non-claims:

- **SR 26-2 (Federal Reserve model-risk guidance, 2026-04-17).** SR 26-2 carves generative and agentic AI systems out of its scope in footnote 3 and delegates governance to the institution's own risk-management practices. Shadow provides an artifact the institution can present under its own governance; Shadow does not claim SR 26-2 applicability.
- **SEC / FINRA rule-specific applicability.** Any brokerage or trading-vertical Shadow deployment inherits SEC / FINRA obligations from the operator; Shadow does not map to specific FINRA rules.
- **HIPAA.** Shadow can carry decisions in healthcare AI systems but does not implement HIPAA-specific PHI handling. HIPAA requires operator-side control on payload store contents.
- **PCI DSS.** Shadow is not a payment-processing artifact.
- **Any national-security or classified-information standard.** Shadow is unclassified open-source.

---

## 9. Update policy

This document is versioned in git. Changes to the mapping tables must be paired with:

- If a standard progresses in status (draft → published / experimental → stable), update the header line for that section with a citation to the publication.
- If Shadow's evidence-bundle format changes (new event type, new signed field), update the mapping tables here in the same PR that ships the format change.
- The "will revise when finalized" annotation is removed only when the underlying standard reaches published / stable status *and* the mapping has been reviewed against the final clause numbers.

## 10. Change log

| Version | Date | Change |
|---|---|---|
| v1 | 2026-07-10 | Initial mapping. Article 12 (in force). OTel GenAI (experimental). ISO/IEC DIS 24970 (draft, placeholder). prEN 18229-1 (draft, placeholder). Non-mapped explicit list. |
| v2 | 2026-08-11 | Added §5 OCSF 1.9.0 `record_integrity` / `attestation` / `ai_agent` mapping (published 2026-08-03) and §6 DSSE envelope + L1/L2/L3 conformance-level self-assessment. Both marked target-not-yet-emitted. Renumbered trailing sections. |

## 11. Feedback

Auditors and procurement officers who find a mapping row unclear, missing, or wrong are invited to open an issue at `github.com/alex-jb/shadow-mentor/issues` with the standard citation and the ambiguity. Corrections that improve auditor traversal are welcome.
