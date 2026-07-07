# Shadow XR Visual Paradigm v3 — Ambient Council

**Version:** 3.0 · **Prepared:** 2026-07-06 late night, post-Alex intuition + second full-web deep research
**Supersedes:** `xr-visual-paradigm-2026-07-06-v2-JARVIS.md`. The JARVIS design was a real improvement over the v1 tribunal, but JARVIS is 2008 aesthetic — cluttered, radial-menu-heavy, made-for-cinema-spectacle. Modern product UX (Vision Pro 2024, Severance 2022, Cursor/Linear/Warp, Her 2013) has moved past the JARVIS visual grammar. Alex called this correctly.

**Positioning:** *Ambient Council* — a context-aware, surface-anchored, voice-first AR council with restraint borrowed from Severance and Her, gaze-anchoring borrowed from Apple Vision Pro's shipped UX, and traceability badges borrowed from Perplexity. Not a menu system, not a diorama, not a hologram. A **presence with agency, restrained visual footprint, and content-anchored authority**.

**Authors:** Alex Xiaoyu Ji (design + implementation, product intuition) · Loredana C. Levitchi (regulatory-domain review + banking-audience audit)

---

## Why v2 was closer but still wrong

The v2 JARVIS document HUD paradigm was correct in spirit — content-anchored, task-driven, dismissable — but the visual reference (Iron Man 2008) is 17 years old. Its aesthetic vocabulary (radial menus, teal wireframes, ambient status bars, voice + gesture heavy) is cinema spectacle, not shipped product UX. Every 2024-2026 AR/AI product that actually replaced a workflow tool has moved *away* from JARVIS clutter toward:

- **Restraint** (Severance's two-color rule, Linear's monochrome, Cursor's inline-only AI suggestions)
- **Gaze-anchoring** (Vision Pro's focus-follows-gaze + pinch-to-select shipped since Feb 2024)
- **Voice-first with minimal visual** (Her 2013 as reference, GPT-4o voice mode 2024 as product)
- **Content-anchored** (Perplexity's citation pills anchored to specific claims; Cursor's Tab predictions anchored to cursor position)
- **Task-mode-shifting HUD** (Cyberpunk 2077 shifts HUD by task; the *pattern* is adaptable, the visual density is not)

v2 got the anchoring right but left in too much JARVIS visual grammar (radial menus, floating spatial cards, ambient status bars).

v3 keeps the anchoring, deletes the JARVIS grammar, and puts the design on the 2024-2026 UX foundation instead.

---

## What v3 IS

### The one-line pitch

**Ambient Council** = one AI compliance engine + three surface adapters (banking / trading / data-science) + one visual grammar (Severance restraint + Vision Pro gaze + Perplexity citations + Her spatialized voice). Zero context-switching for the user; zero visual noise for the reviewer.

### Three surface modes, one engine

| Mode | Anchor surface | Primary user | HUD elements (all Perplexity-style pills) |
|---|---|---|---|
| **Bank mode** | Physical loan PDF (XREAL Eye 12MP OCR + 6DoF anchor) | Compliance officer | Verdict pill (top-right of doc), reason-code badges anchored to specific numbers on the doc (FICO number, DTI ratio, LTV clause), citation pill per Reg B AA code, attestation-status pill (bottom-right) |
| **Trading mode** | Bloomberg terminal / broker platform / trading screen (screen-anchor via Eye + phone tether) | Trader, risk officer | VaR / ES violation pill anchored to the position line; AML/KYC tipping-off flag anchored to counterparty row; volatility regime pill anchored to the chart; attestation-status pill (bottom-right) |
| **Data-science mode** | Jupyter cell / Cursor buffer / Colab notebook (notebook-anchor via Eye camera or window-title recognition) | Data scientist, model validator | Attestation-verify pill anchored to model output cell; Fair Lending protected-class-proxy flag anchored inline to specific feature names; Brier calibration pill anchored to prediction outputs |

**Shared engine:** the same 5-voice council + Brier calibration + Ed25519 hash-chain + reason-code dictionary + HITL-by-invariant that Shadow ships today. Different surface adapters mean different anchoring logic + different HUD element sets; the underlying council reasoning is one codebase.

**Cross-vertical DNA:** Orallexa (Alex's Python trading agent, `github.com/alex-jb/orallexa-ai-trading-agent`, 5-voice Bull/Bear/Judge/Critic/Polyseer) is the same architecture in a different vertical. Trading mode in Ambient Council uses Orallexa as the backend; Bank mode uses Shadow as the backend; Data-science mode uses whichever calibration engine is under review. The surface layer is the product.

### Persona presence — spatialized voice + monochrome pill, not humanoid

Research (Frontiers VR 2025 Anthropomorphic AI Toolkit + arXiv 2601.22082 Auditorily Embodied + arXiv 2503.09794 Spatial Collaborators): **full humanoid embodiment triggers uncanny distrust in high-stakes advisory decisions**. When the AI says "block this loan," the user distrusts a humanoid Joi-style presence more than a spatialized voice + subtle visual pill. Her (2013) got this right: no visual UI at all, just a voice.

For Shadow, each voice is:
- **Fixed spatial audio position** relative to the reviewer:
  - Compliance Officer → left-behind
  - Risk Officer → right-behind
  - Fair Lending Compliance → overhead
  - Credit Fundamentals → left-front
  - Customer Advocate → right-front
  - Macro Contrarian → far-front (contrarian is naturally opposed to the reviewer)
  - AML/KYC Investigator (opt-in) → below-front (subtle, adversarial)
- **One 6-24pt monochrome dot** in the reviewer's peripheral vision, only when that voice is speaking or has a fresh callout to surface. Colors follow Severance's two-color rule (calm slate as base + one alert color per voice):
  - Compliance = amber
  - Risk = red-orange
  - Fair Lending = deep blue
  - Credit = green
  - Customer Advocate = warm gold
  - Macro Contrarian = purple-gray
  - AML/KYC = urgent red (only when active)

The dot fades in 300ms when the voice speaks; fades out 500ms after silence. Voice-invoked drill-down expands one voice card into full readable rationale (right-column layout for Bank mode; overlay for Trading mode; sidebar for Data mode). Only one card can be expanded at a time.

**Joi-style full presence embodiment is reserved for one specific view: Audit Replay.** When an auditor plays back a signed hash-chained deliberation, each voice appears as a subtle volumetric presence (semi-transparent, monochrome, Her-not-Joi restraint) reciting its actual rationale in that voice's spatial position. This is where emotional weight helps rather than hurts, because the auditor is inspecting a past decision, not making a new one.

### Visual grammar — two-color rule, no rainbow

Base: **calm slate** (near-black, very slight blue tint, matches Vision Pro's shipped UI base).

Alert color per voice (see above). No voice card ever uses more than its own alert color + base slate. No secondary decoration. No gradient. No animation beyond the 300/500ms fade.

Font: system default (San Francisco on Apple stack, Roboto on Android stack). No custom typeface for the demo — reviewer's eye trusts familiar system fonts under stress.

Density budget: no HUD element occupies more than **6% of the reviewer's forward field of view** at any moment. Verdict pill + reason-code badges + attestation-status pill together stay under 4% during passive viewing.

---

## Hardware pipeline (unchanged from v2)

XREAL One Pro ($599, Lora purchased) + **XREAL Eye add-on ($99, buy immediately)** + iPhone 17 or MacBook Pro as compute host. Total additional cost: $99.

**Why v3 doesn't change hardware:** the visual grammar upgrade is purely software. The 4 HUD elements (verdict pill + reason-code badges + citation pills + attestation-status pill) render on the same One Pro + Eye display at the same 57° FOV. The spatialized voice runs on the iPhone's audio subsystem. No new hardware unlocks anything v3 needs.

---

## Two-layer honest demo (unchanged from v2)

**Layer 1 (fully real)**: iPhone camera → OCR → Shadow API → verified attestation → reviewer sees real 5-voice verdict + real signed attestation on the iPhone screen.

**Layer 2 (glass HUD)**: XREAL One Pro + Eye captures fresh doc, HUD appears anchored. Frame to audience: *"Layer 1 is the compute + attestation happening live. Layer 2 is the target platform — today it tethers to a phone, tomorrow it runs on-glass. Here's what it looks like now."*

---

## Roadmap update (superseding v2)

### Immediate

- **Buy XREAL Eye** ($99, shipping today from XREAL). Alex or Lora, whoever's card is fastest.
- Draft the HUD scene JSON for Bank mode first (the July demo target). Trading mode + Data mode ship as v3.1 + v3.2 respectively in Q4 2026.

### Preflight (2026-07-07 to 2026-07-10)

- WebXR emulator dry run of Bank mode HUD (Chrome DevTools Sensors → VR profile)
- iPhone OCR pipeline hooked to Shadow API — verify round-trip <2s on Wi-Fi
- Voice-invoked card expansion prototype (Web Speech API + pinch fallback)

### On-device (2026-07-14 to 2026-07-18)

- 5-session on-device test week per updated `docs/xreal-one-pro-test-protocol/README.md` (to be refreshed in a follow-on commit tonight to reflect Ambient Council + Eye + tethered pipeline)
- Sessions test: HUD anchor stability, reason-code badge placement accuracy on 8pt loan text, voice command reliability in a quiet vs noisy room, fade-in/out timing subjective preference, spatial audio localization

### Executive Dean + VP demo (late July)

- Bank mode only for the July demo. Trading and Data modes are the "and here's where we go next" pitch slide.
- Reviewer sits at a desk, holds a printed loan application. Alex is 6 feet away with a laptop backup running the same WebXR scene. Two-layer demo as documented in v2.

---

## Roadmap after July

**v3.1 Trading mode (Q4 2026):** Orallexa backend + screen-anchor to Bloomberg / broker terminal. Target audience: institutional trading desks. Reference customer: nobody yet, but Alex has SpaceX-IPO-Tracker as a public decision log to demonstrate on.

**v3.2 Data-science mode (Q1 2027):** Jupyter cell + Cursor buffer anchor. Target audience: quant + ML validators. Reference customer: Loredana's Columbia statistics faculty introduction; Prof. Yang's capstone cohort.

**v3.3 Audit Replay (Q1-Q2 2027):** Joi-style volumetric persona embodiment for post-decision replay. Requires better display hardware (XREAL Aura Fall 2026 as the natural target). This is the *only* place Shadow uses embodied AI presence, and it's reserved for the auditor-inspecting-a-past-decision use case where emotional weight helps.

---

## What we own after this design

- **"Ambient Council" as a positioning term.** No shipping product owns it. Chen 2412.12681 and Zhu 2504.16562 use "context-aware AR" and "AI-driven adaptive AR" academically; no vendor has adopted these into product marketing. Shadow claims Ambient Council as the product surface layer over Shadow (banking) + Orallexa (trading) + future data-science-mode.
- **First-mover position across three regulated verticals** with one visual grammar. No Big-4 auditor, no bank, no LLM vendor has this. The competitive moat is not the AR technology (which is commodity XREAL + Vision Pro under the hood); it is the *council architecture + calibration discipline + hash-chained attestation* underneath, plus the visual grammar consistency across verticals.

---

## Reviewer notes for Loredana

1. **This is v3 — v2 (JARVIS) is superseded but retained in the repo for provenance.** The change is aesthetic + hardware footprint identical to v2. The engine (Shadow API + attestation + 5-voice + reason-code dictionary) is unchanged.
2. **Persona presence is spatialized voice + monochrome pill, not humanoid.** Research (Frontiers VR 2025 + arXiv 2601.22082 + arXiv 2503.09794) shows humanoid embodiment triggers distrust in high-stakes advisory decisions. This matters for banking specifically — a compliance officer needs to trust "the Compliance voice says no" more than "a humanoid Joi says no."
3. **Two-color rule per voice** (calm slate + one alert). Please tell me if you want any of the 6 alert colors reassigned before I lock the design.
4. **Three-vertical framing (Bank + Trading + Data-Science)** is the strategic upgrade. Bank mode is the July demo. Trading + Data are the roadmap. This gives the Dean + VP a clear "here's what we do next" that positions Yeshiva as the venue for a multi-vertical XR compliance product.
5. **Joi-style embodiment is deliberately reserved for Audit Replay only.** This is where emotional weight helps (auditor inspects a past decision). Everywhere else, restraint wins.

---

## Contact

- Alex Xiaoyu Ji · xji1@mail.yu.edu — design + implementation, engine + surface adapters
- Loredana C. Levitchi · [email verify] — regulatory-domain review, voice card content, per-line badge accuracy audit
- Hieu Ngo, PhD · Yeshiva Katz School — XR pedagogical scaffolding (IEEE VR co-author)

*This design doc supersedes v1 (tribunal) and v2 (JARVIS document HUD) and is the current canonical Shadow XR paradigm as of 2026-07-06. It is a public artifact of `shadow-mentor` (MIT).*

---

## Appendix A — Design references (dated sources)

- **Her (2013)** — voice-first minimalism, no visual UI. [Techpolicy analysis](https://www.techpolicy.press/five-things-the-movie-her-got-wrong-and-a-bit-right/). GPT-4o voice mode modeled on Samantha, widely reported 2024.
- **Blade Runner 2049 (2017)** — Joi as presence-not-menu; used for Audit Replay reference. [IndieWire VFX](https://www.indiewire.com/awards/industry/blade-runner-2049-denis-villeneuve-holographic-joi-of-sex-visual-effects-1201906204/).
- **Severance (Apple 2022+)** — retro-Lumon two-color rule; alert-color-per-voice adapted from this. [Designboom coverage](https://www.designboom.com/design/severance-closer-look-mid-century-brutalist-retro-futuristic-universe-lumon-03-21-2025/), [Trickle 60-30-10 rule](https://trickle.so/blog/how-severance-uses-the-60-30-10-rule-to-inspire-ui-design).
- **Cyberpunk 2077 (2020)** — task-mode-shifting HUD; pattern adapted for three-mode surface adaptation. [Super Jump UX analysis](https://medium.com/super-jump/a-ux-analysis-of-cyberpunk-2077s-hud-f74afe6b9961).
- **Vision Pro shipped UX (Feb 2024, M5 Oct 2025)** — gaze-anchor + pinch-select; reviewed extensively. [arXiv 2508.12268 iTrace AVP paper](https://arxiv.org/pdf/2508.12268), [XR Practices AVP UX](https://medium.com/xrpractices/a-ux-designers-take-on-the-apple-vision-pro-part-1-the-beginning-d12bd6e05d14).
- **Cursor + Linear + Warp restraint principle** — AI inline where user is looking, never in chrome. [Cursor for Designers](https://cursor.com/for/designers).
- **Perplexity citation anchoring** — every claim tied to a URL badge; provenance inspection.
- **Context-aware AR academic surveys** — [Zhu 2504.16562](https://arxiv.org/pdf/2504.16562), [Chen 2412.12681](https://arxiv.org/pdf/2412.12681), [Springer Ambient Intelligence for Next-Gen AR](https://link.springer.com/chapter/10.1007/978-3-032-03296-6_1).
- **Persona presence research** — [Frontiers VR 2025 Anthropomorphic Toolkit](https://www.frontiersin.org/journals/virtual-reality/articles/10.3389/frvir.2026.1794720/full), [arXiv 2601.22082 Auditorily Embodied Agents](https://arxiv.org/pdf/2601.22082), [arXiv 2503.09794 Spatial Collaborators](https://arxiv.org/pdf/2503.09794).
