# Wednesday 2026-07-16 — XREAL One Pro playbook (Alex-solo)

> This is a NEW playbook, not an edit to any file on the rule-3 frozen list. It sits alongside `docs/wednesday-preflight-2026-07-16.md`, `docs/xreal-one-pro-test-protocol/**`, `demo/xreal.html`, and `verify.html` — none of which are modified by this document.
>
> Scope: Alex receives XREAL One Pro + Eye add-on on Wed 2026-07-16, then demos a spatial Shadow surface at a Yeshiva University academic venue the same day. This playbook covers the 24 hours around that demo. It intentionally omits paper-track and co-author framing per Alex's instruction (`~/.claude/projects/-Users-alexji-Desktop-vibex/memory/feedback_lora_hieu_alex_drives_followup.md`).
>
> Grounding: hardware behavior + offline-first requirement + presenter beats are from `docs/roadmap/SHADOW_XR_DEMO_BRIEF.md` sections X0, X6, X7, X8. Frozen-path list is from `docs/AUTONOMOUS_SESSION_RULES.md` rule 3. Rule 8 (fabrication is a bug) governs every claim below.

---

## 1 · The night before (Tuesday 2026-07-15 evening)

Five items. Do them in order. All are ~5 minutes each except the offline verify, which is ~15.

1. **Confirm XREAL delivered.** Package includes One Pro + Eye add-on. If Eye is missing, the document-anchored render path (per test-protocol v2) degrades to a fixed 2D image on a 171" virtual display — still fine for Wednesday's beat structure, but note it in your morning-of checklist as a known state, not a surprise.
2. **Charge glasses to 100%.** USB-C in. Verify the charging LED. Do not skip this because "they came pre-charged" — retail units routinely ship at 20-40%.
3. **Test USB-C DP-Alt from your Mac.** Plug XREAL into the Mac's USB-C port. Open `System Settings → Displays`. XREAL One Pro should appear as a second external display in mirror mode by default. Confirm:
   - The display shows up (if it doesn't, unplug and replug; if still absent, try a different USB-C port and a known-good USB-C cable — some USB-C cables are power-only and don't carry DP-Alt).
   - Mirror mode is on, or extended mode with the primary display anchored to the glasses — either works.
   - Resolution is native (1920×1080 per eye is expected on One Pro; the OS may report the composite). Do not force a non-native resolution.
4. **Load the offline demo package on the laptop and verify it runs from `file://` with no network.**
   - Per `docs/roadmap/SHADOW_XR_DEMO_BRIEF.md` X7: the build output is `demos/replay/dist/` (single folder, runs from `file://`); the `make demo` target builds it and prints the pre-flight checklist to the terminal.
   - Per X6: the demo bundle is `demos/replay/data/demo-session.bundle` (real, sanitized) with a `demo-session-synthetic.bundle` fallback.
   - Verify test: disable Wi-Fi on the Mac, open `demos/replay/dist/index.html` directly, run beats 1 → 8 → 0 once end-to-end. If any asset fails to load, that's a network dependency you didn't vendor — investigate root cause tonight, not tomorrow. Per rule 3, you do NOT edit anything on the frozen path to fix it; you file the bug for Thursday and fall back to option 5.
5. **Backup: iPhone/iPad tab with verify.html + a pristine bundle preloaded.** Open `verify.html` in mobile Safari, drop in the pristine `demo-session.bundle`, confirm it shows green. This is your "if the laptop dies" recovery: you can hand the iPad to the audience and walk them through the same failure signature. Screenshot the green report to your camera roll so even if the file eviction wipes the tab, you have proof.

Then sleep by midnight. The demo is the delivery; the debugging window closed at step 4.

---

## 2 · Morning of (Wed 2026-07-16 AM, ≥ 90 min before slot)

Four items. Room-lights-ON is not negotiable; it's the single most common cause of on-stage SLAM drift.

1. **Room lights ON.** Per `SHADOW_XR_DEMO_BRIEF.md` X7 pre-flight and X0 constraint 1: XREAL's X1-chip monocular SLAM anchors the virtual screen using visible-light feature tracking. Dim rooms cause anchor drift — the "screen" appears to swim in space, which is instantly disqualifying for a research venue. If the room has dimmable lights, set them to at least 50%. If the venue is a projection room and lights must be off for the projector, that's a separate problem — resolve it Tuesday evening with AV, not Wednesday morning.
2. **Anchor screen at ~2m nominal distance.** Per X7: the virtual screen should sit ~2m in front of you. On One Pro, this is set by the glasses' built-in menu (short-press the temple button to summon the anchor UI; distance adjusts with the wheel). Set once, don't fidget mid-demo.
3. **Glasses dimming set to max.** Per X0 constraint 2 and X7 pre-flight: One Pro's electrochromic dimming is a physical shade over the see-through optics. Max dimming (theatre mode) makes dark backgrounds render as true black rather than gray-washed. Toggle via the frame button. Confirm the world visibly darkens.
4. **Browser fullscreen on the glasses display, `verify.html` preloaded in a second tab.**
   - Chrome window → move to the XREAL display → press F11 (or the fullscreen button in `demo/xreal.html`, per the frozen path).
   - Second Chrome tab: `verify.html` with the pristine `demo-session.bundle` preloaded. Do not switch to it yet; it lives in tab 2 for Beat 5.
   - Rehearse beats 1 → 8 → 0 once end-to-end while wearing the glasses. If any beat feels sluggish, per X7 you're on the 60fps @ 3840×1080 SBS budget for an integrated GPU — investigate but do not code-fix on the frozen path.

---

## 3 · During the demo — 90-second beat structure

Beats are keyboard-driven per the presenter kit spec (`SHADOW_XR_DEMO_BRIEF.md` X3 + X7). Number keys 1–8 are pre-authored camera waypoints; `0` resets to pristine; `5` triggers the tamper state machine (X5). `E` exports the working bundle for the browser-tab handoff (X8).

Total duration: 90 seconds. If you're at 60 seconds and only through Beat 3, skip Beat 4 and jump to Beat 5 — the cross-surface proof is more important than the reset animation.

| Beat | Time    | Key   | What the audience sees                                                                                                                                                             |
| ---- | ------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 0–15s   | `1`   | Open on the overview waypoint. Evidence corridor along the time axis. Say one sentence about what a "sealed bundle" is. Do not narrate the geometry — let it speak.                |
| 2    | 15–35s  | `2`   | Camera glides to the first `file_write` block. Real recorded Claude Code session. Point at the sha256 pill, the prev_hash link status. This is the "receipt" claim, made concrete. |
| 3    | 35–55s  | `5`   | Trigger tamper. The predetermined `file_write` payload mutates in the in-memory working copy. Real verifier fires. Caption appears in-scene (in red): "payload_hash mismatch at seq N (file_write); chain broken for M downstream events." The caption text is sourced from the verifier's structured error object, not hardcoded — that's the code-review-legible proof it's the real verification path. |
| 4    | 55–75s  | `0`   | Reset to pristine. Downstream blocks re-brighten in reverse order — the "healing" replay. This visual is the deterministic-verification argument in one motion.                    |
| 5    | 75–90s  | `E` then browser tab 2 | Press `E` to export the tampered working bundle. Switch Chrome to tab 2 (`verify.html`). Drop the exported bundle in. Same seq-N failure appears in the browser report. Cross-surface consistency: same primitive, same failure, different renderer. |

If the venue projector mirrors your laptop, the audience sees exactly what you see. You see the glasses view; the projector shows the fullscreen browser image. Both are consistent by construction because the glasses are a display peripheral, not a separate runtime.

---

## 4 · Failure modes + fallbacks

Five failures ranked by likelihood. Each has a specific pre-planned fallback so you never improvise on stage.

1. **Venue Wi-Fi flaky or absent.** Not a failure — we planned for it. Per step 1.4 above, the entire demo runs offline from `file://` out of `demos/replay/dist/`. Do not attempt to connect. Do not switch networks. The pre-flight rehearsal Tuesday evening was airplane-mode explicitly for this reason.
2. **USB-C DP-Alt cable doesn't work with the venue's laptop / adapter mismatch.** Carry your own laptop. The XREAL is your display; your laptop is your compute. Do not attempt to plug into a shared podium laptop. Confirm at the venue that a power outlet is reachable — 90 seconds of GPU work at 3840×1080 SBS on integrated graphics drains fast.
3. **Glasses SLAM drifts in low light.** Room-lights-ON from the morning-of step 2.1 is the fix. If the venue insists on lights-off (projector configuration), fall back to Beat 5 first: hand the iPad with `verify.html` around, walk through the same tampered bundle, and skip the in-glasses beats entirely. The receipts story survives without the spatial scene; the spatial scene without receipts is a gadget demo.
4. **Watchdog catches an uncaught exception.** Per `SHADOW_XR_DEMO_BRIEF.md` X7: the presenter-mode watchdog logs to an on-disk file and soft-reloads into the last beat within 2 seconds. If you see the reload, pause narration for 2 seconds, then resume from the beat you were on. Do not comment on the reload — the audience did not know a crash happened.
5. **You forget a beat number mid-demo.** Enable `?presenter=1` in the URL — this shows the beats HUD (tiny in-scene strip visible to the wearer only, since the projector mirrors what's on screen and the strip is designed for the glasses view). Per X7, this is the presenter reliability strip explicitly for this failure mode. Rehearse with it on during Tuesday's dry run.

---

## 5 · What to say — talk track (under 200 words)

Delivered to Yeshiva faculty from finance and computer science. Do not read this verbatim; use it as the shape.

> "What you're about to see runs on my laptop, offline, from a folder on disk. No cloud call, no network. The glasses are just a display.
>
> A software agent — Claude Code, in this case — did a session of work: read some files, wrote some files, ran some commands. Every step was captured, hashed, and chained together. This is what a sealed bundle of that session looks like as a spatial object.
>
> Now watch: I'm going to tamper with one event in the middle. The block turns red, and every downstream block dims — the chain notices, deterministically, at exactly the event I touched. The caption you're reading is the verifier's own error message, not a caption I wrote for the demo.
>
> Reset. Everything heals.
>
> Same file, dropped into a plain browser tab: same failure at the same event. Cross-surface consistency.
>
> This is not a compliance product. It's an offline-verifiable evidence layer. It ships receipts, not judgments. What you do with the receipts is a policy question for the domain you're in — banking, research, medicine. We're not answering that question. We're making the receipts checkable.
>
> Questions."

Approximately 190 words. Time it Tuesday evening; trim if you run over 90 seconds of speaking.

---

## 6 · After the demo — immediate follow-up

Three items. Do all three before leaving the room, not "when you get home."

1. **Save the projector-mirror screen recording.** If you kicked off QuickTime / OBS on the laptop before the demo, stop it now and save to `~/Desktop/xreal-demo-2026-07-16/`. If you forgot to record, that's fine — the deterministic bundle can be replayed later.
2. **Save any bundle files touched during the demo to a labeled folder.** The exported tampered bundle from Beat 5 (E key), plus the pristine bundle for comparison. Store at `~/Desktop/xreal-demo-2026-07-16/bundles/`. Do not overwrite the source files in the repo — those are frozen path.
3. **Note any hardware quirks in `~/.shadow/xreal-notes-2026-07-16.md`.** Free-form. What drifted, what dimmed wrong, what the glasses felt like after 30 minutes. This is your first-person hardware log for the future IEEE VR paper reference (which is on a separate track — you're not writing the paper today, just capturing the field notes while the memory is fresh).

---

## 7 · What NOT to do Wednesday

Four anti-patterns, ranked by cost of getting caught.

1. **Do NOT edit any file on the rule-3 frozen list DURING or after the demo.** The list from `docs/AUTONOMOUS_SESSION_RULES.md` rule 3: `demo/xreal.html` and any assets it references at runtime, `docs/demo-2026-07-16-narration.md`, `docs/demo-2026-07-16-narration-tight.md`, `docs/wednesday-preflight-2026-07-16.md`, `docs/xreal-one-pro-test-protocol/**`, `bin/attestation-acceptance-demo.mjs`, `verify.html`. Rule 3 sunsets 2026-07-16 EOD NY, at which point the categorical block lifts — but let it cool for 24 hours before mass edits. Landing changes to the demo path in the same session where you demoed it is how you break the primitive that just worked.
2. **Do NOT compare Shadow to Vision Pro or brag about Aura.** Wrong audience. Faculty in finance and computer science do not care about the AR hardware landscape ranking; they care about whether the receipts are real. If someone asks "why not Vision Pro" — the honest answer is "Vision Pro is deprioritized by Apple as of June 2026 and Aura ships Fall 2026; XREAL One Pro is what shipped and works with a MacBook today." Do not extend beyond that.
3. **Do NOT accept a "can I try it on my head" request without a wipe cloth and a 30-second reset ritual.** Per XREAL's monocular SLAM behavior, the anchor recalibrates per user. Handing the glasses to a stranger without resetting means they see a drifting scene, blame the software, and walk away with the wrong take-home. If someone asks, say: "let me reset it for you — 30 seconds." Wipe the temple pads, re-anchor the screen at 2m in the same lighting, hand it over. If you didn't bring a wipe cloth, politely decline.
4. **Do NOT promise a follow-up to any attendee.** Post-launch outreach happens Aug 3+. If someone asks for a meeting, say: "I'm not sending anything until August 3rd — send me a note then." Take their card; do not commit to a date.

---

## What's operator-dependent (verify Tuesday evening)

Per rule 8, these were not verifiable from repo docs; fill in yourself:

- **Venue address at Yeshiva U.** Not stated in any repo doc.
- **Room number / projector model / cable type at the podium.** The pre-flight doc says "verify HDMI or DisplayPort connector before assuming your adapter fits. Ask AV for an alternate if needed" — that's the frozen-path instruction and still stands. Confirm Tuesday.
- **Exact demo start time.** Not stated in any repo doc. The pre-flight says "leave home 60 min before slot start" — apply that offset once you know the slot.
- **Whether the room dims for projection.** If yes, revisit failure mode 4.3 fallback plan before the demo.
- **Whether a hardwired Ethernet is available at the podium.** Optional; the demo runs offline regardless.

---

**File:** `/Users/alexji/Desktop/AI-Projects/shadow-mentor/docs/wednesday-2026-07-16-xreal-playbook.md`
