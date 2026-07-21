# Speaker notes — Shadow capstone practice presentation

Target: ~8–10 minutes of talking, then questions. Timing is marked per slide. These are written to be spoken in my own voice — I don't read the bullets, I talk to them. Where cryptography comes up I keep it plain. I state the limitations out loud; I don't hide them.

**Total talk target: 8:30. Demo (if live) adds ~2 min inside Slide 7.**

---

## Slide 1 — Title · 0:00–0:30
Hi, I'm Alex. This is my Capstone I project, Shadow. The one-line version is: it's a way to take an AI-assisted decision and produce evidence of it that someone else can independently verify. The subtitle is where it came from — I started with a multi-agent system that produced *answers*, and I moved to producing *verifiable evidence*. I'll explain why.

## Slide 2 — The problem · 0:30–1:20
Here's the gap the whole project is about. When an AI gives you an answer, that answer is not the same thing as evidence of how it got there. If you're the person who has to sign off on it — an auditor, a compliance officer — you actually need four things the answer doesn't give you: what sources it relied on, what it actually did, whether the record was changed after the fact, and whether *you* can check it yourself. A normal log doesn't do this — it's mutable and it's tied to one platform. And the model's own explanation is just more generated text — it can sound right and still not match what the system did.

## Slide 3 — Project evolution · 1:20–2:00
Quick history, because the professor will ask. This started as Orallexa — several AI voices, a bull, a bear, a judge, that debated a question. It worked. But building it taught me the real problem: more opinions is not more trust. A panel of AI voices can be very convincing and still leave you no way to check what it was based on. So Shadow kept the analysis as one feature, but moved the trust down a layer — to the evidence underneath, not the voices on top. It's a sharper version of the same question, not a project that failed.

## Slide 4 — What Shadow records · 2:00–2:50
This is the core idea in one line. Source, to a tool or model action, to a structured evidence event, into a hash chain, sealed with a signature, and then anybody can verify it. The two words that matter: hash chain means each event locks in the one before it, so if you change an early event, everything after it breaks — and that's detectable. And offline — you don't need my server or an internet connection to check it. That independence is the point.

## Slide 5 — Architecture · 2:50–3:30
Three layers. The core is the evidence itself — the schema, the signed hash chain, the verifier, and a claim-evidence graph that I'll come back to. Then profiles for different domains. Then the interfaces. And I want to be honest here — these interfaces are *not* equally mature, and I'll tell you which is which as we go. The command-line, the server, and the browser verifier are tested and running. The Unity and 3D pieces are prototypes with real builds but no device validation yet.

## Slide 6 — Three profiles · 3:30–4:10
The same machinery works across domains. Banking: a document produces a risk claim, tied back to a source. Data science: a dataset, a model, a metric. A coding agent: an issue, a diff, tests, a commit. Different words, but underneath it's the exact same verification grammar — a sequence, a hash chain, a signature, and source resolution. That's what makes it a general evidence layer and not one bank-specific tool.

## Slide 7 — Tamper demo · 4:10–6:00  ← the moment
This is the most important slide, and if the live demo works this is where I run it. [SEE DEMO_RUNBOOK.] The idea: I start with a clean, sealed record. I change one earlier event — one field. And the verifier tells me the *exact* first sequence number where it breaks. Not "something's wrong" — the precise event. And then everything after that point is flagged as invalidated, because the signature covered a chain that no longer exists. So it's stronger than "one bad event" — it's "the record is broken from here on." And notice what it does *not* do: even when it catches the tamper, it never tells you whether the original conclusion was right. Integrity and correctness stay separate. That separation is deliberate.

## Slide 8 — Verify the Verifier · 6:00–6:50
A fair question is: okay, but why should I trust the verifier page itself? So the page carries a signed manifest and reports "assets match signed manifest." But — and this is the honest part — a page hashing *itself* is not trust. Real trust means comparing its asset hashes against a manifest you got from a *separate* channel, and comparing the signing key's fingerprint independently. The page literally says "independent comparison not performed" until you do that. And I'll say clearly: right now the signing is a fixture key, not a production key. I did not generate a production signing key for this.

## Slide 9 — Spatial experience · 6:50–7:30
This is the part that connects to the XR course. There's a Unity app and a Three.js version that put the audit chain in space — the sequence, the provenance, the tamper replay. You look at a card to focus it — that's head-directed, gaze-based hover. I want to be precise: that is *not* eye tracking, there's no camera capture, and there's no 6DoF on the mock build. The Android app is built — it's a real 24-megabyte APK, I have its hash — but it is *built*, not device-validated. Beam Pro and XREAL testing is still ahead. And there's always a 2D fallback, so the 3D is never required to verify anything.

## Slide 10 — Evaluation · 7:30–8:00
Numbers, honestly. About eighteen hundred host tests pass — 1,824 of 1,827, the three skips are environment-gated, not disabled. The browser verifier was validated in real Chromium with Playwright, in English and Chinese, with zero external network requests. The Android APK builds. The 3D layouts render and I recorded them. And the one thing I have *not* done is a user study — so I make no claim yet that the 3D actually helps people. That's next.

## Slide 11 — Where it stands · 8:00–8:20
Two columns — what's real now, what's next. Implemented: the evidence, the verification, the tamper localization, the bilingual verifier, the Android build. Pending in Capstone II: device validation, the shared 3D scene contract, the user study, the semantic audit, and production signing. Fixture-signed, device-pending, no correctness claim — I'd rather say that plainly than oversell.

## Slide 12 — Contribution · 8:20–8:30
So the contribution in one sentence. Shadow doesn't ask you to trust the AI's answer. It gives you evidence you can verify yourself — the sequence, the sources, the signature, and if it was tampered with, exactly where it breaks. And it draws a hard line: this proves integrity, not correctness. Thank you — happy to take questions.

---

## Timing summary
| Slide | Window |
|---|---|
| 1 Title | 0:00–0:30 |
| 2 Problem | 0:30–1:20 |
| 3 Evolution | 1:20–2:00 |
| 4 What it records | 2:00–2:50 |
| 5 Architecture | 2:50–3:30 |
| 6 Profiles | 3:30–4:10 |
| 7 Tamper demo | 4:10–6:00 |
| 8 Verify the Verifier | 6:00–6:50 |
| 9 Spatial | 6:50–7:30 |
| 10 Evaluation | 7:30–8:00 |
| 11 Where it stands | 8:00–8:20 |
| 12 Contribution | 8:20–8:30 |

If running long, compress Slides 5 and 6 (they're the most cuttable) and protect Slide 7.
