# Shadow — a general AI-agent evidence platform

**Shadow is a cryptographic flight recorder and evidence layer for AI agents. Banking is its
flagship regulated-decision profile.**

Banking is the flagship vertical, **not** the core product boundary. The core is generic; each
vertical is a versioned profile on top of it.

## Architecture

```
Shadow Core (generic, profile-agnostic)
  · evidence events (prompt / tool_call / tool_result / model_output / human_approval)
  · signing + hash chaining (Ed25519 + SHA-256)  · source maps (content items)
  · tool / model / human provenance              · verification · anchoring · replay
  · the un-hallucinable-citation gate (a claim may only cite source_ids that exist)

Profiles (versioned extensions, isolated from each other)
  · banking-v1        — regulated lending decision (document scan + OCR geometry + reg mapping)
  · data-science-v1   — experiment replay (dataset → metrics → calibration → model selection)
  · coding-agent-v1   — coding session replay (issue → files/commands/diffs → tests → commit)

Experiences (renderers over the SAME contract)
  · CLI / MCP / HTTP   · Web   · Unity / XR   · Flow
```

## What is generic vs profile-specific

The base contract (`validateBaseSession`) mandates **no** banking — or even document-scan —
fields. `capture`, XR `device`, OCR `bounding_box_normalized`, and per-item `confidence` are all
**optional**, validated only when present. A "source" is any `{source_id, text|content}` item;
the citation gate (claims may only cite source_ids that exist) applies to **every** profile.

Banking-only fields live in the `banking-v1` profile (the unchanged strict document validator).
`data-science-v1` and `coding-agent-v1` add their own required extension under `profile.data`,
validated in isolation — banking rules never run against them, and vice-versa.

## Every profile earns the same guarantees

All three profiles:
- create a **real** signed attest-core evidence bundle,
- **pass the same generic verifier** (`verifyBundle`),
- **fail at the exact sequence** after tampering,
- **export to Flow**, and
- **render through the shared Unity contract** (Trust Bar + Audit Mode).

Metrics/results are bound to artifacts: a `data-science-v1` `eval_metric` must cite a `source_id`
in the map; a `coding-agent-v1` `test_results`/`security_lint` must cite the command's recorded
output. This is the same "coordinates come from the source, never the model" principle the
banking profile uses for OCR geometry.

## Fixtures

Reproducible, signed, non-banking fixtures live in `fixtures/profile-fixtures.mjs`
(`dataScienceSpec`, `codingAgentSpec`) with static session snapshots
(`*.session.json`). Tests in `test/shadow-profiles.test.js` prove the de-coupling.
