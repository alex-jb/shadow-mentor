# Shadow M5 "The Audit Room" — deep research (2026-07-16)

Five-axis parallel research pass to de-risk the M5 XR work and feed three
downstream consumers:

- **IEEE VR 2027 paper** (deadline ~2026-08-24) — Related Work, Method, study design.
- **The live demo** — defensibility of the 7 design principles + the framing.
- **The Monday Yang call** — the IRB path for the user study.

Axes: **A** spatial viz for anomaly/structure detection · **B** optical
see-through legibility · **C** study methodology + IRB · **D** provenance/
audit-log viz prior art · **E** WebXR/XREAL technical reality.

> Citation-confidence discipline: works marked **(solid)** are ones I'm
> confident exist as described; **(verify)** need a title/DOI/arXiv-id check
> before they go in the paper. Do not paste any "verify" cite into the
> submission without confirming it first.

---

## Axis A — Does spatiality actually help find anomalies & trace structure?

**Bottom line: yes, but only for the *task regime* Shadow lives in.** Stereo
+ motion help *path-following and large-graph comprehension*; they *hurt*
precise value comparison. Shadow's task — "follow the chain, find where it
breaks, trace the downstream impact" — is squarely path-following, which is
the regime the evidence supports. Frame the hypothesis narrowly around that
and it's defensible; frame it as "3D is better" and a reviewer buries you.

### Key findings

- **Ware & Franck, "Evaluating stereo and motion cues for visualizing
  information nets in three dimensions," ACM TOG 1996 (solid).** Stereoscopic
  viewing + head-coupled motion increased the size of a graph a person could
  read (error-free path tracing) by roughly **3×**. This is the single most
  on-target prior result: our chain *is* an information net and finding the
  break *is* path tracing.
- **Ware & Mitchell, "Visualizing graphs in three dimensions," ACM TAP 2008
  (solid).** Replication/extension: 3D + motion/stereo reduces path-tracing
  errors on larger graphs vs 2D. Reinforces the above.
- **Kraus et al., "The Impact of Immersion on Cluster Identification Tasks,"
  IEEE TVCG (VIS 2019) (solid).** Immersive (HMD) viewing improved cluster
  identification for 3D data vs desktop — evidence immersion aids *structure*
  perception, not just navigation.
- **Cordeil et al., "ImAxes" (UIST 2017) (solid)** and the **Immersive
  Analytics** volume (Marriott et al. eds., Springer LNCS 11190, 2018)
  (solid) — establish immersive analytics as a legitimate venue-recognized
  field; use for framing, not for effect claims.
- **Counter-evidence — Bach et al., "The Hologram in My Hand: How Effective
  is Interactive Exploration of 3D Visualizations in Immersive Tangible AR?"
  IEEE TVCG (VIS 2017) (solid).** Tangible AR was **not** reliably better than
  a 2D baseline for several abstract tasks. This is the paper a skeptical
  reviewer will cite; cite it *first*, yourself.
- **General viz wisdom (solid):** for *abstract* data, 3D commonly loses to 2D
  (occlusion, perspective distortion, navigation cost) — the Munzner/2D-first
  tradition. Shadow's defense is that the chain is *spatially structured*
  (a path), not an abstract scatter, and that the XREAL condition is
  *anchored stereo*, minimizing navigation cost.

### The 3 strongest papers to cite for the hypothesis

1. **Ware & Franck 1996** — the ~3× path-tracing result; our task is its task.
2. **Kraus et al. VIS 2019** — immersion aids structure/cluster perception.
3. **Bach et al. VIS 2017** — cited defensively, to show we know 3D isn't a
   free win and designed the task to the regime where it helps.

### Implications for the Shadow M5 study

- **Hypothesis, narrowly:** *anchored-stereo (XREAL) and immersive (Quest)
  reduce time-to-locate-the-break and improve downstream-impact-scope accuracy
  vs a flat 2D report, because the task is path-following over a chain.*
- **Plausible effect:** older stereo-graph work shows large effects on
  path-tracing; modern immersive-analytics effects are more modest
  (time −10–30%, task-specific accuracy gains). Power for a *moderate* effect,
  not the historical 3×.
- **Design consequence:** the outcome most likely to move is **impact-scope
  accuracy** (tracing *which* downstream events are dead), because that's the
  path-following sub-task. Instrument it precisely (see Axis C).

### RED FLAGS

- Over-claiming "3D/immersive is better" invites Bach 2017 + the 2D-first
  canon. Keep the claim task-scoped.
- Anchored stereo (XREAL) removes head-coupled motion (the scene doesn't
  follow the head) — part of what powered Ware's effect. Don't inherit
  Ware's *magnitude*; the XREAL condition tests *stereo + world-anchoring*,
  not full motion parallax. Say so explicitly.
- Novelty effect: first-time XR users may be faster *because it's novel*.
  Control with practice trials + a familiarity covariate (Axis C).

---

## Axis B — Optical see-through legibility (7-principle validation)

**Six of seven principles hold; #3 and #7 need refinement, and the color
story is actually *stronger* than we wrote it.**

| # | Principle | Verdict | Why |
|---|-----------|---------|-----|
| 1 | Light is the only material (#000 = invisible) | **SUPPORTED** | OST combiners are strictly additive; zero-luminance = transparent by physics. Any non-emissive fill must be *drawn* with light and blends unpredictably (Gabbard & Swan color-blending, arXiv:1908.09348). |
| 2 | Arc beats Z-corridor | **PARTIAL (reasoned)** | Depth along the view vector leans on accommodation + large disparities — the cues most degraded by vergence–accommodation conflict (Hoffman et al. 2008, J Vision 8(3):33). Lateral arc + size + modest disparity are lower-conflict. No paper directly compares arc-vs-corridor → inference, not finding. |
| 3 | Small cards, wide arc | **REFINE** | Acuity falls off steeply outside the central ~20–30°; at ~38 PPD small+peripheral text risks illegibility. **Keep legible text near the central field; periphery carries status glyph/color only.** |
| 4 | Bright text, no bloom | **SUPPORTED** | OST legibility is a sharp-edge/high-contrast problem (Gabbard, Swan & Hix, *Presence* 2006; Gabbard et al., IEEE VR 2010). Bloom smears the one channel you can't lose. |
| 5 | Color = status only, never alone | **SUPPORTED (strongly)** | ~8% of men red-green deficient (Wong 2011, *Nature Methods*; Okabe-Ito) **and** OST background-blending shifts perceived hue — color is doubly unreliable here. |
| 6 | Stillness is the luxury | **SUPPORTED** | Peripheral motion involuntarily captures attention; in wide-FoV AR the periphery is the *real world*. Static-until-event is correct. |
| 7 | Everything in-scene, no DOM | **PARTIAL / REFINE** | Head-locked 2D "swims" against stereo depth — right to avoid. But a *minimal* screen-locked layer is defensible for safety-critical/always-available cues (our fatal-error div qualifies). |

**Key refs (solid):** Gabbard/Swan/Hix *Presence* 2006 (DOI 10.1162/pres.2006.15.1.16); Gabbard et al. IEEE VR 2010 (DOI 10.1109/VR.2010.5444808); OST color-blending arXiv:1908.09348; Hoffman et al. 2008 VAC (DOI 10.1167/8.3.33); Wong 2011 *Nature Methods* (DOI 10.1038/nmeth.1618).

**Strongest refinement (adopted in code):** hue is the *least* trustworthy channel on OST, so status should be carried primarily by **position/shape/label**, with color as reinforcement. Our cascade already does this (⛓✗ glyph + dimming + red), but it's worth stating in the paper as a deliberate design response, not a coincidence.

**RED FLAGS:** (a) the **PPD number** — ~33 is unverified; geometry gives ~38 PPD horizontal (57° is *diagonal*). Cite ~38 geometric; call ~33 an observed/effective value only if sourced. *(Fixed in `constants.js`.)* (b) "Arc beats corridor" has **no direct citation** — present as reasoned inference from VAC + acuity, or a reviewer calls it opinion. (c) The arc's own disparity still conflicts with the fixed focal plane; it *reduces*, doesn't remove, VAC.

---

## Axis C — User-study methodology + IRB (for the Monday Yang call)

**Recommended design (defensible in front of an IEEE VR reviewer):**

- **Within-subjects**, every participant sees all three displays. Field norm
  (~92.7% of VR object-interaction studies) and the only way small n works —
  it removes between-person variance (huge for spatial ability).
- **n = 12 or 18, a multiple of 6** so a **balanced Latin square** over the
  3! = 6 condition orders is fully crossed — the clean defense against
  order/learning effects. n=12 is the floor; n=18 matches the published
  per-study VR norm. Pre-register the target + a **sensitivity power
  analysis** (at n=12, RM-ANOVA α=.05/80% power detects ~f≈0.4 / large
  effects — state this honestly, don't claim small-effect sensitivity).
- **Trials/condition:** 2 practice (discarded, distinct chain) + 6–8 scored,
  each a different tampered chain **matched across conditions** for difficulty
  (same length, tamper depth, downstream fan-out). Randomize which chain
  appears on which display per participant.
- **Measures:** (1) time-to-correct-localization (log-transform; RT is
  skewed); (2) **impact-scope accuracy = F1/Jaccard** of the participant's
  named affected-set vs. the true downstream set in the DAG. Report
  localization correctness (binary) *separately* from scope F1 so
  fast-but-wrong can't masquerade as good.
- **Stats:** time → RM-ANOVA + Mauchly/Greenhouse-Geisser, fall back to
  **Friedman + Wilcoxon (Holm)** if non-normal at small n; accuracy (bounded)
  → Friedman/Wilcoxon or a beta/binomial GLMM. **Always report effect sizes
  (partial η², Kendall's W) + within-subject 95% CIs** — p-only reads as a
  defect at this n.

**IRB path (US / Yeshiva University):** almost certainly **Exempt — Common
Rule Category 2 (or 3 "benign behavioral interventions"), 45 CFR 46.104(d)**.
Adults, ~30–45 min timed puzzle, no sensitive data, de-identified (codes, no
names). Submit as exempt citing 46.104(d)(2)/(d)(3) with protocol, recruitment
text, consent script, **SSQ**, task materials. The one thing that can bump you
to *expedited* is the Quest VR-sickness angle — pre-empt it: screen out
photosensitivity/vestibular history, administer the SSQ pre/post, stop anyone
who reports discomfort. **Timeline:** exempt clears ~1–3 weeks, expedited
3–6 weeks. **What blocks recruitment:** nothing until the determination letter
— you cannot enroll one participant before it. **What blocks nothing:** writing
the protocol, building the three conditions, and piloting on lab members
(pilot-to-refine is fine pre-approval; just don't analyze that data). **Submit
by mid/late July** to leave 4 weeks before 2026-08-24.

**Reviewer objections to design out NOW:** (1) underpowered → within-subjects
+ Latin square + multiple trials + pre-registered sensitivity analysis;
(2) novelty effect → familiarization phase + order counterbalancing + prior-VR
covariate; (3) confounds (text legibility / input / sickness differ per
display) → hold text constant in **angular units (DVA)** across displays, use
one input modality (ray-point on both HMDs), report SSQ; (4) ceiling/floor →
pilot so mean accuracy lands ~40–70%; (5) cherry-picking → **pre-register on
OSF** (hypotheses, primary outcomes, exclusions, exact tests) before data.

**Sources (all solid):** 45 CFR 46.104 (law.cornell.edu/cfr/text/45/46.104;
ecfr.gov); OHRP exemptions + Limited-IRB FAQ (hhs.gov/ohrp); Pitt HRPO benign-
behavioral-interventions guidance; VR evaluation guidelines
(vrevaluation.github.io/guidelines.html); SSQ psychometrics (PMID 31563798);
Friedman-as-nonparametric-RM-ANOVA. IEEE VR within-subjects display-comparison
exemplars exist (e.g. an N=20 longitudinal 2D/VR/AR eye-hand study).

---

## Axis D — Provenance / audit-log visualization prior art

_From the completed prior-art research pass. Several arXiv ids / 2025–26
titles are flagged **unverified** and must be checked before citing._

### Prior art landscape

- **Merkle/hash-chain visualizers (2D, toy):** didactic web tools showing the
  root-changes-when-a-leaf-edits avalanche (hashexplained, Blockchain Academy
  Mittweida). Not tied to a real signed artifact, no verifier.
- **Git-history viz — Gource (solid):** animated 3D-ish repo history, but
  visualizes *authorship*, not a verifiable tamper-evident chain; no verifier,
  no break-cascade.
- **Transparency logs / content provenance (verifiable, not spatial):**
  **Sigstore Rekor** + **rekor-monitor** (solid) — real Merkle transparency
  log w/ inclusion/consistency proofs, CLI/API only, no spatial UI. **C2PA /
  Content Credentials** (solid) — X.509-signed manifests, flat per-asset
  "inspect" popover, no chain replay.
- **Immersive security / SOC / forensic VR (spatial, not verifiable-chain):**
  immersive cyber-situational-awareness surveys + SOC-in-VR studies (Kabil et
  al., Computers & Security 2023 — verify) render *network/attack graphs*, not
  signed audit logs.
- **Bank/financial AR — a graveyard (solid):** Fidelity StockCity (2014,
  Rift), Citi HoloLens Holographic Workstation (2016) — POCs that visualized
  *market data* and did not persist. Lesson: financial AR dies the day-30
  utility test; it must be the fastest way to *do a real job*, not spectacle.

### Closest works & how Shadow differs

1. **Merkle visualizers** — nearest concept (edit-leaf → root breaks); Shadow
   uses a *real* Ed25519-signed agent bundle, runs an *actual* verifier
   in-scene, and is spatial/replayable, not a 4-node toy.
2. **Gource** — nearest 3D-temporal; no crypto verification, no tamper
   semantics; Shadow's edges *are* hash links whose breakage a verifier
   computes.
3. **Sigstore Rekor** — nearest on verifiability; no spatial UI, monitors
   package-signing infra; Shadow reuses RFC 3161 / Rekor anchoring as a
   *backend* primitive under a spatial audit UI.
4. **SOC/cyber-SA VR** — nearest on security-in-XR; renders topology for
   monitoring, not a signed tamper-evident chain with a verifier-driven
   cascade.

### Honest novelty statement (paper-ready)

> To our knowledge, no prior system provides spatial (3D/XR) replay of a
> cryptographically verifiable AI-agent audit chain in which a real in-scene
> verifier recomputes signatures/hash-links on user tampering and renders the
> resulting break-cascade. The primitives exist separately (transparency logs,
> 3D history viz, immersive security analytics); binding a live verifier to an
> interactive tamper over a signed agent-evidence bundle appears unprecedented.

Scope it as "to our knowledge," not an existence proof.

### Positioning implications (product)

- **Commodity (consume, don't reinvent):** Ed25519, Merkle batching, RFC 3161,
  Sigstore/Rekor. Table stakes; they lend credibility.
- **Moat:** verifiable-replay + tamper-cascade, and the discipline that only
  hash-chain provenance genuinely earns 3D. Competitors either verify without
  visualizing (Rekor/C2PA) or visualize without verifying (Gource, SOC-VR).
  Shadow sits in the empty cell.

### RED FLAGS / verify before submission

- No verified work fully preempts the core claim.
- **Verify:** VisGuard ("tamper-resistant data retrieval for visualization")
  and any IEEE VIS/VR 2025–26 "replay for handover" paper (titles/DOIs); any
  emerging C2PA 3D/AR viewer; vendor "agent provenance" blogs that might ship a
  viewer. Several arXiv ids in this axis are unverified.

---

## Axis E — WebXR / XREAL technical reality

**All three setup facts CONFIRMED (one wording fix), plus the single biggest
implementation risk surfaced.**

- **XREAL One Pro + Eye = DP-alt display, exposes nothing to the browser —
  CONFIRMED.** X1 does on-device 3DoF/stabilization consumed *internally*; the
  Mac sees a 1080p120 monitor, no WebXR/pose/camera. **Wording fix:** the
  glasses world-lock the mirrored *image* via firmware 3DoF, so say **"the
  rendered viewpoint is static,"** not "the image is head-fixed."
- **macOS Chrome has no immersive-ar — CONFIRMED.** Quest 3 (Meta Horizon
  browser) is the mature WebXR target.
- **Offline file:// single build — CONFIRMED** with the constraint we hit:
  Chrome gives file:// a null opaque origin blocking ES-module imports *and*
  fetch/XHR (even to sibling files). Fix = **one classic `<script>` IIFE, all
  assets inlined**. Validated — this is exactly our build.

**⚠️ #1 implementation risk (verify on hardware): XREAL SBS signal mode.**
Many XREAL 3D modes expect a **frame-packed 3840×1080 full-width-per-eye**
signal, NOT a half-width squeeze. `stereo.js` renders two half-width viewports;
if the glasses are in frame-packed mode each eye is horizontally squished and
depth reads wrong. *(Flagged in `stereo.js` + DEMO_SCRIPT pre-flight as the
top check.)*

**Other gotchas (folded into code):** `THREE.StereoCamera` for correct
asymmetric-frustum convergence *(done)*; `eyeSep ~0.03–0.045` on the small FoV
*(default lowered 0.062 → 0.045)*; Quest pinch surfaces as **`selectstart`** on
the hand input source, not `pinchstart` *(now binds both)*; Quest needs
**https** — file:// won't grant an immersive session, so the Quest study
condition can't share the offline build *(noted in `webxr.js`)*.

**Is the 3-condition framing defensible? YES — if named precisely.** Call the
XREAL condition a **"spatially anchored stereoscopic display (stereo disparity
without head-coupled motion parallax)"** — the **fish-tank VR** lineage (Ware,
Arthur & Booth 1993) minus head-coupling. Isolate the two dimensions: **stereo
disparity** (conditions 2 & 3) vs **head-coupled motion parallax** (condition 3
only); cite **Milgram & Kishino's reality–virtuality continuum**. Never call
XREAL "immersive VR" or "AR" in the methods — the honest scoping is the
confound isolation reviewers want.

**Sources (solid):** XREAL One Pro shop + VR-Compare; Nebula-for-Mac; Meta
Quest WebXR docs; W3C WebXR + MDN; three.js StereoCamera; Ware/Arthur/Booth
fish-tank VR; MDN file:// null-origin CORS.

---

## Synthesis → the three consumers

### 1 · IEEE VR 2027 paper (deadline 2026-08-24)

- **Hypothesis, task-scoped (A + E):** *spatial anchoring (stereo disparity,
  and head-coupled parallax) reduces time-to-locate-the-break and improves
  downstream-impact-scope accuracy vs a flat 2D report, because tamper-tracing
  is a path-following task.* Never "3D wins." Cite Ware & Franck 1996 (the ~3×
  path-tracing result) as the anchor, Kraus VIS 2019 (immersion aids
  structure), and Bach VIS 2017 *defensively*.
- **Framing (E):** three points on a spatiality continuum — 2D flat →
  spatially-anchored stereoscopic (fish-tank-VR-minus-head-coupling) →
  head-tracked immersive. Milgram & Kishino continuum. This confound isolation
  is a *strength*.
- **Method / design (C):** within-subjects, **n = 12 or 18** (multiple of 6 →
  balanced Latin square), 2 practice + 6–8 matched-difficulty scored trials,
  measures = log-time + **impact-scope F1** (separate from binary
  localization), stats = RM-ANOVA/Greenhouse-Geisser with Friedman fallback +
  effect sizes + within-subject CIs. **Pre-register on OSF.**
- **Related Work / novelty (D):** "to our knowledge, first spatial replay of a
  *verifiable* agent audit chain with a live-verifier tamper cascade." Verify
  the flagged 2025–26 titles (VisGuard; replay-for-handover; C2PA AR viewers)
  before submission.
- **Design section (B):** present the 7 principles as OST-grounded design
  responses (additive display, VAC, acuity, color-blending), citing
  Gabbard/Swan + Hoffman 2008 + Wong 2011. State that status is carried by
  position/shape/label with color as reinforcement — the OST-correct choice.

### 2 · The live demo

- Everything already built holds. Research-driven code fixes shipped this pass:
  PPD comment corrected to ~38 geometric, `eyeSep` default → 0.045, Quest
  `selectstart` binding, SBS-mode + Quest-https warnings in code + docs.
- **Highest pre-demo action = verify the XREAL SBS signal mode on the real
  glasses** (frame-packed vs squeeze). This is the one thing that can make the
  stereo look wrong; everything else is tuning.
- Keep legible text central; periphery = status glyph/color (Axis B #3).

### 3 · The Monday Yang call (IRB)

- **The study is almost certainly IRB-Exempt (Common Rule Cat 2 / 3, 45 CFR
  46.104(d)).** Adults, ~30–45 min timed puzzle, de-identified.
- **Submit as exempt NOW (mid/late July)** — the determination letter is the
  *only* thing that blocks recruiting a single participant; it clears in
  ~1–3 weeks, so submitting late July leaves the 4-week margin before 8/24.
- **Pre-empt the VR-sickness bump to expedited:** screen photosensitivity/
  vestibular history + administer the SSQ + stop-on-discomfort. Say this in the
  protocol.
- **Not blocked by IRB:** writing the protocol, building all three conditions,
  and piloting on lab members (just don't analyze pilot data).

## Action items (ranked)

1. **Submit the IRB exempt application** (Yeshiva) by late July — the critical
   path for the whole study. Bring the Axis-C design to the Yang call so the
   protocol writes itself.
2. **Pre-register the study on OSF** (hypotheses, primary outcomes = time +
   impact-scope F1, exclusions, exact tests) before any data collection.
3. **On the glasses: verify the SBS signal mode** (frame-packed vs squeeze) —
   top hardware risk.
4. **Before submission, verify the flagged 2025–26 prior-art titles** (VisGuard;
   replay-for-handover; C2PA AR viewers) so the novelty claim is airtight.
5. **Paper drafting:** lead Method with the fish-tank-VR framing + the
   task-scoped hypothesis; cite the anchor set (Ware & Franck 1996, Kraus 2019,
   Bach 2017, Gabbard/Swan, Hoffman 2008, Milgram & Kishino).

> Full agent memos (with all URLs/DOIs) are preserved in the research task
> transcripts for this session; citations marked **(verify)** must be confirmed
> before the paper.
