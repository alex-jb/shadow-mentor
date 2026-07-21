# Claim → source matrix

Every load-bearing claim in the report, mapped to its repository evidence and its honest status. Audited at commit `5106799` (worktree branch `chore/capstone-final-report-and-practice`), 2026-07-21. Canonical facts are pinned in `product-facts.json`; test totals in `release-state.json`.

Status vocabulary: `SOURCE-AUTHORED · HOST-TESTED · BROWSER-RENDERED · BROWSER-RECORDED · UNITY-AUTHORED · UNITY-TESTED · ANDROID-BUILT · FIXTURE-SIGNED · PRODUCTION-SIGNED · DEVICE-VALIDATION-PENDING · RESEARCH-PILOT · NOT IMPLEMENTED`.

| # | Claim in report | Repository evidence (path) | Commit / value | Status |
|---|---|---|---|---|
| 1 | 11 MCP tools | `product-facts.json` (`mcp_tools`), `mcp/server.js` | 11, drift-guarded | HOST-TESTED |
| 2 | 1,824 / 1,827 host tests pass (3 skipped, 0 fail) | live re-run; `release-state.json` pins 1595/1598 (trails HEAD) | commit `5106799`, 2026-07-21 | HOST-TESTED |
| 3 | Ed25519 signing | `spec/attestation.schema.json`, `lib/` attestation | v2.2.0 | HOST-TESTED |
| 4 | SHA-256 hash chain, canonical serialization | `spec/evidence-bundle.schema.json` (v1) | required: bundle_version, spec_version, header, events, batch_root, signatures | HOST-TESTED |
| 5 | Exact tamper localization (first failed sequence + downstream) | verifier + hash-chain walk; case study §13.6 | deterministic fixture | HOST-TESTED |
| 6 | Offline browser verifier, two modes, CSP 0 external | `verify.html`, `verify-acceptance/` | Chromium 149.0.7827.55 | BROWSER-RENDERED / BROWSER-RECORDED |
| 7 | Verify-the-Verifier: assets-match-manifest / independent-comparison-not-performed | `verify-acceptance/screenshots/en-verifier-valid.png`, `-mismatch.png` | fixture manifest | FIXTURE-SIGNED |
| 8 | Bilingual EN + 简体中文, locale parity (hashes/quotes/verdict unchanged) | `verify-acceptance/BROWSER_ACCEPTANCE_REPORT.md`, `verify/locales/*.json` | signed asset hashes | BROWSER-RENDERED |
| 9 | Untrusted-input hardening (bounded parse, escape, allowlist) | `product-facts.json` verify-untrusted-input-hardening | — | HOST-TESTED |
| 10 | Three domain profiles (banking-v1, data-science-v1, coding-agent-v1) | `apps/shadow-lens/web/spatial-agent/src/profiles/workspaces.ts` | ids verified | SOURCE-AUTHORED / UNITY-AUTHORED |
| 11 | Unity Shadow Lens (3 workspaces, audit arc, verify/tamper/reset) | `apps/shadow-lens/unity/Assets/ShadowLens/` (Mock workspaces, Flow, Narrative) | Unity 6000.0.23f1 | UNITY-AUTHORED |
| 12 | Head-directed focus (gaze hover) — NOT eye tracking | `product-facts.json` head-directed-focus; forbidden_claims | hover/highlight only | UNITY-AUTHORED / DEVICE-VALIDATION-PENDING |
| 13 | Android mock APK built | `apps/shadow-lens/demo/wednesday/frozen/mock-stable-5168b07.apk` | 24,442,084 B · sha256 `93f2a81a…548d0b8` | ANDROID-BUILT (not device-validated) |
| 14 | Three.js spatial replay, 4 layouts + 2D fallback | `demos/replay/3d/`, `apps/shadow-lens/web/spatial-agent/` | rendered + recorded | BROWSER-RENDERED / BROWSER-RECORDED |
| 15 | Claim–evidence graph (shared fact source) | `lib/claim-evidence-graph.mjs`, `test/shadow-claim-evidence-graph.test.js` | fixture `…graph/1.0` | SOURCE-AUTHORED |
| 16 | Semantic audit of ingested LLM output (auditIngestedOutput) | `product-facts.json` pending_capabilities | ingestion boundary | SOURCE-AUTHORED / DEVICE-VALIDATION-PENDING |
| 17 | OTel third-party ingestion (structural seal) | `product-facts.json` otel-third-party-ingestion-structural | structural only | HOST-TESTED |
| 18 | Brier calibration tracking | `product-facts.json` brier-calibration-tracking | post-hoc, n<100 | HOST-TESTED (not a coverage certificate) |
| 19 | Conformal / coverage | `product-facts.json` conformal-abstention | n<100 | RESEARCH-PILOT (not production-certified) |
| 20 | Deterministic 5-voice council; per-voice = persona prior "STANCE STRENGTH" | `product-facts.json` confidence_semantics | fixed priors, not probabilities | HOST-TESTED |
| 21 | Spatial comprehension benefit (RQ4) | — | no user study | NOT IMPLEMENTED (Capstone II) |
| 22 | Production signing / KMS / device validation | — | none generated | NOT IMPLEMENTED |

**Discipline notes.** No claim in the report exceeds its row's status. "Integrity ≠ correctness" is stated wherever verification is described. Regulatory references (SR 26-2 superseding SR 11-7; EU AI Act Art. 14; GDPR Art. 22; Schufa C-634/21) are cited as *context for a governance gap*, never as a claim that any regulation already mandates Shadow — per `product-facts.json` `scope_honesty` and `forbidden_claims`.
