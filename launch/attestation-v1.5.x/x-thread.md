# X thread draft — v1.5.x attestation burst

## Thread (8 tweets)

### Tweet 1 (hook, ≤280 chars)

Shipped 6 releases in 48 hours closing a real bank-compliance question:

"How does an auditor actually verify an AI attestation without either shelling out to a CLI or trusting the vendor's SDK?"

Answer: 3 dispatch surfaces on 1 primitive.

Thread ↓

### Tweet 2 (context, ≤280 chars)

Shadow is an on-device 5-voice AI council for regulated banking. Every verdict carries an Ed25519 signature (RFC 8032) binding the exact request + response + model.

Bank holds only the public key. Can verify every historical decision. Cannot forge one.

That separation is the whole ballgame.

### Tweet 3 (surface 1 — CLI)

**Surface 1 — CLI, for auditors on a laptop:**

```
node bin/verify-attestation.mjs \
  --response saved.json \
  --public-key shadow-public.pem
```

Offline. No server. No JS knowledge beyond `node`. Green ✓ or red ✗ + the exact failure reason.

### Tweet 4 (surface 2 — MCP)

**Surface 2 — MCP tool, for auditors inside Claude Desktop / Cursor / OpenCode:**

`shadow_verify_attestation` is the 7th tool on Shadow's MCP server.

Paste the response, attestation, and public key into chat. LLM dispatches the verify inline. No shell drop.

### Tweet 5 (surface 3 — HTTP)

**Surface 3 — HTTP, for SIEM pipelines:**

```
curl -X POST /api/verify-attestation \
  -d '{"attestation": ..., "public_key": ...}'
```

Bank CI. Splunk pipelines. Any tool that speaks JSON.

Same primitive under all three. Response shape identical between MCP + HTTP.

### Tweet 6 (drop-in CI recipe)

Then I made it a 30-second bank ops setup:

```
gh secret set SHADOW_ATTESTATION_PUBLIC_KEY < shadow-public.pem
cp examples/verify-in-ci/verify.yml .github/workflows/
cp examples/verify-in-ci/verify.sh scripts/
```

Every push touching audit-log JSON re-verifies before merge. Compliance record cannot be filed on a broken signature.

### Tweet 7 (the demo)

The whole chain fires from a fresh clone in ~250ms:

```
npm run demo:attestation

[1/6] Generate Ed25519 keypair                    ✓
[2/6] Run /api/loan-council in-process             ✓
[3/6] Verify with lib/attestation.js               ✓
[4/6] Verify with POST /api/verify-attestation     ✓
[5/6] Verify with shadow_verify_attestation (MCP)  ✓
[6/6] Tamper detection catches silent flip         ✓
```

Wired into CI as regression net.

### Tweet 8 (CTA)

MIT-licensed. 543 tests green. Full deploy walkthrough is one command now, no more scary `node -e` blob.

If you're in bank compliance, MCP tooling, or ML supply-chain security — would love your read.

github.com/alex-jb/shadow-mentor

## Alt one-shot tweet (for casual promotion, no thread)

Shipped 6 Shadow releases in 48h: Ed25519 attestations for AI-driven bank compliance now verifiable from CLI, chat (MCP), or curl (HTTP). Same primitive under all three. Bank holds only the public key. Can verify, cannot forge.

`npm run demo:attestation` runs the whole loop in ~250ms.

github.com/alex-jb/shadow-mentor

## Do not

- Do not tag Anthropic accounts unless the thread explicitly frames Shadow as a Claude Sonnet 4.6 downstream (which this thread doesn't need to)
- Do not use "we" — Alex is solo founder, use first-person singular
- Do not add emojis in the technical explanation tweets; ✓ and ✗ are semantic markers, not decoration

## Timing

Weekday 8am-10am NY EST for max reach among US bank compliance + infra engineers.
