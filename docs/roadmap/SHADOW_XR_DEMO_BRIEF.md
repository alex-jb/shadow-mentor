# Shadow XR Demo — XREAL One Pro Addendum for Claude Code (extends M5 of SHADOW_V3_CLAUDE_CODE_BRIEF.md)

> Scope: `demos/replay/` only. One three.js codebase, four render modes. Target hardware for the live demo: XREAL One Pro + XREAL Eye (6DoF anchoring is handled BY THE GLASSES, not by our app), driven by a laptop over USB-C DP-alt. Quest 3 WebXR is a separate mode for the user study, not the capstone demo.

## X0 — Hard constraints (read first, they invalidate naive approaches)

1. **XREAL One Pro has NO WebXR runtime, no hand tracking, no head-pose API for the browser.** To our app it is a dumb external monitor. All "spatial" behavior (screen anchored in the room, user leaning in) comes from the glasses' own X1-chip 3DoF/6DoF anchoring. Never call `navigator.xr` in XREAL modes.
2. **Optical see-through: black pixels = transparent.** On XREAL, a pure-black background makes the corridor float in the real room; a bright room washes out dim content. Design rule: background #000 (true black, not #111), all meaningful content ≥ 60% luminance, thin dark-gray strokes are invisible — do not use them. Presenter will set the glasses' electrochromic dimming to max for the demo (theater mode); the app must still be legible at zero dimming.
3. **In SBS mode, DOM overlays are broken** (they'd appear once, spanning both eyes). Therefore ALL UI — event cards, captions, badges, menus — must be rendered in-scene (three.js objects), not HTML. Use `troika-three-text` for text (SDF, crisp at any scale). The only DOM allowed: a mode-switch splash and the fatal-error screen.
4. Everything must run **fully offline** from a single static build (`vite build`, open `index.html` from disk). No CDN imports, no network calls at runtime. Vendor all assets.

## X1 — Render mode system

- Modes: `flat` (default, any screen), `ultrawide` (3840×1080 layout), `sbs` (side-by-side stereo for XREAL 3D mode), `webxr` (Quest only).
- Selection: URL param `?mode=` + runtime hotkeys `F1..F4`. Mode switch must not reload or lose scene state (camera position, opened cards, tamper state persist).
- `sbs` implementation: two `PerspectiveCamera`s with adjustable eye separation (default 0.064 world units mapped to scene scale; hotkey `[`/`]` adjusts ±10%, persisted to localStorage — note: this demo is a built site, not a Claude.ai artifact, so localStorage is fine). Render left/right via two viewport passes on one canvas sized to the full output resolution. Do NOT use the deprecated `THREE.StereoEffect` example class; implement the two-viewport pass directly.
- `ultrawide`: canvas fills 3840×1080; corridor runs along X with generous horizontal spread; two persistent in-scene side panels (left: session header + trust-level badges; right: selected-event detail card).
- Acceptance: all four modes render the same 47-event demo bundle; switching modes mid-tamper-animation preserves state; SBS fusion comfortable at 2m nominal screen distance (manual check).

## X2 — Scene: the evidence corridor

- One block per event along the time axis. Geometry: instanced rounded boxes (InstancedMesh; target ≤ 2 draw calls for blocks + 1 for edges). Spacing ∝ inter-event wall-clock gap, clamped [0.4, 2.0] units, with a subtle time ruler underneath (minute ticks).
- Event-type semantics (shape/icon on the front face, generated as SDF sprite atlas at build time — no runtime canvas text):
  - `tool_call` wrench, `tool_result` wrench-check, `file_write` page with folded corner, `file_read` page, `shell_exec` terminal chevron, `model_call`/`model_output` rounded node, `user_message` speech bubble, `human_approval` check-shield, `network_request` globe, `error` triangle, `session_start`/`session_end` gate posts.
- Color is reserved for STATUS only: intact = #E8E8E8 edges, error event = amber #FFB020, tampered = red #FF4A4A, downstream-of-tamper = 35% dimmed + broken-link icon. Type is never encoded by color (colorblind rule).
- Selected block expands a card (in-scene panel, max 0.9×0.7 units): timestamp, type, actor, payload sha256 (first 12 chars + copy affordance in flat mode), prev_hash link status, and a type-specific summary line (file_write → path + diff stat "+12 −3"; shell_exec → command truncated 60 chars + exit code; model_call → model id + token counts). Full payload NEVER renders in-scene; card shows "open in 2D inspector" hint (works in flat/ultrawide via side panel).

## X3 — Input

- Gamepad API (any standard-mapping bluetooth pad): left stick = glide along corridor (ease-in/out, max 3 units/s), right stick = orbit camera ±30° (soft-clamped, auto-recenters), `A` = select/expand nearest block, `B` = close card, `X` = cycle lens, `Y` = toggle SBS/flat, `RT` hold = fast glide, `Start` = presenter menu.
- Full keyboard parity (arrow keys / enter / esc / L / F2...) — document as a table in `demos/replay/CONTROLS.md`.
- **Presenter beats:** number keys `1..8` jump the camera (smooth 1.2s tween) to pre-authored waypoints defined in `demo-beats.json`: 1 overview, 2 first file_write, 3 shell_exec pair, 4 security-lens on, 5 tamper trigger point, 6 pull-back full-chain view, 7 tampered block close-up, 8 trust badges. `0` = full reset to pristine state. Beats are the demo script made deterministic; rehearsal happens on these keys.

## X4 — Lenses (review filters)

- Three lens presets, cycled with `X`/`L`: **security** (highlights `shell_exec`, `network_request`, `file_write` outside workspace), **compliance** (highlights `file_read` on paths matching a configurable sensitive-glob list, all `human_approval`, all `model_call` with external provider), **quality** (highlights `error` + any `tool_call` retried ≥ 2×, detected by identical payload_hash on consecutive tool_calls).
- Highlight = white edge pulse (1Hz, subtle) + all non-matching blocks drop to 50% opacity. Lens name shows as an in-scene caption for 2s.
- Annotations (minimal): in flat/ultrawide, presenter can press `N` on a selected block to attach a canned note; the note is appended to the working copy of the bundle as a signed `review_annotation` event and a small tag appears on the block. One canned note per lens is enough for the demo ("flagged for security review" etc.). Acceptance: after annotating, re-running the verifier on the working bundle passes, and the annotation event is itself part of the chain.

## X5 — Tamper demo state machine

- States: `PRISTINE → TAMPERED → (reset) PRISTINE`. Trigger: presenter beat `5` or menu item. Never triggerable by accidental single keypress (requires beat key or two-step menu).
- Effect: mutate one predetermined `file_write` payload in the in-memory working copy → run the real verifier (the same `@shadow/attest-core` verify function — not a simulation) → animate: tampered block edges flash to red over 0.4s, then downstream blocks dim sequentially at 24 blocks/s with a traveling "crack" sound-free visual pulse; floating caption (in-scene, 3s persist): exact verifier error, e.g. `payload_hash mismatch at seq 23 (file_write); chain broken for 24 downstream events`.
- The caption text must come from the verifier's structured error object, not hardcoded strings — this proves in code review that the demo runs the real verification path.
- Reset (`0`): restore pristine bundle, blocks re-brighten in reverse order (the "healing" replay is visually satisfying and reinforces determinism).

## X6 — Demo dataset

- `demos/replay/data/demo-session.bundle`: a REAL recorded Claude Code session captured via `@shadow/adapter-claude-code` (M2.1), 40–60 events, containing ≥ 3 file_writes, ≥ 2 shell_execs, 1 error, 1 human_approval. Sanitize payload store: strip any absolute paths outside the project, any tokens/env values (write `scripts/sanitize-bundle.mjs`; sanitation re-signs with a demo key and is documented as such in the bundle header — never present the demo bundle as production-signed).
- Fallback `demo-session-synthetic.bundle` generated by a script, same shape, in case the real capture has issues on stage. Both committed to the repo (they are small; payload store trimmed to summaries).
- Trust badges: pre-anchor the demo bundle's batch root with a real RFC 3161 token at build time so the TIME_ANCHORED badge is genuine; LOG_ANCHORED badge may show "not anchored" honestly if Rekor isn't wired by demo day.

## X7 — Presenter reliability kit

- `?presenter=1` enables: beats HUD (tiny in-scene strip showing current beat number, visible to wearer only in practice since audience projector mirrors — acceptable), auto-pause of all idle animations (battery/GPU), and a watchdog that catches any uncaught exception, logs to an on-disk file, and soft-reloads into the last beat within 2s.
- Performance budget: 60fps minimum at 3840×1080 in SBS on an integrated-GPU laptop; if the machine is discrete-GPU, fine, but test on integrated. Enforce: no postprocessing passes (no bloom — fake glow with sprite billboards), instancing for blocks, frustum-culled cards, `powerPreference: "high-performance"`.
- Build output: `demos/replay/dist/` single folder, runs from `file://`. Add `make demo` target that builds, copies bundles, and prints the pre-flight checklist (below) to the terminal.
- Pre-flight checklist (also in `DEMO_SCRIPT.md`): glasses firmware updated; Eye attached, room lights ON (monocular SLAM); anchor screen at 2m; glasses dimming max; laptop mirrored to projector via HDMI; OS display scaling 100%; browser fullscreen on the glasses display; gamepad paired; run beats 1→8→0 once end-to-end; verify.html open in a second tab pre-loaded with the same bundle.

## X8 — Ending integration with verify.html

- Beat `8` → presenter switches browser tab to `verify.html` (already loaded with the tampered working bundle exported via `E` key = "export working bundle"). verify.html shows the same seq-23 failure in its report.
- Acceptance: exported tampered bundle's verify.html report and the in-scene caption reference the identical seq and reason.

## X9 — Quest 3 WebXR mode (post-capstone, for the user study only)

- Same scene graph, `mode=webxr`: local-floor reference space, teleport along corridor waypoints + smooth glide with vignette, controller ray select, hand-pinch select. No new features beyond parity with flat mode interactions. Gate behind a feature flag; do not spend capstone-week time here.

## Out of scope (do not build)

- XREAL Eye camera capture integration (requires Beam Pro; not part of our pipeline).
- Any Unity/native path. Any multiplayer. Any avatars or agent embodiment.
- Live-session streaming view (we replay sealed bundles only).

## Definition of done

- [ ] Four modes from one build; state survives mode switches
- [ ] SBS verified comfortable on One Pro in 3D mode; all UI in-scene; legible at zero dimming
- [ ] Beats 1–8 + reset drive the full 3-minute script with gamepad and keyboard
- [ ] Tamper path calls the real verifier; caption text sourced from its error object
- [ ] Real recorded + sanitized Claude Code bundle committed, with genuine RFC 3161 anchor
- [ ] 60fps at 3840×1080 SBS on integrated GPU; runs offline from file://
- [ ] Exported tampered bundle fails identically in verify.html
