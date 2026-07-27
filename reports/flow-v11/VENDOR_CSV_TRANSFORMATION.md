# Node / edge transformation — Shadow presentation graph → Flow vendor CSV

Source: `shadow-flow-presentation/1.0` — 25 nodes, 19 directed typed edges
Target: `shadow-flow-vendor-csv/1.0` — 25 rows, 18 adjacency entries
Transformer: `apps/shadow-lens/flow/flow-vendor-csv.mjs`
Validator: `scripts/validate-flow-vendor-csv.mjs`

The vendor format is an **adjacency-list** graph (one row per node, connectivity in `idList`).
The Shadow presentation graph is a **directed, typed, multi-edge** graph. This document records
exactly what that conversion preserves, what it collapses, and what it deliberately refuses to do.

## 1 · Node identity

Shadow node IDs are namespaced strings (`banking-v1:n3:claim`, `council:risk-officer`). The vendor
example (`2|3|10`) is numeric, and `|` is the delimiter, so IDs must be short and pipe-free.

**Rule.** Assign 1-based integers in the deterministic order the presentation mapping emits nodes.
Carry the Shadow string ID on the same row as `shadow_node_id`.

- The numbering is stable across builds (pinned: "deterministic — two builds are byte-identical").
- The numbering is **not** an identity. `shadow_node_id` is. If the fixture ever gains a node and
  the integers shift, every row still names its own Shadow node and its own `evidence_ref`, so no
  row can silently detach from its evidence.

## 2 · Edge direction

**Rule.** A row's `idList` holds the nodes that row points **to** (outgoing).

Direction is therefore preserved without a second dataset: the lineage chain
`n1 → n0`, `n2 → n1`, `n3 → n2` … appears as each successor row naming its predecessor, exactly as
the Shadow `DERIVED_FROM` edges are oriented. A test asserts that **every** typed edge appears in
its source row's `idList`.

If Flow treats `idList` as undirected connectivity, the scene still renders correctly — each
relation is declared exactly once, so no duplicate line is drawn.

## 3 · Edge type

An adjacency column cannot carry a type. Rather than discard the relation vocabulary
(`DERIVED_FROM`, `SEALED_BY`, `ATTESTS`, `BINDS`, `cites`, `disagrees`), the transformer emits
`idListTypes`: the same number of pipe-delimited entries, positionally aligned with `idList`.

The **authoritative** typed, directed, un-collapsed edge record remains
`demo-package/shadow-flow-presentation-edges.csv` (19 rows). `idListTypes` is a convenience
projection; when the two disagree, the edges CSV wins.

## 4 · Multi-edge collapse — the one lossy step, accounted for

An adjacency list has no multi-edges. The Shadow graph declares one relation twice:

| Edge id | from → to | type | category |
|---|---|---|---|
| `edge:e4` | `banking-v1:n4:recommendation` → `banking-v1:n3:claim` | `DERIVED_FROM` | `lineage` |
| `edge:downstream:banking-v1-n4-recommendation` | `banking-v1:n4:recommendation` → `banking-v1:n3:claim` | `DERIVED_FROM` | `downstream` |

Same source, same target, same type — two *categories* (it is both a lineage step and a downstream
consequence of the first failure).

**Rule.** Collapse to one `idList` entry; union the types into the matching `idListTypes` entry.

**Accounting (emitted in `shadow-flow-vendor-graph-stats.json`, asserted by test):**

| Quantity | Value |
|---|---|
| `typed_edges` (authoritative) | **19** |
| `adjacency_pairs` (idList entries) | **18** |
| `collapsed_multi_edges` | **1** |

The collapse is reported, never silent. The `downstream` category itself is not lost: the affected
rows carry `is_affected_downstream = true`.

## 5 · Isolated nodes — deliberately preserved

Six of the 25 rows have no edge in either direction:

| `shadow_node_id` | Why it is unconnected in the Shadow fixture |
|---|---|
| `presentation:case-card` | the case container panel; the narrative declares no relation from it |
| `evidence:B0L0` (annual income) | no council voice cited this evidence item |
| `council:fair-lending-compliance` | this voice reached a finding **without citing** an evidence item |
| `council:macro-contrarian` | abstained; cited nothing |
| `presentation:attestation` | contextual status panel |
| `presentation:device-boundary` | the simulation/capability disclaimer panel |

**These are real properties of the Shadow record, not gaps to be repaired.** Connecting them would
fabricate citations and relationships that Shadow never recorded — a direct violation of the
standing rule *"do not alter Shadow findings, lineage, review state, approval state or provenance
merely to make the visualization simpler."*

Two safeguards exist so a future edit cannot quietly "prettify" the scene:

1. the validator reports isolated nodes as **INFO** with the explicit instruction not to invent
   edges (INFO never fails the run — the condition is expected, not defective);
2. a test **pins the exact six** `shadow_node_id`s. Adding an invented edge to any of them turns
   that test red.

In Flow, expect six unconnected elements. That is the audit being shown honestly: a council voice
that cited no evidence should *look* like a council voice that cited no evidence.

## 6 · What is copied, never recomputed

`label_en`, `label_zh`, `status`, `status_family`, `lineage_order`, `is_first_failure`,
`is_affected_downstream`, `evidence_ref` and the three case-scope columns are all copied from the
presentation mapping, which copies them from the fixtures. A test compares every row's
`status` / `status_family` / labels against its Shadow source node, so a transformer that started
deriving its own verdicts would fail CI before it could reach an auditor's scene.

## 7 · Determinism

No `Date.now`, no `Math.random`, no network, no absolute paths. `generated_at` is the fixture
timestamp. Two builds produce byte-identical CSV, and the committed file is drift-gated by both
`node scripts/gen-flow-presentation-package.mjs --check` and a test.

## 8 · What this transformation does not establish

- **No import has been performed.** The CSV has never been loaded into Flow.
- **No scene has rendered**; no XREAL One Pro or Beam Pro has displayed it.
- **No SCP claim.** SCP is in the final stages of production release and is not treated here as
  currently production-available.
- Structural validity of a graph dataset is not evidence that Flow's importer accepts this exact
  column set. The vendor guidance names `id` and `idList`; the remaining 17 columns are Shadow
  payload whose acceptance is confirmed only by an actual import attempt.
