# Shadow presentation route matrix

Four routes, not mutually exclusive. The product architecture stays:

```
Shadow core audit/evidence
├── Shadow Web (Audit Room)
├── Offline verifier / report
├── Flow visualization adapter        ← this spike
└── Shadow Lens native XR
```

| Dimension | A · Native Shadow Lens | B · Shadow data in Flow on XREAL | C · Shadow Web Audit Room | D · Offline verifier / report |
|---|---|---|---|---|
| Primary purpose | First-party spatial XR experience of the audit | Vendor-rendered spatial data story of the same audit | Browser-based audit replay + review | Independent cryptographic verification + printable record |
| Current readiness | **Blocked** — candidate-04 exists; MyGlasses MR package handoff missing; candidate-05 gated; no physical XR capability has passed | **Package ready, import unconfirmed** — sanitized deterministic package + SCP prompt + storyboard done; no live Flow import attempted | Live workstream (Terminal 2, separate) | Frozen verifier; works today, fully offline |
| Dependencies | Unity build chain, XREAL SDK, MyGlasses handoff resolution | Flow account + vendor import path answers (Q1–Q10) | Web stack only | Node only |
| Device dependency | Beam Pro + XREAL One Pro (hard) | Beam Pro + XREAL via Flow's supported route (vendor-stated; unverified on One Pro) | None (any browser) | None |
| Network dependency | None at runtime | Yes (Flow platform account/session) | Local or hosted | **None** |
| Vendor dependency | XREAL SDK | **High — Flow Immersive platform** | None | None |
| Evidence authority | Displays Shadow's | Displays Shadow's — must never recompute (contract + tests pin this) | Displays Shadow's | **IS the authority** (frozen verifier) |
| Presentation value | Highest ceiling (native spatial, first-party) | High, soonest — vendor-polished spatial + AI querying + collaboration | Medium — familiar, shareable, zero hardware | Low visual, highest trust |
| Implementation risk | High (currently blocked at package handoff) | Low-medium (adapter is trivial; risk concentrated in vendor unknowns) | Low | Minimal |
| What it proves | Shadow can ship first-party XR | Shadow's audit output is presentation-portable to a third-party spatial platform | Shadow audits are reviewable anywhere | Shadow's evidence verifies independently of ANY presentation layer |
| What it does NOT prove | — | **Nothing about native Lens**: no MyGlasses handoff progress, no APK success, no first-party XR capability; also does not prove One Pro compatibility until physically observed | Nothing spatial | Nothing about UX |

## Reading

- Route B is a **hedge and a demo accelerator**, not a substitute for A. If Flow's route works on
  Beam Pro + One Pro, we get a vendor-grade spatial demo while candidate-05 stays gated — with zero
  APK work and zero claims about native Lens.
- Route D is the trust anchor for every other route: any scene (A, B, or C) can be cross-checked
  against the offline verifier as long as stable IDs survive (vendor question 8).
- Failure containment: if Flow import stalls on vendor answers, the storyboard runs unchanged on
  C (Web Audit Room) or the existing Three.js guided story — Shadow owns the canonical story.
