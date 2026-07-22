# Shadow self-contained animation system

Shadow's own explainer-animation system: each concept is one **self-contained HTML+SVG+CSS** file that
runs offline, embeds anywhere, and encodes Shadow's honesty rules. Generated with **our own Claude + our
own prompt** — no third-party animation code, so **no CC-BY-NC-ND / NonCommercial constraint** and **no
runtime dependency**.

## What exists
| explainer | file | what it teaches |
|---|---|---|
| Audit chain + tamper propagation | `apps/shadow-lens/explainers/audit-chain.html` | a hash-chained Ed25519 provenance chain; tamper one link → downstream fails |
| Reason-code → attestation binding | `demos/animations/reason-code-attestation.html` | a reason is bound to a hashed, versioned dictionary; changing the text after signing is caught |
| Persona deliberation → synthesis | `demos/animations/persona-deliberation.html` | perspectives → evidence-grounded synthesis; majority ≠ correctness; dissent/unsupported/abstention preserved |

Reusable prompt: `apps/shadow-lens/explainers/SYSTEM_PROMPT.md`. Authoring-time generator:
`apps/shadow-lens/explainers/generate.mjs` (needs `ANTHROPIC_API_KEY`; not a runtime dependency).

## Data-contract pattern (reason-code example)
Non-trivial explainers separate data from view: a deterministic fixture (`fixtures/animations/*.json`) is
the source of truth; a builder (`demos/animations/build.mjs`) computes real hashes and **injects the
fixture into the HTML** so the page stays self-contained + offline with zero drift. Tests validate both.

## Rules (enforced by tests)
- **Self-contained**: no external script/link/font/fetch/CDN; no `eval`/`Function`; CSP `default-src 'none'`;
  runs from `file://`, offline; zero telemetry.
- **Honest**: state integrity ≠ correctness; keep the independent checks separate; mark adequacy /
  analytical correctness / legal-fairness `NOT EVALUATED`; never render `TRUSTED`/`COMPLIANT`; label
  illustrations FIXTURE. Never claim device validation, live model, 6DoF, or eye tracking.
- **Status never colour-only**: shape + text + colour. **Bilingual** EN + 简体中文 (hashes/IDs/quotes
  never translated). **Accessible**: `prefers-reduced-motion` + toggle, visible focus, keyboard-operable,
  ARIA live captions. **Deterministic**: no `Date.now()`/`Math.random()` driving visible content.
- **No decoration**: motion encodes meaning (sequence, causality, propagation), not sparkle/bloom/particles.

## Generate + gate + record
```bash
export ANTHROPIC_API_KEY=...                      # authoring-time only
node apps/shadow-lens/explainers/generate.mjs "<topic>"
node demos/animations/build.mjs                   # if the explainer has a fixture
node --test test/shadow-explainers.test.js test/reason-code-attestation.test.js
# then Playwright-capture screenshots + video into media/… and write a browser acceptance report
```

## Roadmap (per Alex's ordering)
1. Reason-code dictionary binding — **done**.
2. Persona deliberation explainer — **done** (personas = configured analytical perspectives, not experts;
   count ≠ confidence; majority ≠ correct; conclusion still needs evidence + verification; see
   `PERSONA_DELIBERATION_EXPLAINER.md`).
3. Embed all three into docs/demo — planned in `EXPLAINER_INTEGRATION_PLAN.md`.
4. Unity/Three.js reuse the same story — IMPLEMENTED via `shadow-guided-story-v1`. The three
   explainers, the Three.js player, and the Unity native adapter now render one compiled semantic
   block with a shared SHA-256 hash. See `SHADOW_SHARED_STORY_ARCHITECTURE.md` +
   `SHADOW_CROSS_ENGINE_PARITY.md`.
