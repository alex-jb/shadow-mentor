#!/usr/bin/env bash
# verify-shadow.sh — verify a single persisted Shadow response against the
# public HTTP verifier at $SHADOW_URL/api/verify-attestation.
#
# Assumes the persisted file is:
#   {
#     "request":  <the exact body Shadow was called with>,
#     "response": <the exact response body Shadow returned, WITH the attestation field>
#   }
#
# The Shadow deployment's Ed25519 public key must be available as
# $SHADOW_ATTESTATION_PUBLIC_KEY (PEM string).
#
# Exit codes:
#   0 — verified ok
#   1 — verification failed (tamper / silent model-swap / wrong key material)
#   2 — HTTP transport error (retry-worthy)

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <path-to-persisted-response.json>" >&2
  exit 64
fi

FILE="$1"

if [ -z "${SHADOW_URL:-}" ]; then
  echo "SHADOW_URL not set (should be your Shadow deployment base URL)" >&2
  exit 78
fi

if [ -z "${SHADOW_ATTESTATION_PUBLIC_KEY:-}" ]; then
  echo "SHADOW_ATTESTATION_PUBLIC_KEY not set (should be the Ed25519 public key PEM)" >&2
  exit 78
fi

# Split the persisted file into request + response-minus-attestation + attestation.
# Requires jq (pre-installed on ubuntu-latest GitHub runners).
REQ=$(jq -c '.request' "$FILE")
ATT=$(jq -c '.response.attestation' "$FILE")
RES=$(jq -c '.response | del(.attestation)' "$FILE")

# Build the verifier POST body. Public key is passed inline so the endpoint
# doesn't need to know about the CI's key material.
BODY=$(jq -nc \
  --argjson attestation "$ATT" \
  --argjson original_request "$REQ" \
  --argjson original_response "$RES" \
  --arg public_key "$SHADOW_ATTESTATION_PUBLIC_KEY" \
  '{attestation:$attestation, original_request:$original_request, original_response:$original_response, public_key:$public_key}')

# curl the verifier. -f fails on 4xx/5xx (transport error, exit 2).
# -s silent, -S show error, --max-time 20 = don't hang forever.
RESPONSE=$(curl -sSf --max-time 20 \
  -H 'content-type: application/json' \
  -X POST "$SHADOW_URL/api/verify-attestation" \
  -d "$BODY") || {
  echo "✗ HTTP transport error contacting $SHADOW_URL/api/verify-attestation" >&2
  exit 2
}

OK=$(printf '%s' "$RESPONSE" | jq -r '.ok')
MODE=$(printf '%s' "$RESPONSE" | jq -r '.mode')
MODEL=$(printf '%s' "$RESPONSE" | jq -r '.model_id')
KEY_ID=$(printf '%s' "$RESPONSE" | jq -r '.key_id')

if [ "$OK" = "true" ]; then
  echo "  ✓ verified"
  echo "    mode:     $MODE"
  echo "    model_id: $MODEL"
  echo "    key_id:   $KEY_ID"
  exit 0
fi

REASON=$(printf '%s' "$RESPONSE" | jq -r '.reason')
INTERP=$(printf '%s' "$RESPONSE" | jq -r '.interpretation')
echo "  ✗ FAILED"
echo "    mode:            $MODE"
echo "    model_id:        $MODEL"
echo "    key_id:          $KEY_ID"
echo "    reason:          $REASON"
echo "    interpretation:  $INTERP"
exit 1
