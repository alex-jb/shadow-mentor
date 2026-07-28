# Shadow Lens — Architecture Decision Record

**Status:** accepted 2026-07-20 · **Branch:** `feat/shadow-lens-native`

## Decision

Shadow Lens is **one integrated product** — Look → Capture → Understand → Analyze →
Cite → Visualize → Verify — assembled from existing Shadow components plus native
capture. It is not another disconnected demo.

## Boundaries

- **Shadow Core stays device-neutral.** `packages/attest-core` (Ed25519 + SHA-256 chain +
  RFC3161/Rekor anchoring), the Banking Evidence Profile, `document-source-map`, and the
  reason-code governance are the evidence + verification layer under *every* path. No
  renderer forks or copies verification logic.
- **Unity + XREAL SDK 3.1 is the authoritative One Pro + Eye client.** It is the only path
  that can access the Eye RGB camera (native), so **all real document capture + OCR +
  scanning happens here**. 6DoF + Eye RGB are the two capabilities One Pro exposes; no
  planes/anchors/hands/depth (see `docs/m5-xr/unity-webxr-scan-plan.md`).
- **Quest is the authoritative WebXR device.** The Audit Room / Risk / Council run there
  in real 6DoF. **WebXR is never used for XREAL Eye capture** — One Pro is not a WebXR
  runtime, and neither Quest nor XREAL exposes camera frames to a web page.
- **Flow is an optional renderer** of the same real session — a third-party spatial
  storytelling layer, not part of the trust core.
- **One versioned session contract** (`apps/shadow-lens/contracts/shadow-lens-session.
  schema.json`) is what every renderer consumes, so Unity, Quest/WebXR, Flow, and the
  audience mirror all show the *same* signed session.

## Non-negotiable invariants

1. The analysis model **never authors geometry** — only the OCR layer writes source_map
   bounding boxes; a claim may only cite `source_id`s that exist (`resolveClaims()` gate).
2. **Server-side signing only** — no private key in Unity/web assets; clients emit
   unsigned events, the server seals.
3. The contract is a **sidecar** — it never modifies the frozen Evidence Bundle wire
   format or Banking Profile.
4. **Separate verification statuses** (record integrity / anchor / source coverage /
   analysis confidence / human review / freshness) — never one green "VERIFIED" badge.
5. A verified record proves **integrity, not analysis correctness**. Tamper-EVIDENT
   (reveals tampering), not a prevention claim.

## Consequences

- Hardware-blocked items (Unity build on One Pro+Eye, Quest validation, Flow Push creds)
  are built to installable/testable artifacts + a device procedure, and only that
  device-specific validation is marked pending — all other software proceeds.
- Existing demos keep working; Shadow Lens is the integrated entry point going forward.
