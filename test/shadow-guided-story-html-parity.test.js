// HTML-adapter parity: the three self-contained explainers (deployed HTML) and the shared guided
// story tell the SAME story. We compile each guided-story fixture, project it through the HTML
// adapter, and assert it agrees with the explainers' own encoded data:
//   - audit-chain.html   : inline NODES + TAMPER_SEQ constant
//   - reason-code / persona : their fixtures/animations/*.json source (the explainers are built from these)
// This does not re-render the explainers; it proves semantic convergence without a redesign.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile } from "../tools/compile-shadow-guided-story.mjs";
import { toChainView, toCheckView, CHAIN_DISPLAY } from "../demos/animations/src/shadow-guided-story-html-adapter.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const semanticOf = (id) => compile(JSON.parse(read(`fixtures/guided-stories/${id}.guided-story.json`)), { target: "html" }).semantic;

test("audit-chain: guided story matches the explainer's inline NODES count/order + TAMPER_SEQ", () => {
  const html = read("apps/shadow-lens/explainers/audit-chain.html");
  // parse the explainer's own truth: NODES = [ {id:"source",...}, ... ] and const TAMPER_SEQ = 3;
  const nodeIds = [...html.matchAll(/\{\s*id:\s*"([a-z_]+)"/g)].map((m) => m[1]);
  const tamperSeq = Number(html.match(/const\s+TAMPER_SEQ\s*=\s*(\d+)/)[1]);
  assert.ok(nodeIds.length >= 7, "explainer has its 7 chain nodes");

  const sem = semanticOf("audit-chain");
  const view = toChainView(sem, "tamper_seq_3");
  // same number of chain links, same order (by the short id tail). The two source artifacts name
  // the terminal node with a documented alias — audit-chain.html uses "audit", the banking-3d scene
  // uses "audit_record"; both mean the audit record. Sequences 0..5 match tail-for-tail.
  assert.equal(view.nodes.length, nodeIds.length, "chain length matches the explainer");
  view.nodes.forEach((n, i) => {
    const tail = n.id.split(":").pop();               // banking-v1:n0:source -> source
    if (i < nodeIds.length - 1) assert.equal(tail, nodeIds[i], `node ${i} id tail matches explainer NODES order`);
    else assert.ok(tail.startsWith(nodeIds[i]) && tail.includes("audit"), `terminal node is the audit record ("${nodeIds[i]}" ~ "${tail}")`);
  });
  // the tamper falls at the same sequence, and downstream freezes exactly after it
  assert.equal(view.firstFailureSeq, tamperSeq, "first failure sequence == explainer TAMPER_SEQ");
  assert.deepEqual(view.downstreamSeq, view.nodes.filter((n) => n.sequence > tamperSeq).map((n) => n.sequence));
  assert.equal(view.nodes[tamperSeq].status, "TAMPERED");
  assert.ok(view.nodes.slice(tamperSeq + 1).every((n) => n.status === "NOT_VERIFIED"));
  // pristine scenario: everything verified
  assert.ok(toChainView(sem, "pristine").nodes.every((n) => n.status === "VERIFIED"));
});

test("reason-code: guided scenarios reuse the animation fixture's ids + first-failure checks (no drift)", () => {
  const src = JSON.parse(read("fixtures/animations/reason-code-attestation.json"));
  const sem = semanticOf("reason-code-attestation");

  // reason codes + signer fingerprint survive into the shared story
  const entityIds = sem.entities.map((e) => e.id);
  for (const rc of ["RC-017", "RC-021", "RC-031"]) assert.ok(entityIds.includes(`rc:${rc}`), `${rc} present`);
  assert.ok(sem.entities.some((e) => e.a11y.en.includes(src.signer_fingerprint)), "signer fingerprint preserved");

  // every source tamper scenario is present, and its source check name is recorded in the note
  for (const [scName, sc] of Object.entries(src.tamper_scenarios)) {
    if (!sc.first_failure) continue;
    const guided = sem.scenarios.find((s) => s.id === scName);
    assert.ok(guided, `scenario ${scName} carried over`);
    assert.ok((guided.note.en + guided.note.zh).includes(sc.first_failure), `${scName} note records source check ${sc.first_failure}`);
    assert.equal(guided.first_failure != null, true, `${scName} has a first_failure`);
  }
  // pristine check view: dictionary hash/version/binding all PASS; analytical correctness NOT judged
  const v = toCheckView(sem, "pristine");
  assert.equal(v.checks.find((c) => c.dimension === "DICTIONARY_HASH").status, "PASS");
  assert.equal(v.checks.find((c) => c.dimension === "ANALYTICAL_CORRECTNESS").status, "NOT_EVALUATED");
});

test("persona: guided scenarios reuse the animation fixture's personas + first_warning per scenario", () => {
  const src = JSON.parse(read("fixtures/animations/persona-deliberation.json"));
  const sem = semanticOf("persona-deliberation");

  for (const p of Object.keys(src.personas)) assert.ok(sem.entities.some((e) => e.id === `persona:${p}`), `${p} present`);
  for (const e of Object.keys(src.shared_evidence)) assert.ok(sem.entities.some((ent) => ent.id === e), `${e} present`);

  // each source scenario is carried; its first_warning (null or a check) is reflected in the guided story
  for (const [scName, sc] of Object.entries(src.scenarios)) {
    const guided = sem.scenarios.find((s) => s.id === scName);
    assert.ok(guided, `scenario ${scName} carried over`);
    if (sc.first_warning == null) assert.equal(guided.first_failure, null, `${scName} is clean`);
    else assert.notEqual(guided.first_failure, null, `${scName} flags a first warning`);
  }
  // majority is never mapped to correctness: analytical correctness NOT evaluated, human approval NOT present
  const v = toCheckView(sem, "consensus_with_evidence");
  assert.equal(v.checks.find((c) => c.dimension === "ANALYTICAL_CORRECTNESS").status, "NOT_EVALUATED");
  assert.equal(v.checks.find((c) => c.dimension === "HUMAN_APPROVAL").status, "ABSENT");
});

test("the display mapping is honest: FIRST_FAILURE→TAMPERED, AFFECTED_DOWNSTREAM→NOT_VERIFIED", () => {
  assert.equal(CHAIN_DISPLAY.FIRST_FAILURE, "TAMPERED");
  assert.equal(CHAIN_DISPLAY.AFFECTED_DOWNSTREAM, "NOT_VERIFIED");
  assert.equal(CHAIN_DISPLAY.VERIFIED, "VERIFIED");
});
