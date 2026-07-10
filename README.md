# Shadow

A cryptographic audit-evidence layer for AI-assisted credit decisions.

Shadow signs each credit decision — verdict, adverse-action reason codes, model manifest, dictionary hash — with Ed25519, chains them together with SHA-256, and lets a third party verify months later that the decision was not silently rewritten. The verdict engine itself is deterministic rules; the LLM personas produce prose rationale for human reviewers but cannot change the verdict.

**Status**: pre-1.0. Not audited. Not a certified compliance product.

<!-- readme-stats:begin -->
**Version**: 2.0.0-rc1
**Tests**: 1302/1303 passing (0 failing)
**Attestation signed fields**: 21 parameters, 14 append-only conditional bindings
**Release tags**: 52
<!-- readme-stats:end -->

Numbers above are regenerated from source by `node scripts/readme-stats.mjs --write`. CI blocks pushes where they drift.

## 60-second verify demo

Clone the repo, run the acceptance demo, and see the tamper-detection path fire end-to-end:

```bash
git clone https://github.com/alex-jb/shadow-mentor
cd shadow-mentor && npm install
npm run demo:attestation
```

The demo generates an Ed25519 keypair, signs 3 loan decisions, verifies them, then mutates one byte and shows the verifier detect the tamper. No external LLM calls, no API keys required.

## Architecture

Two layers. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for details.

**Verdict engine** — `lib/run-loan-council.js`, deterministic. Reads a loan schema (`credit_score`, `debt_to_income`, `loan_to_value`, amount, sector) and returns one of `refuse_to_serve` / `block` / `escalate` / `approve` via named-constant thresholds. No LLM call inside this path. Reproducible bit-for-bit given the same input. This is the layer the attestation binds.

**Rationale layer** — `lib/prompts.js` + `api/deliberate.js`. Five persona prompts run against an LLM to generate prose explanations of the verdict — one for Credit Fundamentals, Risk Officer, Fair Lending Compliance, Customer Advocate, Macro Contrarian. The rationale layer is advisory. It cannot change the verdict; the resolver has already run. Useful for the human reviewer building the adverse-action notice narrative and for the internal-audit workpaper.

**Attestation layer** — `lib/attestation.js`. Ed25519 signs a canonical serialization of the verdict, the model_id, the input commitment, the output commitment, the previous_hash (chain), and 14 optional append-only bindings (dictionary hash, reproducibility manifest, sampling-seed commitment, etc). Old attestations verify against new verifier code because bindings are appended, not inserted.

## Regulatory anchors

Shadow does not claim to be a compliance product. It produces evidence that regulated lenders can present to a bank counsel, an internal-audit workpaper reviewer, or a state examiner. The primary hooks that actually bind at US mid-tier banks in 2026:

- **ECOA / Regulation B §1002.9 adverse-action notice specificity.** The 2026-07-21 Reg B final rule narrowed disparate-impact exposure at the federal level. §1002.9's specific-principal-reason obligation was not amended and still binds. Shadow's signed reason-code dictionary (`lib/schemas/reason-code-dictionary.json`) is the artifact that pins which codes the lender is allowed to emit for a given verdict.
- **CFPB adverse-action AI guidance.** The CFPB's existing guidance on AI-generated adverse-action reasons — most recently reinforced in Circular 2026-03 (2026-05-05) — is the operative federal expectation for ML/AI-lender specificity.
- **State fair-lending regimes.** New York, Massachusetts, California, Illinois, and New Jersey retain effects-based fair-lending regimes and coordinated state-AG activity against AI-underwriting disparate-impact. Massachusetts' 2025-07-10 $2.5M AI-underwriting settlement is the poster case. Federal deregulation does not touch these.
- **Fair Housing Act.** FHA disparate-impact liability survives via private litigation for residential-mortgage secured credit, subject to HUD's evolving rulemaking posture.
- **GDPR Article 22 + Schufa (C-634/21).** For EU-active institutions: the ECJ Schufa decision is enforceable today. Shadow's persona rationale layer and audit chain map to "meaningful information about the logic" and "human intervention" requirements. EU AI Act credit-scoring provisions were deferred to 2027-12-02 by the Digital Omnibus.

Shadow does not claim SR 26-2 applicability. The Fed/OCC/FDIC 2026-04-17 interagency model-risk guidance excludes deterministic rule-based processes from the definition of "model" and explicitly carves generative and agentic AI out of scope, though it directs the institution's own risk-management practices to govern them (SR 26-2 footnote 3). Shadow's verdict engine falls in the excluded rule-based class; the rationale layer falls in the carved-out generative-AI class. Interpret this as delegation to the institution, not a mandate for Shadow.

## API surface

- `POST /api/loan-council` — verdict-engine only. Pure compute. No LLM call. Deterministic.
- `POST /api/deliberate` — verdict + rationale. Calls the LLM for the persona prose. Returns the same verdict as `/api/loan-council` for the same input.
- `POST /api/attest` — sign an arbitrary decision payload. See [T6 spec](./docs/roadmap/T6-attest-core.md) — planned for v2.0.0.
- `POST /api/verify-attestation` — verify a signed decision.
- `POST /api/verify-chain` — walk a chain and report tamper detection.
- `GET /api/health` — liveness.
- `GET /api/attestation-info` — public key discovery.
- `GET /api/mcp-manifest` — SBOM of the MCP tool surface.

## MCP integration

Shadow ships a 9-tool MCP server (`mcp/server.js`) usable from Cursor, Claude Desktop, Zed, or any MCP client. See [`mcp/README.md`](./mcp/README.md).

## Threat model

Documented in [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md). Summary: Shadow's Ed25519 attestation defeats **external tampering** and **chain reordering / insertion / truncation**. It does **not** defeat a **bank insider with the private key**. If your threat model includes bank-side re-signing of history, you need an external timestamp anchor (RFC 3161 TSA or a public transparency log) on top of Shadow. Sigstore Rekor integration is on the v2.1 roadmap.

## What Shadow is not

- Not a certified fair-lending validator. Shadow's rationale layer is itself a candidate for fair-lending validation.
- Not a bank decision engine. Real bank loan origination uses a loan-origination system + credit models + human underwriters. Shadow attests. It does not decide.
- Not SOC 2 audited. `docs/soc2-readiness.md` is a self-assessment readiness map, not an audit report.
- Not designed to replace WORM logging + SIEM retention. Those handle chain-of-custody. Shadow adds a reason-code dictionary binding that WORM+SIEM cannot produce.

## Legacy content

Prior README described intern-mentor, trading, and data-science persona packs that were experimental and are no longer part of the shipping product. Archived at [`docs/archive/README-v1-legacy.md`](./docs/archive/README-v1-legacy.md).

The XR / spatial-council demo (`demo/xreal.html`) is a research artifact for a July 2026 capstone and IEEE VR 2027 abstract, not a bank product. Will be relocated to `demos/xr/` post-capstone with a redirect stub at the old path.

## License

MIT. See [`LICENSE`](./LICENSE).

## Contributors

Alex Xiaoyu Ji (author).
Loredana C. Levitchi — regulatory-domain review and BRD authorship for the risk / credit-policy / adverse-action modules; source basis Mode A BRD + Addenda A/B/C + Risk Appetite Note, MIT-licensed merge per 2026-06-19 explicit grant.

## Contact

Alex Xiaoyu Ji · xji1@mail.yu.edu
