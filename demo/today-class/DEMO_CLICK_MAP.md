# Demo click map — exact operator actions

Every step has an **exact** action, the **expected visible result**, a **recovery** if it doesn't appear,
and a **max wait**. Labels are verbatim from the real pages. The tamper is shown by loading the pre-made
tampered fixture (deterministic — no live-edit that can fail).

**Before class:** run `demo/today-class/scripts/demo-preflight.sh` → must print `PREFLIGHT OK`.
Then `demo/today-class/scripts/demo-start.sh` and open the printed URLs. Fullscreen on the presentation
display. Have `demo/today-class/fallback/` open in Finder in case a step misbehaves.

---

### A. Opener (optional, ~30 s)
1. Open **`.../demos/guided-shadow-demo.html`**.
   - Expect: title "Shadow — three layers of inspectable trust", an intro slide, **EN / 中文** buttons,
     **◀ Back / Next ▶** nav, and a footer line "This is a FIXTURE demonstration, not a production banking
     system." · Recovery: skip to B. · Max wait: 3 s.
2. Click **Next ▶** two–three times to set the banking framing, then stop. (Do not run to the CTA yet.)

### B. Normal banking record → VERIFIED  (~1 min)
3. Open **`.../verify.html`** (the "VERIFY EVIDENCE" tab is already selected).
   - Expect: heading area with a dashed **"Drop an evidence bundle here"** box, a blue **"Choose file"**
     button, and below it a public-key textarea (placeholder `-----BEGIN PUBLIC KEY-----`). · Max wait: 3 s.
4. Paste the public key: open **`demo/today-class/fixtures/reference-2026-public-key.pem`**, copy its
   contents, paste into the textarea labelled **"Ed25519 public key (PEM), required if the bundle does not
   embed one"**. · Recovery: the key is also printed at the top of `TODAY_DEMO_RUNBOOK.md`.
5. Click **"Choose file"** → select **`demo/today-class/fixtures/pristine-banking-bundle.json`**.
   - **Expected result:** the trust matrix renders —
     Record Integrity **VERIFIED** · Digital Signature **VERIFIED** · Hash Chain **VERIFIED** · Profile
     **VERIFIED** · Source Resolution **NOT PRESENT** · External Anchor **NOT PRESENT** ·
     Analytical correctness **"Not judged by this verifier"**. Bundle ID `reference-banking-decision-2026-001`.
   - Recovery: use the **"…or paste bundle JSON"** button + paste the file contents; or show
     `fallback/02-verify-success.png`. · Max wait: 3 s.
6. Point at the **"What verification proves — and does not"** panel — read the core line (talk track 1:40).

### C. Tamper one early record → FAILED + first failure + downstream  (~1 min)
7. Click **"Choose file"** again → select **`demo/today-class/fixtures/tampered-banking-bundle.json`**.
   - **Expected result:** status **FAILED**; Hash Chain **FAILED**; Record Integrity & Digital Signature
     **NOT CHECKED**; meta rows **Failed sequence = 2**, **Failure reason = prev_hash_mismatch**,
     **Downstream affected = seq 2…4**.
   - This is one early record (the tool-call step) changed after sealing; the final approval was left alone.
   - Recovery: paste-JSON path, or show `fallback/04-first-failure.png` + `05-downstream-impact.png`.
     · Max wait: 3 s.
8. Say the failure/downstream line (talk track 2:40): first failing point vs the later affected steps.

### D. Independence point  (~30 s)
9. Gesture at the browser: this is **one offline HTML file** — check the on-page "Network transparency"
   line **"External requests (expected: 0)"** and **"processed locally — nothing uploaded"**.
   - Talk track 3:20: the reviewer doesn't trust the Shadow app; the original passes, the modified fails.

### E. Unity / XREAL status (optional, ~30 s)
10. Show **`demo/today-class/fallback/08-unity-xreal-readiness.png`** (or the Audit Room tab
    `.../demos/replay/3d/index.html`, press `1`).
    - Say the XREAL line (talk track 4:00): built, **device validation pending — Beam Pro not arrived**.
      **Do not** claim any device result.

### F. Reset
11. Reload the `verify.html` tab (clears the result). The Audit Room resets with **`0`**.
    Fixtures are read-only; `demo/today-class/scripts/demo-reset.sh` re-checks their hashes.

---

### Chinese demo variant
- guided-shadow-demo: click **中文**. · verify.html: the page auto-shows a **TRANSLATION** badge and a
  language control; the status/matrix strings have zh-CN (已验证 / 验证失败 / 失败序号 / 受影响的后续序号).
  Use `06-independent-verifier-success.png` framing if needed.

### Global recovery
- Server down → double-click `verify.html` in Finder (**file://** works for file-load + paste).
- Anything stalls > 3 s → switch to the matching `fallback/*.png` and keep talking. Never debug live.
