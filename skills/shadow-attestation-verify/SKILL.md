---
name: shadow-attestation-verify
description: >
  Verify a Shadow attestation record (Ed25519 or HMAC) without leaving Claude
  Desktop. Confirms request wasn't tampered, response wasn't tampered, the
  exact pinned model ran, and the deployment key material matches. Use when
  a bank auditor hands you a persisted JSON response and asks "is this real."
  Works cross-language — Python shadow-verify library produces byte-identical
  results for the same inputs on Python 3.9–3.13.
version: 1.0.1
author: Alex Xiaoyu Ji
authors:
  - Alex Xiaoyu Ji <xji1@mail.yu.edu>
license: MIT
repo: https://github.com/alex-jb/shadow-mentor
tags:
  - shadow
  - attestation
  - ed25519
  - hmac
  - audit
  - verify
  - cross-language
scope: shadow:read
depends_on:
  - shadow_verify_attestation MCP tool (v1.5.1+)
---

# Shadow Attestation Verify

Cryptographic verification of a persisted Shadow decision, without a network call to Shadow itself.

## When to use

The user's request combines all of:

1. A JSON attestation object (from `response.attestation`) with `signature`, `mode`, `model_id`, `request_commitment`, `output_commitment`, `completed_at_utc`, `key_id`.
2. The original request body Shadow was called with.
3. The original response body, with the `attestation` field stripped (hashing an attestation into itself is a common wrong path).
4. The verification key material — Ed25519 public key PEM for procurement-mode records, HMAC secret for legacy dev mode.

If any of the four is missing, ask for it. Do not fabricate.

## What it does

Calls `shadow_verify_attestation` with the four inputs and returns:

- **ok** — true if signature verifies + commitments match + key_id + model_id are as pinned. False otherwise.
- **reason** — plain-English reason if false. One of: request tampered, response tampered, model_id substitution detected, signature invalid, wrong key.
- **model_id + key_id + completed_at_utc** — surfaced for audit trail.
- **interpretation** — one sentence a compliance officer can paste into an audit note.

## The named invariant

**Dictionary hash is bound into the signing payload since v1.5.8.** If the reason-code dictionary was swapped between decision time and verification time, the signature will not verify — even with the correct key. This closes the "post-hoc dictionary edit" gap under Reg B / CFPB Bulletin 2024-09.

## Approval boundary

Never surface an attestation-verified-true result to the end user if the underlying `verdict` is `escalate` or `block`. That is a separate approval rule, not a verification rule. This skill only proves cryptographic integrity — it does not decide whether the loan was correctly denied.

If `ok: false` — halt. This is a tampering signal. Do not surface the underlying tool response. Escalate to security per `config/approval-rules.json:attestation-verify-failed` with a 1-hour SLA.

## Non-goals

- Not legal advice. The verifier says the record wasn't tampered; a licensed attorney says whether the underlying decision was legally defensible.
- Not a signature generator. Verification only. Signing lives on the Shadow deployment.
- Not a private-key operation. This skill only ever touches public keys or HMAC secrets shared with the auditor.

## Reference

- Shadow `bin/verify-attestation.mjs` — CLI equivalent.
- Shadow `POST /api/verify-attestation` — HTTP equivalent.
- Python `shadow_verify` library — cross-language equivalent, Python 3.9–3.13 CI matrix.
- RFC 8032 (Ed25519).
