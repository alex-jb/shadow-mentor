# XREAL One Pro Test Protocol — Shadow × Yeshiva U

**Version:** 1.0 · **Prepared:** 2026-07-06 (evening, post-Lora email confirming XREAL One Pro purchase)
**Hardware:** XREAL One Pro (X1 chip, native 3DoF, X-Prism optics, 57° FOV, 171" virtual display, 120 Hz FHD)
**Software backend:** Shadow v1.5.12 (`github.com/alex-jb/shadow-mentor`, MIT, public 2026-07-06)
**Rendering pipeline:** WebXR + Three.js (browser-native) with Flow Immersive optional presentation layer
**Authors:** Alex Xiaoyu Ji (author) · Loredana C. Levitchi (reviewer + purchase authority)

**Purpose:** define what "the XREAL One Pro test week" actually looks like so Lora and Alex agree on the pass/fail criteria before the hardware lands and before the Yeshiva Dean + Vice-Provost demo date is locked.

---

## Ownership and coordination

- Lora holds the physical device. Amazon delivery ETA: max Saturday 2026-07-11. Device stays at Lora's or Alex's per weekly agreement.
- Alex owns the software pipeline (Shadow endpoints, Three.js scene graph, Flow Immersive scene JSON).
- Neither party solo-approves a demo scene for the Dean + Vice-Provost session. Both sign off in writing (email is fine) on each scene's readiness before it appears in the executive demo.

---

## Phase A — Preflight (2026-07-07 to 2026-07-10, no hardware needed)

While the XREAL One Pro is in transit, Alex builds and validates every render path on desktop Chrome + WebXR emulator. Any failure caught here saves live device time next week.

### A1. Flow Immersive scene template

Alex registers `a.flow.gl` (Jason Marsh gave free-tier access post 2026-06-22 call). Builds a scene JSON template that consumes `POST /api/deliberate` output and renders the five personas as spatial cards in a 4×4 meter room, plus the hash-chain audit trail as a walk-around 3D object.

Expected deliverable: `docs/xreal-one-pro-test-protocol/flow-scene-template.json` in this repo before Sat 2026-07-11.

### A2. WebXR emulator dry-run

Chrome WebXR API emulator (Chrome DevTools → Sensors → Virtual reality profile) validates:
- Scene graph loads without a runtime error
- 5 persona cards positioned at [±1.5m, 1.6m, ±1.5m] (semicircle around origin)
- Hash-chain object at [0m, 1.4m, -2.0m] (walk-through-able)
- FPS overlay ≥ 60 fps on M-series MacBook + Chrome
- Camera aligned so a reviewer at [0m, 1.6m, 1m] sees all 5 cards without turning

### A3. Fallback rendering paths (defensive plan)

If X1 chip native 3DoF fails at target FPS on-device (documented failure mode in XREAL developer forum posts for large scenes with >800k transparent quads), fall back to:

1. **Reduced-vertex scene** — swap the 3D Gaussian Splatting ambient with a flat cubemap (drops per-frame cost 3× at the cost of losing the immersive background)
2. **Two-persona focus** — hide 3 personas behind a "voice cabinet" UI element; reviewer summons them individually
3. **Tethered mode** — plug One Pro into MacBook Pro USB-C, run scene in Chrome on the laptop, One Pro becomes a 171" virtual display + head-tracking input (X1 chip idle)

Each fallback is coded into the scene graph as a `params.mode = 'full' | 'reduced' | 'focus' | 'tethered'` switch, so Lora and Alex can flip between modes during on-device tests without recompiling.

---

## Phase B — On-device test (starting week of 2026-07-14)

Lora brings the XREAL One Pro to school. Test cycle runs Mon 7/14 → Fri 7/18, one 60-minute session per day.

### B1. Session 1 (Mon 2026-07-14) — Standalone rendering baseline

Boot XREAL One Pro standalone (X1 chip, no laptop tether). Load `a.flow.gl` in the device's browser. Open the Phase A1 scene URL. Measure:

- Cold load time (scene JSON fetch + scene graph build)
- Sustained FPS over 3 minutes with reviewer walking around the persona semicircle
- Head-tracking latency (subjective: does the persona card drift with head movement?)
- Battery draw (One Pro internal, per XREAL app)

**Pass criteria:** ≥ 45 fps sustained, < 3s cold load, no visible head-track drift after 30s.

If any criterion fails: promote reduced-vertex fallback (Phase A3.1), rerun. Log which mode achieved the pass.

### B2. Session 2 (Tue 2026-07-15) — Live Shadow endpoint integration

Same scene, but instead of a mocked `/api/deliberate` response, hit the live Shadow endpoint with a real loan scenario. Measure:

- Round-trip latency from persona voice-vote gesture (Web Speech + hand pinch) to verdict-render in the scene
- Attestation verification success rate (client-side `/api/verify-attestation` after each verdict)
- Bill-counsel-facing readability of the `citation` field in each persona's rationale (Lora reads each of the 5 rationales aloud, confirms each cites the correct regulatory anchor)

**Pass criteria:** < 1.5s round-trip p95, 100% verify success, Lora approves all 5 citation strings for reader-audience clarity.

### B3. Session 3 (Wed 2026-07-16) — 4-case verdict lattice

Load each of the 4 canonical case studies from `docs/case-studies/`:
- Case 1: $2.5M CRE loan with PEP owner + diverse routing → escalate
- Case 2: First-time HELOC, FICO 640 → block by Credit Fundamentals
- Case 3: SBA loan, OFAC SDN hit → block by AML/KYC
- Case 4: Standard approve path

For each case, run the scene end-to-end. Measure:
- Verdict-render correctness against the case-study expected verdict
- 5-voice agreement (do all 5 personas render + speak?)
- Gesture-vote submission → hash-chain audit entry (verify via `/api/verify-chain`)

**Pass criteria:** 4-of-4 verdict correctness, 5-of-5 persona rendering, 4-of-4 audit entries verify.

### B4. Session 4 (Thu 2026-07-17) — Executive demo dress rehearsal

Alex + Lora run the full Dean + Vice-Provost demo from start to end, timing the transitions. This is a rehearsal, not a technical test.

- Open scene from `a.flow.gl` URL (30s)
- Play Case 1 ($2.5M CRE loan) — 90s
- Reviewer walks around the persona semicircle to inspect each verdict (60s)
- Reviewer performs a gesture-vote on the escalation prompt (30s)
- Hash-chain audit trail renders as a walk-through 3D object; reviewer walks through it (60s)
- Q&A anticipation — Lora and Alex rehearse answers to 5 questions the Dean/VP are likely to ask (10 min)

**Pass criteria:** end-to-end demo runs in under 8 minutes, both Lora and Alex are comfortable with the narrative flow.

### B5. Session 5 (Fri 2026-07-18) — Failure mode red-team

Deliberately break the scene in 5 ways and measure recovery:
1. Kill network mid-verdict → does the client retry gracefully, or hang?
2. Send a tampered attestation → does the client-side verifier catch it?
3. Trigger a WebXR permission revoke mid-session → does the scene degrade to 2D safely?
4. Rotate the X1 chip's IMU calibration → does the scene re-anchor?
5. Overload with 10 concurrent verdict requests → does the SIEM's batch-verify (v1.5.12) hold?

**Pass criteria:** all 5 failure modes recover gracefully. None crash the browser.

---

## Phase C — Dean + Vice-Provost executive demo (target: last week of July or early August, TBC by Lora)

- Lora coordinates the date with the Dean and Vice-Provost office.
- Alex + Lora demo Case 1 ($2.5M CRE loan) as the primary narrative. Fallback scenes B2 + B3 are ready if the reviewer asks for a second case.
- Loom recording (unlisted) of the exact demo goes to the shared Drive within 24h of the session so anyone who missed it can replay.
- Post-demo debrief: Lora + Alex agree on which scenes to publish (public repo) vs keep private (for procurement-only viewing).

---

## Failure protocol

If any Phase B session fails a pass criterion:
1. Log the failure in `docs/xreal-one-pro-test-protocol/failure-log.md`
2. Alex has 24h to iterate the scene / endpoint / fallback path
3. Rerun the failed session within 48h
4. Do NOT proceed to Phase C until every Phase B session has a green pass criterion

If a systemic failure (X1 chip driver crash, XREAL SDK regression, etc.):
- Alex contacts XREAL developer support
- Lora holds the demo date and communicates the slip to the Dean's office
- The 4-week Q3 macOS native fallback (per brain memory) becomes the accelerated path

---

## Contact

- Alex Xiaoyu Ji · xji1@mail.yu.edu — software pipeline, scene graph, endpoint integration
- Loredana C. Levitchi · [email verify] — hardware ownership, executive coordination, banking-domain scene review
- Jason Marsh · Flow Immersive · [via existing thread] — Flow scene template support if we hit rendering ceilings
- Hieu Ngo, PhD · Yeshiva Katz School — XR faculty consult, spatial-XR pedagogical scaffolding

---

*This protocol is a public artifact of the `shadow-mentor` repository (MIT). It is meant to be iterated in-place; any change from either author should be committed with a short "why" note.*
