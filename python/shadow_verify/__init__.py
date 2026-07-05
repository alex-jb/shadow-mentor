"""shadow_verify — pure-Python verifier for Shadow AEX-style attestations.

Ships 2026-07-05 as part of the v1.5.x attestation dispatch surface.
Extends verifier reach to Python-based bank SIEM pipelines (Splunk SDK,
custom compliance harness, pandas-based audit tooling) without requiring
Node on the bank's box.

Same primitive as the three Node dispatch surfaces (CLI, MCP tool, HTTP
endpoint), same wire contract. Cross-language compatibility pinned by a
Node-side test (`test/python-verify-cross-lang.test.js`) that signs an
attestation in Node and verifies it here.

Usage
-----

    from shadow_verify import verify_attestation

    result = verify_attestation(
        attestation=persisted["response"]["attestation"],
        original_request=persisted["request"],
        original_response={k: v for k, v in persisted["response"].items()
                           if k != "attestation"},
        public_key_pem=open("shadow-public.pem").read(),
    )
    if result["ok"]:
        print(f"verified — model_id: {result['model_id']}")
    else:
        raise RuntimeError(f"attestation FAILED: {result['reason']}")

Requires
--------
- Python 3.9+
- cryptography>=41  (for Ed25519 primitive + PEM parsing)

The HMAC-SHA256 mode also works and needs only the stdlib.
"""

from __future__ import annotations

from base64 import b64decode
from hashlib import sha256
import hmac
import json
from typing import Any

ATTESTATION_VERSION = "aex-attestation/v1"
MODE_HMAC = "hmac-sha256"
MODE_ED25519 = "ed25519"


def canonicalize(value: Any) -> str:
    """Byte-identical canonicalization to the Node lib/attestation.js canonicalize().

    Objects sort keys, arrays recurse element-wise, primitives go through
    json.dumps. This MUST match the Node implementation exactly or every
    commitment will mismatch.
    """
    if value is None or not isinstance(value, (dict, list)):
        # json.dumps with default separators matches JSON.stringify for
        # primitives (numbers, strings, booleans, null).
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(x) for x in value) + "]"
    keys = sorted(value.keys())
    return "{" + ",".join(
        json.dumps(k, ensure_ascii=False) + ":" + canonicalize(value[k])
        for k in keys
    ) + "}"


def commitment_of(value: Any) -> str:
    """SHA-256 hex digest of canonicalize(value)."""
    return sha256(canonicalize(value).encode("utf-8")).hexdigest()


def _signing_payload(*, mode: str, request_commitment: str,
                     output_commitment: str, model_id: str,
                     completed_at_utc: str, previous_hash, key_id: str,
                     dictionary_hash=None) -> str:
    """Exact same pipe-delimited signing payload as the Node lib.

    `dictionary_hash` is optional (v1.5.8+). When absent, the field is
    omitted from the payload so pre-v1.5.8 attestations continue to
    verify byte-for-byte. When present, the counsel-signed reason-code
    dictionary hash at decision time is bound into the signature so
    any post-hoc dictionary edit breaks verification.

    Any drift here means Node signatures don't verify in Python and
    vice versa — the cross-language test catches that immediately.
    """
    parts = [
        ATTESTATION_VERSION,
        mode,
        request_commitment,
        output_commitment,
        model_id,
        completed_at_utc,
        previous_hash or "",
        key_id,
    ]
    if dictionary_hash:
        parts.append(dictionary_hash)
    return "|".join(parts)


def _verify_hmac(payload: str, signature_hex: str, secret: str) -> bool:
    expected = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"),
                        sha256).hexdigest()
    return hmac.compare_digest(expected, signature_hex)


def _verify_ed25519(payload: str, signature_b64: str, public_key_pem: str) -> bool:
    # Lazy-import so the HMAC path works with only the stdlib.
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    from cryptography.exceptions import InvalidSignature
    key = load_pem_public_key(public_key_pem.encode("utf-8"))
    try:
        key.verify(b64decode(signature_b64), payload.encode("utf-8"))
        return True
    except InvalidSignature:
        return False


def verify_attestation(
    *,
    attestation: dict,
    original_request: Any,
    original_response: Any,
    public_key_pem: str | None = None,
    hmac_key: str | None = None,
) -> dict:
    """Verify a Shadow attestation. Returns the same shape as the Node lib.

    Response
    --------
    {
      "ok": bool,
      "reason": str,
      "checks": {
        "request_commitment_match": bool,
        "output_commitment_match":  bool,
        "signature_match":          bool,
      },
      "mode": str,
      "model_id": str | None,
      "completed_at_utc": str | None,
      "key_id": str | None,
    }

    On failure `reason` names the exact failure mode (tamper / silent
    model-swap / wrong key). Never raises on a bad attestation — that's
    a data condition, not a program error. Raises TypeError only on
    caller mistakes (missing key material, unsupported mode).
    """
    checks: dict = {}

    if not isinstance(attestation, dict):
        return {"ok": False, "reason": "attestation missing or malformed",
                "checks": checks, "mode": None,
                "model_id": None, "completed_at_utc": None, "key_id": None}

    if attestation.get("version") != ATTESTATION_VERSION:
        return {"ok": False,
                "reason": f"unsupported attestation version: {attestation.get('version')}",
                "checks": checks,
                "mode": attestation.get("mode"),
                "model_id": attestation.get("model_id"),
                "completed_at_utc": attestation.get("completed_at_utc"),
                "key_id": attestation.get("key_id")}

    mode = attestation.get("mode", MODE_HMAC)

    # Request commitment
    expected_request = commitment_of(original_request)
    checks["request_commitment_match"] = (
        expected_request == attestation.get("request_commitment")
    )
    if not checks["request_commitment_match"]:
        return _fail("request commitment mismatch — record was tampered",
                     checks, attestation)

    # Output commitment
    expected_output = commitment_of(original_response)
    checks["output_commitment_match"] = (
        expected_output == attestation.get("output_commitment")
    )
    if not checks["output_commitment_match"]:
        return _fail("output commitment mismatch — response was tampered",
                     checks, attestation)

    # Signature
    payload = _signing_payload(
        mode=mode,
        request_commitment=attestation["request_commitment"],
        output_commitment=attestation["output_commitment"],
        model_id=attestation["model_id"],
        completed_at_utc=attestation["completed_at_utc"],
        previous_hash=attestation.get("previous_hash"),
        key_id=attestation["key_id"],
        # v1.5.8+: only included when the attestation carries it. This
        # keeps pre-v1.5.8 attestations verifying byte-identical.
        dictionary_hash=attestation.get("dictionary_hash"),
    )

    if mode == MODE_HMAC:
        if hmac_key is None:
            raise TypeError("hmac_key required for hmac-sha256 mode")
        checks["signature_match"] = _verify_hmac(
            payload, attestation["signature"], hmac_key
        )
        if not checks["signature_match"]:
            return _fail(
                "signature mismatch — either the wrong signing key was used, "
                "or the model_id / completed_at_utc were tampered with silently.",
                checks, attestation)
    elif mode == MODE_ED25519:
        if public_key_pem is None:
            raise TypeError("public_key_pem required for ed25519 mode")
        checks["signature_match"] = _verify_ed25519(
            payload, attestation["signature"], public_key_pem
        )
        if not checks["signature_match"]:
            return _fail(
                "ed25519 signature mismatch — either the wrong public key was used, "
                "or the attestation was signed by a different private key, or the "
                "model_id / completed_at_utc were tampered with silently.",
                checks, attestation)
    else:
        return _fail(f'unsupported attestation signature mode "{mode}"',
                     checks, attestation)

    return {
        "ok": True,
        "reason": "attestation verified",
        "checks": checks,
        "mode": mode,
        "model_id": attestation["model_id"],
        "completed_at_utc": attestation["completed_at_utc"],
        "key_id": attestation["key_id"],
    }


def _fail(reason: str, checks: dict, attestation: dict) -> dict:
    return {
        "ok": False,
        "reason": reason,
        "checks": checks,
        "mode": attestation.get("mode"),
        "model_id": attestation.get("model_id"),
        "completed_at_utc": attestation.get("completed_at_utc"),
        "key_id": attestation.get("key_id"),
    }


__all__ = [
    "verify_attestation",
    "commitment_of",
    "canonicalize",
    "ATTESTATION_VERSION",
    "MODE_HMAC",
    "MODE_ED25519",
]
