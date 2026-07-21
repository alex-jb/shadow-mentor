---
title: "Shadow"
subtitle: "A Cryptographically Verifiable Evidence and Spatial Audit System for AI-Assisted Decisions"
author: "Alex Ji · M.S. Computer Science · Yeshiva University"
date: "Capstone in Computer Science I — Practice Presentation · 2026-07-21"
---

# Shadow

**A Cryptographically Verifiable Evidence and Spatial Audit System for AI-Assisted Decisions**

*From Multi-Agent Answers to Independently Verifiable AI Decision Evidence*

Alex Ji · M.S. Computer Science · Yeshiva University
Capstone in Computer Science I — practice presentation

# The problem

An **AI answer** is not the same thing as **verifiable evidence**.

The gap, concretely:

- **Source provenance** — what did it actually rely on?
- **Tool / model actions** — what did it actually do?
- **Tamper detection** — was the record changed after the fact?
- **Independent verification** — can *someone else* check it, offline?

Ordinary logs are platform-specific and mutable. A model's explanation is generated prose, not a record.

# Project evolution

**Orallexa** → multi-agent decision support → **Shadow** → portable, verifiable evidence.

- Orallexa: several AI voices debated an answer. It worked.
- The lesson: *more opinions is not more trust.*
- Shadow keeps the analysis as a domain capability — but trust rests on the **evidence layer beneath it**, not on the voices above it.

A refinement of the research question, not a failure of the first one.

# What Shadow records

The evidence lifecycle:

**Source → Agent / Tool Action → Evidence Event → Hash Chain → Signature → Independent Verification**

- Every event is structured and canonically serialized.
- Each event commits to the previous one (hash chain).
- The sealed batch root is signed (Ed25519).
- Anyone can verify the record — including offline.

# Architecture

**Core** — canonical evidence schema · signed hash-chain record · source maps · verifier · claim–evidence graph

**Profiles** — banking-v1 · data-science-v1 · coding-agent-v1

**Interfaces** — CLI · MCP (11 tools) · HTTP · browser `verify.html` · Unity Shadow Lens · Three.js replay

*Interfaces are of different maturity — the deck says which is which.*

# Three profiles, one grammar

| Profile | Source → action → check |
|---|---|
| **Banking** | document → risk claim → source |
| **Data Science** | dataset → model → metric |
| **Coding Agent** | issue → diff → tests → commit |

Same verification grammar underneath: sequence, hash chain, signature, source resolution.

# Tamper demonstration  ⟵ the key moment

Pristine → change one earlier event → **first failure** → downstream impact.

- The verifier reports the **exact first failed sequence** — the earliest event whose hash no longer matches.
- **Everything after it is invalidated** — the signature covered a chain that no longer exists.
- Integrity, signature, and *correctness* stay **separate** statuses, even in failure.

*This is the strongest thing to show live.*

# Verify the Verifier

Can you trust the verifier page itself?

- It carries a **signed fixture manifest**: `ASSETS MATCH SIGNED MANIFEST`.
- Independent trust needs an **out-of-band** check: asset hashes vs. a manifest from a separate channel, and the release-key **fingerprint** compared independently — reported as `INDEPENDENT COMPARISON NOT PERFORMED`.
- **A page hashing itself is not trust** — and Shadow says so, on the page.

*Current signing is fixture, not production.*

# The spatial experience

Unity **Shadow Lens** + Three.js replay — 3D is for **sequence, provenance, and tamper replay**.

- Three workspaces; provenance audit arc; Verify / Tamper / Reset.
- **Head-directed focus** (gaze interactor) — hover only. *Not eye tracking. No RGB. No 6DoF on the mock.*
- Android **mock APK is built** (24.4 MB, hashed). **Beam Pro / XREAL device validation is pending.**
- A precise **2D fallback** always remains.

# Evaluation

- **1,824 / 1,827 host tests pass** (0 fail, 3 env-gated skips), re-run 2026-07-21.
- **Browser acceptance**: Chromium 149 (Playwright), EN + 简体中文, 8 flows, CSP **0 external / 0 violations**, offline verify — real screenshots.
- **Android**: mock APK **built** (24,442,084 B, SHA-256 `93f2a81a…`). *Built, not device-validated.*
- Three.js: 4 layouts rendered + recorded. **No user study yet.**

# Where it stands

| Implemented now | Pending next (Capstone II) |
|---|---|
| Deterministic evidence + hash chain | Beam Pro / XREAL device validation |
| Independent + offline verification | Shared Unity/Three.js scene contract |
| Exact tamper localization | User study (does 3D actually help?) |
| Bilingual verifier (EN / zh-CN) | Semantic audit of ingested output |
| Android mock build | Production signing · KMS/HSM |

Fixture-signed · device-pending · no correctness claim — stated honestly.

# Contribution

Shadow does **not** ask the auditor to trust the AI's answer.

**It gives the auditor evidence that can be independently verified** — the sequence, the sources, the signature, and, if it was tampered with, the exact point where the record breaks.

And it draws a firm line: **integrity, not correctness.**

*Thank you — questions welcome.*
