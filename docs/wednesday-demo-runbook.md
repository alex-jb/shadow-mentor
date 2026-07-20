# Wednesday demo runbook — scan → answer → glasses (+ 3D + voice)

Three acts on the XREAL One Pro used as a **display** (USB-C DisplayPort-Alt from
the Mac — no Eye/Beam Pro needed). Everything runs in the browser. Each act has an
**offline fallback** so a network hiccup never makes the glasses look broken.

## 0. Glasses setup (once)

1. Plug the One Pro into the Mac's USB-C (must be a DP-Alt-capable port/cable).
2. Set it as an **extended** (not mirrored) display, or mirror if you want to see
   the same thing on the laptop. In XREAL's control, enable 3D/SBS mode only for
   Act 2's stereo beat.
3. Move the browser window onto the glasses display, full-screen (`⌃⌘F`).

**Serve over http, not `file://`.** Act 1 loads a shared verifier module, and
browsers only allow ES-module imports over http(s). Two ways:
- **Online:** open the live URL — `https://shadow-mentor-phi.vercel.app/demos/`.
- **Offline venue:** from the repo root run `python3 -m http.server 8127`, then open
  `http://localhost:8127/demos/` (localhost needs no internet — fully offline-safe).
The old `open file://…` shortcut no longer works for Act 1.

## Act 1 — scan a document → answer in the glasses

`demos/scan-analyze/index.html`

- Open it with **glasses HUD mode**: append `?glasses=1` (or press **G** to
  toggle). Big, high-contrast, single-column — the answer is the star.
- Click **"scan a document"** → pick/capture an image of a financial statement or
  loan doc → it shows as the captured artifact.
- Press **Analyze**:
  - **Real vision** (impressive): posts the image to `/api/scan-analyze` (Claude
    Vision) → a real `{verdict, claims}` answer. Needs the endpoint **deployed**
    (merge `feat/wednesday-demo` → `vercel --prod`) **and** `ANTHROPIC_API_KEY`
    set on the Vercel project. Point at a different endpoint with `?api=<url>`.
  - **Offline fallback** (reliable): the two built-in artifacts ("financial
    statement" / "data chart") return a worked analysis with clickable
    citation pills — no network. **Recommended if the venue Wi-Fi is shaky.**
- Press **Seal evidence** → downloads a signed bundle + public key, AND runs the
  real offline verifier right on screen → **✓ VERIFIED offline · Ed25519 + hash-chain
  intact**. This is the moat, live: the answer is real, and the record is provable.
- **The tamper beat (the closer):** press **Tamper & re-verify** → it edits one
  number in the sealed record and re-runs the SAME verifier → **✗ VERIFICATION FAILED
  at event N** (the chain breaks exactly where the edit happened). Press again to
  restore → ✓ again. Say: *"nobody can silently rewrite an AI's answer — change one
  digit and the proof fails."* Voice: hold Space, say "seal" then "tamper".
- **Recommended demo path:** rehearse both. Lead with a real scan if Wi-Fi is
  solid; keep the offline "financial statement" artifact one click away as the
  safety net. The seal→verify→tamper beat works offline regardless.

## Act 2 — 3D spatial view

`demos/spatial-finance/index.html`

- Press **1** (analytics) then **S** for **SBS stereo** — the risk-return cloud
  splits into two eye viewports; on the One Pro in 3D mode it fuses to depth.
  Tune with `[` / `]`. Start in stereo with `?stereo=1`. **Confirm the fusion on
  the actual glasses before relying on it** — if it doesn't fuse cleanly, present
  the flat (mirrored) cloud, which always works.
- Optional **Flow Immersive** path (only if you have an a.flow.gl account):
  `node demos/spatial-finance/flow-adapter.mjs` writes `flow-portfolio.csv` +
  `flow-audit.csv`; import them into Flow Editor and open the scene on the
  glasses. If Flow isn't set up, the built-in SBS cloud covers this act with zero
  dependencies.

## Act 3 — voice

Both demos take voice: hold **Space**, say e.g. "show the risks" / "what if rates
rise" / "replay" (spatial-finance) or drive scan-analyze by keyboard. Voice **input**
uses the browser speech-recognition service (Chrome relays audio → needs network);
voice **output** (narration) uses device speech synthesis. **Keyboard is
authoritative** — if the venue is offline, skip the voice beat and drive by key.
Test voice on the actual laptop + network before the room.

## The through-line (say this)

Scan a real document → an AI produces an answer → every claim is traceable to its
source → the whole thing is Ed25519-signed into an evidence bundle anyone can
verify offline. That's Shadow: not a better model, but **making an AI-produced
financial analysis auditable** — the answer is real, and nobody can silently
rewrite the record.

## Pre-flight checklist

- [ ] Served over http (live URL or `python3 -m http.server`), NOT `file://`
- [ ] Glasses show the browser (DP-Alt), full-screen, `?glasses=1`
- [ ] Act 1 offline artifact works (Analyze → answer → pills) with Wi-Fi off
- [ ] Seal → shows **✓ VERIFIED**; Tamper → shows **✗ FAILED**; Tamper again → ✓
- [ ] (If using real vision) endpoint deployed + `ANTHROPIC_API_KEY` set; test one scan
- [ ] Act 2 SBS fuses on-device (else plan flat)
- [ ] Voice tested on the venue network (else keyboard-only)
- [ ] A signed bundle downloads + `shadow-verify` confirms it
