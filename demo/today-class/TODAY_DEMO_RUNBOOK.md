PRIMARY DEMO:
Banking evidence workflow + tamper localization + independent verifier

DEVICE STATUS:
Beam Pro not yet available.
No device validation is claimed.

---

# Today's Shadow classroom demo — runbook

3–5 minutes, offline, no XREAL hardware, no internet. The whole demo runs from two frozen offline pages:
a banking narrative opener and the independent evidence verifier. The tamper is shown by loading a
pre-made tampered fixture — deterministic, nothing to break live.

Branch `feat/shadow-spatial-ux-asset-audit-v11` · commit at demo time: run `git rev-parse --short HEAD`.

## The three things the audience should leave with
1. Shadow records the evidence behind an AI decision — sources, model/tool activity, human status.
2. A successful verify proves **integrity, not correctness**.
3. If an earlier record is changed, the verifier names the **first failure** and the **downstream** it
   affects — and anyone can check this **independently, offline**.

## Files
- `DEMO_CLICK_MAP.md` — exact clicks, expected results, recovery, max wait.
- `DEMO_TALK_TRACK_EN.md` / `DEMO_TALK_TRACK_ZH.md` — what to say, matched to each click.
- `DEMO_QA.md` — honest answers to the likely questions.
- `DEMO_PREFLIGHT_CHECKLIST.md` — the 2-minute pre-class check.
- `FALLBACK_RUNBOOK.md` — how to finish on screenshots if anything misbehaves.
- `DEMO_REHEARSAL_RESULTS.md` — validation runs.
- `fixtures/` — pristine + tampered banking bundles + the public key + SHA256SUMS.
- `fallback/` — real screenshots of every step.
- `scripts/` — preflight / start / reset / stop.

## What was verified (so you can trust it in the room)
- `pristine-banking-bundle.json` → the real `verify.html` shows all trust rows **VERIFIED**
  (Record Integrity / Digital Signature / Hash Chain / Profile), Analytical correctness = *Not judged by
  this verifier*. Bundle ID `reference-banking-decision-2026-001`.
- `tampered-banking-bundle.json` (one early tool-call record altered) → **FAILED**, **Failed sequence 2**,
  **Failure reason prev_hash_mismatch**, **Downstream affected seq 2…4**. Final approval untouched.
- Driven through the real `verify.html` in Chromium: pristine VERIFIED, tampered FAILED — confirmed. The
  verifier makes **no external requests** (offline).
- These are deterministic (same bytes → same result every load).

## Honest boundaries (do not cross)
- No Beam Pro / XREAL device validation. The Android candidate is built; device testing is pending.
- No claim of 6DoF / controller / camera / OCR working on device.
- No claim the cryptography is independently audited, and no claim of production-readiness.
- The verifier proves integrity + provenance, **not** analytical correctness or legal compliance.

---

## RUN THIS BEFORE CLASS

```bash
cd <your shadow-mentor repo root>   # the folder that contains verify.html

# 1) preflight — must print "PREFLIGHT OK"
bash demo/today-class/scripts/demo-preflight.sh

# 2) start the offline demo server (prints the URLs)
bash demo/today-class/scripts/demo-start.sh
```

### 3) URLs to open (fullscreen on the presentation display)
- Opener:  http://127.0.0.1:8137/demos/guided-shadow-demo.html
- Verifier (the heart): http://127.0.0.1:8137/verify.html
- (optional spatial) Audit Room: http://127.0.0.1:8137/demos/replay/3d/index.html

Public key to paste into verify.html (from `fixtures/reference-2026-public-key.pem`):
```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEADXsQZDTPJpw2TKCigFvZR8TIgeXZIDgLs5wlEKZqraU=
-----END PUBLIC KEY-----
```
Then in verify.html: **Choose file** → `fixtures/pristine-banking-bundle.json` (VERIFIED) →
**Choose file** → `fixtures/tampered-banking-bundle.json` (FAILED · seq 2 · downstream 2…4).

### 4) reset (safe to run repeatedly; re-checks fixture hashes)
```bash
bash demo/today-class/scripts/demo-reset.sh
```

### 5) stop (kills only the demo server)
```bash
bash demo/today-class/scripts/demo-stop.sh
```

**file:// fallback (no server):** double-click `verify.html` and `demos/guided-shadow-demo.html` in Finder.
