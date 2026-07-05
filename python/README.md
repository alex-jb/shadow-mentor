# shadow-verify (Python)

Pure-Python verifier for Shadow AEX-style attestations. Extends the v1.5.x verifier reach to bank SIEM pipelines whose stacks are Python (Splunk SDK, pandas-based audit tooling, custom compliance harnesses).

Same primitive as the Node dispatch surfaces — CLI (`bin/verify-attestation.mjs`), MCP tool (`shadow_verify_attestation`), HTTP endpoint (`POST /api/verify-attestation`). **Cross-language compatibility is pinned by a Node-side test** (`test/python-verify-cross-lang.test.js`) that signs an attestation in Node and verifies it here — including a nested-array-in-nested-object edge case that would catch any canonicalization drift.

## Install (local, before PyPI publish)

```bash
cd python/
pip install .
# or for editable dev install:
pip install -e .
```

## Use

```python
import json
from shadow_verify import verify_attestation

# The persisted response (e.g. from Shadow's audit log):
persisted = json.load(open("shadow-response.json"))

result = verify_attestation(
    attestation=persisted["response"]["attestation"],
    original_request=persisted["request"],
    original_response={k: v for k, v in persisted["response"].items()
                       if k != "attestation"},
    public_key_pem=open("shadow-public.pem").read(),
)

if result["ok"]:
    print(f"✓ verified — model_id: {result['model_id']}, key_id: {result['key_id']}")
else:
    raise RuntimeError(f"✗ attestation FAILED: {result['reason']}")
```

Response shape (identical to the Node MCP tool + HTTP endpoint):

```python
{
    "ok": True,                           # bool
    "reason": "attestation verified",     # str
    "checks": {
        "request_commitment_match": True,
        "output_commitment_match":  True,
        "signature_match":          True,
    },
    "mode": "ed25519",                    # or "hmac-sha256"
    "model_id": "claude-sonnet-4-6",
    "completed_at_utc": "2026-07-05T00:00:00Z",
    "key_id": "prod-2026-Q3",
}
```

On failure, `reason` names one of three modes explicitly: tamper (`output commitment mismatch` / `request commitment mismatch`), silent model-swap (`ed25519 signature mismatch — ... model_id / completed_at_utc were tampered with silently`), or wrong key material.

## Test

Python-side unit tests (16 cases — no pytest dep needed):

```bash
python3 tests/test_verify.py
# → 16/16 passed
```

Cross-language proof (Node signs, Python verifies) runs from the Node test suite:

```bash
cd ..
npm test -- --test-name-pattern "CROSS-LANG"
```

## Design notes

- **Same wire contract as Node** — pipe-delimited signing payload `version|mode|request_hash|output_hash|model_id|completed_at|previous_hash|key_id`, sorted-key JSON canonicalization, base64 signature for Ed25519, hex signature for HMAC.
- **Stdlib-only for HMAC mode.** `cryptography` is required only for Ed25519 PEM parsing + verification.
- **Never raises on a bad attestation.** A tamper or wrong key produces `{ok: False, reason: ...}`. Raises `TypeError` only on caller mistakes (missing key material for a given mode).
- **No I/O in the library.** The caller reads files / fetches network / hits a KMS; the library takes strings and dicts.

## License

MIT (same as parent shadow-mentor repo).
