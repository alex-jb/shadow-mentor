# Practice Q&A — Shadow capstone

Honest, concise answers to the questions most likely to come up. If I don't know something, I say so — that's more credible than bluffing, and it's the whole spirit of the project.

**Q1 · How is this different from ordinary logging?**
A log records that something happened, but it's mutable, platform-specific, and not built for an outside party to check. Shadow's record is canonically serialized, hash-chained so any earlier change is detectable, signed, and verifiable offline by someone who doesn't have my system. A log tells *you* what happened; Shadow lets *someone else* prove it wasn't changed.

**Q2 · Why hash-chain like a blockchain, but without a blockchain?**
Because I need tamper-evidence and ordering, which the hash chain gives me, but I don't need a distributed consensus network or a token. A blockchain solves "who agrees on the ledger" across untrusting parties; my problem is "can one independent reviewer detect if this sealed record was altered," and a signed hash chain does exactly that, offline, with no infrastructure.

**Q3 · What does the digital signature actually prove?**
That the holder of a specific private key attested to the exact sealed bytes — the batch root. It proves the record hasn't changed since sealing and that it came from that key. It does **not** prove the content is true or the decision was right. Integrity, not correctness.

**Q4 · Does verification prove the AI's answer is correct?**
No — and I've built the system so it never implies that. Verification proves the evidence matches what was sealed. The source it cites could still be wrong, and the conclusion could still be bad. Integrity and correctness are separate statuses on purpose.

**Q5 · Why multiple agent personas / a five-voice council?**
That's a domain feature carried over from the earlier Orallexa work — different analytic stances on a decision. But it is deliberately *not* the trust foundation. And the per-voice numbers are fixed persona priors — "stance strength" — not model probabilities and not a probability of being correct.

**Q6 · Why use 3D at all?**
The honest answer: I hypothesize that spatial layout helps a reviewer follow a sequence and see how a tamper propagates. But I have not proven it — there's no user study yet. So the 3D is a prototype, and the 2D verifier remains the precise, always-available fallback. Whether 3D helps is a Capstone II research question.

**Q7 · What's the role of Unity versus Three.js?**
Unity (Shadow Lens) targets the headset / device path and the Android build. Three.js is the browser-accessible version — same idea, no install, easy to demo. Capstone II work includes a shared scene contract so they stay consistent.

**Q8 · Is this running on XREAL?**
Not yet. The Android mock APK is built and I can show it, but there's no XREAL native integration and no on-device validation. Beam Pro / XREAL testing is pending — I don't claim 6DoF, eye tracking, or RGB capture on the current build.

**Q9 · What has actually been device-tested?**
On real hardware: nothing yet — that's pending. What's real today is host-tested code (about 1,600 tests), a browser verifier validated in real Chromium, and a built (not validated) Android APK. I keep those labels distinct on purpose.

**Q10 · Why did the project change from Orallexa?**
Because building the multi-agent version showed me the deeper problem. More AI opinions didn't make the output more trustworthy — it made it more persuasive. The valuable, harder problem was letting someone verify what the AI actually did. Shadow is that refinement, not a restart.

**Q11 · What is your personal contribution?**
The whole system — the evidence schema and canonical serialization, the hash-chain and Ed25519 signing, the independent verifier including the offline browser version, the tamper-localization logic, the multi-profile design, the bilingual verifier, and the spatial prototypes and the Android build pipeline. It's a solo capstone.

**Q12 · What's still incomplete?**
Production signing (it's fixture-signed), device validation, the semantic audit of ingested third-party output, the claim-evidence graph is source-authored this slice, and there's no user study. I list these in the report's limitations without softening them.

**Q13 · What will you do in Capstone II?**
Device validation on Beam Pro / XREAL, the shared Unity/Three.js scene contract, Audit Arc V2, an OCR-to-source-map pipeline, real device-performance measurement, and — most importantly for the research claim — the user study comparing spatial versus flat audit comprehension.

**Q14 · How will this scale?**
The verifier is stateless and offline, so verification scales trivially — it's just checking a file. The production path (durable storage, KMS/HSM, key rotation, SBOM, reproducible builds) is future work; I'm not claiming production scale today.

**Q15 · How do you protect private data?**
Today the evidence is fixture data, and there is no full PII-retention framework yet — I'm honest that this is pending. The design intent is that the evidence bundle carries references and hashes rather than raw sensitive content where possible, but a production PII-governance process is Capstone II / production-path work.

**Q16 · How is this different from AI observability tools?**
Observability tools (trace/telemetry systems) record what an agent did for *monitoring* — they're generally not tamper-evident or independently verifiable, and they trust the emitting system. Shadow is complementary: it can ingest such a trace *structurally* and seal it so its integrity becomes checkable by an outside party. The independent, offline, tamper-evident verification is the difference.

**Q17 · Can banks use this today?**
No, and I won't claim they can. It's a capstone research and engineering artifact — fixture-signed, not device-validated, not certified, and not legally compliant. It positions as an independent evidence layer for a governance *gap*; it does not claim any regulation already mandates it.

**Q18 · What evaluation would prove the spatial UI is useful?**
A controlled user study: give people a tampered audit chain, measure how fast and how accurately they find the tampered event and state the downstream impact, across a flat 2D report, the anchored-stereo view, and the immersive view. That's the RQ4 study, and it's the first thing on the Capstone II research list.
