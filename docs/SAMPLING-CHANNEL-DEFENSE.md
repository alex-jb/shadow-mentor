# Invisible-Manipulation Channel Defense (Shadow v1.5.28+)

**Reference**: [arXiv:2606.16121](https://arxiv.org/abs/2606.16121) — "Invisible Manipulation Channels in AI-Assisted Financial Advisory" (2026-06-25).

## What the paper documents

An inference proxy sitting between a customer application and a language-model API can adversarially bias sampling in ways that produce:

- **1.8x to 1.9x directional-keyword amplification** in council-style verdicts
- **Bypasses all 6 tested black-box detectors** (calibration probes, self-consistency, temperature-jitter checks, etc.)
- **KL-divergence from clean sampling arbitrarily small** — output looks statistically identical to un-attacked output

The paper's proposed complete defense is quantum-random-number generation + trusted-execution-environment hardware isolation. This detects tampered samples with 100% success. Shadow does not run in a TEE. What Shadow CAN do — and what this module ships — is close the specific attack vector where the inference proxy silently substitutes seed / temperature / model between council calls.

**This is a partial defense, not a complete one.** The paper is explicit: without a QRNG + TEE, no software-only defense can detect adversarial samples where the seed is correctly reported. What Shadow's v1.5.28 defense catches is the easier attack: a proxy that silently changes the seed / temperature / model_id and hopes no one recomputes the commitment.

## The v1.5.28 attestation binding

`buildAttestation({ ..., samplingSeedCommitmentSha256 })` accepts an 8th append-only field. Same back-compat pattern as v1.5.8/18/19/20/23/24. Pre-v1.5.28 attestations verify unchanged.

The commitment is SHA-256 of a canonical JSON serialization of:

- `seed` — the seed Shadow requested
- `temperature` — 0 for deterministic; higher for exploration
- `top_p` and `top_k` — provider-specific
- `provider` — "anthropic" | "openai" | "glm"
- `model_id` — provider's model identifier
- `system_fingerprint` — provider-reported fingerprint (OpenAI ships it; Anthropic returns nothing equivalent so pass `null`)

Post-hoc edit to any of these fields changes the SHA-256 and breaks Ed25519 verification.

## Provider-specific deterministic sampling

Different providers accept different deterministic-sampling parameters. `deterministicSamplingOptionsFor(provider)` returns the correct shape:

| Provider | Deterministic parameters | Notes |
|---|---|---|
| Anthropic | `{ temperature: 0 }` | Anthropic does not accept `seed` |
| OpenAI | `{ temperature: 0, seed: 42 }` | Response ships `system_fingerprint` |
| GLM | `{ temperature: 0, top_k: 1 }` | GLM does not accept `seed`; `top_k: 1` approximates determinism |

## What this defense catches

- Proxy silently changes the seed between calls → recomputed commitment differs → verification fails
- Proxy silently swaps model_id → captured in `attestation.model_id`, cross-referenced by commitment
- Proxy silently changes temperature → commitment differs
- Proxy silently drops `system_fingerprint` → commitment differs on the recorded field

## What this defense does NOT catch

- Proxy returns adversarial samples with the CORRECT seed pinned. This requires QRNG + TEE per the paper.
- Proxy modifies output tokens directly after generation. Shadow's existing `output_commitment` catches this via a different mechanism (output SHA-256 in the signing payload).
- Proxy delays the request to correlate with market-moving events. Out of scope for a sampling-attestation ship; needs a separate temporal-consistency test.

## Honest positioning

Shadow's marketing for v1.5.28 should read: *partial defense against arXiv:2606.16121 invisible-manipulation channels — specifically, silent-substitution attacks on seed, temperature, model, and provider fingerprint. Complete defense per the paper requires QRNG + TEE, which Shadow does not currently ship.*

Do NOT position v1.5.28 as "complete arXiv:2606.16121 defense." That would fail an academic review + procurement due-diligence.

## Related documents

- `docs/JUDGE-CARD.md` — Policy Invariance Score protocol (arXiv:2605.06161)
- `docs/GAICF-COMPATIBILITY.md` — GAICF three-layer control matrix (arXiv:2607.04103)
- `docs/CITATION_MAP.md` — Loredana Levitchi's regulatory-citation-to-test triple map
- `lib/attestation.js` — the underlying attestation build/verify primitives
