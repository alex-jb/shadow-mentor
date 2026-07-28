# Demo Q&A — honest boundaries

Short answers. Every one keeps an honest boundary. Do not overclaim during Q&A.

**Q: Does Shadow prove the AI is correct?**
No. It proves the recorded evidence is internally consistent, signed, and unchanged — integrity and
provenance, not analytical correctness. The verifier explicitly says it does not judge whether the
conclusion is right.

**Q: How is this different from a normal database log?**
A database log can be edited by whoever controls the database, and an edit can be indistinguishable from an
original write. Here the record is a signed hash chain: any change to an earlier record breaks verification,
and the verifier names the *first* failing point and the downstream records affected — independently of the
system that produced it.

**Q: How is this different from Bloomberg?**
Bloomberg is a data + analytics terminal — it delivers information and answers. Shadow is not a data source;
it is an evidence-integrity layer around an AI decision: what was the input, which model/tool acted, what
source was cited, was there human review, and has the sealed record been altered since. Different job.

**Q: Why XREAL / why glasses at all?**
The audit workflow is inherently spatial — a sequence of evidence with a first failure and a downstream
cascade. Glasses let a reviewer keep the chain anchored in the room while inspecting it. It is a
presentation surface for the same evidence model, not the source of trust. The authoritative check is the
2D offline verifier.

**Q: Has it been tested on Beam Pro?**
No. The Beam Pro has not arrived. No device validation is claimed. The Android candidate is built; device
testing begins when the hardware is here.

**Q: Is 6DoF working? Controller? Camera / OCR?**
Not validated on device. The XREAL One Pro is 3DoF without the Eye add-on; 6DoF, controller, camera and OCR
are all pending real-device validation. The core review workflow is designed to work in 3DoF.

**Q: What happens if a user changes a record?**
Verification fails. The verifier identifies the first record that no longer matches the sealed evidence and
lists the downstream records affected by that change. That is exactly the tampered case in the demo.

**Q: Can the company modify its own logs?**
They can change the bytes, but they cannot make a changed record still verify against the original signature
and hash chain without the signing key — and even then the chain and the independent verifier would need to
be re-issued. The value is that a third party can check independently, offline, without trusting the company's
own tooling.

**Q: Is the cryptography independently audited?**
Not yet. No external cryptographic audit has been completed. We use standard primitives (SHA-256,
Ed25519 / HMAC) and the verifier is a single offline file anyone can inspect, but `INDEPENDENT-CRYPTO-AUDIT`
remains false. We do not claim production-readiness.

**Q: Why is V1 still supported?**
Backward compatibility. Existing V1 records must keep verifying, so V1 is frozen and still accepted; new
signing uses the V2 named envelope. V1 records are labeled as the legacy format.

**Q: What changed in Attestation Envelope V2?**
V1 signed a delimiter-joined list of values, which had structural ambiguities (field names, delimiters, and
null/empty/absent were not distinguished). V2 signs a canonical *named* object, so field identity is part of
the signature. V1 stays verifiable; V2 is the default for new records.

**Q: What do the (many) tests prove?**
They pin behavior and prevent regressions — the signing/verification logic, the V1↔V2 compatibility, the
tamper detection, cross-runtime byte parity. They are evidence of engineering discipline. They are not a
substitute for an independent cryptographic audit or device validation.

**Q: Is the product production-ready?**
No. `PRODUCTION-READY` is false. This is a research + prototype stage: the evidence model and the offline
verifier are real and testable; independent audit, device validation, and production signing are pending.
