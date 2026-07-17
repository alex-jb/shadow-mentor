# The Audit Room — controls

**The keyboard is authoritative (Phase 4.1.3).** Every voice command has a
keyboard equivalent, and the keyboard is the source of truth. If the mic
fails on stage, run the whole demo from the keys and say nothing — it plays
identically. Voice is a layer on top, never a dependency.

## Keyboard

| Key | Action |
|-----|--------|
| `F1` / `F2` / `F3` | Mode: **flat** / **SBS stereo** / **WebXR** (Quest) |
| `1`–`8` | Presenter beats (camera tween ~1.2 s to each waypoint) |
| `0` | Full reset (heal the chain, clear lenses, return to overview) |
| `T` | Trigger the tamper cascade (real verifier) |
| `R` | Reset / heal (reverse-order re-brighten) |
| `E` | Export the current working bundle to disk |
| `L` | Cycle review lens: none → security → compliance → quality |
| `K` | Clear lens / filter |
| `H` | Filter to shell commands ("show me every shell command") |
| `B` | Show trust levels (emphasise the badges) |
| click / `←` `→` | Select / focus an event (opens the in-scene inspector) |
| `I` | Explain the selected event |
| `N` | Attach a signed review annotation to the selected event |
| `[` / `]` | Eye separation −10% / +10% (SBS) — persisted to localStorage |
| `;` / `'` | Convergence − / + (SBS parallax zero-plane) |
| hold `SPACE` | Push-to-talk (mic is hot only while held) |
| `M` | Mic hard kill / revive |

## Gamepad (optional, for hands-free presenting)

A standard gamepad is polled if connected — the keyboard stays authoritative,
this just mirrors the common demo verbs.

| Button | Action |
|--------|--------|
| **RT** (right trigger, hold) | Push-to-talk |
| **A** / **RB** | Next beat · **LB** previous beat |
| **B** | Full reset (beat 0) |
| **X** | Trigger tamper |
| **Y** | Show trust levels |
| **D-pad ←/→** | Move selection (focus) |

## Voice → keyboard equivalence

Push-to-talk (hold `SPACE`), speak, release. The transcript is mapped to a
**closed enumerated command set** — anything it can't confidently match
becomes `UNKNOWN` and the scene answers "didn't catch that" with no
improvised action. The model never controls the scene freely.

| Say (examples) | Intent | Keyboard equivalent |
|----------------|--------|---------------------|
| "show me every shell command" | `FILTER_BY_TYPE` | `H` |
| "focus on event six" | `FOCUS_EVENT(6)` | click / `←` `→` |
| "apply the security lens" | `APPLY_LENS(security)` | `L` (cycles to it) |
| "clear lens" | `CLEAR_LENS` | `K` |
| "go to beat five" | `GOTO_BEAT(5)` | `5` |
| "tamper with it" | `TRIGGER_TAMPER` | `T` |
| "reset" | `RESET` | `R` or `0` |
| "show trust levels" | `SHOW_TRUST_LEVELS` | `B` |
| "explain seq 2" | `EXPLAIN_EVENT(2)` | select + `I` |
| (anything else) | `UNKNOWN` | — |

If SpeechRecognition is unavailable, the mic indicator shows disabled and
nothing else changes.

## URL parameters

| Param | Effect |
|-------|--------|
| `?xreal=1` | XREAL optics preset (pure-black bodies, font bump for ~33 PPD) |
| `?mode=sbs` \| `?mode=webxr` | Start in that mode |
| `?presenter=1` | Presenter HUD (in-scene beat indicator) + crash watchdog |
| `?beat=N` | Jump to beat N on load (used by the watchdog for soft-recovery) |

## Tuning on the glasses

Every spatial, legibility, colour, and timing value lives in **one block**
at the top of `constants.js` (design principle 8). Adjust there, run
`node build.mjs`, reload, look through the glasses. Nothing else needs
editing to retune the layout.
