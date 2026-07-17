# IEEE VR 2027 — Method / Study Design (working draft)

> Draft for Alex + Lora to edit. Grounded in the 2026-07-16 deep-research pass
> (`research-2026-07-16-deep-research.md`). Citations marked **(verify)** need
> a title/DOI check before submission. Plain working prose — tighten before it
> goes in the paper. Deadline 2026-08-24.

## 3. Study

We compare how three display conditions affect an auditor's ability to locate a
tampered event in a signed agent audit log and to state which downstream events
that tamper invalidates.

### 3.1 Task

Each trial presents one cryptographically signed evidence bundle from an AI
agent session: an ordered chain of events (prompt, tool_call, tool_result,
etc.), each carrying a payload hash and a link to the previous event's hash,
with an Ed25519 signature over the Merkle-batched root. In every trial one
event's payload hash has been altered after signing, which breaks the hash link
and leaves every later event unverifiable against the signature. The
participant does two things: (1) identify the altered event, and (2) select the
set of events made unverifiable by the break.

The task is forensic path-following: follow the chain, find where it breaks, and
trace the break's reach. We chose this task because path-following over a graph
is the analytic task with the clearest prior evidence for a stereo/spatial
benefit (Ware and Franck 1996; Ware and Mitchell 2008), not because we expect
3D to help in general.

### 3.2 Display conditions

Three conditions place the same scene on a gradient of spatiality:

1. **Flat 2D** — the audit chain as a standard 2D report on a desktop monitor.
2. **Spatially anchored stereoscopic** — the chain rendered in side-by-side
   stereo on XREAL One Pro optical see-through glasses, world-anchored so the
   rendered viewpoint stays fixed as the participant moves. This is stereo
   disparity without head-coupled motion parallax: fish-tank VR (Ware, Arthur,
   and Booth 1993) with the head coupling removed, since the glasses expose no
   head pose to the application.
3. **Immersive** — the same scene in a Quest 3 head-tracked headset, adding
   head-coupled viewpoint and motion parallax.

The conditions isolate two cues. Stereo disparity is present in conditions 2
and 3; head-coupled motion parallax is present only in condition 3. We describe
the gradient using the reality–virtuality continuum (Milgram and Kishino 1994).
We do not call condition 2 "immersive VR" or "AR"; it is a spatially anchored
stereoscopic display, and keeping that distinction is what lets us attribute any
effect to a specific cue.

### 3.3 Participants and design

Within-subjects: every participant uses all three displays. We recruit **n = 18**
adults (minimum n = 12), a multiple of six so that a balanced Latin square over
the 3! = 6 condition orders is fully crossed, which controls order, learning,
and fatigue effects. We pre-register the target n and a sensitivity power
analysis; at n = 12 a repeated-measures analysis at alpha = .05 and 80% power
detects roughly f = 0.4 (large) effects, and we report the study as powered for
large effects, not small ones.

### 3.4 Apparatus

The audit bundles are real evidence bundles produced by our attestation library:
each is a session of events with per-event SHA-256 payload and chain hashes, an
Ed25519 signature over the Merkle-batched root, and an in-browser verifier that
recomputes the chain and signature. Trials are generated to matched difficulty:
within a set, every bundle has the same chain length, the same tamper depth
(position of the altered event), and the same downstream fan-out (number of
events after the break), so the display comparison is not confounded with
puzzle difficulty. Which bundle appears on which display is randomized per
participant. The three renderers share one scene description; the flat, stereo,
and immersive builds differ only in how they present it. Text size is held
constant in angular units across displays so legibility does not differ by
condition.

### 3.5 Procedure

After consent, participants complete a short demographic and prior-XR-use form.
Because condition 3 uses a headset, we screen out anyone with a photosensitivity
or vestibular history and administer the Simulator Sickness Questionnaire
(Kennedy et al. 1993) before and after each headset condition, stopping any
participant who reports discomfort. Each condition begins with two practice
trials on a separate chain (discarded), followed by six to eight scored trials.
Sessions last about 30–45 minutes.

### 3.6 Measures

- **Localization correctness** — whether the participant identifies the altered
  event (binary), reported separately so a fast wrong answer cannot look good.
- **Impact-scope accuracy** — the F1 (or Jaccard) overlap between the events the
  participant marks as unverifiable and the true downstream set, scored against
  ground truth from the generator.
- **Completion time** — time to a correct localization, log-transformed because
  response times are right-skewed.

### 3.7 Analysis

For completion time we use a one-way repeated-measures ANOVA (factor: display,
three levels) with Mauchly's test and Greenhouse–Geisser correction, and fall
back to the Friedman test with Kendall's W and Holm-corrected Wilcoxon
signed-rank post-hoc tests if residuals are non-normal at this sample size. For
the bounded accuracy measure we use Friedman/Wilcoxon or a beta or binomial
generalized linear mixed model on trial-level data. We report effect sizes
(partial eta-squared, Kendall's W) and within-subject 95% confidence intervals,
and we pre-register the hypotheses, primary outcomes (completion time and
impact-scope F1), exclusion rules, and tests before collecting data.

### 3.8 Ethics

The study is minimal risk: adults, a short timed task, no sensitive data, and
de-identified records. We submit it to the university IRB as exempt under the
Common Rule (45 CFR 46.104(d)(2)/(3)) with the headset-sickness safeguards
above.

---

## Related work / novelty note (for §2)

Verifiable provenance and audit tooling exists but does not visualize a chain
spatially: transparency logs (Sigstore Rekor) and content provenance (C2PA)
verify without a spatial interface, while 3D history tools such as Gource
visualize authorship without verification. Immersive security work has put
network and attack graphs in VR but not signed, tamper-evident audit logs.
Earlier financial AR demos (Fidelity StockCity 2014, Citi HoloLens 2016)
visualized market data and did not persist. To our knowledge, no prior system
provides spatial replay of a cryptographically verifiable agent audit chain in
which a real verifier recomputes hashes and signatures under user tampering and
renders the resulting break. We scope this as "to our knowledge," and we verify
the closest recent titles before submission.

Anchor citations to confirm: Ware and Franck 1996 (stereo + motion, path
tracing); Ware and Mitchell 2008; Kraus et al. VIS 2019 (immersion, cluster
identification); Bach et al. VIS 2017 (3D not always better — cited to bound the
claim); Ware, Arthur, and Booth 1993 (fish-tank VR); Milgram and Kishino 1994;
Gabbard, Swan, and Hix, Presence 2006 and Gabbard et al. IEEE VR 2010 (OST
legibility); Hoffman et al. 2008 (vergence–accommodation); Kennedy et al. 1993
(SSQ).
