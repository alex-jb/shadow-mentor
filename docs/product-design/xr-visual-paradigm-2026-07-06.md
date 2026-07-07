# Shadow XR Visual Paradigm — Design Rationale

**Version:** 1.0 · **Prepared:** 2026-07-06 (late night, post-full-web-deep-research)
**Supersedes:** the "5 personas floating in semicircle + 4 Flow demos + 3D Gaussian Splatting ambient" plan.
**Authority:** cross-referenced against Citi × 8ninths (2016), Fidelity StockCity postmortem (2014), Kraus et al. CGF 2022 immersive-analytics survey, Cordeil ImAxes/IATK, Redd 2025 chemistry-VR replication, Flow Immersive published gallery, and 2026 Big-4 AI audit market scans.

**Authors:** Alex Xiaoyu Ji (design + implementation) · Loredana C. Levitchi (regulatory-domain review + banking-audience audit)

---

## What we are NOT building

Every publicly-shipped bank AR/VR demo from 2014 through 2026 has died in the same trap: **impressive for 30 seconds, useless at day 30**. Named case studies:

- **Fidelity StockCity (2014)** — Oculus SimCity metaphor for portfolios. Never shipped consumer.
- **Citi Holographic Workstation (2016)** — HoloLens 3-tier trading dockspace. Piloted, never rolled out.
- **JPMorgan Onyx (2022, Decentraland)** — branded lobby. Not a workflow tool.
- **HSBC × The Sandbox (2022)** — 3×3 metaverse LAND for gaming engagement. Marketing.
- **Meta Horizon Workrooms** — discontinued 2026-02-16 after enterprise failure.
- **Wells Fargo Together Experience** — Oculus + treadmill mall tour. Novelty.

Cargo-cult 3D pie charts, floating city metaphors, and novelty spatial layouts all fail the day-30 utility test. **Do not build any of these.**

---

## What we ARE building

Two academic + industry evidence categories replicate under expert scrutiny:

1. **Spatial arrangement of familiar 2D artifacts** (Flow Immersive portfolio panels, Citi 3-tier dockspace, Tableau visionOS floating dashboards)
2. **Embodied outlier / cluster identification** in 3D scatter (Kraus et al. CGF 2022, Filho et al. replicated by Redd 2025 in *J. Chemometrics*)

Shadow's design combines both plus one specific new claim:

> The only 3D element that earns its 3D existence is one that visualizes a *relationship* the 2D UI cannot afford.

For Shadow, that relationship is **cryptographic audit provenance** — the hash chain linking every decision back through the reason-code dictionary hash to the model version. This has no clean 2D representation because it is time-ordered + graph-structured + signature-bound. Spatializing it gives a bank auditor exactly the "walk the chain to inspect a specific link" affordance the 2D UI can't produce.

Everything else stays flat.

---

## The design: Semicircular Tribunal

### Geometry

- Reviewer stands at origin (0, 1.6, 1) looking toward −Z. Room extent 4×3×4 meters.
- **Five persona cards** float in a semicircle at radius 1.5m, height 1.6m (eye level), spanning −60° to +60° in the reviewer's forward 120° cone.
- Each card is a **flat 2D panel** (approximately 30cm wide × 45cm tall in world space, matching a large iPad).
- **Central hash-chain ribbon** — the only true 3D element — rises vertically at (0, 0.8m to 2.4m, −1.0m). Each link of the ribbon corresponds to one prior attestation (24-hour rolling window). Reviewer walks toward the ribbon to inspect individual links; walks around to see the chain from side view; walks through if the room permits.

### Persona card content

Each card shows the same fields as `/api/deliberate` returns per voice:

- **Verdict pill** — colored green (approve), amber (escalate), red (block)
- **Voice name** in header
- **Rationale short** — one paragraph
- **AA code** if applicable
- **Confidence weight** — small numeric badge in the corner
- **Signature footer** — abbreviated attestation hash (first 8 chars)

Layout is intentionally the same as a printed regulator submission page. Familiarity is the point. Bank counsel opens the demo and reads the same layout they would read on paper.

### Hash-chain ribbon (the only 3D element)

- Vertical column of horizontal ring-segments, one per attestation.
- Rings colored to indicate signature-verification status: **white/silver = verified**, **red = tampered/broken**.
- Ring label shows the attestation timestamp and short signature hash.
- Below each ring, a **branch** trails outward if that decision has an outstanding compliance flag (AML/KYC or fair-lending review). Reviewer follows the branch to a callout showing the flag context.

The chain is the visual signature of Shadow. It is what the demo is *about*.

### What is deliberately NOT in the scene

- No floating 3D scatter plots of loan data (that goes in a *separate* Flow Immersive Brier calibration demo, targeted at the Columbia statistics faculty audience, not the Dean + VP).
- No ambient 3D Gaussian Splatting background (too heavy for phone-tethered XREAL One Pro; adds no signal).
- No animated persona avatars, gestures, or voice-over synthesis. Voice output is via the reviewer's phone speakers only.
- No stock-city / dashboard-city / any -city metaphor.

---

## The hardware pipeline

### Correction to the 2026-07-06 morning test protocol

**XREAL One Pro is a display peripheral, not a standalone computer.** It requires USB-C DisplayPort-Alt-Mode from an iPhone 15+/16/17 or Android with DP-out or Steam Deck / ROG Ally / Mac / PC. The X1 chip handles pose prediction, display stabilization, distortion correction; **it does not run WebGL / WebXR / a browser**.

**Correction to Phase B test sessions**: standalone rendering is impossible. The pipeline is:

- **Android phone + Chrome + WebXR + Three.js** → HDMI-alt-mode → XREAL One Pro
- Fallback: **Mac + Chrome window (non-WebXR)** cast to XREAL One Pro as a 171" 2D virtual screen. Loses head-tracked rendering; retains the persona-tribunal layout as a fixed image.

**iPhone Safari does not support WebXR immersive-AR mode.** Do not build for iOS Safari.

### Rendering budget on Android + Chrome tethered

- Three.js scene graph, WebGPU where available (WebGL2 fallback)
- Under 100 draw calls total
- Under 100k triangles total (5 persona cards × ~4k tris each + hash-chain 20k tris + reviewer UI 15k tris = ~55k)
- No 3D Gaussian Splatting (mobile CPU-sort drops FPS to 20-30)
- Target 60 fps on Pixel 9 Pro / Samsung S24 Ultra / OnePlus 12
- Fallback path: reduce persona count from 5 to 3, hide chain ring branches, drop to 30 fps target

### What to buy in the next 5 days

- **Android host phone** — Pixel 9 Pro ($999) or borrow a Samsung S24. Must have USB-C with DisplayPort-Alt-Mode. **Do not use iPhone as demo host** (Safari WebXR gap).
- **USB-C to XREAL One Pro cable** — included with the XREAL purchase, verify Loredana confirms it's in the box before Saturday.
- Optional: **compact Bluetooth controller** for reviewer hand-input if MediaPipe Hands is not shipped in the demo.

---

## What ships when

- **2026-07-07 (Tue)**: rebuild the WebXR scene against the tribunal + hash-chain paradigm (delete the earlier semicircle prototype). Target: Chrome DevTools WebXR emulator renders the scene at 60 fps on a Mac.
- **2026-07-08 (Wed)**: package the scene as a Flow Immersive-compatible URL. Upload to `a.flow.gl`. Get share URL.
- **2026-07-11 (Fri/Sat)**: XREAL One Pro arrives at Loredana. Both authors confirm the box includes the DP-alt USB-C cable.
- **2026-07-13 (Sun)**: Council-for-Slack submit. XREAL demo is not on the critical path this weekend.
- **2026-07-14 (Mon)** onward: 5-session on-device test week per `docs/xreal-one-pro-test-protocol/` (corrected version to reflect Android tethering).
- **Late July** (executive Dean + VP demo): live demo with the corrected scene, corrected hardware pipeline, corrected fallback plan.

---

## Roadmap after the July demo

**Late 2026**: XREAL Aura ships ($1,500, Fall 2026 per XREAL's Project Aura page). Aura is standalone (Android XR compute puck), which lets us drop the phone-tethering constraint. Migration cost: minimal, since the scene is already WebXR + Three.js — the Aura runs the same Chromium-based Android browser.

**2027**: Anthropic + Apple + Meta smart-glasses landings likely reshape the market. Track the space, but do not build the pitch around any of it. The pitch is that Shadow runs on **commodity AR glasses banks can buy at Best Buy today for $599**.

**Publications**: this design directly feeds the IEEE VR 2027 paper (`Correspondence/ECC-2026/ieee-vr-2027-abstract-v3-2026-07-06.md`). Update the Method section (v2 Section 4.5 "Spatial XR layer") to reference this document as the canonical design source.

---

## Reviewer notes for Loredana

1. This document changes the demo from "5 personas floating with 3D scatter ambient" to a much more sober "tribunal of 2D verdict cards + one true 3D hash-chain ribbon." I made the change because the full-web deep-research on 2014–2026 bank AR/VR shipping products showed that every novelty-metaphor demo died in the "day 30" utility test. Sober + defensible + academic-evidence-backed is the right posture for the Dean + VP audience.
2. Please confirm the persona card fields (verdict, rationale, AA code, confidence, signature footer) match what you would want a bank counsel to see first. If any field should be dropped or added, please annotate.
3. The XREAL One Pro purchase is still the right call. It is $599 hardware banks can actually adopt without a procurement cycle. The Aura roadmap ($1,500, Fall 2026) is the next-generation story to include in the pitch.
4. The Android phone requirement is a new constraint I did not flag before Saturday's purchase. If you don't have a Pixel or a Samsung S24 on hand, I can borrow one for the demo week.
5. I will update `docs/xreal-one-pro-test-protocol/README.md` to reflect the tethered rendering pipeline. Phase B sessions become "tethered baseline" instead of "standalone baseline".

---

## Contact

- Alex Xiaoyu Ji · xji1@mail.yu.edu — visual + scene + rendering
- Loredana C. Levitchi · [email verify] — regulatory-domain review + card content
- Hieu Ngo, PhD · Yeshiva Katz School — XR pedagogical scaffolding (IEEE VR co-author)

*This design doc is a public artifact of `shadow-mentor` (MIT). Every claim above is cited to a dated public source. Please open an issue if any claim is out of date.*
