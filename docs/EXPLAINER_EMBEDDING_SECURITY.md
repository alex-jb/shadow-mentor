# Explainer embedding security model

How the three explainers are embedded into the landing (`demos/shadow-explainer-landing.html`), the
guided demo (`demos/guided-shadow-demo.html`), and the non-frozen Verify companion (`verify-explainers.html`).

## iframe sandbox
Explainers embed as **same-origin iframes** with a minimal sandbox:
```
sandbox="allow-scripts"
```
Not granted: `allow-same-origin`, `allow-top-navigation`, `allow-popups`, `allow-forms`, `allow-modals`,
`allow-downloads`. Without `allow-same-origin` the iframe runs with an **opaque origin** — it cannot read
the parent DOM, cookies, or storage. (The Verify companion's embed of the real `verify.html` additionally
grants `allow-downloads` only, because the verifier offers a "download report" action; nothing else.)
Each iframe has a `title`, `loading="lazy"`, a visible loading state, and a failure state. Only fixed,
in-repo paths are referenced — never `srcdoc` with untrusted HTML, never an external URL.

## No autoplay / one at a time
Nothing autoplays. Iframes load **only on an explicit click**; opening a new explainer replaces the
current one; **Close removes the iframe** (unloads it, stopping any timers). Posters (real
browser-rendered screenshots) are shown until the user opens the interactive demo.

## postMessage contract — `shadow-explainer-embed-v1`
Iframes are **independent by default** (no messaging needed). If messaging is ever enabled, every message
is validated by `demos/shadow-embed-protocol.mjs` before it is acted on:
- `event.origin` must be an allowlisted (same) origin; `event.source` must be the expected window.
- `data.protocol` must equal `shadow-explainer-embed-v1`.
- `data.explainer_id` ∈ {audit-chain, reason-code, persona-deliberation}.
- `data.message_type` ∈ the allowlist (PARENT→CHILD: READY_QUERY/PLAY/PAUSE/RESTART/SET_LOCALE/
  SET_REDUCED_MOTION/SET_SCENARIO; CHILD→PARENT: READY/STEP_CHANGED/SCENARIO_CHANGED/COMPLETED/ERROR).
- The payload is rejected if it contains `<script>` / `javascript:` / `onerror=` / `eval(` / `new Function`.
There is **no** arbitrary command execution, `eval`, `Function`, DOM-selector injection, URL navigation, or
HTML injection. The parent handler returns early on any non-conforming message. Host-tested in
`test/explainer-integration.test.js`.

## CSP + network
`default-src 'none'`; `script-src 'self' 'unsafe-inline'` (the landing loads its own `.mjs` validator);
`style-src 'unsafe-inline'`; `img-src 'self' data:`; `frame-src 'self'`; `connect-src 'none'`. Result:
0 external requests, no analytics, no telemetry, no model API, no evidence upload, no CDN/fonts, no cookies.

## Fixture vs live
Everything is a **deterministic FIXTURE demonstration**. No live model, no runtime API dependency. Never
claims production, compliance, device validation, or AI correctness.

## Frozen artifacts
The frozen Wednesday verifier package and `verify.html` are **referenced read-only** (iframed), never
overwritten. Production integration remains a separate, later effort.
