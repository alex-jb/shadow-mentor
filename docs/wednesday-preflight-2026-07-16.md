# Wednesday 2026-07-16 pre-flight checklist

Read once, tick off on paper morning-of. Do not add items on stage; add them here after the fact for next time.

## Night before (2026-07-15 evening)

- [ ] Full charge: MacBook, phone, backup battery bank
- [ ] Confirm Lora is bringing XREAL One Pro + Eye
- [ ] Chrome up to date (Version → About Chrome)
- [ ] `https://shadow-mentor-phi.vercel.app/api/health` returns 200 (curl or browser)
- [ ] `https://shadow-mentor-phi.vercel.app/demo/xreal.html` loads and fetches live descriptor (not the fallback fixture) — check the status pill top-right
- [ ] Anthropic API key balance topped up if you plan to fire `/api/deliberate` live (not required for the demo path, but a green health check helps confidence)
- [ ] Print two copies of the 3-minute narration (`docs/demo-2026-07-16-narration.md`). One for you, one for Lora as backup teleprompter.
- [ ] Read through the narration once out loud. Time it. Trim if over 2:50.
- [ ] Sleep by midnight.

## Morning of (2026-07-16, ≥ 90 min before slot)

- [ ] Water bottle, phone charger
- [ ] Both printed narrations
- [ ] MacBook + charger + USB-C-to-HDMI adapter for projector
- [ ] Ethernet dongle if the venue has wired network fallback (optional)
- [ ] Leave home 60 min before slot start (buffer for train / traffic)

## At venue, ≥ 30 min before slot

- [ ] Meet Lora at agreed location. Confirm she has XREAL One Pro + Eye.
- [ ] Locate the projector cable at the podium. Verify HDMI or DisplayPort connector before assuming your adapter fits. Ask AV for an alternate if needed.
- [ ] Test: MacBook → projector. Confirm mirror mode shows the desktop.
- [ ] Test: MacBook → XREAL via USB-C DP-Alt. XREAL should appear as a second external display in System Settings → Displays. If it does not appear, unplug and replug the USB-C connector; if still failing, use display arrangement panel to detect displays.
- [ ] Chrome → `https://shadow-mentor-phi.vercel.app/demo/xreal.html`
- [ ] Move the Chrome window to the XREAL display, press the FULLSCREEN button on the page (or F11)
- [ ] Wear the XREAL. Verify legibility at ~2m nominal virtual distance.
- [ ] Turn XREAL electrochromic dimming to max (theatre mode) via the built-in button on the frame.
- [ ] Rehearse beat by beat: click through the 3-minute narration once end-to-end with Lora watching from where she'll stand.
- [ ] Ensure `docs/demo-2026-07-16-narration.md` open in a second Chrome tab as a teleprompter fallback.
- [ ] Ensure `docs/roadmap/SHADOW_V3_BRIEF.md` open in a third tab in case someone asks for the pivot text.

## Just before stage

- [ ] Silence phone (do not turn off — you may need it for tether backup)
- [ ] Deep breath. The narration is on paper.
- [ ] Lora signals when to walk on.

## If the tether fails on stage

Reduced-risk fallback:

- [ ] Chrome fullscreens on the laptop screen. Projector still mirrors. Audience sees the same demo.
- [ ] Continue narration as written. The framing does not change. Say the sentence once: *"we'll do this on the laptop today — the XREAL side is the paper track, not the deliverable."*
- [ ] Do not attempt to reboot the XREAL mid-demo.

## If the network fails on stage

- [ ] The demo page has an embedded fallback fixture. Reload the page; the descriptor comes from local memory.
- [ ] Say: *"we'll show the fallback fixture — the render logic is the same, the descriptor is embedded."*
- [ ] Do not attempt to switch Wi-Fi networks mid-demo.

## After demo

- [ ] Note down which parts of the narration ran under time / over time
- [ ] Note any question the audience raised that you did not anticipate
- [ ] Note whether the XREAL tether stayed stable through the whole 3 minutes
- [ ] Note the projector cable type at the venue for next time
- [ ] Thank Lora and Dr. NGO in person before leaving the room

## Post-demo (evening)

- [ ] Add the after-demo notes to `docs/retrospectives/2026-07-16-capstone-retro.md` (create if needed)
- [ ] Reply to any follow-up questions from the audience within 24 h
- [ ] Do NOT push new code before Sunday — protect the recovery day
