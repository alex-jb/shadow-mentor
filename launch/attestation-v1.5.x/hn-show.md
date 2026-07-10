# Show HN draft — Shadow attestation verifier

## Title (< 80 chars)

Show HN: Shadow — verify AI compliance decisions from CLI, chat, or curl

## Alternate titles (A/B options)

- Show HN: Ed25519 attestations for AI-driven bank compliance (3 verifier surfaces)
- Show HN: Bank auditors verify LLM decisions in 30 seconds without holding the signing key
- Show HN: A one-command procurement demo for AI attestation (Ed25519, RFC 8032)

## Body

Shadow is an on-device 5-voice AI council for regulated banking. When Shadow returns a verdict (approve / escalate / block), the response carries an AEX-style attestation (arxiv 2603.14283) — a signed commitment binding the exact request, the exact response, and the exact model that ran.

Over the last two days I shipped six point releases (v1.5.0 → v1.5.5) closing the "how does a bank actually verify a Shadow attestation" question. The verifier now has three dispatch surfaces + a drop-in CI recipe + a one-command acceptance demo:

    # Auditor on a laptop — offline, no server needed:
    node bin/verify-attestation.mjs --response saved.json --public-key shadow-public.pem

    # Auditor inside Claude Desktop / Cursor / OpenCode — chat-native:
    "verify this attestation: ..." → shadow_verify_attestation MCP tool

    # SIEM pipeline — plain curl:
    curl -X POST /api/verify-attestation -d '{"attestation": ..., "public_key": ...}'

The signing side uses Ed25519 (RFC 8032). Shadow holds the private key; the bank holds only the public key. That separation is what makes procurement teams comfortable — the bank can verify every historical decision but cannot forge one.

All three surfaces wrap the same primitive (`verifyAttestation()` in `lib/attestation.js`). The response shape is identical between the MCP tool and the HTTP endpoint, so audit-trail comparability holds regardless of which dispatch surface a bank uses.

**The whole chain fires in one command from a fresh clone:**

    git clone https://github.com/alex-jb/shadow-mentor
    cd shadow-mentor && npm install
    npm run demo:attestation

    # [1/6] Generate Ed25519 keypair                             ✓
    # [2/6] Run /api/loan-council in-process                     ✓
    # [3/6] Verify with lib/attestation.js (CLI path)            ✓
    # [4/6] Verify with POST /api/verify-attestation             ✓
    # [5/6] Verify with shadow_verify_attestation (MCP)          ✓
    # [6/6] Tamper detection catches silent verdict flip         ✓
    # ✓ All 6 acceptance steps passed

The demo is wired into the test suite (`test/attestation-acceptance-demo.test.js`) so a regression in any of the six releases breaks CI with the exact failing step number.

**What this is defending against:**

1. A downstream service edits the verdict after signing (tamper)
2. The API silently swaps the pinned model (arxiv 2504.04715 — "Auditing Model Substitution in LLM APIs")
3. Someone re-signs the record with a different keypair

Any of these produces a signature mismatch. The failure message names which of the three modes hit.

The whole thing is MIT-licensed. Deployment guide is a real CLI now instead of a scary `node -e` one-liner:

    node bin/generate-attestation-keypair.mjs --key-id prod-2026-Q3

Would love feedback from anyone in bank compliance, MCP tooling, or crypto engineering. Known trade-offs and pending work in the CHANGELOG.

Repo: https://github.com/alex-jb/shadow-mentor
Ed25519 module: https://github.com/alex-jb/shadow-mentor/blob/main/lib/attestation.js

## Comment prep — likely questions

**Q: Why not use JWTs?**
A: JWT doesn't bind the request payload — only the response envelope. The tamper we're catching is "downstream edits the response body" which JWT would sign over as-is. AEX-style commits both request AND response hashes, so any body edit invalidates the signature. Also: JWTs push you toward RS256/HS256; RFC 8032 Ed25519 is faster, has fewer footguns (deterministic signing), and gives you cleaner key rotation via a keyId field.

**Q: Why Ed25519 over ECDSA?**
A: Deterministic signatures (no k-reuse footgun), 64-byte signatures, ~50µs sign / ~200µs verify on M1, no dep needed (Node stdlib). Also Ed25519 keypairs are the same footprint as an HMAC secret so the ops story is symmetrical.

**Q: What happens if Shadow's private key leaks?**
A: The `key_id` field in every attestation supports rotation — old records verify with the retired key during a grace window; new records use the current one. NIST SP 800-57 §5.2 says at least yearly rotation. Nothing pre-leak becomes forgeable retroactively; only future signatures using the leaked key would be forgeable.

**Q: How do I know the demo isn't fake?**
A: Read `bin/attestation-acceptance-demo.mjs` — 165 lines, no dependencies beyond Node stdlib. The 4 subprocess tests in `test/attestation-acceptance-demo.test.js` assert the demo output contains "output commitment mismatch" specifically, so a silent no-op-ification of step 6 (tamper detection) would fail CI.

**Q: What about SR 11-7 / EU AI Act?**
A: SR 11-7 was rescinded 2026-04-17 and superseded by SR 26-2. SR 26-2 excludes deterministic rule-based processes from the "model" definition and carves generative and agentic AI out of scope (footnote 3), delegating governance to the institution's own risk management practices. Shadow's verdict engine falls in the excluded rule-based class. EU AI Act credit-scoring is deferred to 2027-12-02 (Digital Omnibus 2026-05); the enforceable EU regime today is GDPR Art. 22 + Schufa (C-634/21). Positioning honestly.

**Q: Is this actually novel or is it just JWT-with-extra-steps?**
A: The dispatch surface story (same primitive under CLI + MCP + HTTP + CI recipe) is the point. Other attestation implementations either lock you into their SDK or make you shell out. Shadow's contract is: bank pipelines pick whichever surface fits their workflow; response shape is identical between MCP and HTTP so audit-trail comparability holds regardless.

## Timing

Best window: Tuesday-Thursday, 8-10am NY EST. Avoid Monday (weekend backlog) and Friday afternoon.

## Do not include in HN post

- Do not link to CHANGELOG entry — link to repo root, let the reader navigate
- Do not use "revolutionary" / "game-changing" / any marketing verb
- Do not compare to competitors by name (Anthropic FS, Hebbia, Zest) — HN downweights vendor-vs-vendor posts
- Do not include emoji in the title or body
