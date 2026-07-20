# experiments/cubesandbox-attestation

A **deletable** security-research spike (OSS radar 2026-07-20, CubeSandbox). NOT for
the XREAL demo, NOT for a 2.x release — this is a research prototype only.

Shadow today proves *what the agent did* and *that the record wasn't changed*. This
spike adds the missing layer: *what environment the agent was allowed to run in* —
which image, which network policy, which credentials, what it actually egressed to.

The move is NOT to run Shadow inside CubeSandbox. It's to have Shadow **record the
execution environment as evidence**, as a non-destructive `execution_environment`
extension on a session event:

```json
{
  "execution_environment": {
    "provider": "cubesandbox",
    "template_digest": "sha256:…",
    "image_digest": "sha256:…",
    "snapshot_id": "…",
    "network_policy_hash": "sha256:…",
    "credential_policy_hash": "sha256:…",
    "egress_log_hash": "sha256:…",
    "outbound_domains": ["api.anthropic.com"],
    "resource_limits": { "cpu": "1", "memory_mb": 2048 },
    "process_exit_code": 0
  }
}
```

Policy → sandbox config → agent execution → network/tool activity → Shadow bundle.

## The load-bearing discipline (the radar's key risk)

The sandbox's own logs must themselves be **hash-bound**, or the execution evidence
detaches from the Shadow record and can be swapped after the fact. So:
`egress_log_hash` binds the actual egress log, `network_policy_hash` binds the policy
that was enforced (not a description of it). `computeExecutionEnvHash()` gives a stable
digest to pin the whole block into the signed bundle. The validator **warns** when
`outbound_domains` are listed without an `egress_log_hash` — a claim with no bound
evidence behind it.

## Run

```
node experiments/cubesandbox-attestation/execution-environment.mjs
```

Validates the fixture, flags the missing-egress-binding case, and prints the pinnable
`execution_environment_hash`.

## Why it stays out of core for now

- Needs KVM / Linux / a real control plane to produce genuine digests.
- The sandbox performance + isolation claims need independent re-testing.
- No direct help to the current demo.
Promote only after the hash-binding discipline above is proven against a real egress
log — otherwise it's execution theater, not execution evidence.
