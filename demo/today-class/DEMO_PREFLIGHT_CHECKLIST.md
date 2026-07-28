# Pre-class checklist (2 minutes)

Run the automated check first:
```bash
bash demo/today-class/scripts/demo-preflight.sh   # must print PREFLIGHT OK
```

Then eyeball:
- [ ] `PREFLIGHT OK` printed (branch, fixtures, hashes, frozen verify.html, port 8137 free, no external URLs).
- [ ] `demo-start.sh` prints the three URLs; open them; each loads in < 3 s.
- [ ] verify.html: paste the public key → Choose file `pristine-banking-bundle.json` → all rows **VERIFIED**.
- [ ] verify.html: Choose file `tampered-banking-bundle.json` → **FAILED · seq 2 · Downstream seq 2…4**.
- [ ] `fallback/` folder open in Finder (8 screenshots present).
- [ ] Browser fullscreen on the presentation display; OS scaling 100%.
- [ ] Talk track open on a second screen/phone (`DEMO_TALK_TRACK_EN.md` or `_ZH.md`).
- [ ] Say the core line out loud once: "This proves the evidence is consistent, signed, and unchanged —
      not that the conclusion is correct."

Honest-status reminder (for Q&A): no device validation, no independent crypto audit, not production-ready.
