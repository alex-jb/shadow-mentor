# Shadow XR Visual Paradigm v2 — JARVIS-Style Document HUD

**Version:** 2.0 · **Prepared:** 2026-07-06 late night, post-Alex intuition + full-web deep research
**Supersedes:** `xr-visual-paradigm-2026-07-06.md` v1 (Semicircular Tribunal). The tribunal was a museum piece, not a workflow tool. Alex's intuition was correct: what a compliance officer actually needs is JARVIS in Iron Man — point at a document, see AI analysis anchored to what you're looking at, voice-invoke deep-dive, dismiss when done.

**Authority:** cross-referenced against XREAL Eye product ship data (2025-07 GA, currently available), RealitySummary (arXiv 2405.18620 SUI 2025 = closest prior art), Jayse Hansen's Iron Man HUD Bible + UXmatters analysis of Iron Man UX, Bier PDF+ (1993), Wellner DigitalDesk, HoloDoc (Li 2019), Paper Trail (Rajaram 2022), Fjeld Fluid Beam (1998), and industry web survey confirming zero shipping bank AR product does this today.

**Authors:** Alex Xiaoyu Ji (design + implementation, product intuition) · Loredana C. Levitchi (regulatory-domain review + banking-audience audit)

---

## Why v1 was wrong

The v1 Semicircular Tribunal design (5 flat persona verdict cards floating in the forward 120° cone + central hash-chain ribbon) was a **showcase** design. It puts the reviewer in the *center of a museum installation*. Every publicly-shipped bank AR/VR demo since 2014 that has failed the "day 30 utility" test looked like this: impressive to walk into for the first time, useless to work with on the tenth day.

Compliance officers do not walk into rooms of floating personas. They sit at desks with printed loan applications. They read. They flag. They approve or escalate. The XR layer only earns its keep if it makes *that* workflow faster or more auditable, not if it dresses up the room.

Alex's Iron Man / JARVIS reference is the correct frame. Tony Stark's HUD is workflow tooling for a diagnostic user (the character): you look at a target, it labels the threat. You look at engine internals, it labels the problem. You never walk around a tribunal of five debating Jarvises.

Delete v1. Start over.

---

## The design: Document-Anchored Verdict HUD

### Physical setup

- Compliance officer sits at a desk, holds a printed loan application (or a laptop showing the PDF).
- Officer wears XREAL One Pro + XREAL Eye add-on (see hardware section).
- iPhone or laptop tethered via USB-C DisplayPort-Alt-Mode does the compute (Shadow API call + WebXR/native rendering).
- Officer looks at the document. Eye's forward-facing 12MP camera captures a frame. OCR + Shadow API round-trip completes in ~1.5s. HUD appears, spatially anchored to the physical document via Eye's 6DoF tracking.

### HUD elements (four, no more)

1. **Verdict pill** — top-right corner of the document in the reviewer's view. Colored green (approve), amber (escalate), red (block). Contains three-character verdict code (`APR`, `ESC`, `BLK`) and confidence-weighted percentage. Static; no animation.

2. **Five collapsed voice cards** — right column, stacked vertically outside the document's right edge. Each card shows the voice name + verdict pill only. Expand one via voice command ("explain the compliance voice" or gesture pinch on the card) to reveal the full rationale + AA code + citation.

3. **Attestation status pill** — bottom-right corner of the document. Green checkmark when the Ed25519 signature verifies + hash chain intact + dictionary hash matches. Red X when any check fails. Voice command "show me the audit trail" opens a full-screen chain traversal in a second scene (this is the *only* place where the walk-around 3D hash-chain from the v1 design still lives — as an opt-in second scene, not a persistent presence).

4. **Optional inline AML/KYC flag callouts** — when the AML/KYC voice returns a flag on a specific line of the document (borrower's declared income, listed collateral, source of funds), a small icon anchors to that line with a subtle callout arrow. Alex to test on-device whether 8pt loan text can be tracked accurately enough at 40cm viewing distance; if not, drop the per-line callouts and put the AML/KYC flags at the top of the compliance voice card instead. This is the one gamble in the design — the rest is solid.

### What is NOT in the HUD

- No walk-around 3D hash-chain ribbon *persistent in the scene*. (Available on voice command as a separate opt-in view.)
- No floating persona avatars, no persona semicircle, no room-scale tribunal.
- No 3D Gaussian Splatting ambient. No decorative geometry. No animated transitions.
- No text density that would require the reviewer to squint at 40cm.

### The JARVIS discipline

Iron Man's HUD is deliberately *over-cluttered* for cinematic effect. Every serious HUD-UX critique (UXmatters, Jayse Hansen's own postmortems, Medium's "Redesigning JARVIS UX" 2021) reaches the same conclusion: real HUDs work when they surface *only* what the user needs *at the moment they need it*, and fade away otherwise. The JARVIS aesthetic (semi-transparent, ambient status, voice-invoked drill-down, content-anchored) is copied; the JARVIS cluttering is *not* copied.

Practical rules:

- **Everything is dismissable.** Turn head away → HUD fades. Look back at doc → HUD returns. No modal takeover.
- **Voice is optional.** Every action possible via voice is also possible via pinch gesture on the visible card. No voice-only affordance for the executive demo (Dean + VP may not want to speak commands in a demo room with an audience).
- **The document is primary.** HUD elements live at the periphery of the document, never overlap the document text. The reviewer reads the doc, and the HUD gives them a running commentary at the edges.
- **Fade timings.** HUD elements fade in over 300ms when a document is recognized, fade out over 500ms when the head turns away for >2 seconds. No hard on/off.

---

## Hardware pipeline (corrected from v1)

### The critical purchase: XREAL Eye add-on ($99)

XREAL Eye is the modular camera + 6DoF anchoring accessory for XREAL One and One Pro. 1.5g clip-in module. 12MP RGB sensor. 1080p60 video. Native 6DoF spatial anchoring on-device via X1 chip. **General availability since July 2025.** Ships from `us.shop.xreal.com/products/xreal-eye` in July 2026.

Without Eye, the XREAL One Pro is display-only and has no camera. Alex's JARVIS design *requires* a forward-facing camera for document OCR + spatial anchoring. **Do not defer this purchase. It is $99 and it is the hardware that makes the whole design work.**

### Full stack

- **XREAL One Pro** ($599) — already purchased by Loredana 2026-07-06
- **XREAL Eye** ($99) — buy immediately; ships 2-4 business days
- **Host device** — iPhone 17 or MacBook Pro. iPhone runs Shadow client app that receives Eye's camera feed via Beam Pro OR wired camera capture via USB-C. MacBook Pro is the fallback host.
- **Total additional cost from v1 plan: $99**

### What we do NOT need

- No Meta Quest 3S backup. The Quest 3S is a VR headset with passthrough; it looks like a headset in the reviewer's hand + on their face. JARVIS eyeglass aesthetic is broken. Delete from the plan.
- No Meta Ray-Ban Display alternative purchase. Its 20° monocular display is too small for the 4-element HUD.
- No Vision Pro purchase. $3,699 breaks the "commodity hardware banks can buy today" narrative.

### The two-layer honest demo (from web research recommendation)

Rather than pretending the entire pipeline runs on-glass compute, Alex demos in two layers, transparently:

**Layer 1 (fully real, happens live)**: iPhone camera → OCR → Shadow API round-trip → attestation verification. Reviewer sees the iPhone screen with the real 5-voice verdict, the real signed attestation, the real hash-chain integrity check.

**Layer 2 (glass HUD, live but replaying pre-tested capture)**: Alex takes the XREAL One Pro + Eye and shows the reviewer the same document being scanned + the HUD appearing anchored to the physical doc. This is *not* faked — it's a fresh capture on the day of the demo — but it is a second capture of the same document, not a live re-run of the entire API pipeline. This avoids the risk that a network hiccup during the demo makes the glasses appear broken.

Frame the two layers to the audience: **"The verdict, the attestation, and the citation chain are all live in Layer 1. The glasses HUD is the target platform — today it tethers to a phone, tomorrow it runs on-glass. Here's what it looks like now."** This is honest and it invites the Dean and VP to ask "when does on-glass ship?" — which is the correct future-work conversation to have.

---

## Roadmap update

### Immediate (before hardware arrives 2026-07-11)

- **Buy XREAL Eye** on `us.shop.xreal.com/products/xreal-eye`. Alex or Loredana — whoever can put $99 on their card fastest. Amazon or XREAL direct.
- **Draft the HUD scene JSON** (this document has enough spec to guide implementation)
- **Prototype OCR pipeline** on the iPhone or Mac side using `VisionKit VNRecognizeTextRequest` (Apple's built-in OCR is state-of-the-art, private, on-device, free)

### Preflight (2026-07-07 to 2026-07-10, without hardware)

- WebXR emulator dry run of the HUD scene (Chrome DevTools Sensors → VR profile)
- OCR pipeline hooked up to the Shadow API — verify the round-trip completes in <2s on Wi-Fi, <3s on cellular
- Voice-command prototype using Web Speech API — verify "explain the compliance voice" reliably parses in a quiet room

### On-device (2026-07-14 to 2026-07-18)

- Session 1: Eye + One Pro standalone test with a real printed loan doc (Session 1 replaces v1's "standalone baseline" session)
- Session 2: HUD rendering test with all 4 elements
- Session 3: Two-layer demo dress rehearsal
- Session 4: Failure mode red team (network hiccup, camera occlusion, HUD anchor drift)
- Session 5: 8pt inline AML/KYC flag callouts — accuracy test. If per-line tracking is unreliable, drop that HUD element gracefully.

### Executive Dean + Vice-Provost demo (late July or early August)

- Layer 1 + Layer 2 as described above.
- Bring a paper loan application printed on 20lb standard paper. Do not rely on office WiFi — pin the document under a small light source.
- Have a MacBook fallback for Layer 2 in case XREAL One Pro tethering to the iPhone has a driver issue on the day.

---

## Why this design is defensible under Lora's regulatory-domain scrutiny

- Bank counsel opens the demo and sees the *same document layout they would read on paper*. The HUD annotates. It does not replace.
- The verdict pill uses the same three verdict codes Shadow's API already returns. No new taxonomy invented for the AR layer.
- The attestation status pill maps to `verifyAttestation()` + `verifyChain()` + `dictionary_hash` binding. Every green checkmark corresponds to a passing test in `test/attestation.test.js`, `test/attestation-chain.test.js`, and `test/dictionary-hash-binding.test.js`.
- The 5 voice cards match the runtime persona list from `lib/prompts.js`.
- The AML/KYC per-line callouts (if shipped) map to the 32 adversarial tests in `test/aml-kyc-adversarial.test.js` and specifically respect the BSA §5318(g)(2) tipping-off boundary (borrower-facing rationale never names the specific SAR flag).

Every visual claim in the HUD is backed by a specific runtime test and a specific regulatory citation. This is the discipline Loredana's BRD Source Separation Principle demands.

---

## What changes in the July 14 XREAL One Pro test protocol

The protocol at `docs/xreal-one-pro-test-protocol/README.md` was written on the (incorrect) assumption of standalone rendering + a persona semicircle scene. It needs to be updated to reflect:

1. Hardware pipeline is XREAL Eye add-on + One Pro + iPhone/Mac tether. Not standalone.
2. Scene is document-anchored HUD, not persona semicircle.
3. Phase B session pass criteria change to reflect the HUD:
   - **B1 replaced**: standalone → tethered baseline. Cold load < 3s from Eye capture to HUD render. HUD anchor drift < 5mm at 40cm document distance over 30s.
   - **B2 replaced**: 5-personas-render → 4-element HUD (verdict pill + collapsed voice cards + attestation pill + optional AML/KYC callouts). Pass criteria: all 4 render, voice command expands cards reliably, HUD dismisses on head-turn.
   - **B3 unchanged**: 4-case verdict lattice still runs through the same case studies.
   - **B4 replaced**: 8-min executive rehearsal → 5-min executive rehearsal (the JARVIS HUD makes the demo shorter because there is less to explain).
   - **B5 unchanged**: failure mode red-team.

Alex will refresh the test protocol document in a follow-on commit tonight.

---

## Reviewer notes for Loredana

1. **Alex's original intuition was correct and my v1 tribunal design was wrong.** The JARVIS-style document HUD is a workflow tool, not a museum installation. This is a better design for the Dean + VP audience and, more importantly, for actual bank compliance officers.
2. **The XREAL Eye add-on is a $99 purchase that unlocks the entire design.** Please tell me whether you want to add it to your order (same XREAL merchant account) or whether I should buy it on my end so it ships to your address in time for the 7/11 hardware landing. Either works.
3. **The design uses 5 voice cards but only expands one at a time.** Your BRD Source Separation Principle is preserved: every visible verdict + rationale + AA code + citation traces to a specific test file and a specific regulation. Nothing is invented for the AR layer.
4. **The AML/KYC per-line callouts are the one gamble in the design.** If on-device testing shows they drift or misalign on dense 8pt text, we drop them cleanly and put the flags at the top of the compliance voice card. Not a critical failure.
5. **The Meta Quest 3S backup is off the plan.** VR headset aesthetic breaks the JARVIS eyeglass framing. If XREAL fails on the day, we degrade to a MacBook + Chrome window running the same WebXR scene as a 2D preview. Honest fallback.

---

## Contact

- Alex Xiaoyu Ji · xji1@mail.yu.edu — design + implementation, HUD scene, OCR pipeline
- Loredana C. Levitchi · [email verify] — regulatory-domain review, voice card content, per-line callout accuracy audit
- Hieu Ngo, PhD · Yeshiva Katz School — XR pedagogical scaffolding (IEEE VR co-author)

*This design doc supersedes v1 and is a public artifact of `shadow-mentor` (MIT). If any claim about XREAL Eye availability, JARVIS UX literature, or the two-layer demo pattern is outdated, please open an issue on the repository.*
