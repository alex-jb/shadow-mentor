# Offline demo package — Wednesday 2026-07-16

This directory contains a pinned, `file://`-tested copy of the XREAL demo used for the Katz capstone presentation, plus a rehearsal checklist for confirming it works without network access.

**Why this exists:** the primary demo URL (`shadow-mentor-phi.vercel.app/demo/xreal.html`) depends on venue Wi-Fi. Classroom Wi-Fi is empirically the #1 killer of live demos — more than hardware, more than software crashes. This package eliminates that dependency by making a local-first path first-class.

## What's in the package

| File | Purpose |
| --- | --- |
| `xreal.html` | Byte-for-byte clone of `demo/xreal.html` at the time of packaging (commit `HEAD` when copied). Do not sync automatically; if the canonical demo changes, re-copy manually and update the "clone-of commit" record below. |
| `verify-offline.sh` | Smoke check: confirms the HTML file has zero external-URL references, greps for the fallback fixture, opens the file in the default browser via `file://`. Exit code 0 if all checks pass. |

## How it works

`demo/xreal.html` has a `FALLBACK_DESCRIPTOR` const inlined at line ~197. When the runtime `fetch("/api/ambient-turn")` fails (which it will over `file://` because there's no `/api/*` route without a server), the code path takes the catch block and renders the fallback. This has been the intended offline path since v1.5.47.

The `verify-offline.sh` script confirms:
1. No `http://` or `https://` URLs point at anything other than `about:blank` / `#` / documented external resources
2. The `FALLBACK_DESCRIPTOR` const is present and structurally valid
3. Opening the file via `file://` renders without console errors (checked manually by the operator per the rehearsal checklist)

## Rehearsal checklist (do at least once before Tue 2026-07-15 EOD)

1. **Airplane mode test.** Turn on macOS airplane mode (Wi-Fi off + Bluetooth off).
2. **Open via file://.** Double-click `demos/offline-2026-07-16/xreal.html`. Should open in default browser.
3. **Confirm the fallback path.** The status text top-right should read "fallback fixture (offline)" within ~5 seconds. Console should show one warning: `live fetch failed, using fallback: ...`
4. **Confirm the render.** Five persona pills should render around the central verdict pill. The verdict pill should read "APPROVE" (from the obvious-approve fallback fixture).
5. **Press "R".** Should re-fire the fetch. Should log the same warn and re-render.
6. **Fullscreen.** Click the FULLSCREEN button top-right. Should go fullscreen without issue.
7. **Kill Chrome and reopen.** Confirm nothing was cached that would fake a "working" render.

If any step fails, do not use this package on Wednesday; fall back to the laptop-display-only path documented in `docs/demo-2026-07-16-narration-tight.md` and re-run this rehearsal against the fresh copy of `demo/xreal.html`.

## Three network layers on Wednesday (in order of preference)

1. **This offline package via `file://`.** Zero network. Works even if Katz Wi-Fi is completely down.
2. **Phone hotspot to the Vercel deployment.** Requires a working cellular signal + the operator's phone battery. Verifies against `shadow-mentor-phi.vercel.app/demo/xreal.html`.
3. **Venue Wi-Fi to the Vercel deployment.** Historically the least reliable path; do not lean on it.

## Clone-of record

- **Source file:** `demo/xreal.html`
- **Copied at:** 2026-07-10
- **Copy method:** `cp demo/xreal.html demos/offline-2026-07-16/xreal.html` (byte-for-byte)

Any change to the canonical `demo/xreal.html` after this timestamp is NOT reflected here. If the canonical file changes before Wednesday, the operator MUST manually re-copy and re-run the rehearsal checklist.

## Sibling documents

- `docs/demo-2026-07-16-narration.md` — full narration (697 words, backup teleprompter)
- `docs/demo-2026-07-16-narration-tight.md` — 3-min hard-cap narration (403 words, stage version)
- `docs/wednesday-preflight-2026-07-16.md` — the general pre-flight checklist. This offline README addends it; does not replace it.
