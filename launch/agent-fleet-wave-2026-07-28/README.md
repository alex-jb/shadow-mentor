# Launch package — governed-agents wave (2026-07-28)

Supersedes `launch/attestation-v1.5.x/` for firing purposes (that package's
numbers — 7 tools / 543 tests / v1.5.x — are 23 days stale; keep it as history).

## Why now

Three ops-governance products blew up in one half-year — Microsoft Agent
Governance Toolkit (2026-04), Paperclip (~75K★ in 5 months), Block's Buzz
(~15K★) — and none of them does cryptographic, externally-verifiable,
regulation-mapped attestation. They are creating the audience that needs us.
The wedge decays as they add signing natively. Fire this week.

## Ground truth (verify against release-state.json before firing)

- repo v2.2.0 · npm shadow-attest-core 2.1.0 live · **2253/2256 tests, 0 fail**
- **11 MCP tools** · Ed25519 + batch signing + hash-chain + dictionary_hash
- CITATION_MAP: every persona rule → regulatory citation → test file (machine-readable JSON/CSV)
- 9 skills on skills.sh (cross-agent: Claude Code, Codex, Cursor, Copilot…)

## Positioning rules (unchanged, binding)

- "SR 26-2 Tier 3 companion" — always quote-scoped, never "compliant"
- EU: "GDPR Art. 22 + Schufa C-634/21", never "AI Act ready"
- Honest Microsoft-overlap answer (see hn-show Q&A) — never dodge it
- Never claim production readiness, device validation, or WCAG certification
- FICO<700 hard block is policy, never soften

## Fire order

1. `x-thread.md` — any weekday, morning NY
2. `hn-show.md` — Tue–Thu 8-10am NY (not same day as X if X pops)
3. Existing dev.to/linkedin from v1.5.x package: refresh numbers per this
   README before firing, or skip — the thread + HN carry the wave.
