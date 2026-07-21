# Claim–Evidence Graph — one fact source for Shadow, Unity, Flow, verifier

A decision is a graph, not a paragraph. `lib/claim-evidence-graph.mjs` is the canonical,
dependency-free, deterministic model every surface renders — so the 3D audit arc, the web
verifier, the signed bundle, and Flow can never tell three different stories.

Version: `shadow-claim-evidence-graph/1.0`.

## Nodes
`source · snapshot · evidence · claim · transformation · policy · council_voice · dissent ·
recommendation · signature · audit_record`

## Edges
`SUPPORTS · CONTRADICTS · DERIVED_FROM · APPLIES_POLICY · CHALLENGED_BY · SUPERSEDES · SEALED_BY`

## The shape of a decision
```
source ──DERIVED_FROM◄── snapshot ──DERIVED_FROM◄── evidence ──SUPPORTS──► claim
claim ──APPLIES_POLICY──► policy          claim ──CHALLENGED_BY──► dissent
recommendation ──DERIVED_FROM──► claim(s)   recommendation ──SEALED_BY──► signature
audit_record ──DERIVED_FROM──► signature
```

## Guarantees
- **Deterministic + attestable**: `exportGraph()` is byte-stable (nodes sorted by id, edges
  by (type,from,to), keys sorted), so `graphSha256()` is insertion-order independent and a
  post-hoc edit changes the hash.
- **Stable IDs**: caller-provided, uniqueness enforced by `addNode`.
- **No secrets**: `addNode` rejects PEM keys / `sk-…` / AWS keys / long raw hex. Snapshots
  carry a `*_sha256`, never the raw sensitive body.
- **Clear failure — missing evidence**: `validateGraph()` flags any claim that is neither
  supported by evidence, nor grounded in an applied policy, nor an explicit abstention. This
  is the "no citation passes just because its format is valid" rule at the graph layer.

## Who consumes it
- **Shadow AI layer**: the council decision serializes into this graph; the ingested-output
  auditor (see `INGESTED_OUTPUT_AUDIT.md`) emits its claims/citations into it.
- **Unity audit arc** (`FLOW_OR_AUDIT`): walks `provenanceChain()` — the ordered spine
  `source → snapshot → evidence → claim → recommendation → signature → audit_record` — lights
  each node in sequence, and freezes downstream nodes as NOT VERIFIED after a broken link.
- **Flow export**: serializes `exportGraph()`.
- **Offline verifier** (`verify.html`): can re-hash `exportGraph()` to confirm the graph the
  bundle sealed is the graph being shown.

## Reference build
`apps/shadow-lens/fixtures/banking-graph.mjs` builds the banking decision graph from the same
deterministic narrative the Unity stage + Flow export use (`banking-narrative.mjs`) — the
worked example the tests validate (`test/shadow-claim-evidence-graph.test.js`).
