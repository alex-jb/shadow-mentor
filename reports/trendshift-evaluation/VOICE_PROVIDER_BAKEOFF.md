# Spike C — Voice Provider Bake-Off (jamiepine/voicebox)

Research-only. The **Shadow spoken-language planner is unchanged** (constraint honored). Voicebox was
**NOT installed** (it is a desktop stack — Bun/Rust/Tauri — and installing it would run its scripts,
which is prohibited). What we CAN run in-session: route identical spoken contracts through the current /
fixture TTS and record the baseline; Voicebox is documented as a research-only comparison target.
2026-07-22.

## What was actually run (in-session, real)
The provider-independent planner emits ONE spoken contract per scenario; every provider consumes the
same contract. Measured on the audit-chain tamper scenario (level 2):

| Locale | Segments | Chars | Prosody | First line |
|---|---|---|---|---|
| en-US | 4 | 144 | VERIFICATION_FAILURE | "The first failure is sequence three. Steps four through six are affected…" |
| zh-CN | 4 | 53 | VERIFICATION_FAILURE | "第一个失败点是序号三。序号四到六受到影响。这验证的是完整性,不代表结论正确…" |

Current/fixture baseline (macOS `say`, desktop FIXTURE — from Phase 7, real audio in `media/voice-v7/`):

| Sample | Duration | Voice |
|---|---|---|
| en-current (naive UI-dump) | 40.3 s | Samantha |
| en-v2 (planner) | 10.5 s | Samantha |
| zh-current | 55.2 s | Tingting |
| zh-v2 (planner) | 12.9 s | Tingting |

This confirms the bake-off substrate: **same contract → different provider → compare**. The engineering
win (−74%/−77% shorter, semantic-preserving) is already the planner's, independent of provider.

## Voicebox — research-only findings
See `SHADOW_EXTERNAL_PROJECT_MATRIX.csv` for the verified repo facts (license/deps/network). Key points
for Shadow:
- It is a **desktop, local-first voice studio** (Bun/Rust/Tauri) bundling multiple TTS engines
  (Kokoro / Qwen TTS / Chatterbox, per its docs). It is NOT a mobile library and cannot be a Unity /
  Beam Pro runtime dependency.
- Shadow does **not** want voice cloning — only "same spoken contract → different engine, compare
  EN/中文 naturalness, latency, memory, privacy". So Voicebox is at most a **desktop reference bench**
  for choosing which local engine (if any) to later wrap behind `IShadowTtsProvider` for a *desktop*
  comparison — never on device.
- On device, the baseline stays Android system TTS (offline, no network); any cloud/neural engine is
  opt-in + privacy-reviewed (existing rule).

## What a full bake-off would measure (protocol, when a desktop bench is authorized)
Route the same contracts through: (a) Android system TTS [device], (b) macOS say [fixture, done],
(c) a selected local Voicebox engine [desktop only]. Record per engine: EN + 中文 naturalness samples
(listener-rated later — no naturalness claim from duration), first-audio latency, stop latency, memory,
offline availability, and privacy posture. Do NOT clone a real voice; do NOT ship any engine on device
without a second authorization.

## Constraints observed
Planner unchanged · Voicebox not installed · no voice cloning · not a Unity dependency · nothing merged.

## Verdict
**RESEARCH ONLY.** The planner already delivers the measurable win provider-independently; Voicebox is a
useful desktop bench to audition local engines for a *desktop* comparison, but it is a desktop stack
with no mobile path and Shadow needs no cloning. Any engine adoption behind `IShadowTtsProvider` is a
separate, explicitly-authorized decision; device default remains offline Android system TTS.
