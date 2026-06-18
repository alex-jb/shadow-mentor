# Contributing to Shadow

> Solo-founder repo. PRs welcome but the bar is high — Shadow ships to regulated banks, so every change has to clear procurement-grade hygiene.

## Before you open a PR

1. **Run tests locally**: `npm test` — must be 100% green (currently 37/37).
2. **Run the benchmark** if you touched `lib/prompts.js` or `api/deliberate.js`: `npm run benchmark`. The Shadow Agentic Score must not regress (current baseline 88/100 against v0.3.3 rubric).
3. **Local build sanity**: there is no build step (vanilla JS + Vercel serverless). Just confirm `node --check` passes on any file you edit.
4. **Single source of truth for prompts**: `lib/prompts.js` is shared by `api/deliberate.js` AND `benchmark/runner.js`. If you change persona prompts, both surfaces move together — that's intentional. Don't fork them.

## What we WILL accept

- New persona packs (5th persona pack template lives in `lib/prompts.js`).
- New scenario contexts in `lib/prompts.js` paired with `src/mock-data.js` cell content.
- Cross-session memory backend swaps (Elastic, Pinecone, pgvector). Keep the `lib/memory.js` interface stable: `recall()`, `recallCalibrationStats()`, `append()`.
- Device-client wiring (a 5th device client — e.g. Vision Pro spatial — would slot in via `DEVICE_INFO` in `src/app.js`).
- Provider integrations beyond Anthropic + GLM (DeepSeek, Qwen, Mistral, etc.) — follow the `lib/glm-call.js` shape.

## What we WON'T accept

- Score-hacking the benchmark by widening rubric ceilings. The whole point of the deterministic structural rubric is procurement defensibility.
- LLM-as-judge evals — buyers explicitly told us they don't trust judge-LLM scores in procurement decks.
- Changes that introduce service-role secrets in client code. Anthropic / GLM keys live in server env only.
- Anything that uploads raw screen frames in default mode. The privacy boundary IS the product.

## How to file an issue

- Be specific. "It feels slow" is not an issue. "/api/deliberate p95 latency ≥ 12s on quant × cds (n=10)" is.
- If a regulatory citation in a persona prompt is wrong (Policy 11.4 number, SR 11-7 framing, Reg BI suitability language), file with the source — bank examiners will check our citations.
- Security issues: see `SECURITY.md` — do NOT open public issues for security.

## Local dev

```bash
git clone https://github.com/alex-jb/shadow-mentor
cd shadow-mentor
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run dev   # vercel dev on :3000
# in a second tab:
open http://localhost:3000
```

## Style

- ESM imports (`import x from "y"`), no CommonJS.
- Single source of truth for persona prompts is `lib/prompts.js`.
- Tests use `node --test` + `node:assert/strict`. No external test framework.
- Don't add a build step. Vercel auto-detects ESM.
- Two-space indent. No semicolons-required culture war — match what's around the change.

## License

MIT. By contributing you agree your changes ship under MIT.
