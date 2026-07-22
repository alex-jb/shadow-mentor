# Deep-audit report — source + provenance

**Only ONE report exists, not two.** The two uploaded PDFs (`~/Downloads/shadow-mentor 深度分析报告.pdf`
and `… (1).pdf`) are **byte-identical** (sha256 `922aef52…`) — the same Kimi.ai-generated report downloaded
twice. All reconciliation below is against that single report.

- **Report subject:** `shadow-mentor` **main @ 57e175c**, dated 2026-07-20 → 2026-07-23.
- **Current tree:** `feat/shadow-spatial-ux-asset-audit-v11 @ 34fe8aa` — substantially newer (V10 → security
  envelope v2 @ 9f889dd → V11). So several findings needed re-verification against the current code.
- Report method: full repo read + test-suite run + CLI verify + browser render screenshots + XR/crypto file
  review. It is largely accurate and fair (it confirms the honesty/engineering discipline and flags real
  demo/render/version defects).

## Report's headline structure
- §1 "what it is / how good": honest engineering, but demo-layer + render-perf + metadata-version defects.
- §2 architecture + code quality: **P0-1 attest metadata version drift**; P1 npm lag; P1 demo fragmentation;
  P1 CORS `*`.
- §3 UI: verify.html excellent; replay 2D good; Audit Room design-principled but flat-mode framing + tiny
  labels; xreal.html Ambient Council layout defects; spatial-finance honest.
- §4 XR: architecture correct; **P0-2 per-frame alloc**; **P0-3 no-instancing / hit-proxy**; **P0-4 SBS
  squeeze not device-confirmed**; **P1-5 untrusted innerHTML**; CJK path uncovered.
- §5 security/crypto: sound primitives; anchors.js hand-rolled ASN.1 wants fuzz + allowlist; SELF_SIGNED
  disclosure wording.
- §6 research tracks; §7 ranked优化清单 (P0×4, P1×5, P2×6).

See `CURRENT_TREE_FINDING_MATRIX.{csv,md}` for every finding × classification × action.
