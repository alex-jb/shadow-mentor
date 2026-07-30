# Show HN draft — Shadow
*Fire Tue–Thu 8–10am ET, ONLY after the website rebuild lands + a contact path exists. Alex's go required.*

## Title (pick one — A is safest)
- **A.** Show HN: Shadow – an independent, open-source verifier for AI credit decisions
- B. Show HN: Shadow – prove what your AI agent decided, and that the record wasn't rewritten
- C. Show HN: Shadow – tamper-evident, reason-code-mapped audit for automated lending decisions

## Body
> When an AI/ML model denies a loan applicant and an examiner (or the applicant, under GDPR Art. 22) asks *why*, most teams have a log file — not evidence they can defend. Reconstructing the reasoning is often two weeks of manual work plus outside counsel.
>
> Shadow is an **independent, open-source verifier** for those decisions. It turns each AI credit decision into a signed, hash-chained evidence bundle — the claims made, the evidence each cites, the adverse-action reason codes (Reg B / ECOA, GDPR Art. 22), and a human's sign-off — that a third party can **verify offline**, with a single self-contained HTML file, no network and no dependencies.
>
> The point isn't the cryptography (Ed25519 + SHA-256 hash-chain — Microsoft open-sourced that layer in April). The point is **independence**: it verifies an agent it didn't build, which is the seat an examiner needs and a self-attesting platform can't fill. The moat we actually care about is the banking reason-code depth mapped to each decision and each test.
>
> Try it: drag any evidence bundle into `verify.html` — edit one byte and the chain breaks, offline. Verdicts are deterministic rules; the LLM personas only write rationale, so the decision is reproducible.
>
> **Honest status:** pre-1.0, not yet audited, the hosted demo uses synthetic data. It's an OSS core (MIT) you can self-host and run in your own CI. I'm looking for EU-exposed fintech lending / model-risk teams to pressure-test it against a real denied case.
>
> Repo: {github link} · Verify offline: {verify.html link} · Security brief (PDF): {link}
>
> Happy to answer anything about the threat model, the reason-code mapping, or where it breaks.

## Anticipated Qs (prep)
- *"Isn't this just Microsoft's Agent Governance Toolkit?"* — They attest their own stack; Shadow independently verifies anyone's, and adds the banking reason-code layer (Reg B/Art 22) they don't. Independence + vertical depth, not crypto.
- *"What does a green ✓ actually prove?"* — Integrity (the record wasn't altered), not content authenticity. We state that boundary everywhere.
- *"Regulation doesn't require this yet."* — Correct in the US (soft). EU is the live driver: GDPR Art. 22 + Schufa/Dun & Bradstreet are enforceable now. We don't claim a mandate.
- *"Why should a bank trust an MIT tool for a litigation-sensitive workflow?"* — Because it's independent and self-hostable — evidence never leaves your perimeter, and you can audit the verifier's source.
