# Demo rehearsal results

Automated validation of the demo's deterministic core, plus a template for Alex's timed run-throughs.
The verify flow is deterministic cryptography — the same bytes produce the same result on every load — so
the machine-verifiable part is fully pinned here; the human variable is timing + narration.

## Preflight
`bash demo/today-class/scripts/demo-preflight.sh` → **PREFLIGHT OK** (commit 40efb81). All checks green:
branch, all demo files present, fixture hashes match, frozen `verify.html` unchanged
(`c478b46f…`), python3 available, port 8137 free, no external runtime resources in either page.

## Real-browser validation (Chromium, via the actual verify.html)
Driven through the real `http://…/verify.html`:
- `pristine-banking-bundle.json` → **VERIFIED** — Record Integrity / Digital Signature / Hash Chain /
  Profile all VERIFIED; Analytical correctness "Not judged by this verifier"; Bundle ID
  `reference-banking-decision-2026-001`. (screenshot `fallback/02-verify-success.png`)
- `tampered-banking-bundle.json` → **FAILED** — Hash Chain FAILED; **Failed sequence 2**; **Failure reason
  prev_hash_mismatch**; **Downstream affected seq 2…4**. (screenshot `fallback/04-first-failure.png`)
- **Network requests: 0 external** (only same-origin localhost during the automated drive; in the real demo
  the operator uses "Choose file" and verify.html fetches nothing). Offline claim holds.

## Deterministic re-verification (3 consecutive runs)
`verifyBundle` (Node), same fixtures, 3 runs:
```
run 1: pristine ok=true | tampered ok=false failedSeq=2 reason=prev_hash_mismatch
run 2: pristine ok=true | tampered ok=false failedSeq=2 reason=prev_hash_mismatch
run 3: pristine ok=true | tampered ok=false failedSeq=2 reason=prev_hash_mismatch
```
Identical every run → no drift, no flakiness.

## Acceptance (met)
- [x] pristine proof passes · [x] tampered proof fails with a clear early first-failure + downstream
- [x] three consecutive identical runs · [x] no internet dependency · [x] no console/external requests
- [x] frozen `verify.html` unchanged · [x] stable APK untouched (no APK involved) · [x] no semantic drift
- [x] Reset is a no-op on read-only fixtures (re-checks hashes)

## Alex's timed run-through log (fill during 3 rehearsals before class)
| Run | Total time | Startup | Verify=VERIFIED | Tamper=FAILED | first-failure seq | downstream | console errs | recovery needed |
|-----|-----------|---------|-----------------|---------------|-------------------|-----------|--------------|-----------------|
| 1   |           |         |                 |               |                   |           |              |                 |
| 2   |           |         |                 |               |                   |           |              |                 |
| 3   |           |         |                 |               |                   |           |              |                 |

Target: each run under 5 minutes; verify VERIFIED; tamper FAILED · seq 2 · downstream 2…4; 0 console errors;
Reset restores initial state. If any run needs a recovery action, note which fallback screenshot you used.
