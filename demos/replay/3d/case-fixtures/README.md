# Audit-room case-state fixtures (②)

Drop any `*.bundle.json` into the 3D room (bundle-loader.js) to render that case.
Each is a real signed attest-core bundle from the deterministic council. Verify with its `*.public.pem`.

| case | kind | verdict | events | reviewers |
|---|---|---|---|---|
| approved | resting clean decision (5/5 approve) | approve | 5 | 1 |
| rejected | hard block (FICO floor) | block | 5 | 1 |
| multi-reviewer-conflict | approved vs rejected → pending (FINDING-C1) | escalate | 6 | 2 |
| aml-flagged | AML/KYC 6th-voice flag | escalate | 5 | 1 |
