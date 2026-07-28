# Shadow explainers — embeddable animation components

Self-contained HTML+SVG+CSS explainer animations for Shadow concepts (audit chain, tamper propagation,
persona deliberation, attestation binding…). Generated with **our own Claude call** — no third-party
animation code, so **no CC-BY-NC-ND / NonCommercial / NoDerivatives constraint**. The output is ours,
editable, commercial-safe, and has **no runtime dependency** (runs from `file://`, offline, CSP-locked).

## What's here
- `audit-chain.html` — the flagship reference: the hash-chained, Ed25519-signed provenance chain, with a
  **Tamper** button that shows failure propagating downstream. EN + 简体中文, reduced-motion, status by
  shape+text+colour, honest ("integrity, not correctness"). `audit-chain-preview.png` is a rendered still.
- `SYSTEM_PROMPT.md` — the reusable prompt (Shadow rules baked in: honesty, no decorative particles,
  bilingual, a11y, self-contained, status never colour-only).
- `generate.mjs` — authoring-time generator (needs `ANTHROPIC_API_KEY`; not a runtime dependency).

## Generate a new explainer
```bash
export ANTHROPIC_API_KEY=...          # authoring-time only, Alex's key
node apps/shadow-lens/explainers/generate.mjs "how the reason-code dictionary hash binds an attestation"
node --test test/shadow-explainers.test.js    # self-contained + honesty gate before committing
```

## Embed it
It's a single HTML file — inline it in docs, drop it in an `<iframe>` on a demo page, or open it directly.
Because it's CSP-locked and offline, it's safe on a USB stick or in a bank's air-gapped review.

## Rules (enforced by `test/shadow-explainers.test.js`)
No external script/link/fetch/CDN, no eval; CSP `default-src 'none'`; bilingual EN + 中文 with
reduced-motion; status carries shape + text (never colour alone); states integrity ≠ correctness and
marks analytical correctness NOT judged; illustrations labeled FIXTURE. Never claim device validation,
live model, 6DoF, or eye tracking.

## Why our own prompt, not the Fogsight tool
The "one self-contained HTML animation from a sentence" idea is common; the Fogsight tool is CC-BY-NC-ND
(no commercial, no derivatives) and burns your API tokens anyway. We reproduce the *pattern* with our own
Claude and our own prompt — deterministic, embeddable, license-clean, aligned with Shadow's honesty rules.
