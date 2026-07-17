# One credit decision, three surfaces, one verdict

The Banking Evidence Profile v1 conformance gate — *"is this credit decision
auditable?"* — runs the same `checkBankingProfileV1()` primitive under three
dispatch surfaces, so the verdict a SIEM pipeline gets is identical to the one an
analyst gets in chat. Pick whichever fits the workflow.

A verdict answers: does the bundle carry the examiner-required evidence for a US
credit decision (integrity, decision outcome, model/tool manifest, policy
version, timestamps, data-as-of, human review, principal reason codes ≤4, a
**governed** reason-code dictionary version, source citations, retention), each
mapped to its Reg B / FCRA / SR 26-2 hook? A swapped or ungoverned reason-code
dictionary fails the gate. Structural PASS = the evidence exists and is
tamper-evident; it does **not** certify the decision was correct, fair, or
compliant.

## 1. CLI — CI / engineering

```bash
# verify integrity + check profile conformance; exit 4 = verified-but-non-conformant
node bin/shadow-verify.mjs decision.bundle.json --public-key public.pem --profile banking-v1

# or produce the examiner-ready packet (markdown or --json)
node bin/evidence-packet.mjs decision.bundle.json --public-key public.pem --payloads payloads.json
```

## 2. MCP tool — bank analyst in Cursor / Claude Desktop

Install the MCP server (`mcp/README.md`), then from chat:

> Call `shadow_banking_profile` with this bundle and my public key, and give me the examiner packet.

```jsonc
// tool: shadow_banking_profile
{ "bundle": { /* … */ }, "public_key": "-----BEGIN PUBLIC KEY-----\n…", "packet": true }
// → { conformance: { pass, coverage_pct, adverse, fields[], missing_required }, interpretation, examiner_packet_markdown }
```

## 3. HTTP — SIEM / GRC pipeline

```bash
curl -sX POST https://<your-deployment>/api/banking-profile \
  -H 'Content-Type: application/json' \
  -d '{ "bundle": { … }, "public_key": "-----BEGIN PUBLIC KEY-----\n…", "packet": true }'
# → { "ok": true, "conformance": { … }, "interpretation": "…", "latency_ms": 3, "examiner_packet_markdown": "…" }
```

Always HTTP 200 with the verdict in the body — a non-conformant bundle is a valid
answer, not a request error; `ok` mirrors `conformance.pass`.

## Why this matters

The 5-voice council is easy to copy (persona prompts). A regulation-mapped
conformance gate that produces an examiner-ready packet, runs identically across
CLI/MCP/HTTP, and refuses a swapped reason-code dictionary is not. See
`spec/banking-evidence-profile-v1.json` for the field-to-regulation map and
`docs/VENDOR_VIABILITY.md` for the procurement posture.
