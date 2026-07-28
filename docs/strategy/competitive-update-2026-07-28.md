# Competitive landscape update — 2026-07-28

Three independent signals in one week confirm the July thesis (see
`shadow-reposition-2026-07-16.md` + the 2026-07-17 Microsoft Agent Governance
Toolkit finding): **operations-layer agent governance is commoditizing fast,
and none of the commoditizers touch regulatory mapping or cryptographic
verifiability.** Shadow's moat is unchanged — bank vertical + Ed25519/hash-chain
attestation + CITATION_MAP — and each new entrant widens the audience that
needs it.

## New rows

| Entrant | What it is | Governance it HAS | Governance it LACKS | Relation to Shadow |
|---|---|---|---|---|
| **Paperclip** (paperclipai/paperclip, MIT, ~75K★ in 5 months, pseudonymous founder) | "AI company OS": org charts of agents, budgets with hard-stop, human approval queues for hires/spend, kanban, 24/7 heartbeats. Skills distributed via skills.sh at ~1.4M installs. | Process governance: RBAC, approval gates, budget caps, append-only audit log with tool-call tracing. | **No signing, no attestation, no hash chain, no external verifiability** (its "immutable" log is a DB property a DB admin can rewrite undetectably), no regulatory mapping, no persona deliberation. | **Adjacent + integration wedge.** Its 75K-star audience runs agent fleets with compliance anxiety. Wedge line: **"Paperclip logs it. Shadow proves it."** — sign / verify-chain its audit log entries. Watch: if Paperclip Labs adds native signing, the generic layer is absorbed; the bank vertical + citation map is the durable defense. |
| **Buzz** (block/buzz, Apache-2.0, ~15K★, Block/Jack Dorsey) | Self-hosted "agents are members, not bots" workspace on Nostr relays: every message / workflow / git event is a **signed event** in one unified log; agents hold their own keypairs. | Cryptographic event signing at the transport/workspace layer; per-agent identity. | Approval gates still being wired; **no compliance/regulatory layer, no deliberation, no decision-level attestation semantics** (it signs *that* an event happened, not *that a regulated decision followed policy*). | **Market evidence, not competitor.** Block independently shipping "every agent action is a signed, auditable event" validates Shadow's thesis at 15K stars. Positioning line: "Block signs agent actions in chat; Shadow attests agent decisions in banking." Long-term: a possible Council distribution surface (agents-as-members fits a 5-voice council better than Slack's bot model). |
| **pub-local-jarvis** (LYiHub / 林亦LYi, MIT code, 4 days → 133★) | Local always-on perception agent (continuous ~1 fps screen + audio into on-device MiniCPM-o 4.5, full-duplex LISTEN/SPEAK loop). Consumer/game-companion vertical. | Honest-limits README; local-first privacy posture; evidence-gated state transitions (Steam foreground = "hard evidence"). | Everything governance — it's a perception demo, not a governance product. | **Pattern donor, not competitor.** Validates ambient-perception demand. Borrow: LISTEN/SPEAK ambient loop, dual-context isolation, evidence-gated states — for Shadow's DS/coding personas *only* if perception output is sealed via attest-core ("perception = evidence capture", never screen-chat). Always-on capture is an anti-pattern for the banking vertical. |

## Distribution note (skills.sh)

skills.sh is now fully cross-agent (~20 agents incl. Codex, Cursor, Copilot;
Vercel "open agent skills ecosystem"). Trending top-10 needs 10–20K installs/day
and is dominated by media-generation funnels + clone farms — not a target for a
compliance catalog. The realistic channel is **find-skills query routing**
(2.7M installs): this update adds agent-fleet-vocabulary triggers to
`shadow-attestation-verify` so operators asking "can an outside auditor prove my
agents' log wasn't rewritten?" route to Shadow instead of nothing.

## One-line summary

Half a year, three commoditizers (Microsoft toolkit → Paperclip → Buzz), zero
regulatory mapping among them. Sell verifiability to the fleets they create.
