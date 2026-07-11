# Shadow vs. debug observability vs. runtime governance

> **v1 — 2026-07-10.** An honest table. No trash talk. If you already have LangSmith / Langfuse / Datadog GenAI, you likely already have observability. If you already run PromptHalo / Salt / an in-house policy gate, you likely already have runtime governance. Shadow is neither of those. This document explains what Shadow is, what it is not, and where the categories meet or fail to overlap.

## The three-category landscape

There are three distinct categories of AI-agent infrastructure today. They solve different problems for different audiences.

**Debug observability** (LangSmith, Langfuse, Datadog GenAI, Arize, W&B Weave, Honeycomb GenAI). Answers *"why did the agent break?"* Audience: engineers iterating on agent quality. Storage: mutable telemetry, indexed for fast query, sampled or downsampled at scale, deleted per retention policy.

**Runtime governance** (PromptHalo, Salt Security, Prompt Security, Robust Intelligence). Answers *"should this agent action be allowed?"* Audience: security teams enforcing policy at request time. Mechanism: policy engine sitting in the request path, allowing or blocking before the agent acts.

**Cryptographic evidence** (Shadow, and — as far as we've found — no other MIT-licensed open-source project in this specific shape as of 2026-07). Answers *"months later, prove nobody rewrote this record."* Audience: auditors, regulators, bank counsel, court-appointed experts. Storage: immutable, hash-chained, independently verifiable offline. Zero telemetry to a vendor.

The categories are complementary, not competitive. A production deployment likely runs one of each.

## Feature comparison table

| Concern | Debug observability (LangSmith / Langfuse / Datadog) | Runtime governance (PromptHalo / Salt) | Shadow (cryptographic evidence) |
|---|---|---|---|
| **Primary question** | Why did it break? | Should this be allowed? | Was this record rewritten? |
| **Primary audience** | Engineers | Security team | Auditor / regulator / counsel |
| **When it acts** | After the fact, for iteration | In the request path, at decision time | After the fact, at verification time |
| **Record integrity** | Not a design goal; records are mutable telemetry | Not a design goal; records may exist but the policy engine is what enforces | Load-bearing; hash chain + Ed25519 make records tamper-evident by construction |
| **Sampling** | Common (Datadog defaults to 10% for cost) | N/A (policy runs on all requests) | Never — every event that enters the store is signed. Sampling would break the chain. |
| **Retention** | Typically 30-90 days, per vendor plan | Application-defined | Operator-defined; the artifact is portable and survives any specific vendor. |
| **Offline verifiability** | No (vendor UI required) | No (policy engine required) | Yes ([`verify.html`](../verify.html) drag-in works from a USB stick) |
| **Vendor lock-in risk** | High (proprietary storage format) | Medium (proprietary policy DSL) | Low (MIT license, spec-frozen bundle format, verifier reproducible from spec alone) |
| **What runs where** | Agent → vendor SaaS (or self-host paid tier) | Sidecar proxy or SDK inline | Library in the agent process; store on operator infrastructure; verifier fully offline |
| **Telemetry to vendor** | Yes (traces, spans, sometimes payloads) | Sometimes (rule updates, threat feeds) | None. Zero. Grep the source. |
| **Cost model** | Volume-metered (per event / per span) | Volume-metered (per request) | Zero (MIT open-source; operator pays only for their own signing key + store) |
| **Standards alignment** | Interfaces with OpenTelemetry | Interfaces with policy standards (OPA, Cedar) | Directly maps to EU AI Act Article 12, OTel GenAI, ISO/IEC DIS 24970 draft ([`STANDARDS_MAP.md`](./STANDARDS_MAP.md)) |
| **Cryptographic primitives** | Optional (log integrity is not a core concern) | Optional (policy verifiability is not a core concern) | Load-bearing: Ed25519 (RFC 8032), SHA-256 hash chain, batch-root signature, GDPR-compliant redaction path |
| **Threat model addressed** | Bugs in agent code | Adversarial prompts, exfiltration, jailbreaks | Operator-side re-signing / silent record edit (subject to trust-level constraints) |
| **Verification without trusting the vendor** | Not offered | Not offered | Core promise |

## Where the categories overlap

**Debug observability + Shadow.** OTel-instrumented agents already emit `gen_ai.*` spans; the M2.2 OpenTelemetry adapter (planned) reads those spans and emits Shadow evidence events, one-way. A team can keep LangSmith for iteration and add Shadow for the audit-defensible record without instrumenting twice.

**Runtime governance + Shadow.** A policy gate that blocks a request emits a `human_approval` event (with the human being a policy engine, actor: `system`). Shadow records that the gate fired, its outcome, and the policy version. A regulator can later verify that the policy actually ran on the request, and what the policy said at that moment in time — which is a claim runtime governance alone cannot make.

**All three.** A production high-risk AI system likely wants all three: LangSmith or Langfuse for debug iteration, a policy gate for runtime control, Shadow for the audit-defensible record. None replaces the others. The pattern is "one of each," not "one instead of the others."

## When Shadow is the wrong tool

Shadow is not the answer for:

- **Debug iteration on why the agent produced a bad answer.** Use debug observability. Shadow's records are not indexed for fast query; they are indexed for tamper detection.
- **Blocking a request in real time.** Use runtime governance. Shadow does not sit in the request path; it records what happened after the fact.
- **Multi-tenant SaaS telemetry.** Shadow is designed for the operator to run in their own infrastructure. A hosted verifier is on the roadmap as a convenience; the primary artifact is always the local bundle.
- **Real-time dashboards for engineers.** The bundle is not a dashboard.

## When each category is the wrong tool

**Debug observability is the wrong tool for the auditor.** A LangSmith trace is mutable telemetry. If the compliance question is *"prove this record has not been altered since emission,"* the answer LangSmith gives is *"trust us, the SaaS operator, that we did not alter it."* That is not a cryptographic answer. It is a policy answer. Some auditors accept it; the ones running under GDPR Article 22 or EU AI Act Article 12 increasingly do not.

**Runtime governance is the wrong tool for the auditor.** The policy engine's job is to allow or deny at decision time. Once it allows, its record of the allowance is typically stored in the same mutable telemetry the debug observability platform stores. The auditor asking six months later *"which version of the policy fired on this request?"* is asking a question the runtime governance category was not built to answer.

**Shadow is the wrong tool for the debug engineer.** The engineer needs fast iteration, mutable records, sampling. Shadow's cryptographic-integrity properties are load-bearing weight the engineer does not need. Do not point an engineer at Shadow when they want to debug agent quality.

## Positioning in one sentence

Debug observability tells engineers *why the agent broke*. Runtime governance stops the agent from doing bad things. Shadow proves, to an auditor, *that the record of what the agent did has not been rewritten*. All three are honest jobs. Shadow does only the third one.

## Related documents

- [`docs/STANDARDS_MAP.md`](./STANDARDS_MAP.md) — field-by-field mapping to EU AI Act Article 12, OTel GenAI, ISO/IEC DIS 24970 (draft), prEN 18229-1 (draft).
- [`spec/EVIDENCE_BUNDLE.md`](../spec/EVIDENCE_BUNDLE.md) — evidence-bundle spec, v1.
- [`docs/roadmap/SHADOW_V3_BRIEF.md`](./roadmap/SHADOW_V3_BRIEF.md) — v3 engineering brief.
- [`docs/CITATION_MAP.md`](./CITATION_MAP.md) — credit-decision vertical persona × regulation × test map.

## Not covered in this document

- Vendor-vendor comparison within a category (e.g. LangSmith vs. Langfuse). That is a debug-observability tooling decision, not a Shadow decision.
- Specific pricing at any vendor. Prices change; consult the vendor.
- Compatibility with specific agent frameworks. See M2 adapters in the roadmap; the M2.1 Claude Code adapter and M2.2 OTel adapter are the two shipping the v3.0 launch window.
