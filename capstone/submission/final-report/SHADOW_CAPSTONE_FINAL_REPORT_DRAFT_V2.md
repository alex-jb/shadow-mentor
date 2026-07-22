---
title: "Shadow: A Cryptographically Verifiable Evidence and Spatial Audit System for AI-Assisted Decisions"
subtitle: "From Multi-Agent Answers to Independently Verifiable AI Decision Evidence"
author: "Alex Ji"
program: "M.S. Computer Science"
institution: "Yeshiva University"
course: "Capstone in Computer Science I"
date: "2026-07-21"
status: "DRAFT V2"
geometry: margin=1in
fontsize: 11pt
toc: true
toc-depth: 2
numbersections: true
---

<!-- V2. Truth-refreshed 2026-07-21 across the working tree and two sibling worktrees:
     main base 5106799; feat/shadow-lens-explainers @ 19f52f0; research/unity-threejs-spatial-ux-v2 @ bb33196.
     Canonical facts come from capstone-facts-v2.json + a live test re-run; statuses use the V2 vocabulary and
     never collapse authored / host-tested / built / device-validated. The V1 figure 1,824/1,827 is stale and is
     not reused anywhere in this document. -->

# Abstract {.unnumbered}

AI-assisted decision systems increasingly produce conclusions that a person must review and sign off on, yet the answer such a system returns is not the same as verifiable evidence of how it was produced. Ordinary application logs are mutable and platform-specific, and a model's own explanation is generated prose rather than a checkable record; neither lets an independent reviewer confirm what happened or detect after-the-fact tampering. This capstone presents **Shadow**, an independent evidence and decision-audit layer for AI systems. Shadow represents an AI-assisted workflow as a canonical, deterministic sequence of structured events, links them in a SHA-256 hash chain, and seals the batch with an Ed25519 signature, producing a portable evidence bundle that a third party can verify — including offline in a browser. When a record is altered, the verifier localizes the exact first failed sequence and flags every downstream event the break invalidates. The system carries three domain profiles (banking, data science, coding agent) under one verification grammar, a bilingual (English / Simplified Chinese) verifier, a shared 3D scene contract with spatial-replay prototypes in Unity and Three.js, and a built Android mock. The implementation is host-tested (**1,858 of 1,861 tests passing**, 3 environment-gated skips, 0 failing) with browser-acceptance validation in Chromium; the spatial surfaces are research prototypes and the Android build is not device-validated. One principle governs the design: **cryptographic verification establishes integrity, not correctness** — it cannot show that a cited source was truthful or that a conclusion was right, and the system states this at every surface. The project's major limitations are that signing is fixture-grade and that device validation and a spatial-comprehension user study are pending; no correctness or compliance claim is made. Capstone II will pursue device validation, a controlled user study for the spatial interface, and the production signing and governance path.

# Introduction

AI-assisted decision-making is moving from novelty to infrastructure. Systems built on large language models now draft credit memos, triage documents, size positions, and recommend actions that a person then signs off on. As these systems take on higher-stakes work, a gap becomes visible: the answer an AI produces is not the same thing as *evidence of how it was produced*, and the two are routinely conflated.

An ordinary application log records that something happened, but it is platform-specific, mutable, and not designed for an outside party to check. A model's own explanation of its reasoning is a generated narrative, not a record — it can be fluent and still be unfaithful to what the system actually did. Neither gives a downstream reviewer — an auditor, a compliance officer, a counterparty — a portable artifact they can inspect independently and, crucially, detect tampering in.

This report describes **Shadow**, an independent evidence and decision-audit layer for AI systems. Shadow's research and engineering objective is narrow and deliberate: produce a **portable evidence record** for an AI-assisted workflow that an independent party can verify — the sequence of events, the sources referenced, the tool and model actions, the hash-chain continuity, the digital signature, and, if the record was altered, the *exact* point of failure and the downstream events it invalidates.

A principle runs through the entire system and through this report: **integrity is not correctness.** Cryptographic verification can establish that a supplied evidence record matches what was sealed. It cannot establish that the underlying source was truthful or that the analytical conclusion was right. Shadow keeps these separate on purpose, and this report is careful never to let one stand in for the other.

# Project Evolution

This capstone's current subject, Shadow, grew out of an earlier project, **Orallexa** — a multi-agent AI decision-support system in which several LLM "voices" (a bull, a bear, a judge, and a critic) debated a question and produced a recommendation. Orallexa worked, and building it surfaced the more important research problem.

The lesson from the multi-agent work was that producing *more opinions* is not the same as producing *trust*. A panel of AI voices can be persuasive and still leave a reviewer with no way to check what sources or actions actually underpinned the conclusion. The debate is an input to a decision; it is not evidence of one. Adding a fifth voice made the answer richer, not more verifiable.

Shadow is the refinement of that problem. It shifts the emphasis from generating answers to **recording verifiable evidence** of an AI-assisted workflow — events, sources, tool actions — in a form that is cryptographically sealed and independently checkable. The multi-agent analysis is retained as a *domain capability* — Shadow **includes a deterministic five-perspective fixture council for demonstration and testing**, where each perspective carries a persona prior that expresses **stance strength**, not model confidence or a probability that the conclusion is correct. That analysis layer is deliberately **not** the foundation of trust. Trust rests on the evidence layer beneath it, not on the persuasiveness of the voices above it.

This is a sharpening of the original research question, not an abandonment of it. Orallexa asked "how do we get a better AI answer?" Shadow asks "how do we let someone verify what the AI actually did?" — which is the harder and more durable problem.

# Problem Statement

The central problem this project addresses is:

> How can an AI-assisted workflow produce a **portable evidence record** that allows an independent party to verify the event sequence, the source references, the tool and model actions, the hash-chain continuity, and the digital signature — and, when the record has been altered, to identify the exact first failed sequence and the downstream events it affects — **without claiming that cryptographic verification proves analytical correctness**?

The final clause is not a caveat bolted on at the end. It is part of the problem. A system that lets integrity masquerade as correctness would be worse than no system, because it would manufacture confidence it has not earned. The design goal is verifiable integrity *with an explicit, defended boundary* around what that integrity does and does not prove.

# Objectives and Research Questions

The project's objectives are:

1. Represent an AI-assisted workflow as a canonical, deterministic sequence of structured events.
2. Link those events cryptographically (hash chain) and seal them with a digital signature.
3. Provide an independent verifier that can validate the record — including offline — and localize any tamper.
4. Support multiple domain profiles under one verification grammar.
5. Provide both a precise 2D audit surface and spatial (3D/XR) replay prototypes, without letting the spatial layer become required for verification.

These objectives are examined through four research questions.

- **RQ1 — Tamper localization.** Can Shadow detect the modification of an earlier AI-workflow event and identify the first failed sequence number?
- **RQ2 — Cross-surface verification.** Can the same evidence semantics be verified across command-line, browser, and spatial (Unity / Three.js) surfaces?
- **RQ3 — Separation of concerns.** Can source, claim, and workflow provenance be represented *without collapsing integrity, stance strength, and analytical correctness into a single status*?
- **RQ4 — Spatial comprehension.** Can a spatial replay interface improve a reviewer's understanding of provenance and tamper propagation while retaining a precise 2D fallback? **RQ4 is not yet user-studied**; the spatial surfaces exist as research prototypes over a host-tested scene contract, and the comprehension claim is a Capstone II research question, not a present result.

# Repository State and Audit Basis

This report describes the union of work across the main tree and two sibling worktrees, audited 2026-07-21:

| Branch | Commit | Adds |
|---|---|---|
| main base | `5106799` | core evidence layer, verifier, MCP, profiles, ingest audit |
| `feat/shadow-lens-explainers` | `19f52f0` | three self-contained explainers + current test suite |
| `research/unity-threejs-spatial-ux-v2` | `bb33196` | `shadow-3d-scene-v1` scene contract + host test, Three.js four-layout replay |

Because the two feature branches are not yet merged into the base — and diverge from each other — the project is described as their union with per-capability branch/commit attribution rather than as any single tip. This is also why an earlier draft's `1,824 / 1,827` count, taken from the base alone, is superseded here by a live re-run (§Evaluation).

# Background and Related Work

Shadow draws on several established areas.

**Cryptographic hash chains.** Linking records so that each entry commits to the previous one — so that altering an earlier entry invalidates everything after it — is the mechanism behind tamper-evident logs and Merkle-linked structures. Shadow uses a per-event hash chain sealed by a batch root, following the general construction described in cryptographic literature and standardized primitives (NIST FIPS 180-4 for SHA-256 [1]).

**Digital signatures.** Shadow signs the sealed record with Ed25519 (RFC 8032 [2]). A signature establishes that the holder of a private key attests to the sealed bytes; it does not establish anything about the truth of the content those bytes describe.

**Provenance and data lineage.** The idea that a result should carry a checkable record of the sources and transformations that produced it is long-standing in data-management and scientific-workflow research (e.g., the W3C PROV data model [3]). Shadow applies this to AI workflows specifically, where the "transformations" include model and tool actions.

**AI observability and model governance.** Recent industry tooling records agent traces and telemetry. Shadow is complementary rather than competing: it can ingest a third-party agent's trace **structurally** and *seal* it, but the **semantic** audit of ingested content is a separate, still-developing capability (§Third-Party and LLM Output Audit). Governance frameworks — U.S. supervisory guidance [6] and EU regulation [7–9] — are discussed with an explicit note on scope; citation presence does not imply that any regulation mandates Shadow.

**Claim–evidence structures.** Representing an assertion together with its supporting and contradicting evidence and its sources — rather than as free prose — is more inspectable than a narrative answer. Shadow implements a claim–evidence graph as a shared fact source.

**Spatial visualization and audit replay.** Immersive and spatial presentation of abstract structures is an active visualization research area; the open question, which this project treats honestly, is *whether* spatial presentation measurably helps for this task — a question RQ4 defers to a user study.

# System Requirements

**Functional requirements.** Shadow must: capture structured events; maintain a deterministic sequence; link events cryptographically; sign and seal the evidence; preserve source maps; verify evidence independently; show the exact tamper failure point; support multiple domain profiles; export a portable evidence bundle; and provide both 2D and spatial replay.

**Non-functional requirements.** Verification must be deterministic and offline-capable. Untrusted evidence must be handled safely (bounded parsing, no code execution, escaped rendering). The verifier must be bilingual (English and Simplified Chinese) with locale parity that never alters a hash, quote, signature, or verdict. Status must be communicated accessibly (never by color alone). The verifier and the self-contained explainers must have **no external runtime dependency**. Trust boundaries must be explicit.

# System Architecture

Shadow is organized into a core evidence layer, a set of domain profiles, and several interface surfaces of deliberately *different maturity*.

```
 ┌───────────────────────────────────────────────────────────────┐
 │                        SHADOW CORE                             │
 │  canonical evidence representation (spec/evidence-bundle.      │
 │  schema.json, v1: bundle_version, spec_version, header,        │
 │  events, batch_root, signatures)                              │
 │  signed hash-chain record → Ed25519 (spec/attestation.        │
 │  schema.json)  ·  source maps  ·  verifier                    │
 │  profile validation  ·  claim–evidence graph                  │
 │  ingested-output audit (structural tested; semantic pending)  │
 └───────────────┬───────────────────────────────┬───────────────┘
                 │                                │
        ┌────────┴────────┐            ┌──────────┴─────────┐
        │    PROFILES     │            │     INTERFACES     │
        │  banking-v1     │            │  CLI · MCP (11)    │
        │  data-science-v1│            │  HTTP · verify.html│
        │  coding-agent-v1│            │  Unity Shadow Lens │
        └─────────────────┘            │  Three.js replay   │
                                       │  Android mock APK  │
                                       │  HTML/SVG explainers│
                                       └────────────────────┘
```

*Figure 1. Shadow layered architecture — one core, three profiles, many surfaces of differing maturity.*

The interfaces are **not** of identical maturity, and the report does not present them as such. The CLI, MCP server (11 tools), HTTP endpoints, and the browser verifier (`verify.html`) are **host-tested** and, for the verifier, **browser-rendered** and **browser-recorded**. The shared **`shadow-3d-scene-v1`** scene contract is **authored and host-tested** (its contract test is green), with Unity production integration still pending. The Unity Shadow Lens is **unity-authored** with an **Android-built** mock APK; its on-device behavior is **device-validation-pending** (Beam Pro). The Three.js spatial replay is a **browser-rendered** research prototype. The self-contained explainers are **host-tested** deterministic HTML/SVG.

![**Figure 2.** Evidence-lifecycle explainer (audit-chain) — source → action → event → hash chain → signature → independent verification. Real self-contained HTML/SVG poster; host-tested and browser-rendered (`feat/shadow-lens-explainers @ 19f52f0`).](../figures-v2/v2-explainer-audit-chain.png)

# Evidence and Trust Model

Shadow separates concerns that are frequently — and dangerously — merged:

- **Record integrity** — the bytes verify against the sealed record.
- **Hash-chain continuity** — each event commits to the previous one; the chain is unbroken.
- **Digital signature** — the sealed batch root is signed with a known key.
- **Profile validation** — the evidence conforms to a domain profile's schema.
- **Source resolution** — cited sources resolve to referenced material.
- **External anchor** — optional third-party timestamp/inclusion (not required for the base guarantee).
- **Analytical correctness** — whether the conclusion is *right*. **Shadow does not establish this.**

Stated prominently, because it is the load-bearing claim of the whole project:

> **Cryptographic verification can establish that the supplied evidence matches the sealed record. It does not establish that the underlying source was truthful or that the analytical conclusion was correct.**

**Signing status is also kept honest.** The current release uses **fixture signing**, not production signing. The verifier's "Verify the Verifier" view reports either `ASSETS MATCH SIGNED MANIFEST` or `INDEPENDENT COMPARISON NOT PERFORMED` — a page hashing *itself* is explicitly **not** presented as trust. Independent trust requires comparing the page's asset hashes against a signed release manifest obtained through a separate channel and comparing the release-key fingerprint out of band. **No production signing key exists in this project**, and none was generated for it.

# Claim–Evidence Graph

Rather than emit a prose answer, Shadow can represent a conclusion as a structured graph (`lib/claim-evidence-graph.mjs`): each **claim** carries its **supporting evidence**, any **contradictory evidence**, its **source references**, and a **graph hash**; the structure also surfaces **unsupported claims** and **unresolved sources**.

This is more inspectable than prose because the gaps are explicit — a reviewer can see *which* claims lack support and *which* sources did not resolve, rather than having to trust a fluent paragraph. It does **not** prove truth. A well-formed graph with resolvable sources can still rest on a false source; the graph makes that checkable, not impossible. This capability is **host-tested** (main @ `5106799`).

# Third-Party and LLM Output Audit

Shadow defines an ingestion boundary for output produced by a third-party agent or LLM, with a status model: `ACCEPTED`, `ACCEPTED_WITH_WARNINGS`, `QUARANTINED`, `REJECTED`, `NOT_AUDITED`. The boundary applies schema validation, attempts source/citation resolution, flags unsupported claims, and looks for prompt-injection indicators before an ingest decision.

The honest status, kept precise: the **structural ingest audit** — sealing a third party's trace so its integrity is checkable — is **host-tested**. The **semantic** audit of ingested content is **source-authored**, and its **production evaluation is pending** — this is a *production*-pending capability, **not** a device-pending one. This is **not** a complete AI-safety solution and is not presented as one; it is an ingestion-boundary design with a partial, tested structural implementation and a defined semantic layer still under development.

# User Experiences

## Browser verifier (host-tested · browser-rendered · browser-recorded)

The browser verifier (`verify.html`) offers two modes — **Verify Evidence** and **Verify the Verifier** — in **English and Simplified Chinese**. On a valid bundle it reports the independent statuses; on a tampered bundle it localizes the failure. It carries a signed fixture manifest, enforces a Content-Security-Policy with **zero external runtime requests**, and verifies evidence offline. Its current limitation is stated plainly: the signing is **fixture**, not production.

Real rendered validation (Playwright, Chromium 149.0.7827.55, viewports 1440×900 / 1280×720 / 390×844) passed the interactive flows in both locales, with locale parity confirmed (hashes, IDs, quotes, and sequence numbers unchanged by language) and CSP/network checks passing with no external requests.

![**Figure 3.** Browser verifier — valid evidence (English). Independent statuses report clean. Browser-rendered / browser-recorded; fixture-signed (main @ `5106799`).](../figures-v2/v2-verify-valid-en.png)

![**Figure 4.** Browser verifier — tampered evidence (English). The verifier localizes the first failed sequence and flags downstream-affected events. Browser-rendered; fixture-signed.](../figures-v2/v2-verify-tampered-en.png)

![**Figure 5.** Verify-the-Verifier — assets-match-signed-manifest state (English, fixture-signed). A page hashing itself is not presented as trust; the page reports "independent comparison not performed" until an out-of-band manifest and key fingerprint are compared.](../figures-v2/v2-verifier-valid-en.png)

![**Figure 6.** Bilingual parity — valid evidence rendered in Simplified Chinese; hashes, IDs, quotes, and sequence numbers are unchanged by locale.](../figures-v2/v2-verify-valid-zh.png)

## Unity Shadow Lens (unity-authored · Android-built · device-validation-pending)

The Unity Shadow Lens (Unity **6000.0.23f1**) presents three domain workspaces — Banking, Data Science, and Coding Agent — with a provenance audit arc, source highlighting, and explicit Verify / Tamper / Reset actions. Interaction uses **head-directed focus** via an XR gaze-interactor abstraction — hover and highlight only. This is **not eye tracking**, there is no RGB capture, and there is no dwell-based approval; selection and approval are kept explicitly separate. An Android **mock** APK is built (§Evaluation).

Honest status: the Shadow Lens is **unity-authored**; the shared **`shadow-3d-scene-v1`** scene contract it targets is **authored and host-tested**, but Unity production integration and **Beam Pro device validation are pending.** No XREAL native integration or 6DoF is claimed on the mock build.

## Three.js spatial replay (browser-rendered · research prototype)

A browser-accessible Three.js prototype explores four layouts for spatial replay — an audit **arc**, a layered **DAG**, a **timeline**, and a **hybrid 2D/3D** view — over the shared 3D scene contract, with focus-plus-context navigation and a **2D fallback**. It is **browser-rendered** and **browser-recorded**; there is **no user study yet**, so no comprehension benefit is claimed (RQ4).

![**Figure 7.** Three.js spatial replay — audit-arc layout of a banking loan-file workflow, all events verified. Browser-rendered research prototype over the host-tested `shadow-3d-scene-v1` contract (`research/unity-threejs-spatial-ux-v2 @ bb33196`).](../figures-v2/v2-3d-current-arc.png)

## Self-contained explainers (host-tested)

Deterministic HTML/SVG audit-chain, reason-code, and persona-deliberation animations, bilingual, honoring reduced-motion preferences, with **no third-party runtime dependency**. Their didactic message is the project's thesis in miniature: **integrity does not equal correctness.**

# Implementation

Shadow's core is implemented in **Node.js / JavaScript** with **JSON Schema** validation; the cryptography uses **Ed25519** (RFC 8032) for signatures and **SHA-256** (FIPS 180-4) for the hash chain, over a **canonical serialization** so that the same logical record always hashes identically. The browser verifier uses **WebCrypto** and runs offline under a strict CSP. The spatial surfaces use **Unity 6 / C#** (Shadow Lens) and **Three.js** (web replay) over a shared, host-tested scene contract. Browser acceptance is driven by **Playwright**; the Android mock is built through the Unity **Android / Gradle / IL2CPP** pipeline. Integration surfaces include an **MCP** server exposing 11 tools. The explainers are plain **HTML / SVG / CSS**.

Code snippets are used sparingly in this report; data-flow and architecture diagrams carry the design, and the repository is the implementation source of truth.

# Evaluation

## Host tests

A live re-run of the host test suite on the current work (`feat/shadow-lens-explainers @ 19f52f0`) on 2026-07-21 gives **1,858 of 1,861 tests passing, 0 failing, 3 skipped**. The three skips are environment-gated (a Mistral OCR key and other live-network / OpenSSL gates), not disabled coverage. *An earlier draft reported 1,824 / 1,827 from the base commit alone; that figure is superseded by this re-run and is not used elsewhere in this report.* A drift guard enforces that README, `llms.txt`, `index.html`, and presentation copy agree with the canonical fact source.

## Browser acceptance

Validated in real Chromium 149.0.7827.55 (Playwright), English and Simplified Chinese, across the interactive flows: valid evidence, tampered evidence, Verify-the-Verifier valid, Verify-the-Verifier mismatch, and their locale pairs. Signed assets carried stable content hashes. CSP and network checks passed with **0 external requests and 0 violations**; no console errors; responsive at three viewports; evidence verification worked offline.

## Android build

An Android mock APK is **built** (not device-validated): `mock-stable-5168b07.apk`, **24,442,084 bytes**, SHA-256 `93f2a81aa5f965aec540526abe621b152c7507c03c0fea51d381094bd548d0b8`, produced by Unity 6000.0.23f1. This is a **built** artifact used as the demo baseline; it is **not** called device-validated, and Beam Pro / XREAL on-device behavior remains pending.

## Scene contract and Three.js prototype

The shared **`shadow-3d-scene-v1`** contract (`schemas/shadow-3d-scene-v1.schema.json`) is exercised by a green host test (`test/shadow-3d-scene-contract.test.js`, `research/unity-threejs-spatial-ux-v2 @ bb33196`) — **authored and host-tested**. Over it, the Three.js prototype renders four layouts with deterministic fixture semantics; screenshots and recordings were generated (browser-rendered / browser-recorded). **No user study** has been conducted.

## Unity tests

Unity test status is reported only from actual test-run evidence. Authored Unity test scripts exist under the Shadow Lens project; where a test was *executed*, it is labeled unity-tested, and where it is authored but not yet executed on-device it remains unity-authored / device-pending. This report does **not** aggregate authored tests into a passing count.

## Tamper case study

A step-by-step pristine-versus-tampered example (deterministic fixture), and the strongest joint demonstration of RQ1 and RQ3:

1. **Pristine.** A sealed bundle of *N* events (`bundle_version 1`), each committing to the previous via the hash chain, with a signed `batch_root`. All independent statuses report clean.
2. **Modify.** One earlier event's payload is altered — in the worked example, sequence 3 (the Council-claims node).
3. **First failure.** Verification walks the chain and reports the **first failed sequence** — the earliest event whose recomputed hash no longer matches what the next event committed to.
4. **Downstream impact.** Every event after the first failure (4, 5, 6) is flagged **NOT VERIFIED**, because the signature covered a chain that no longer exists — stronger than "one bad event."
5. **Independent statuses hold.** Even in failure, integrity, signature validity, and *analytical correctness* remain **separate** statuses — the panel reports "Analytical correctness: NOT EVALUATED," asserting nothing about whether the original conclusion was right.

![**Figure 8.** Exact tamper localization (real render). Sequence 3 is TAMPERED; downstream events 4, 5, 6 are NOT VERIFIED; the verification panel holds "Analytical correctness: NOT EVALUATED." Browser-rendered research prototype (`research/unity-threejs-spatial-ux-v2 @ bb33196`). This is the centerpiece of the practice presentation.](../figures-v2/v2-3d-tamper-propagation.png)

# Results

The project has demonstrated: deterministic evidence generation from a canonical schema; independent verification (CLI, MCP, HTTP, and offline browser); exact tamper localization to the first failed sequence with downstream-impact propagation; multi-profile evidence semantics under one verification grammar (banking-v1, data-science-v1, coding-agent-v1); a bilingual verifier with locale parity; an authored-and-host-tested shared 3D scene contract; spatial-replay prototypes (Unity Shadow Lens + Three.js four layouts); three host-tested explainers; and a working Android mock build pipeline.

The project does **not** claim: production deployment; legal or regulatory compliance; analytical correctness; Beam Pro validation; full XREAL native integration; or real banking-approval automation.

# Limitations

Stated directly:

- Evidence is **fixture data**; live-provider validation is limited.
- **Production signing is not implemented**; the current manifest is fixture-signed. No production signing key exists.
- **Device validation is pending** (Beam Pro); **XREAL SDK / native APIs** are not integrated.
- **No completed user study** — the spatial-comprehension benefit (RQ4) is unproven.
- **No proof of source truth** and **no proof of analytical correctness** — by design, integrity ≠ correctness.
- The **semantic ingest audit** is production-evaluation-pending (structural side is host-tested).
- **No production KMS/HSM**, no key rotation, no durable production storage.
- **No full PII-retention framework** and **no production incident-response process.**

# Future Work

**Capstone II.** Beam Pro / XREAL device validation; Unity integration of the shared `shadow-3d-scene-v1` contract; Audit Arc V2; an OCR-to-source-map pipeline; real device-performance measurement; a user study for RQ4; production evaluation of the semantic ingest audit; and evaluation on real sanitized datasets.

**Production path.** Production release signing; KMS/HSM; key rotation; durable storage; PII governance; a software bill of materials (SBOM); reproducible builds; and an incident-response process.

**Research path.** Spatial-versus-flat audit comprehension (the RQ4 study); trust calibration; provenance replay; uncertainty and abstention UX; and multilingual verification semantics.

# Conclusion

Shadow's contribution is a shift in what an AI system asks of the person on the other side of a decision. Instead of asking an auditor to *trust the AI's answer*, Shadow gives them a **portable evidence record they can independently inspect and verify** — its sequence, its sources, its signature, and, if it was tampered with, the exact point where the record breaks and everything the break invalidates. The system draws a firm line around what that verification proves: it establishes integrity, not correctness, and it says so at every surface. That discipline — verifiable evidence with an honest boundary — is the capstone's core result, and it is the foundation the Capstone II work builds on.

# Appendices {.unnumbered}

**Appendix A — Implementation status matrix.** See `CURRENT_PROJECT_TRUTH_V2.md` (every claim → status, path, branch@commit, evidence, V1-stale flag).

**Appendix B — Test inventory.** 1,858 / 1,861 host tests passing (3 environment-gated skips, 0 failing), live re-run on `feat/shadow-lens-explainers @ 19f52f0`, 2026-07-21.

**Appendix C — Key schemas.** `spec/evidence-bundle.schema.json` (v1: bundle_version, spec_version, header, events, batch_root, signatures); `spec/attestation.schema.json`; `schemas/shadow-3d-scene-v1.schema.json`.

**Appendix D — Build information.** Frozen mock APK `mock-stable-5168b07.apk`, 24,442,084 bytes, SHA-256 `93f2a81aa5f965aec540526abe621b152c7507c03c0fea51d381094bd548d0b8`, Unity 6000.0.23f1.

**Appendix E — Audit basis.** Working tree + sibling worktrees `feat/shadow-lens-explainers @ 19f52f0` and `research/unity-threejs-spatial-ux-v2 @ bb33196`, main base `5106799`; audit performed 2026-07-21.

# References {.unnumbered}

Primary and official sources. Web documentation accessed 2026-07-21. Citation presence does not imply compliance or that any regulation mandates the system.

[1] NIST, *FIPS PUB 180-4: Secure Hash Standard (SHS)* (SHA-256), National Institute of Standards and Technology.

[2] S. Josefsson and I. Liusvaara, *RFC 8032: Edwards-Curve Digital Signature Algorithm (EdDSA)* (Ed25519), IETF.

[3] W3C, *PROV-DM: The PROV Data Model*, World Wide Web Consortium Recommendation.

[4] W3C, *Web Cryptography API*, World Wide Web Consortium.

[5] W3C, *Content Security Policy Level 3*, World Wide Web Consortium.

[6] Board of Governors of the Federal Reserve System, *SR 26-2: Revised Guidance on Model Risk Management* (superseding SR 11-7; retained as a legacy alias for historical reference only). SR 26-2, like SR 11-7, currently scopes generative/agentic AI **out** of its model-risk guidance pending a future study; Shadow positions as an independent evidence layer filling that gap and does not claim any regulation already mandates it.

[7] European Union, *Regulation (EU) 2024/1689 (EU AI Act), Article 14 — Human oversight of high-risk AI.*

[8] European Union, *General Data Protection Regulation (GDPR), Article 22 — Automated individual decision-making.*

[9] Court of Justice of the European Union, *Case C-634/21 (SCHUFA) — automated credit-scoring interpretation.*

[10] Consumer Financial Protection Bureau, *Circular 2026-03 — adverse-action reason-code specificity* (AA01–AA06 mapping); Regulation B / ECOA (12 CFR 1002).

[11] Unity Technologies, *Unity 6 (6000.0.23f1) documentation.*

[12] Three.js, *Three.js documentation*, threejs.org.

[13] Playwright, *Playwright browser automation* (used for acceptance testing).

[14] Model Context Protocol, *MCP specification and roadmap*, modelcontextprotocol.io.

[15] Orallexa (project ancestor) — the earlier multi-agent AI decision-support concept from which the current evidence-and-audit direction was refined.
