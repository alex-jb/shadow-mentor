# XREAL One Pro Test Protocol — Shadow × Yeshiva U

> **2026-07-11 update — read this first.** The Wednesday 2026-07-16 capstone demo path was simplified after the XREAL One Pro documentation review: the glasses are treated as a **6DoF-anchored 171" virtual display** driven from MacBook M5 over USB-C DP-Alt, **not** as an immersive WebXR runtime. The current `demo/xreal.html` renders in Chrome fullscreen on that display; no WebXR immersive session is entered. This is the *actual* path for the capstone demo. The user-study track (Quest 3 immersive WebXR) is post-capstone and separate.
>
> The rest of this document was prepared 2026-07-07 for a more ambitious path and remains as a reference for the Ambient Council v3 immersive experiment. Fold in whichever sections still apply; ignore the WebXR-immersive-mandatory sections for Wednesday.

**Wednesday morning pre-flight**: [`docs/wednesday-preflight-2026-07-16.md`](../wednesday-preflight-2026-07-16.md).
**Narration script**: [`docs/demo-2026-07-16-narration.md`](../demo-2026-07-16-narration.md).

---

**Version (historical):** 2.0 · **Prepared:** 2026-07-07 (post 4-agent full-web deep research + design pivot to Ambient Council v3)
**Supersedes:** v1.0 (2026-07-06) — which assumed standalone rendering + persona semicircle. Both assumptions were wrong.
**Hardware:** XREAL One Pro ($599, Lora purchased 2026-07-06) + **XREAL Eye add-on ($99, ORDER NOW)** + Android phone (Pixel 9 Pro / Samsung S24) or MacBook Pro as USB-C tether host
**Software backend:** Shadow v1.5.14 (`github.com/alex-jb/shadow-mentor`, MIT, public, 706/707 tests)
**Rendering pipeline:** WebXR + Three.js + gpt-realtime voice (WebRTC) + Perplexity-style citation pills — served over Chrome on the tether host
**Design paradigm:** Ambient Council v3 (`docs/product-design/xr-visual-paradigm-2026-07-06-v3-AMBIENT-COUNCIL.md`)

**Purpose:** define what the July 2026 Dean + Vice-Provost demo actually looks like, what pass/fail criteria we agree on before the demo date, and what the Alex + Loredana test-week protocol is on-device.

**Authors:** Alex Xiaoyu Ji (design + implementation) · Loredana C. Levitchi (regulatory-domain review + hardware ownership)

---

## What changed from v1

The v1 protocol had two structural errors baked in that would have wasted Phase B on-device time:

1. **v1 assumed XREAL One Pro is a standalone computer.** It is not. It is a USB-C DisplayPort-Alt-Mode peripheral. iPhone Safari does NOT support WebXR immersive-AR. The correct compute host is Android + Chrome + WebXR, or Mac + Chrome window as a 2D fallback.
2. **v1 assumed a "5 personas floating in tribunal" showcase.** Full-web research on 12 years of shipping bank AR/VR demos (Fidelity StockCity 2014 → Meta Horizon Workrooms killed 2026-02-16) showed every floating-showcase demo died in the day-30 utility test. v3 Ambient Council paradigm replaces this with document-anchored Perplexity-style pills + spatialized voice + Severance restraint.

If you are reading v1 (`git log --diff-filter=D`) — throw it out. Read only v2.

---

## Ownership and coordination

- **Loredana** owns the physical device + XREAL Eye purchase + regulatory-domain scene review + executive coordination with the Dean's office.
- **Alex** owns the software pipeline: Shadow API + WebXR scene + gpt-realtime voice + Perplexity citation pills.
- **Both** sign off in writing before the Dean + VP demo on each scene's readiness. No solo approvals.

---

## Hardware pipeline (corrected)

### The critical purchase (do this today, ~$99)

**XREAL Eye add-on** — 12MP forward camera + native 6DoF spatial anchoring on the X1 chip. General availability since July 2025. Ships from `us.shop.xreal.com/products/xreal-eye` in 2-4 business days. Without the Eye, XREAL One Pro is display-only with no camera and no 6DoF — Ambient Council's document-anchored HUD cannot work.

**Total additional cost:** $99.

### The compute host (borrow or use MacBook)

- **Primary:** Android phone with USB-C DisplayPort-Alt-Mode support — Pixel 9 Pro, Samsung S24 Ultra, or OnePlus 12. Runs Chrome + WebXR + Three.js + gpt-realtime voice.
- **Fallback:** MacBook Pro (any Apple Silicon). Runs Chrome window that gets cast to XREAL One Pro as a 171-inch 2D virtual screen. Loses head-tracked rendering; retains persona positions and voice interaction as a fixed 2D image.

**iPhone is not a host** because Safari does not support WebXR immersive-AR (verified via `caniuse.com/webxr` 2026-07-07). Do not plug XREAL One Pro into an iPhone for the demo.

### Voice stack

- **Primary voice model:** `gpt-realtime` (OpenAI, WebRTC transport, 200-350ms first-audio latency, native barge-in). Reference: `docs/strategy/roadmap-2026-2028.md` § voice.
- **Fallback for deictic references** ("this loan", "that flag"): Gemini 3.1 Flash Live (1M-token multimodal context).
- **Activation:** no wake word. Copy visionOS 27 Siri orb pattern — a gaze-anchored Council orb pinned above the physical loan PDF. Look-and-speak.

### What we do NOT buy

- No Meta Quest 3S backup ($299). VR headset aesthetic breaks the Ambient Council eyeglass framing. Fallback is MacBook + Chrome, not another head-mounted device.
- No Meta Ray-Ban Display ($799). Monocular 20° HUD is too small for the 4-element document-anchored layout.
- No Apple Vision Pro ($3,499+). Publicly de-prioritized (Kuo 2026-06-03), off-brand for the pitch.

---

## Phase A — Preflight (2026-07-08 to 2026-07-10, no hardware needed)

While the XREAL Eye is in transit, Alex builds and validates the WebXR scene on desktop Chrome + WebXR emulator.

### A1. Ambient Council scene skeleton

Alex builds the 4-element HUD:
- Verdict pill (top-right, above document region)
- 5 collapsed voice cards (right column, expand on voice command or pinch)
- Attestation status pill (bottom-right)
- Optional AML/KYC per-line callouts anchored to specific lines of the PDF

Content spec + design references at `docs/product-design/xr-visual-paradigm-2026-07-06-v3-AMBIENT-COUNCIL.md`.

Voice interaction: user says "explain the compliance voice" → the corresponding voice card expands with the full rationale + Reg B citation pill + AA code. User says "audit trail" → the scene shifts to Joi-style volumetric persona replay for the past 30 days of decisions (reserved for this one use case only).

### A2. WebXR emulator dry run

Chrome DevTools → Sensors → Virtual reality profile:
- Scene loads without runtime error on Chrome 137+
- 4 HUD elements render in correct positions relative to a mock PDF surface
- Verdict pill = green/amber/red based on mock verdict response
- Voice command "explain the compliance voice" expands the correct card
- Fade-in 300ms / fade-out 500ms on head-turn simulation

### A3. iPhone camera + Shadow API round-trip

Two-layer honest demo (per v3 design):
- **Layer 1:** iPhone camera + `VisionKit VNRecognizeTextRequest` on-device OCR + `POST /api/deliberate` (Shadow API) round-trip. Verify < 2s on Wi-Fi, < 3s on cellular.
- **Layer 2:** the XREAL Eye captures the same document + renders the HUD. This is the "target platform" demo layer.

Both layers must work by 2026-07-10 EOD.

---

## Phase B — On-device test (2026-07-14 to 2026-07-18)

Loredana brings XREAL One Pro + Eye to school. 5 sessions, 60 minutes each, one per day.

### B1 (Mon 2026-07-14) — Tethered baseline

Boot XREAL One Pro + Eye + Android host or MacBook. Load Chrome + WebXR scene. Measure:

- Cold load: < 3s from Eye document capture to HUD render
- Sustained FPS: ≥ 45 fps on Android tether, ≥ 60 fps on MacBook fallback, over a 3-minute session with 4 HUD elements + spatialized voice
- HUD anchor drift: < 5mm at 40cm document viewing distance over 30 seconds
- Voice round-trip: < 1.5s p95 from utterance to card expansion

**Pass criteria:** all four numeric thresholds met on the primary path (Android + Chrome + WebXR). If Android fails on FPS or anchor drift, degrade to MacBook fallback and record the fallback numbers.

### B2 (Tue 2026-07-15) — 4-element HUD readability

Same scene, real Shadow API endpoint. Measure:

- Verdict pill readable at 40cm without leaning in
- 5 voice cards expand on voice command in a quiet room (rehearsal room, no noise)
- Attestation status pill (green ✓ / red ✗) legible from the reviewer's seated posture
- Optional AML/KYC per-line callouts: track accuracy on 8pt loan text. If drift > 3mm/callout, DROP the per-line feature and put flags at the top of the Compliance voice card instead.

**Pass criteria:** verdict + voice-card expand + attestation pill all pass; per-line callouts are gambled — accept the accuracy result whatever it is.

### B3 (Wed 2026-07-16) — 4-case verdict lattice

Load each of the 4 canonical case studies (approve × 1, escalate × 1, block × 2 paths) from `docs/case-studies/`. Run each end-to-end. Measure:

- Verdict correctness against expected verdict (4/4)
- 5 voices render + are voice-callable (5/5)
- Hash-chain audit entry verifies via `/api/verify-chain` (4/4)
- Voice-command "explain compliance voice" surfaces the correct rationale text with the correct AA code and Reg B / SR 26-2 / CFPB citation

**Pass criteria:** 4/4 verdict correctness, 5/5 voice availability, 4/4 audit entries verify, all voice-invoked drill-downs surface the right rationale.

### B4 (Thu 2026-07-17) — Executive demo dress rehearsal

Full 5-minute Dean + VP demo rehearsal. The Ambient Council paradigm keeps this shorter than v1 (was 8 min; now 5 min):

- Open scene from tethered laptop or Android phone (30s)
- Play Case 1 ($2.5M CRE loan) — 90s
- Reviewer says "explain the compliance voice" → HUD updates → 45s
- Reviewer says "audit trail" → scene shifts to Joi-style volumetric replay for 30 days → 60s
- Reviewer says "back to loan" → return to Case 1 HUD → 30s
- Q&A anticipation (10 min prep — off the demo clock)

**Pass criteria:** end-to-end demo runs in ≤ 5 minutes, both Alex and Loredana can narrate confidently.

### B5 (Fri 2026-07-18) — Failure mode red-team

Deliberately break 5 things + measure recovery:

1. Kill Wi-Fi mid-verdict → does the client retry gracefully or hang?
2. Send a tampered attestation → does client-side verify catch it?
3. Trigger WebXR permission revoke mid-session → does scene degrade to 2D?
4. Speak "explain the compliance voice" while another voice is expanded → does the interruption pattern (gpt-realtime barge-in) actually work?
5. Occlude the XREAL Eye camera for 3 seconds → does the HUD gracefully hide + re-appear on re-detect?

**Pass criteria:** all 5 failures recover gracefully. None crash the browser or freeze the scene.

---

## Phase C — Dean + Vice-Provost executive demo (target: last week of July)

- Loredana coordinates the date with the Dean's office.
- Alex + Loredana demo Case 1 ($2.5M CRE loan) as the primary narrative.
- Backup: Case 3 (SBA loan, OFAC SDN hit → block by AML/KYC) if reviewer asks for a second scenario.
- Fallback path if XREAL fails on the day: MacBook + Chrome window running same WebXR scene as 2D preview. Loses head-tracked rendering; retains everything else.
- Loom recording (unlisted) of the actual session in Loredana's Drive within 24h.
- Post-demo debrief: agree on what publishes vs stays private.

---

## Failure protocol

If any Phase B session fails a pass criterion:
1. Log in `docs/xreal-one-pro-test-protocol/failure-log.md`
2. Alex has 24h to iterate the scene / endpoint / fallback
3. Rerun the failed session within 48h
4. Do NOT proceed to Phase C until every Phase B session is green

If a systemic hardware failure (X1 driver crash, XREAL SDK regression, USB-C DP-Alt loss):
- Alex contacts XREAL developer support
- Loredana communicates the slip to the Dean's office
- Fall back to MacBook + Chrome window as the demo target — the Ambient Council WebXR scene works identically here, just as 2D not head-tracked.

---

## Contact

- Alex Xiaoyu Ji · xji1@mail.yu.edu — software pipeline + WebXR scene + voice stack
- Loredana C. Levitchi · [email verify] — hardware ownership + Eye add-on purchase + executive coordination + regulatory-domain scene review
- Jason Marsh · jason@flow.gl — Flow Immersive template support (fallback layer only, not primary path)
- Hieu Ngo, PhD · Yeshiva Katz School — XR faculty consult, IEEE VR co-author

---

*This protocol is a public artifact of `shadow-mentor` (MIT). Every design decision above is grounded in either v3 Ambient Council design doc, 4-agent full-web deep research 2026-07-06 through 2026-07-07, or the Strategic Roadmap 2026-2028 doc. Open an issue if any claim is out of date.*
