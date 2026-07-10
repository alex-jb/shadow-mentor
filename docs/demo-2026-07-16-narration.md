# Wednesday 2026-07-16 capstone demo — narration script (v1)

**Setting**: combined AI-courses presentation, ~30 groups, time-constrained. Dr. NGO (banking / regulatory research advisor) + Dr. Nobel (AI courses) + Prof. Lora Levitchi (banking domain co-author) in the room.

**Hardware**: MacBook M5 + XREAL One Pro + XREAL Eye. Chrome fullscreen at `shadow-mentor-phi.vercel.app/demo/xreal.html`. Backup: laptop screen if the tether misbehaves.

**Runtime**: 3 minutes hard cap.

**Reading discipline**: no AI voice, no manifesto tone. Say what the thing does. Say what it does not do. Say what the pivot is. Get off stage.

---

## 0:00 – 0:15 · Frame the gap

Two things happened this year in AI-regulation land, and together they leave a gap.

- The Fed / OCC / FDIC replaced SR 11-7 with SR 26-2 on 2026-04-17. SR 26-2 explicitly excludes generative and agentic AI from its scope, and footnote 3 tells the institution to govern that class using their own risk-management practices. So the guidance says "you figure it out."
- In Europe, EU AI Act Article 12 requires high-risk AI systems to automatically record events, but the standards that define what that record must look like are still in draft. So the regulation says "record it" without saying how.

Every institution running an AI agent right now is generating logs. Almost none of those logs can prove, months later, that nobody rewrote them.

## 0:15 – 1:15 · Show what exists today

*(Bring up `shadow-mentor-phi.vercel.app/demo/xreal.html` on the XREAL. Cursor at the fullscreen button. Press it.)*

This is the current shipping version of Shadow. It's a 5-persona council for banking loan decisions. Deterministic verdict engine — Credit, Risk, Fair Lending, Customer Advocate, Macro Contrarian — plus an LLM rationale layer that produces prose reasons a human underwriter can read.

Every decision is Ed25519-signed. The signature covers 22 field slots — 8 required, 14 optional append-only bindings. `previous_hash` links each decision to the last one, so the chain is walkable. Tamper any byte of any decision and the verifier catches it.

*(Advance the slide / page. Point at the persona cards, the verdict pill, the trust chain visualization.)*

The domain framing on this specific demo is credit. Reg B §1002.9 specific-principal-reasons, CFPB Circular 2026-03, state fair-lending regimes in NY / MA / CA / NJ / IL, GDPR Article 22 and the Schufa decision for EU-active institutions. Those are the regulatory hooks that actually bind at mid-tier banks in 2026.

Lora's BRD — the risk / credit-policy / adverse-action module set — is what gave us a real vertical to characterize the response function against. Without her domain work we wouldn't have real fixtures to test drift against. The SIVE fixture set that catches persona-response-function pathologies came out of that collaboration.

## 1:15 – 2:15 · The pivot

Here is what changed for us since the last review, and this is the interesting part.

Every part of what you're looking at generalizes. The council is one producer of a signed decision record. The chain doesn't care whether the decisions came from a loan committee, an underwriter, a Claude Code session writing code, a Cursor tool call, or an MCP server firing a function. The verifier doesn't care either. And the spatial replay — walking the chain, expanding a suspicious event, watching the tamper cascade downstream — makes even more sense on an agent session than it does on a decision series, because agent sessions are branching timelines with nested tool calls.

So the v3 direction, targeted at the EU AI Act Annex III enforcement window, is a general **agent evidence layer**. One npm install. Every agent session produces a signed, chained, independently verifiable evidence bundle. The credit-decision use case becomes the first vertical — the reference implementation for the pattern.

*(If time allows, tab-switch to `docs/roadmap/SHADOW_V3_BRIEF.md` on the repo page briefly. Otherwise skip.)*

The paper track becomes cleaner too. IEEE VR 2027 stops being "AI council in VR" — which is a claim reviewers can shoot down with one sentence — and becomes "spatial forensic replay of cryptographically attested agent trajectories," which is a defensible novelty because branching timelines with cryptographic integrity constraints have real 3D structure and there is 30 years of program-visualization literature to cite.

## 2:15 – 2:45 · What we are not claiming

Three things it is important to be clear about.

- Shadow is tamper-**evident**, not tamper-**proof**. If the operator loses control of the private key, we cannot defend against retro-signing. That is why the roadmap includes external time-anchoring — RFC 3161 timestamps or a public transparency log — so the "insider at the bank" adversary is actually defeated.
- We do not claim any regulation is satisfied. We produce evidence that supports a compliance narrative. The determination is legal work.
- We are pre-1.0 and not audited. A solo student MIT-licensed repo does not pass a bank's third-party risk management gate today. Real production adoption in the finance vertical routes through a partnership with a loan-origination-system vendor or a fair-lending validator that has already passed that gate.

## 2:45 – 3:00 · Close

The public repo is on GitHub. The demo URL is on the slide. The v3 brief is in the repo under `docs/roadmap/`. Feedback on any of it is welcome.

Thank you.

---

## Presenter checklist (pre-flight)

- [ ] `shadow-mentor-phi.vercel.app/api/health` returns 200 the morning of
- [ ] XREAL One Pro + Eye — tether tested on the laptop 24 h before, no cold-start surprises
- [ ] Chrome fullscreened on the XREAL display
- [ ] Room lights up (monocular SLAM needs contrast)
- [ ] Laptop mirrored to the projector so the audience sees what you see
- [ ] Backup: keep the tab loaded on the laptop screen so if the tether drops, the projector still shows the demo
- [ ] Have `docs/roadmap/SHADOW_V3_BRIEF.md` open in a second tab in case someone asks for the pivot text
- [ ] Water on stage

## Anticipated questions and short answers

- **"How does this compete with LangSmith / Langfuse / Datadog?"** — Different category. Those are debug observability: mutable telemetry for engineers. We are evidence: signed, chained, offline-verifiable, schema-frozen. Debug tools care about feature velocity; evidence tools care about schema stability. Those are inversely correlated as product philosophies.
- **"Why 3D for a linear chain?"** — Because agent sessions are not linear. They're branching timelines with nested tool calls, and the tamper-cascade property is a spatial one — a change here dims everything downstream. That is a 3D operation, not a table.
- **"What is the business model?"** — Open source library, hosted verifier as a convenience. First revenue path is a partnership with an LOS vendor already through TPRM gates. Solo entity does not sell direct to banks in year one; that is the wrong shape of company.
- **"Is this legally admissible?"** — No. That is a legal determination we do not make. We produce a tamper-evident record. Whether it is admissible under a specific rule of evidence in a specific jurisdiction is a lawyer's job.
- **"Why the pivot?"** — Because the credit-decision framing had a structural problem: banks do not run 5-persona councils, so the attestation layer only had value after they adopted an unproven decision engine. The evidence layer works whether the underlying agent is our council, someone else's LOS, or Claude Code writing code. That is a smaller claim and a much larger addressable surface.
