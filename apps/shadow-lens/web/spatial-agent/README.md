# Shadow Lens — Spatial Agent (browser/Quest layer)

Adapts the Lab 7 Three.js/WebXR spatial-agent architecture to the Shadow Lens contract. This is
the **browser and Quest** spatial-agent layer (scene questions + controlled actions). Unity +
XREAL SDK remains the One Pro/Eye capture + OCR + native-voice + source-overlay layer; Shadow
Core is the shared evidence/signing/verification/profiles. **This does not replace Unity.**

The standalone **course submission** lives separately (`~/Desktop/Yeshiva/Lab7-Spatial-Agent/`)
and does not depend on this repo — the grader runs the original lab unchanged (plus the two
implemented TODOs + hardening).

## What's here

- `scene-graph.mjs` (§4) — `sessionToSceneGraph(session)` → `shadow-evidence-scene-v1`. Every
  object id, source id, evidence sequence, verification state, and document source-box coordinate
  comes from the **real signed session** — the model never invents them. Works for all three
  profiles (banking / data-science / coding) via per-profile audit lanes.
- `server-tools.mjs` (§5) — closed server-side tool allowlist. `verify_bundle` invokes the **real
  Shadow verifier** (never an LLM). Every returned id is validated against the session.
- `client-actions.mjs` (§6) — closed client-side action allowlist. The model may request only
  these; each is validated (name, arg schema, referenced id exists) before the browser performs
  it. Arbitrary JS/DOM/URL/file/shell is rejected.
- `agent-core.mjs` (§10) — two paths: deterministic commands (Show Sources / Show Audit / Verify /
  Reset) bypass the LLM; grounded questions resolve against the session with citations. Ungroundable
  → honest answer, no actions. Document text + query are untrusted and cannot change tool routing.
- `../../../api/shadow-lens/spatial-agent.js` (§8) — the hardened endpoint.

## Security delta from the classroom starter (§3)

The classroom `backend-starter` is fine for a local lab but **not** copied as-is:

| Classroom starter | Shadow endpoint |
|---|---|
| `cors()` broad default | allowlisted origin, rejects `Origin: null` |
| 10 MB JSON | strict 6 MB cap, `413` over limit |
| generic `/api/agent`, model-returned client tool calls | closed server-tool + client-action allowlists, validated against the real session |
| screenshot trusted | magic-byte validated after base64 decode; untrusted visual context only |
| — | `no-store`, prompt-hash + model-id logging, no signing/model key ever exposed |
| model decides validity | `verify_bundle` = the real verifier; the LLM never decides if a bundle is valid |

The **structured scene graph + Shadow source map are the source of truth**; the screenshot is
secondary. The backend never claims an action completed merely because the model requested it —
the browser performs validated actions.
