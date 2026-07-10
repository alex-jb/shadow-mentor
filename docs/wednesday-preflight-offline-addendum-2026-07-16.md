# Wednesday 2026-07-16 pre-flight — offline addendum

Sibling addendum to `docs/wednesday-preflight-2026-07-16.md`. Focus: the network layer that the main pre-flight underweights.

**Why this is separate.** The main pre-flight was written assuming laptop-screen fallback covers "eyeglasses fail." It does not cover "Katz classroom Wi-Fi fails or is congested to unusable." That failure mode is empirically the most common demo killer at university venues — more common than hardware, more common than software crashes.

## Three network layers, ranked by reliability

1. **`file://` offline copy at `demos/offline-2026-07-16/xreal.html`.** Zero network. Works regardless of venue Wi-Fi state. Fallback fixture inlined; verifier CI-checked. **This is the default demo path for 7/16.**
2. **Phone hotspot to `shadow-mentor-phi.vercel.app/demo/xreal.html`.** Requires operator phone battery + cellular reception at the venue. Live LLM verdict, live signature, live tamper detection all work end-to-end.
3. **Venue Wi-Fi to the Vercel deployment.** Historically the least reliable. Not the primary path.

The narration is identical across all three. What differs is the "descriptor source" text top-right of the demo:
- Path 1 shows `fallback fixture (offline)`
- Paths 2 and 3 show `live from /api/ambient-turn`

## Pre-flight additions (do these in order, before 2026-07-16)

### Sun 2026-07-13 (or immediately after XREAL arrives)

- [ ] Turn on macOS airplane mode. Confirm Wi-Fi off + Bluetooth off in top-menu control center.
- [ ] Open `demos/offline-2026-07-16/xreal.html` in Chrome via `open` command. Should double-click work; file:// path should render.
- [ ] Confirm the top-right status text shows `fallback fixture (offline)` within 5 seconds.
- [ ] Confirm 5 persona pills render + central verdict pill shows `APPROVE`.
- [ ] Press `R`. Should re-render without error.
- [ ] Turn airplane mode off. Reload. Confirm status changes to `live from /api/ambient-turn` and the render is identical.
- [ ] Run `bash demos/offline-2026-07-16/verify-offline.sh`. Exit 0 expected.

### Mon 2026-07-14

- [ ] Phone hotspot test. Enable hotspot, disable venue-Wi-Fi expected SSID, load the Vercel URL. Confirm live path works.
- [ ] Screenshot the offline render + the live render. Store in `demos/offline-2026-07-16/rehearsal-screenshots/` (create if needed). Attach to your notes so if you get to the venue and something looks different you have a reference.

### Tue 2026-07-15

- [ ] Cold-boot the demo laptop. Do not open any browser tab manually. Open the offline copy via the file manager (not via a saved bookmark). Confirms nothing cached is faking a working render.
- [ ] Charge to 100% overnight. Bring the charger.
- [ ] Print two copies of the narration (`docs/demo-2026-07-16-narration-tight.md`). One for you, one for Lora.

### Wed 2026-07-16 morning (in this order)

- [ ] 30 min before the presentation slot: open the offline copy at the venue. If the offline render is green, you have a working demo regardless of Wi-Fi.
- [ ] 15 min before: try the live Vercel URL. If it loads, prefer it (audience sees "live from /api/ambient-turn" which is the more impressive descriptor).
- [ ] 5 min before: pick which browser tab you'll actually present from. Close the others. Do NOT switch tabs on stage.

## What to say if the offline path is what the audience sees

The tight narration already handles this without change. The status text top-right will say `fallback fixture (offline)` and no one will notice unless they zoom in. If someone asks after the presentation, the honest answer is:

> The demo shows the deterministic verdict-engine layer end-to-end. The rationale-layer LLM call requires network; today we're showing the pinned fallback because I did not want to depend on classroom Wi-Fi during the demo slot. The code path is byte-identical.

That is the truth. Do not paper it.

## What not to do

- Do **not** edit `demos/offline-2026-07-16/xreal.html` between now and Wednesday. It is a pinned snapshot. If the canonical `demo/xreal.html` changes, re-copy manually and re-run the rehearsal.
- Do **not** delete the `verify-offline.sh` output before Wednesday. If you re-verify on Tuesday, keep the output so you have a clean trail if anything breaks between Tuesday and Wednesday.
- Do **not** rely on venue Wi-Fi as the primary path. Path 3 above is a nice-to-have, not a plan.

## Cross-references

- `docs/wednesday-preflight-2026-07-16.md` — the main pre-flight (this file addends it)
- `docs/demo-2026-07-16-narration-tight.md` — the 3-min narration used with either path
- `demos/offline-2026-07-16/README.md` — package README with per-file explanations
- `demos/offline-2026-07-16/verify-offline.sh` — the automated check to run pre-rehearsal
