// Claim–Evidence Graph contract: the one fact source shared by Shadow / Unity / Flow /
// verifier. Pins node+edge type coverage, validity of the banking graph, the
// missing-evidence failure, deterministic (attestable) export, the no-secrets guard, and
// the provenance chain the audit arc walks.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CEG_VERSION, NODE_TYPES, EDGE_TYPES, PROVENANCE_ORDER,
  createGraph, addNode, addEdge, validateGraph, exportGraph, graphSha256, provenanceChain,
} from "../lib/claim-evidence-graph.mjs";
import { buildBankingGraph } from "../apps/shadow-lens/fixtures/banking-graph.mjs";

test("declares the required node and edge types", () => {
  for (const t of ["source", "snapshot", "evidence", "claim", "transformation", "policy",
    "council_voice", "dissent", "recommendation", "signature", "audit_record"])
    assert.ok(NODE_TYPES.includes(t), `missing node type ${t}`);
  for (const t of ["SUPPORTS", "CONTRADICTS", "DERIVED_FROM", "APPLIES_POLICY",
    "CHALLENGED_BY", "SUPERSEDES", "SEALED_BY"])
    assert.ok(EDGE_TYPES.includes(t), `missing edge type ${t}`);
});

test("the banking graph is valid (claims supported, recommendation derived, sealed)", () => {
  const g = buildBankingGraph();
  const v = validateGraph(g);
  assert.ok(v.ok, "banking graph invalid: " + v.errors.join("; "));
  assert.equal(g.version, CEG_VERSION);
  assert.ok(g.nodes.some((n) => n.type === "recommendation"));
  assert.ok(g.edges.some((e) => e.type === "SEALED_BY"));
});

test("a claim with no supporting evidence fails validation (missing-evidence)", () => {
  const g = createGraph();
  addNode(g, { id: "claim:lonely", type: "claim", label: "unsupported" });
  const v = validateGraph(g);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /claim:lonely.*(no supporting evidence|NO grounding)/i.test(e)), v.errors.join("; "));
});

test("export is deterministic + insertion-order independent (attestable hash)", () => {
  const a = createGraph();
  addNode(a, { id: "src:x", type: "source", label: "x" });
  addNode(a, { id: "ev:1", type: "evidence", label: "e1" });
  addEdge(a, { type: "DERIVED_FROM", from: "ev:1", to: "src:x" });

  const b = createGraph();               // same graph, reversed insertion order
  addNode(b, { id: "ev:1", type: "evidence", label: "e1" });
  addNode(b, { id: "src:x", type: "source", label: "x" });
  addEdge(b, { type: "DERIVED_FROM", from: "ev:1", to: "src:x" });

  assert.equal(exportGraph(a), exportGraph(b));
  assert.equal(graphSha256(a), graphSha256(b));
});

test("no secret can be stored in a node (store a hash, not the raw value)", () => {
  const g = createGraph();
  assert.throws(
    () => addNode(g, { id: "src:leak", type: "source", key: "-----BEGIN PRIVATE KEY-----\nMIIB" }),
    /looks like a secret/,
  );
  assert.throws(() => addNode(g, { id: "src:leak2", type: "source", token: "sk-ABCDEFGHIJKLMNOP1234" }), /secret/);
});

test("edges cannot reference unknown nodes", () => {
  const g = createGraph();
  addNode(g, { id: "a", type: "source" });
  assert.throws(() => addEdge(g, { type: "SUPPORTS", from: "ghost", to: "a" }), /not a node/);
});

test("provenance chain follows the ordered spine source→…→audit_record", () => {
  const chain = provenanceChain(buildBankingGraph());
  const types = chain.map((c) => c.type);
  assert.equal(types[0], "source");
  assert.equal(types[types.length - 1], "audit_record");
  // ordering respects PROVENANCE_ORDER (no type appears before an earlier-ordered type)
  const rank = (t) => PROVENANCE_ORDER.indexOf(t);
  for (let i = 1; i < types.length; i++) assert.ok(rank(types[i]) >= rank(types[i - 1]), `out-of-order at ${i}`);
  chain.forEach((c, i) => assert.equal(c.seq, i)); // seq is stable + dense
});
