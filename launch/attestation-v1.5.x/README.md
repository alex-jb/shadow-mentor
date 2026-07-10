# Launch package — Shadow v1.5.x attestation burst

Drafts for distributing the v1.5.0 → v1.5.5 attestation story shipped over 2026-07-03 → 2026-07-04. Six releases, one thesis: **banks need three verifier surfaces to actually operationalize AI attestation — CLI, chat, and HTTP — plus a repeatable acceptance test.**

## What shipped

| Release | Ship | Real-world unlock |
|---|---|---|
| v1.5.0 | Public verifier CLI (`bin/verify-attestation.mjs`) | Auditor on laptop can verify offline |
| v1.5.1 | 7th MCP tool (`shadow_verify_attestation`) | Auditor inside Cursor / Claude Desktop can verify from chat |
| v1.5.2 | HTTP endpoint (`POST /api/verify-attestation`) | SIEM pipeline can curl-verify |
| v1.5.3 | Drop-in bank CI recipe (`examples/verify-in-ci/`) | 2 GitHub secrets, done |
| v1.5.4 | Keypair bootstrap CLI (`bin/generate-attestation-keypair.mjs`) | Deploy in 30 seconds, correct file modes by default |
| v1.5.5 | Acceptance demo (`npm run demo:attestation`) | Whole chain proves itself end-to-end in ~250ms |

All backed by Ed25519 (RFC 8032) asymmetric signing shipped in v1.4.0. Bank holds only the public key; cannot forge, only verify. Test surface 493 → 543 across the burst. Zero regressions.

## Draft channels

| Channel | Draft | Priority | Estimated cost |
|---|---|---|---|
| Hacker News (Show HN) | `hn-show.md` | ⭐⭐⭐⭐⭐ | 15 min post + comment monitoring |
| X thread | `x-thread.md` | ⭐⭐⭐⭐⭐ | 5 min post + engagement |
| dev.to article | `devto.md` | ⭐⭐⭐⭐ | 30 min post + comment monitoring |
| LinkedIn (compliance officers) | `linkedin.md` | ⭐⭐⭐ | 5 min post |
| awesome-mcp-servers PR update | `awesome-mcp-pr.md` | ⭐⭐⭐ | 10 min PR |

## Positioning discipline

- Always cite SR 26-2 (footnote 3 delegation), NOT SR 11-7 (rescinded 2026-04-17)
- Always cite GDPR Art. 22 + Schufa for EU, NOT EU AI Act (credit-scoring deferred to 2027-12-02)
- Lead with "Anthropic ships agents, Shadow governs them" when comparing to Anthropic FS
- FICO<700 is a hard block per Lora Levitchi's 2026-06-19 binding decision — never soften this in copy
- Ed25519 posture explained as "who signs" vs "who verifies" separation — most concrete framing for procurement audiences

## Do not

- Do not claim SOC 2 Type 1 formal certification — we ship the readiness checklist (`docs/soc2-readiness.md`), not a signed audit
- Do not oversell CNFinBench score — harness scaffolded, dataset run pending
- Do not overpromise MCP tool count — 7 tools as of v1.5.1, do not round to 10
