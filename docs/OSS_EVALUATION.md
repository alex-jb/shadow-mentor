# OSS evaluation — trending repos vs. Shadow (2026-07-17)

Verdict on the Trendshift-trending projects and the third-party ideas raised for
Shadow. Rule: **the trending pages are a technology radar, not a shopping list**
— Daily for inspiration, Weekly for experiments, Monthly/long-term for things
that may enter the architecture. Every dependency that ships gets a row here
first (license + security + alternative + decision), per governance discipline.

## Verdicts

| Project | Role | License | Decision | Why |
|---|---|---|---|---|
| **OpenBB** | real market-data layer | AGPLv3 | **ADOPT (isolated)** | Replaces the mock fixture; expose as `OpenBBMarketDataProvider` behind a provider boundary + process/API isolation (AGPL must not touch Shadow core). The concrete "wire real data" answer. Needs install (Alex-gated). |
| **OpenTelemetry GenAI/MCP adapter** | ingest any agent's traces | Apache-2.0 | **ADOPT (highest leverage)** | Maps OTel spans (LangGraph/Claude Code/MCP/OpenAI-compatible) → existing Shadow evidence events, without changing the frozen wire schema. Turns Shadow from "our demo" into "any agent system's trust layer." On the roadmap (adapter-otel). Buildable autonomously. |
| **AG-UI / CopilotKit** | agent↔UI event protocol | MIT-ish | **BORROW** | Adopt an AG-UI-*compatible* interaction event layer (RUN_STARTED / TOOL_CALL / STATE_DELTA / HUMAN_APPROVAL → our session_start/tool_call/model_output/human_approval). Do NOT rewrite the frontend to CopilotKit, and keep Shadow's own run_id/parent_run_id/agent_id/step_id — AG-UI's parallel-agent story is still in flux. |
| **MarkItDown** | digital-doc → markdown | MIT | **ADOPT** | The digital-file capture path (PDF/DOCX/PPTX/XLSX → markdown → extract → Shadow). Keep a `source-map.json` (claim → page/region/text/confidence) so a claim can jump back to the source cell. Not a substitute for camera OCR (that's the paper path). |
| **C2PA / Content Credentials** | source provenance | spec | **ADOPT-LATER (UX now)** | The three-layer trust badge (RECORD / SOURCE / ANALYSIS / DATA) is already shipped in the demo — that's the UX insight (a green RECORD ≠ "correct"). Full C2PA ingredient integration for scanned-file provenance is a later phase. |
| **AI Hedge Fund** | persona roles reference | MIT | **BORROW** | Reuse the analyst-role taxonomy + data structures; do NOT import the repo. Final call by a deterministic aggregator / human reviewer, not a random 5-agent vote (matches `lib/confidence-weighted-verdict.js`). |
| **Pipecat / LiveKit** | real-time voice agent | Apache/MIT | **LATER (pick one)** | Browser push-to-talk + system TTS is enough for the 10-min demo (shipped). For the production JARVIS voice: Pipecat (multimodal, Python) or LiveKit (low-latency WebRTC + turn detection) — one, not both. |
| **Fish Speech** | TTS model | custom | **SKIP** | Custom license + model-deploy complexity; system TTS suffices. |
| **TrendRadar** | news/sentiment | GPLv3 | **MONITOR** | Possible sentiment provider later; not demo-core (news scraping = network fragility + GPL). |
| **ASTRYX / agent UI-skills** | design system | OSS | **BORROW method** | Borrow the design-token + agent-readable component-doc approach; do NOT drop a whole web component set — spatial UI (font size, depth, binocular legibility) differs from a web page. |
| **Lingbot-MAP** | 3D scene reconstruction | — | **SKIP** | Reconstructs 3D *physical scenes* from streams; we need 3D *data viz*. Only relevant if we ever scan real rooms/desks. |
| **Graphify** | repo → knowledge graph | OSS | **DEV-TOOL only** | Useful for Claude Code to navigate the large Shadow repo (impact analysis); never a runtime/demo dependency. |

## What's already shipped from these ideas

- **Three-layer trust** (RECORD/SOURCE/ANALYSIS/DATA) + **tamper before/after diff** — `demos/spatial-finance` (the C2PA-insight UX + the "verified ≠ correct" honesty).
- **Progressive-disclosure Decision Workspace** (agents are not the default scene) — already the demo's UX rule.
- **BoE fan chart + calibration/Brier view** — the honest-forecast + governance framing.
- **OTel GenAI/MCP adapter** (`packages/adapter-otel`, tested round-trip + runnable `example.js`: a 5-span loan-review trace → signed → tamper-caught) — any instrumented agent's spans → signed Shadow evidence. [queue #1 ✓]
- **What-if / counterfactual as a recorded, signed branch** — `demos/spatial-finance` (press W): forecast changes AND the change is appended to the chain, re-sealed, re-verified; the audit trace grows an amber branch. [queue #4 ✓]
- **Timeline replay** — `demos/spatial-finance` (press P): the run plays forward over a synthetic 18s timeline, playhead sweeps the chain, future nodes dimmed. [queue #1 ✓]
- **Source-map / click-claim-to-source** — `demos/spatial-finance` (click a risk or the top-3 metric, or say "trace"): the claim highlights its backing names in the cloud with the arithmetic recomputed live from the signed weights + the producing event named ("model_output · seq 2"). The structured-data version of the Meta rule "no claim without a traceable source"; the scanned-doc version (claim → page/region) still needs MarkItDown/OCR. [queue #2 ✓]

## Next, worth building (ranked)

1. **OpenBB provider** behind the data interface (real market data; install Alex-gated).
2. **OTel-ingest demo** — feed a real captured agent run (via `packages/adapter-otel`) into the spatial-finance chain so the replay/trace runs over genuine spans, not the fixture.
3. **Scanned-doc source-map** — claim → page/region for a real PDF (MarkItDown for digital, OCR for paper). Beam Pro Phase 2.
4. **Presenter / audience split** (wearer sees debug + next-scene; projection stays clean).

## Meta

Do not add more talking agents. The upgrade path is the loop: **see the data →
understand it → analyze it → prove how the analysis was produced** — voice
control, data that changes on command, every claim traceable to source, agent
disagreement visible, human edits visible, tamper location visible, the whole
run replayable and independently verifiable.
