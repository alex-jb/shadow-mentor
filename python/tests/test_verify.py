"""Python-side unit tests for shadow_verify.

Runnable standalone (no pytest dep) via `python3 python/tests/test_verify.py`.
The main cross-language proof lives in Node
(`test/python-verify-cross-lang.test.js`); these are Python-side
correctness pins for the primitive itself.
"""

import json
import sys
import traceback
from base64 import b64encode
from hashlib import sha256
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shadow_verify import (  # noqa: E402
    verify_attestation,
    commitment_of,
    canonicalize,
    ATTESTATION_VERSION,
    MODE_HMAC,
    MODE_ED25519,
)

TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


# ─── canonicalize contract ────────────────────────────────────────

@test
def canonicalize_sorts_object_keys():
    a = canonicalize({"b": 1, "a": 2})
    b = canonicalize({"a": 2, "b": 1})
    assert a == b, f"canonicalize must sort keys deterministically: {a!r} vs {b!r}"
    assert a == '{"a":2,"b":1}'


@test
def canonicalize_handles_nested_arrays():
    got = canonicalize({"x": [{"b": 1, "a": 2}, {"d": 4, "c": 3}]})
    assert got == '{"x":[{"a":2,"b":1},{"c":3,"d":4}]}', got


@test
def canonicalize_handles_primitives():
    assert canonicalize(1) == "1"
    assert canonicalize("hi") == '"hi"'
    assert canonicalize(None) == "null"
    assert canonicalize(True) == "true"


@test
def commitment_of_matches_hand_computed_sha256():
    value = {"a": 1, "b": 2}
    expected = sha256('{"a":1,"b":2}'.encode("utf-8")).hexdigest()
    assert commitment_of(value) == expected


# ─── HMAC verification ────────────────────────────────────────────

def _hmac_attestation(secret="test-secret"):
    """Build a valid HMAC attestation from scratch."""
    from hmac import new as hmac_new

    request = {"loan_id": "PY-TEST-001", "credit_score": 720}
    response = {"verdict": "approve", "voices": []}

    request_commitment = commitment_of(request)
    output_commitment = commitment_of(response)

    payload_parts = [
        ATTESTATION_VERSION, MODE_HMAC, request_commitment, output_commitment,
        "sonnet", "2026-07-05T00:00:00Z", "", "v1",
    ]
    payload = "|".join(payload_parts)
    signature = hmac_new(secret.encode(), payload.encode(), sha256).hexdigest()

    attestation = {
        "version": ATTESTATION_VERSION,
        "mode": MODE_HMAC,
        "request_commitment": request_commitment,
        "output_commitment": output_commitment,
        "model_id": "sonnet",
        "completed_at_utc": "2026-07-05T00:00:00Z",
        "previous_hash": None,
        "key_id": "v1",
        "signature": signature,
    }
    return attestation, request, response


@test
def hmac_happy_path_verifies():
    att, req, res = _hmac_attestation()
    result = verify_attestation(
        attestation=att, original_request=req, original_response=res,
        hmac_key="test-secret",
    )
    assert result["ok"], f"expected ok=True, got {result}"
    assert result["mode"] == MODE_HMAC
    assert result["model_id"] == "sonnet"
    assert result["key_id"] == "v1"


@test
def hmac_catches_tampered_request():
    att, req, res = _hmac_attestation()
    tampered = {**req, "credit_score": 600}
    result = verify_attestation(
        attestation=att, original_request=tampered, original_response=res,
        hmac_key="test-secret",
    )
    assert not result["ok"]
    assert "request commitment mismatch" in result["reason"], result


@test
def hmac_catches_tampered_response():
    att, req, res = _hmac_attestation()
    tampered = {**res, "verdict": "block"}
    result = verify_attestation(
        attestation=att, original_request=req, original_response=tampered,
        hmac_key="test-secret",
    )
    assert not result["ok"]
    assert "output commitment mismatch" in result["reason"], result


@test
def hmac_catches_model_swap():
    att, req, res = _hmac_attestation()
    swapped = {**att, "model_id": "haiku"}
    result = verify_attestation(
        attestation=swapped, original_request=req, original_response=res,
        hmac_key="test-secret",
    )
    assert not result["ok"]
    assert "signature mismatch" in result["reason"], result


@test
def hmac_catches_wrong_secret():
    att, req, res = _hmac_attestation()
    result = verify_attestation(
        attestation=att, original_request=req, original_response=res,
        hmac_key="wrong-secret",
    )
    assert not result["ok"]
    assert "signature mismatch" in result["reason"], result


@test
def hmac_without_secret_raises():
    att, req, res = _hmac_attestation()
    try:
        verify_attestation(
            attestation=att, original_request=req, original_response=res,
        )
    except TypeError as e:
        assert "hmac_key required" in str(e), e
        return
    raise AssertionError("expected TypeError when hmac_key omitted")


# ─── Ed25519 verification ─────────────────────────────────────────

def _ed25519_attestation():
    """Build a valid Ed25519 attestation using cryptography lib."""
    from cryptography.hazmat.primitives.asymmetric import ed25519
    from cryptography.hazmat.primitives import serialization

    private_key = ed25519.Ed25519PrivateKey.generate()
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    request = {"loan_id": "PY-ED25519-001"}
    response = {"verdict": "escalate"}

    request_commitment = commitment_of(request)
    output_commitment = commitment_of(response)

    payload = "|".join([
        ATTESTATION_VERSION, MODE_ED25519, request_commitment, output_commitment,
        "sonnet", "2026-07-05T01:00:00Z", "", "v1",
    ])
    signature = private_key.sign(payload.encode())

    attestation = {
        "version": ATTESTATION_VERSION,
        "mode": MODE_ED25519,
        "request_commitment": request_commitment,
        "output_commitment": output_commitment,
        "model_id": "sonnet",
        "completed_at_utc": "2026-07-05T01:00:00Z",
        "previous_hash": None,
        "key_id": "v1",
        "signature": b64encode(signature).decode(),
    }
    return attestation, request, response, public_pem


@test
def ed25519_happy_path_verifies():
    att, req, res, pub = _ed25519_attestation()
    result = verify_attestation(
        attestation=att, original_request=req, original_response=res,
        public_key_pem=pub,
    )
    assert result["ok"], f"expected ok=True, got {result}"
    assert result["mode"] == MODE_ED25519


@test
def ed25519_catches_response_tamper():
    att, req, res, pub = _ed25519_attestation()
    tampered = {**res, "verdict": "approve"}
    result = verify_attestation(
        attestation=att, original_request=req, original_response=tampered,
        public_key_pem=pub,
    )
    assert not result["ok"]
    assert "output commitment mismatch" in result["reason"], result


@test
def ed25519_catches_wrong_public_key():
    from cryptography.hazmat.primitives.asymmetric import ed25519
    from cryptography.hazmat.primitives import serialization

    att, req, res, _ = _ed25519_attestation()
    other = ed25519.Ed25519PrivateKey.generate().public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    result = verify_attestation(
        attestation=att, original_request=req, original_response=res,
        public_key_pem=other,
    )
    assert not result["ok"]
    assert "ed25519 signature mismatch" in result["reason"], result


@test
def ed25519_without_public_key_raises():
    att, req, res, _ = _ed25519_attestation()
    try:
        verify_attestation(
            attestation=att, original_request=req, original_response=res,
        )
    except TypeError as e:
        assert "public_key_pem required" in str(e), e
        return
    raise AssertionError("expected TypeError when public_key_pem omitted")


# ─── Version / mode gates ─────────────────────────────────────────

@test
def unsupported_version_fails_cleanly():
    att, req, res = _hmac_attestation()
    att = {**att, "version": "wrong/v99"}
    result = verify_attestation(
        attestation=att, original_request=req, original_response=res,
        hmac_key="test-secret",
    )
    assert not result["ok"]
    assert "unsupported attestation version" in result["reason"]


@test
def malformed_attestation_fails_cleanly():
    result = verify_attestation(
        attestation="not-a-dict",
        original_request={},
        original_response={},
        hmac_key="test-secret",
    )
    assert not result["ok"]
    assert "malformed" in result["reason"]


# ─── main ────────────────────────────────────────────────────────

def main():
    failures = []
    for fn in TESTS:
        try:
            fn()
            print(f"  ✓ {fn.__name__}")
        except Exception as e:
            failures.append((fn.__name__, e))
            print(f"  ✗ {fn.__name__}: {e}")
            traceback.print_exc()

    print()
    print(f"{'✓' if not failures else '✗'} {len(TESTS) - len(failures)}/{len(TESTS)} passed")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
