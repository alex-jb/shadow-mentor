---
title: Wed 2026-07-16 demo — what to show, in what order
audience: Alex; read Tuesday night before rehearsal
depends_on:
  - packages/adapter-claude-code/ M2.1 + M2.2 shipped 2026-07-13
  - demos/replay/ M5 2D shipped 2026-07-13
  - packages/attest-core/session.js verifyBundle {seq,reason,impact} shipped 2026-07-13
  - XREAL One Pro + Eye add-on hardware arriving Wed
---

# Wed demo checklist

Two audiences, one hardware kit. **Lora** (banking compliance angle,
Ready to give feedback for IEEE VR abstract) + **anyone else who
happens to be watching**. XREAL One Pro is the hardware; nothing about
the demo *requires* it (the whole thing runs on a laptop screen). The
XREAL is the "wow, this can be spatial" flourish AT THE END, not the
opener.

Total wall-clock: aim for **12 minutes**. Under 10 is better.

---

## Beat sheet

### 1 · Story hook (60 seconds, laptop only)

Open with the problem. **Do not open with a product.**

> "A bank auditor gets a claim: 'this loan was denied because Claude
> said DTI was over 43%'. Right now the auditor has nothing to
> verify that — no signed record, no way to prove the model saw the
> real inputs, no way to prove nobody changed the log after the fact.
> That's the gap Shadow closes."

Say it out loud once before you sit down. Do not read a slide.

### 2 · Adapter dogfood (2 min, laptop only)

Open a fresh Claude Code session in a terminal. Ask it to read one file
and write another (small — one hello.txt file). Then `/exit`.

Then in another terminal:

```bash
ls ~/.shadow/sessions/
# → pick the newest one (mtime today)

npx shadow-verify ~/.shadow/sessions/<newest-id>/bundle.json \
  --public-key ~/.shadow/keys/public.pem
```

Expected output:

```
✓ Bundle verified
  session_id : <id>
  agent      : claude-code@2.1.116     ← M2.2 pinned real version
  events     : ~8-15
  key_id     : claude-code-local
  batch_root : <hex>
  trust      : SELF_SIGNED — chain intact + signature valid; operator could still have re-signed history
```

**Point at**: `agent` and `events`. "That's the real Claude Code CLI
version, pinned by reading the transcript at hook time. Every prompt,
every tool call, every response is signed as one Merkle root."

### 3 · Replay demo (4 min, laptop only)

Open `demos/replay/index.html` from disk (works from `file://`, no
server, no network — say this out loud, it matters). Drop the bundle
from step 2. Paste the public key.

Timeline renders. Verdict green: `signature valid · SELF_SIGNED`.

Click event #0 → inspector shows payload_hash + payload_ref + prev_hash.

Then click **Tamper & verify**.

Row #0 flashes red. Every downstream row dims to 35% with a ⛓✗ chain-break marker. Verdict flips red: `verify failed: prev_hash_mismatch`. Caption at the bottom prints:

```
SEQ    0
REASON prev_hash_mismatch
IMPACT Mutated event at seq 0; verifier detected the break at seq 1.
       prev_hash at seq 1 does not match the previous event's own hash;
       chain broken at this point and every event after it is
       unverifiable against this signature.
```

**Say**: "Someone at the bank rewrote history. The verifier caught it,
named exactly where the tamper happened, and dimmed every downstream
event because none of them are trustworthy anymore. This is what the
auditor sees."

Click **Reset**. Back to green. "And this is a receipt they can hand to
outside counsel, or to the Fed, or to their own audit committee."

### 4 · Trust-level ladder (2 min, laptop only)

Open the terminal again:

```bash
npx shadow-verify ~/.shadow/sessions/<id>/bundle.json \
  --public-key ~/.shadow/keys/public.pem \
  --check-anchors structural
```

Same verdict — but now `trust : SELF_SIGNED` because there are no
anchors on this bundle yet.

Explain the ladder briefly (30 sec each):

- **SELF_SIGNED** — what we just showed. Chain intact + signature valid, but a bank insider with the private key could still re-sign history.
- **TIME_ANCHORED** — add an RFC 3161 timestamp anchor. Now the bank can't roll history *forward*; the TSA's countersignature pins the seal to a specific wall-clock moment.
- **LOG_ANCHORED** — publish the batch root to Sigstore Rekor. Now anyone in the world can independently witness the seal existed on a given date; even the bank + TSA colluding can't retroactively rewrite.

**Say**: "You choose your threat model. If the concern is 'employee
tampers with the log', SELF_SIGNED is enough. If the concern is
'management tampers', TIME_ANCHORED. If the concern is 'a whole
institution colludes to rewrite', LOG_ANCHORED. Shadow ships all three."

### 5 · XREAL flourish (2-3 min, hardware)

Only after the story is told. Plug XREAL One Pro USB-C into any Mac
port (no adapter, no software install — Nebula for Mac was
discontinued 2026, all display config is native macOS + on-glass
buttons). System Settings → Displays → Mirror + set 60 Hz.

Open the replay in xreal mode:
```
open "http://localhost:8765/index.html?xreal=1"
```
The `?xreal=1` param already bumps fonts + contrast + caps motion for
33 PPD birdbath optics (the "90 PPD" spec you'll see in some places
is wrong — actual is 1920÷57° ≈ 33 PPD). Cmd-+ once or twice for
comfort. Show the tampered-event cascade through the glasses.

**Say**: "Same evidence, same verifier, same signing key — the auditor
gets a 171-inch virtual monitor with the chain-break visualization
front and center. When we ship the 3D chain-corridor next quarter,
this JSON, this crypto, rendered as a spatial chain of blocks you can
step through. Today: 2D but in-glasses."

**Do NOT** promise WebXR immersive-ar in this demo — that path doesn't
work on macOS Chrome (confirmed 2026-07-13 research). It's an
Android/ARCore-only WebXR path. The XREAL Eye add-on unlocks cameras
for 6DoF but isn't required for a tamper-button demo.

### 6 · Close (60 sec)

**Say**:

> "Two open questions for you. One: for the IEEE VR abstract, does the
> auditor-walkthrough visual metaphor (this cascade dimming) hold up as
> a research contribution, or should we frame it differently? Two: when
> you talk to Y.U. Dean+VP, does the SR 26-2 model-purpose carve-out for GenAI positioning land or
> does that need to be reframed for a non-Fed audience?"

Do NOT ask for money, roles, or timing. Ask her opinion, listen, take
notes. Both questions are things she legitimately knows better than
you do.

---

## Pre-Wed checklist (Tuesday night)

Run all four in order. Any failure = fix before demo.

```bash
# 1. Adapter works: hook config still resolves absolute paths
grep -c "/shadow-record.mjs" ~/.claude/settings.json
# → expect 9

# 2. Tests still green
cd ~/Desktop/AI-Projects/shadow-mentor
node --test 'test/**/*.test.js' 2>&1 | tail -3
# → expect: 1471 pass / 3 skipped / 0 fail (or higher if we ship more)

# 3. Demo file loads from file:// without errors
open demos/replay/index.html
# → drop demo bundle, paste key, click Tamper, click Reset. All work.

# 4. Fresh session dogfood produces a bundle with real model_id
claude   # opens a real session
# do: read hello.txt / write hello.txt
# type /exit
ls -la ~/.shadow/sessions/ | head -3   # pick newest, note the id
npx shadow-verify ~/.shadow/sessions/<id>/bundle.json \
  --public-key ~/.shadow/keys/public.pem
# → expect: agent : claude-code@2.1.116 (NOT @unknown)
#           model_id populated (NOT unknown) — visible via /api/version or by
#           inspecting bundle.header.models[0].model_id directly
```

**If any of the above fails, DO NOT demo it live.** Fall back to the
2026-07-13 archived bundle at
`docs/dogfood-evidence/m2.1-first-success-13df92c7-2026-07-13.json` +
`docs/dogfood-evidence/public-key-2026-07-13.pem`. That one is
guaranteed working — that's what the seeded demo file is anyway.

---

## What NOT to demo (freeze list)

Don't show these Wed unless Lora specifically asks. Distractions:

- The whole 5-persona council API. Different pitch, different day.
- Trader-pack / DS-pack. Different vertical.
- Prompt-caching / cost-savings. Not what Lora cares about.
- The evidence bundle spec's inner structure at the JSON level. Save
  for whoever nerds out about it after Lora leaves.

If she asks: "yes, we have all that; want to dig into it after this?" —
then break out the JSON viewer.

---

## Answers to likely questions

**"Does this need Anthropic's cooperation?"**
No. The adapter uses Claude Code's public hook API, documented at
code.claude.com/docs/en/hooks. Anthropic doesn't sign anything, doesn't
see anything — the whole capture + sign happens on the operator's
laptop. Anthropic could break the hook contract, but the current hook
API is stable and Anthropic v2.1.205 itself now defends against
transcript tampering, which puts them on the same side as us.

**"What if the operator changes the code and re-signs?"**
That's exactly what SELF_SIGNED can't defeat, and why the trust ladder
exists. TIME_ANCHORED closes it against future-dated tampering.
LOG_ANCHORED closes it against past-dated tampering. The bank chooses
the ladder rung based on their threat model.

**"How does this fit into SR 26-2?"**
The 2026-04-17 Fed/OCC/FDIC guidance rescinded SR 11-7 + OCC 2011-12 and
scoped GenAI + agentic AI out of the model-risk envelope pending a
follow-up RFI. Banks using GenAI in decision workflows have no
currently-mandated evidence requirement. Shadow fills that gap
voluntarily, before the follow-up RFI is finalized. If the RFI ends up
mandating something, Shadow is already there.

**"Why not just use OpenTelemetry?"**
OTel exports observability data — it's designed for engineers reading
dashboards. It has no cryptographic chain, no signature over the batch,
no way to detect tampering. Shadow's bundle is deliberately smaller
than an OTel trace (hashes, not full payloads) and every event is
signed as one Merkle root, which is what an auditor needs.

**"What's the pricing model?"**
Not deciding today. Ask Alex 3 months from now after we know whether
the primary buyer is banks (per-seat), banks-through-consultants (per
audit), or auditors themselves (per hour saved). Answering pricing on
Wed is premature.

---

## Post-demo

- Take Lora's specific feedback into brain memory that same night —
  don't wait.
- If she said yes to IEEE VR v4, refresh the abstract Thursday
  morning while it's fresh. Don't wait for the 2026-08-24 deadline.
- Add whatever she flagged as unclear or wrong to
  `docs/roadmap/POST_WED_FEEDBACK.md` so it doesn't get lost.
