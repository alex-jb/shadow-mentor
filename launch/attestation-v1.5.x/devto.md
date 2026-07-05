# dev.to article draft — RFC 8032 attestations for AI compliance

## Title

Ed25519 attestations for AI-driven bank compliance: same primitive, three verifier surfaces

## Tags

`security`, `mcp`, `crypto`, `compliance`

## Cover image

Terminal screenshot of `npm run demo:attestation` showing 6 green ✓ steps. No decorative graphics.

## Body

Bank auditors have a specific problem I hadn't seen cleanly solved: they can accept an AI-driven verdict for compliance record-keeping, but only if they can prove — independently, offline, and without the vendor's SDK — that the response they filed today is the same one the AI actually generated.

Standard JWT doesn't cut it. JWT signs the response envelope but not the request payload, so a downstream service can silently edit the response body between "vendor signed it" and "auditor received it" without invalidating the signature. Model substitution (arxiv 2504.04715) is another failure mode JWT doesn't catch — the response says it came from Claude Sonnet 4.6 but the vendor silently ran Haiku for cost.

Over the last two days I shipped six point releases (v1.5.0 → v1.5.5) on my Shadow project closing this end-to-end. This post is a walkthrough of the design decisions.

## The signing primitive

Every Shadow response carries a top-level `attestation` object binding four commitments:

```js
{
  version: "aex-attestation/v1",
  mode: "ed25519",
  request_commitment: "9379409de5f633d4...",   // sha256 of full request body
  output_commitment:  "b72e9f155823bba1...",   // sha256 of full response body
  model_id: "claude-sonnet-4-6",
  completed_at_utc: "2026-07-04T16:52:28.131Z",
  key_id: "prod-2026-Q3",
  signature: "eK9ux4dQP+kwPZ7..."              // Ed25519 signature over all of the above
}
```

The signature covers a canonicalized concatenation:

```
version | mode | request_hash | output_hash | model_id | completed_at | previous_hash | key_id
```

Domain separation via the `mode` field means an HMAC-signed payload can't be replayed as Ed25519 material even if someone swaps the mode string. The `previous_hash` chains attestations into a per-deployment log; `key_id` supports rotation.

## Why Ed25519 over ECDSA / RSA / JWT

- **Deterministic signatures** (RFC 8032). No nonce-reuse footgun. A vendor demo and a bank replay of the same input produce identical signatures.
- **64-byte signature**, 32-byte keys. Same footprint as an HMAC-SHA256 secret so the ops story stays symmetrical for teams switching modes.
- **~50µs sign / ~200µs verify** on M1. Vs ECDSA-P256 which needs constant-time care to avoid timing leaks.
- **Node stdlib, no dep.** `crypto.sign(null, buffer, keyObject)` where `algorithm=null` triggers pure-EdDSA.
- **Cleaner rotation semantics.** The `key_id` field carries the rotation tag; a bank auditor picks the right verifier key by keyId. NIST SP 800-57 §5.2 recommends yearly rotation.

## The three dispatch surfaces

The primitive lives in `lib/attestation.js`. Everything else is dispatch.

### Surface 1: CLI (for dev laptops)

```bash
node bin/verify-attestation.mjs \
  --response saved.json \
  --public-key shadow-public.pem
```

Exit 0 = ✓ verified. Exit 1 = ✗ failed with a specific reason (`output commitment mismatch — response was tampered` or `ed25519 signature mismatch — either wrong public key or model_id tampered`). Bank auditor runs this against a saved response with only their public key. Cannot forge, only verify.

### Surface 2: MCP tool (for chat)

Shadow's MCP server exposes `shadow_verify_attestation` as its 7th tool. Same input schema, same response shape, dispatched via `handleToolCall("shadow_verify_attestation", args)`.

Bank auditor in Cursor / Claude Desktop / OpenCode / Zed pastes the persisted response + attestation + public key into chat. The LLM invokes the MCP tool inline and gets back a structured `{ok, reason, checks, mode, model_id, key_id, interpretation}` object.

The tool sits in the `shadow:read` OAuth scope (analyst seat) — an analyst can audit integrity without needing the write privilege that `shadow:council` grants.

### Surface 3: HTTP endpoint (for SIEM)

```bash
curl -sX POST /api/verify-attestation \
  -H 'content-type: application/json' \
  -d '{
    "attestation": {...},
    "original_request": {...},
    "original_response": {...},
    "public_key": "-----BEGIN PUBLIC KEY-----\n..."
  }' | jq '{ok, mode, model_id, interpretation}'
```

No OAuth scope required. Verification is a read-only crypto check; an auditor holding the response body + attestation + correct public key is by definition already authorized to see the record. Gating verification behind auth would just add friction without adding security.

## Making it operationally boring

Shipping the primitive is table stakes. Getting a bank ops team to actually adopt it requires killing the deploy friction.

**Deploy CLI** replaces the traditional 380-character `node -e "..."` one-liner:

```bash
node bin/generate-attestation-keypair.mjs --key-id prod-2026-Q3
# → shadow-private.pem (mode 0600, deployment only)
# → shadow-public.pem  (mode 0644, share with auditors)
# → paste-ready env block printed to stdout
```

Correct file permissions by default. Refuses to accidentally overwrite existing keys (rotation is a `--force` opt-in, not a shell accident). JSON-quotes the PEM so multi-line PEM survives Vercel-dashboard paste boxes.

**Drop-in CI recipe** for bank audit-log repos:

```bash
gh secret set SHADOW_ATTESTATION_PUBLIC_KEY < shadow-public.pem
gh variable set SHADOW_URL --body 'https://your-shadow.internal.bank.com'
cp examples/verify-in-ci/verify.yml .github/workflows/
cp examples/verify-in-ci/verify.sh scripts/verify-shadow.sh
```

Every push touching `audit-log/**/*.json` re-verifies before merge. Merge blocked on any bad attestation. `workflow_dispatch` supports full-sweep after key rotation.

## The acceptance demo

The whole story fires end-to-end in ~250ms:

```bash
npm run demo:attestation

# Shadow attestation acceptance demo (v1.4.0 → v1.5.4)
# ─────────────────────────────────────────────────────────
# [1/6] Generate Ed25519 keypair                    ✓
# [2/6] Run /api/loan-council in-process             ✓
# [3/6] Verify with lib/attestation.js (CLI path)    ✓
# [4/6] Verify with POST /api/verify-attestation     ✓
# [5/6] Verify with shadow_verify_attestation (MCP)  ✓
# [6/6] Tamper detection catches silent verdict flip ✓
# ─────────────────────────────────────────────────────────
# ✓ All 6 acceptance steps passed
```

The demo is a 165-line Node script (`bin/attestation-acceptance-demo.mjs`) with no external state. Generates a keypair, runs `/api/loan-council` in-process, verifies via all three dispatch surfaces, then tampers the response body and confirms detection catches it.

Wired into the test suite as a subprocess smoke test:

```js
test("demo runs end-to-end and exits 0 in under 5 seconds", () => {
  const r = spawnSync("node", [DEMO], { encoding: "utf8", timeout: 5000 });
  assert.equal(r.status, 0);
});

test("demo actually verifies tamper detection (step 6 is not a no-op)", () => {
  const r = spawnSync("node", [DEMO], { encoding: "utf8" });
  assert.match(r.stdout, /output commitment mismatch/,
    "silent no-op-ification of tamper check would be caught here");
});
```

A regression in any of the six releases breaks the demo, which breaks CI.

## Where this is going

Next targets:
- Python client library for banks whose SIEMs are Python-based
- `/api/attestation-info` endpoint for key discovery (fingerprint + key_id + mode)
- AML/KYC voice hardening — the ACAMS 2026 procurement lane is where mid-tier banks bite

Repo (MIT): https://github.com/alex-jb/shadow-mentor

Would love reads from anyone in bank compliance, MCP tooling, or crypto engineering.

## SEO — internal link anchors

Add these back-links from the Shadow README to this article once published:

- README hero → devto link (procurement audience acquisition)
- CHANGELOG v1.5.5 → devto link (technical readers who click through)
- `mcp/README.md` → devto link (MCP-curious readers)
