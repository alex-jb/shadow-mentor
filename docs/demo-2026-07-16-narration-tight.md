# Wednesday 2026-07-16 capstone demo — tight narration (3-min hard cap)

**Purpose**: 425 spoken-text words targeting 3:00 at 140-150 wpm. Same 4-beat structure as `docs/demo-2026-07-16-narration.md` but every sentence carries load. Read this on stage; keep the primary narration open on the laptop as a fallback if a specific example needs unpacking during Q&A.

**Discipline**: no AI voice, no manifesto tone. Say what it does. Say what it does not do. Say the pivot. Get off stage.

---

## 0:00 – 0:15 · Frame the gap

Two things happened in 2026 that leave a gap. SR 26-2 replaced SR 11-7 in April; footnote 3 tells institutions to govern generative AI on their own. EU AI Act Article 12 requires event recording without defining what the record must look like. So we get "you figure it out" plus "record it — somehow."

## 0:15 – 1:15 · Show what exists today

*(Bring up `shadow-mentor-phi.vercel.app/demo/xreal.html` on the XREAL. Press fullscreen.)*

Shadow ships today as a 5-persona council for banking loan decisions. Credit, Risk, Fair Lending, Customer Advocate, Macro Contrarian. Deterministic verdict engine, plus an LLM rationale layer that produces prose reasons an underwriter can read.

Every decision is Ed25519-signed over 22 field slots. `previous_hash` chains decisions together. Tamper any byte and the verifier catches it.

*(Advance the page. Point at persona cards, the verdict pill, the trust chain.)*

Regulatory hooks that actually bind at mid-tier banks: Reg B §1002.9, CFPB Circular 2026-03, state fair-lending regimes in NY / MA / CA, GDPR Article 22 plus the Schufa decision for EU exposure.

Prof. Levitchi's BRD gave us the risk and adverse-action module set. Without her domain work we wouldn't have real fixtures to catch persona-response-function drift.

## 1:15 – 2:15 · The pivot

Here is what changed since the last review, and this is the interesting part.

Everything you're looking at generalizes. The council produces a signed decision record; the chain doesn't care whether that record came from a loan committee, a Claude Code session, or an MCP tool call. The verifier doesn't care either.

So the v3 direction, targeted at the EU AI Act Article 12 enforcement window, is a general **agent evidence layer**. One npm install. Every agent session produces a signed, chained, independently verifiable evidence bundle. Credit becomes the first vertical — the reference implementation for the pattern.

The paper track becomes cleaner too. IEEE VR 2027 becomes "spatial forensic replay of cryptographically attested agent trajectories" — defensible because branching agent timelines have real 3D structure.

## 2:15 – 2:45 · What we are not claiming

Three things.

Shadow is tamper-evident — a change is detectable at verification time, which is different from prevention. If the operator loses control of the private key, retro-signing is possible; the roadmap adds RFC 3161 timestamps and a public transparency log to close that.

We do not claim any regulation is satisfied. We produce evidence that supports a compliance narrative. The determination is legal work.

Pre-1.0, not audited. A solo student MIT repo does not pass a bank's TPRM gate today. Real production adoption routes through a loan-origination-system vendor partnership.

## 2:45 – 3:00 · Close

Repo on GitHub. Demo URL on the slide. v3 brief is in the repo under `docs/roadmap/`. Feedback welcome.

Thank you.

---

## Presenter timing note

- **Word count (spoken text only, excluding stage directions):** ~425
- **Target rate:** 140-150 wpm → 2:50 – 3:02 delivery
- **If you run fast at rehearsal (<2:40):** slow down; the disclaimer beat 2:15-2:45 is the one where a rushed delivery undermines the point
- **If you run slow at rehearsal (>3:05):** trim one bullet from beat 2:15-2:45 first (drop the RFC 3161 sentence); trim the paper-track sentence in beat 1:15-2:15 second
- **On-stage watch position:** at 1:00 you should be past "Prof. Levitchi's BRD"; at 2:00 you should be at "The paper track"; at 2:45 you should be at "Repo on GitHub"

## Pre-flight

See `docs/demo-2026-07-16-narration.md` for the fuller version, backup teleprompter, and anticipated Q&A. See `docs/wednesday-preflight-2026-07-16.md` for the full pre-flight checklist.
