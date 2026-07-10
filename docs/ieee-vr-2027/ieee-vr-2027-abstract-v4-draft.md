# IEEE VR 2027 — Abstract v4 (draft)

**Status**: draft. Not submitted. Alex reviews before any submission action.

**Track**: Poster / short paper (target). Submission deadline 2026-08-24.

**Change from v3**: pivots away from "AI council in VR" (indefensible novelty) to "spatial forensic replay of cryptographically attested agent trajectories." The core visual is the same walk-the-chain interaction shipped in `demo/xreal.html`; the framing and the related-work anchor set change.

---

## Title

**Spatial Forensic Replay of Cryptographically Attested AI Agent Trajectories**

Alternate titles for consideration:
- Walking the Evidence Chain: A Spatial Interface for AI Agent Audit
- Chain-Corridor: Rendering Tamper-Evident Agent Traces in Immersive 3D

## Authors (in draft order)

Alex Xiaoyu Ji (Yeshiva University Katz School of Science) · Loredana C. Levitchi (Columbia University) · Hieu Ngo, PhD (Yeshiva University Katz School of Science)

Second-author decision (Lora vs Hieu) pending Alex + Lora's Sunday review per the 2026-06-19 co-first-authorship agreement, and Hieu's 2026-06-25 confirmation as pedagogical scaffolding + spatial-XR faculty consult. Placement here is provisional.

## Abstract (250 words target)

AI agents are increasingly delegated multi-step work in regulated settings — from Claude Code sessions that edit codebases to underwriter-assist workflows in banks. Debug-grade observability tools such as LangSmith and Langfuse capture the *why* of an agent session for engineering iteration. They do not, however, produce evidence that will survive a later audit: their logs are mutable telemetry designed for platform velocity, not for cryptographic integrity months after the fact. When EU AI Act Article 12 takes effect on 2026-08-02 and requires high-risk AI systems to automatically record events, the standards that describe *how* to record are still in draft. This creates a specification gap between what regulators demand and what any shipped agent stack actually produces.

We present a system that treats an agent session as a chain of Ed25519-signed events, then renders the chain as a spatial corridor a human auditor can physically walk. Each block on the corridor is one event — a tool call, a file write, a model output. Selecting a block expands its typed-claim envelope in place. Introducing a tamper mutation causes the offending block's edge glow to shift red and the downstream chain to dim in propagation order at 24 blocks per second, with a floating caption sourced verbatim from the verifier's structured error object. The interaction demonstrates two properties that are hard to convey in a table: append-only chain integrity is a spatial invariant, and downstream contamination is a directional one.

We contribute (a) an evidence-bundle schema aligned to EU AI Act Article 12(2) and OpenTelemetry GenAI semantic conventions, (b) a WebXR replay implementation with a 2D-desktop parity mode and a side-by-side stereo mode for the XREAL One Pro, and (c) a preliminary user study comparing three presentation modalities on a shared audit task.

## Novelty claim (single sentence)

To our knowledge this is the first system to render a cryptographically signed AI-agent event chain as an interactive spatial artifact whose integrity properties — append-only, downstream-contamination — are expressed as directly perceivable spatial invariants rather than as tabular metadata.

## Contributions

1. **Evidence-bundle schema** — a JSON schema for a session-scoped chain of Ed25519-signed events, with a mapping table to Article 12(2)(a), (b), and (c) record purposes and to OpenTelemetry GenAI semantic conventions. The schema is frozen as `schema_version: 1` and published in the paper's supplementary material.
2. **Chain-corridor renderer** — a WebXR + three.js implementation that runs in three modes from one code base: 2D desktop fallback (mouse orbit, keyboard navigation), 3840×1080 ultrawide, and side-by-side stereo for the XREAL One Pro spatially anchored display. XREAL uses the glasses' internal X1-chip 6DoF anchoring; our application treats the display as an anchored virtual monitor, not as an immersive VR runtime.
3. **Tamper-cascade demonstration** — a state machine that mutates a single event's payload and calls the actual verifier (not a simulation). The verifier's structured error output populates the in-scene floating caption verbatim, so the visual behavior and the machine-readable output are provably the same object.
4. **Preliminary user study** — a within-subjects comparison of 2D flat, 6DoF-anchored ultrawide, and immersive WebXR (Quest 3) on a fixed audit task: locate the tampered event and report the propagation extent. Report reading time, correct-identification rate, and self-reported confidence.

## Related work (short form for the abstract; full lit review in the paper body)

- Program visualization traditions (Chi et al., 1998; Reiss, 2003; Wanner et al., 2019).
- Cryptographic transparency logs and Merkle audit trees (Certificate Transparency, Sigstore, Rekor).
- LLM observability platforms (LangSmith, Langfuse, Arize Phoenix, Datadog LLM Observability).
- Immersive analytics for time-series data (Marriott et al., 2018).
- Evidence-based visualization for regulated domains (Munzner et al., 2015).

## Why 3D — one paragraph

Agent sessions are not linear. A single Claude Code turn can spawn nested tool calls; a single OpenAI Realtime session interleaves user speech, model output, and function-call spans across three simultaneous timelines. A tabular renderer must either collapse this branching structure into a flat scroll (losing sibling-sibling relationships) or expand it into a wide table (losing time-order at a glance). The spatial arrangement puts sibling spans at the same corridor depth and lets the auditor step past them; expansion of a span happens in place; downstream contamination is a directional visual that requires no legend. This is not a claim that immersion is required for auditing. It is a claim that agent-session integrity has spatial structure and that mapping that structure onto space reduces the cognitive load of a specific audit task. The user study is designed to test that claim, not to assume it.

## What we explicitly do not claim

- We do not claim the system is legally admissible in any jurisdiction; that determination is legal, not visual.
- We do not claim the private-key-holder cannot rewrite history. That threat requires an external time anchor (RFC 3161 TSA or a public transparency log), which our design accommodates but which is out of scope for this paper's contribution.
- We do not claim VR is superior to 2D for all audit tasks. The user study includes a 2D condition specifically to characterize where the spatial rendering helps and where it does not.

## Method for the user study (paper body)

- **Participants**: N ≥ 24 with mixed audit / software-engineering background, recruited through the authors' academic networks.
- **Task**: presented with a 47-event agent session containing exactly one tampered payload, identify the tampered event and the extent of downstream contamination.
- **Conditions** (within-subjects, counterbalanced): 2D desktop; XREAL One Pro anchored ultrawide; Quest 3 immersive WebXR.
- **Measures**: time to correct identification, reported propagation extent (correct / partial / wrong), NASA-TLX, one open-ended debrief question.
- **Analysis plan**: repeated-measures ANOVA on time; McNemar tests on identification accuracy; qualitative thematic coding on the debrief.
- **Pre-registration**: analysis plan and hypotheses pre-registered on OSF before data collection begins.

## Reproducibility statement

The complete render implementation is open-source under MIT license at `github.com/alex-jb/shadow-mentor`. The `evidence-bundle` schema, the XREAL demo build, the acceptance-demo bundle, and the user-study protocol will be released as paper supplementary material. The pre-recorded session used in the tamper demonstration is included as supplementary data, with sanitization documentation.

## Reviewer objections we anticipate and pre-answered

- *"This is a visualization paper, not a VR paper."* Correct as stated; the contribution is that the spatial rendering is well-matched to the properties of the underlying artifact and the user study characterizes when the mapping pays off vs when it does not. The XREAL 6DoF-anchored condition and the Quest 3 immersive condition are distinct enough that the design space for spatial auditing UIs is what is being explored.
- *"Why not just use LangSmith?"* Different category — debug observability vs cryptographic evidence. LangSmith's logs are mutable telemetry. This system's logs are signed, chained, and offline-verifiable. The visualization is derivative from that difference.
- *"Ed25519 + Merkle audit chains are 20 years old."* The primitives are old; the mapping onto an interactive spatial audit interface with tamper cascade as a visual invariant is not. The novelty is in the mapping, not in the crypto.

## Alignment with Alex's July 2026 capstone artifacts and July-August 2026 launch

- Capstone presentation 2026-07-16 demos the same code path (chain-corridor + tamper cascade) on the XREAL One Pro that this paper describes.
- The v3.0 launch targeted at 2026-08-02 EU AI Act enforcement window uses the same schema described in Contribution 1.
- One engineering artifact supports two deliverables. No divergent branch.

---

## Next actions before submit

1. Alex reviews v4 draft; picks one of the two candidate titles.
2. Confirm co-authorship placement with Lora (Sunday review per 2026-06-19 agreement) and Hieu (2026-06-25 confirmation).
3. Word-cut the abstract to the venue's strict limit (typically 250 or 300 words for IEEE VR posters — verify against the 2027 CFP when released).
4. Register the user-study protocol on OSF; wait for approval before submitting.
5. Submit no earlier than 2026-08-15; deadline 2026-08-24.
