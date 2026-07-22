# Speaker notes — Shadow capstone practice presentation (V2)

Target: ~8–10 minutes talking, then questions. Spoken in my own voice — I talk *to* the slides, I don't read them. Cryptography stays plain. Limitations get said out loud, not hidden. Every number below matches `capstone-facts-v2.json`.

**Total talk target: 8:30. Live demo (if it comes up cleanly) adds ~2 min inside Slide 7.**

---

## Slide 1 — Title · 0:00–0:30
Hi, I'm Alex. This is my Capstone I project, Shadow. One line: it takes an AI-assisted decision and produces evidence of it that *someone else* can independently verify. The image on the right is a real render from the system — the audit sequence in 3D — and I'll come back to it. The subtitle is the whole arc: I started producing AI *answers*, and I moved to producing *verifiable evidence*.

## Slide 2 — The trust gap · 0:30–1:20
Here's the gap the project is about. An AI answer is not the same thing as evidence of how it was reached. If you're the person signing off — an auditor, a compliance reviewer — you need four things the answer doesn't give you: what sources it relied on, what it actually did, whether the record was changed afterward, and whether *you* can check it yourself. A normal log doesn't do this — it's mutable and tied to one platform. And the model's own explanation is just more generated text — it can sound right and not match what the system did.

## Slide 3 — Project evolution · 1:20–2:00
Quick history, because it'll come up. This began as Orallexa — several AI voices, a bull, a bear, a judge, debating a question. It worked. But it taught me the real problem: more opinions is not more trust. A convincing panel still leaves you no way to check what it was based on. So Shadow kept the analysis as one feature and moved trust *down a layer* — to the evidence underneath, not the voices on top. A sharper version of the same question, not a failure.

## Slide 4 — How Shadow records evidence · 2:00–2:50
The core idea in one line: source, to a tool or model action, to a structured event, into a hash chain, sealed with a signature, and then anyone can verify. Two words matter. Hash chain: each event locks in the one before it, so changing an early event breaks everything after — and that's detectable. Offline: you don't need my server or the internet to check it. That independence is the point.

## Slide 5 — Architecture · 2:50–3:30
Three layers. The core is the evidence itself — schema, signed hash chain, verifier, claim–evidence graph. Then domain profiles. Then interfaces. And I'll be honest: these interfaces are *not* equally mature, and the slide labels which is which. Command-line, server, and browser verifier are host-tested and running. The Unity and 3D pieces are authored prototypes with real builds — no device validation yet.

## Slide 6 — Three profiles · 3:30–4:10
Same machinery across domains. Banking: a document produces a risk claim tied to a source. Data science: a dataset, a model, a metric. A coding agent: an issue, a diff, tests, a commit. Different words — underneath, the exact same verification grammar: sequence, hash chain, signature, source resolution. That's what makes it a general evidence layer, not one bank-specific tool.

## Slide 7 — Exact tamper localization · 4:10–6:00 ← the moment
This is the most important slide, and if the live demo comes up this is where I run it. What you're looking at is a real render. I start with a clean, sealed record. I change one earlier event — one field, sequence 3. And the verifier names the *exact* first sequence where it breaks — not "something's wrong," the precise event. Then everything after it — 4, 5, 6 — is flagged NOT VERIFIED, because the signature covered a chain that no longer exists. So it's stronger than "one bad event" — the record is broken from there on. And notice what it does *not* do: even catching the tamper, it never says whether the original conclusion was right. Look at the panel — "Analytical correctness: NOT EVALUATED." Integrity and correctness stay separate. That's deliberate.

## Slide 8 — Verify the Verifier · 6:00–6:50
Fair question: why trust the verifier page itself? The page carries a signed manifest and reports "assets match signed manifest." But — the honest part — a page hashing *itself* is not trust. Real trust means comparing its asset hashes against a manifest from a *separate* channel, and checking the signing key's fingerprint independently. The page literally says "independent comparison not performed" until you do that. And I'll say it plainly: right now the signing is a *fixture* key, not a production key. I did not generate a production signing key for this.

## Slide 9 — Spatial audit replay · 6:50–7:30
This connects to the XR course. There's a Unity app and a Three.js version that put the audit chain in space — sequence, provenance, tamper replay. You're seeing two real layouts here, arc and layered DAG. You look at a card to focus it — head-directed, gaze-based hover. Precise: that is *not* eye tracking, no camera capture, no 6DoF on the mock. The Android app is built — a real 24-megabyte APK, I have its hash — but *built*, not device-validated. Beam Pro and XREAL testing is ahead. And there's always a 2D fallback, so 3D is never required to verify anything.

## Slide 10 — Evaluation and evidence · 7:30–8:05
Numbers, honestly. 1,858 of 1,861 host tests pass — 0 failed, 3 skipped, and the skips are environment-gated, not disabled. That's re-run today; my earlier draft said 1,824 of 1,827, and I updated it rather than leave a stale number. The browser verifier was validated in real Chromium, English and Chinese, zero external network requests. The Android APK builds. The 3D layouts render and I recorded them. The one thing I have *not* done is a user study — so I make no claim that the 3D helps comprehension. That's next.

## Slide 11 — Current state and Capstone II · 8:05–8:25
Two columns. Now: the evidence, the verification, tamper localization, the bilingual verifier, the scene contract authored and host-tested, the Three.js prototype, the Android build. Capstone II: Unity contract integration, device validation, XREAL native input, performance measurement, the user study, and production signing. One precise distinction — the ingest audit: structural is host-tested; semantic is *production*-pending, not device-pending. I'd rather state that exactly than blur it.

## Slide 12 — Contribution · 8:25–8:35
Contribution in one sentence. Shadow doesn't ask you to trust the AI's answer — it gives you evidence you can verify yourself: the sequence, the sources, the signature, and if it was tampered with, exactly where it breaks. And it draws a hard line: this proves integrity, not correctness. Thank you — happy to take questions.

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
| 7 Tamper (hero) | 4:10–6:00 |
| 8 Verify the Verifier | 6:00–6:50 |
| 9 Spatial | 6:50–7:30 |
| 10 Evaluation | 7:30–8:05 |
| 11 Current state | 8:05–8:25 |
| 12 Contribution | 8:25–8:35 |

If long, compress Slides 5 and 6 (most cuttable); protect Slide 7. Backup slides 13–16 (status matrix, trust boundary, limitations, demo fallback) are for Q&A only.
