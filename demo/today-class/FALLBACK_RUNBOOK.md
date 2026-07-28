# Fallback runbook — finish the talk on screenshots

The demo is offline-capable, but never debug live. If any step stalls > 3 s, open the matching screenshot
in `fallback/` (have the folder open in Finder before class) and keep talking. Every core message survives
on the screenshots.

## Screenshot → demo step
| Talk step | Screenshot | What it shows |
|---|---|---|
| Banking record / opener | `01-normal-banking-record.png` | the guided banking narrative opener |
| Verify success | `02-verify-success.png` | trust matrix all VERIFIED + "proves / does not prove" panel |
| Tampered record | `03-tampered-record.png` | (= the FAILED screen) |
| First failure | `04-first-failure.png` | FAILED · Failed sequence 2 · reason prev_hash_mismatch |
| Downstream impact | `05-downstream-impact.png` | same screen: Downstream affected seq 2…4 |
| Independent verifier — success | `06-independent-verifier-success.png` | pristine VERIFIED in the offline verifier |
| Independent verifier — failure | `07-independent-verifier-failure.png` | tampered FAILED in the offline verifier |
| Unity / XREAL readiness | `08-unity-xreal-readiness.png` | real Unity DESKTOP capture — NOT device validation |

Note: verify.html shows first failure AND downstream on ONE screen (`04`/`05` are that screen). `02` and `06`
are the same VERIFIED screen (it *is* the independent verifier). This is honest — one offline file does both.

## Failure → what to do
- **Local server fails** → double-click `verify.html` in Finder (file:// works for Choose-file + paste).
  Or just present from `fallback/02` + `fallback/04`.
- **Chromium crashes** → reopen; if slow, present from screenshots. The message is the same.
- **verify.html doesn't load a file** → click "…or paste bundle JSON" and paste the fixture contents; or
  show `02` / `04`.
- **Public-key box rejects the key** → re-copy from `fixtures/reference-2026-public-key.pem` (no trailing
  spaces); or show `02`.
- **Audit Room / Unity unavailable** → skip it; show `08-unity-xreal-readiness.png` and say "device
  validation pending".
- **Classroom internet down** → irrelevant; the demo is fully offline. Say so — it's a feature.

## Do not
- Do not edit code, run tests, or rebuild anything live.
- Do not claim any Beam Pro / XREAL device result.
