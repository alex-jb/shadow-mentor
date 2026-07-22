# Speaker notes — Shadow capstone practice presentation (V2.1)

Same flow as V2. Updated only where facts or a slide changed: **test count refreshed to 1,892 / 1,895**, **Unity shown honestly (described, not pictured)**, **canonical tamper fixture = sequence 3 everywhere**. Every number matches `capstone-facts-v2-1.json` (re-run on `feat/shadow-shared-story-adapters @ 5f655e8`, 2026-07-21).

**Total talk target: 8:30. Live demo (if it comes up cleanly) adds ~2 min inside Slide 7 — and the live demo must also use the sequence-3 fixture.**

---

## Slide 1 — Title · 0:00–0:30
Hi, I'm Alex. This is my Capstone I project, Shadow. One line: it takes an AI-assisted decision and produces evidence of it that *someone else* can independently verify. That image is a real render from the system — the audit sequence in 3D. The subtitle is the arc: I started producing AI *answers* and moved to producing *verifiable evidence*.

## Slide 2 — The trust gap · 0:30–1:20
An AI answer is not the same as evidence of how it was reached. If you're the person signing off, you need four things the answer doesn't give you: what sources it relied on, what it did, whether the record was changed afterward, and whether *you* can check it. A normal log is mutable and platform-specific; the model's explanation is generated text — it can sound right and not match what happened.

## Slide 3 — Project evolution · 1:20–2:00
This began as Orallexa — several AI voices debating. It worked, and it taught me the real problem: more opinions is not more trust. So Shadow kept the analysis as one feature and moved trust *down a layer* — to the evidence underneath, not the voices on top. A sharper question, not a failure.

## Slide 4 — How Shadow records evidence · 2:00–2:50
The core idea in one line: source → tool/model action → structured event → hash chain → signature → verify. Two words matter. Hash chain: each event locks in the one before it, so changing an early event breaks everything after — detectable. Offline: you don't need my server to check it. That independence is the point.

## Slide 5 — Architecture · 2:50–3:30
Three layers: core evidence, domain profiles, interfaces. And I'm honest that the interfaces are *not* equally mature — the slide labels each. Core is host-tested; the profiles share one grammar; the experiences are mixed maturity, and I'll say which as we go.

## Slide 6 — Three profiles · 3:30–4:10
Same machinery across domains. Banking — a document produces a risk claim tied to a source; that's the real render on the left, the trust dimensions that are never all one color. Data science — dataset, model, metric, selection. A coding agent — issue, diff, tests, commit. Different words, identical underneath: sequence, hash chain, signature, source resolution.

## Slide 7 — Exact tamper localization · 4:10–6:00 ← the moment
Most important slide; if the live demo comes up, I run it here — **and I use the sequence-3 fixture, same as the slide.** This is a real render. I change one earlier event — sequence 3, the Council-claims node. The verifier names the *exact* first failed sequence — not "something's wrong," the precise event. Then 4, 5, 6 are flagged NOT VERIFIED, because the signature covered a chain that no longer exists. And look at the panel: "Analytical correctness — NOT EVALUATED." Even catching the tamper, it never says the conclusion was right. Integrity and correctness stay separate. That's deliberate.

## Slide 8 — Verify the Verifier · 6:00–6:50
Fair question: why trust the verifier page itself? It carries a signed manifest and reports "assets match signed manifest." But — a page hashing *itself* is not trust. Real trust means comparing its asset hashes against a manifest from a *separate* channel and checking the key fingerprint out of band. The page says "independent comparison not performed" until you do that. And plainly: the signing is a *fixture* key, not production.

## Slide 9 — Spatial audit replay · 6:50–7:30
This connects to the XR course. You're seeing two real Three.js renders — the arc, and the tamper cascade at sequence 3. The Three.js story adapter is host-tested at the contract level and browser-rendered. There's also a Unity Shadow Lens — it's unity-authored, and its generated C# is host-tested for drift against the shared contract, and there's an Android build — **but I'm not showing a Unity screenshot, because I don't have a real Game View capture, and I won't label a Three.js image as Unity.** Device validation is still ahead. Honest bounds: not eye tracking, no 6DoF on the mock, no user study yet.

## Slide 10 — Evaluation and evidence · 7:30–8:05
Numbers, honestly. **1,892 of 1,895 host tests pass — 0 failed, 3 skipped, and the skips are environment-gated, not disabled.** That's re-run today on the final branch. The browser verifier was validated in real Chromium, English and Chinese, zero external requests. The Android APK builds — 24.4 megabytes, hash recorded, not device-validated. The scene and story contracts are host-tested, the Three.js adapter is host-tested and browser-rendered, and the Unity C# contract is drift-tested. The one thing I have *not* done is a user study — so no claim that the 3D helps comprehension.

## Slide 11 — Current state and Capstone II · 8:05–8:25
Two columns. Now: core evidence and verification, the claim–evidence graph, the bilingual verifier and three explainers, the shared scene and story contract authored and host-tested, the Three.js story adapter host-tested and browser-rendered, the Unity C# contract drift-tested and the Android build. Capstone II: Unity production integration and editmode/playmode, Beam Pro validation, XREAL native input, device performance, the user study, and production signing. One precise distinction — the ingest audit: structural is host-tested; semantic is *production*-evaluation pending, not device-pending.

## Slide 12 — Contribution · 8:25–8:35
Contribution in one sentence. Shadow doesn't ask you to trust the AI's answer — it gives you evidence you can verify yourself: the sequence, the sources, the signature, and if it was tampered with, exactly where it breaks. And a hard line: this proves integrity, not correctness. Thank you — happy to take questions.

---

## Timing summary
| Slide | Window |
|---|---|
| 1 Title | 0:00–0:30 |
| 2 Trust gap | 0:30–1:20 |
| 3 Evolution | 1:20–2:00 |
| 4 How it records | 2:00–2:50 |
| 5 Architecture | 2:50–3:30 |
| 6 Profiles | 3:30–4:10 |
| 7 Tamper (hero, seq 3) | 4:10–6:00 |
| 8 Verify the Verifier | 6:00–6:50 |
| 9 Spatial | 6:50–7:30 |
| 10 Evaluation (1,892/1,895) | 7:30–8:05 |
| 11 Current state | 8:05–8:25 |
| 12 Contribution | 8:25–8:35 |

If long, compress 5 and 6; protect 7. Backups 13–16 (status matrix, trust boundary, limitations, demo fallback) are Q&A only. **Demo fallback: if the live app doesn't come up in 20 seconds, open the bookmarked fallback video and keep talking.**
