// Shadow → Flow presentation spike: deterministic, non-network tests over the presentation
// mapping + sanitized demo package (reports/flow-v11/). No live Flow service is ever touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFlowPresentationMapping, buildFlowDemoPackage, FLOW_PRESENTATION_VERSION, PRESENTED_SCENARIO,
} from "../apps/shadow-lens/flow/flow-presentation-mapping.mjs";
import { FLOW_EXPORT_VERSION, FLOW_EXPORT_COLUMNS } from "../apps/shadow-lens/flow/flow-export-contract.mjs";
import { resolveFlowPresenter, WebOrApiFlowPresenter, FlowHandoffState } from "../apps/shadow-lens/flow/flow-presenter.mjs";
import { BANKING_NARRATIVE } from "../apps/shadow-lens/fixtures/banking-narrative.mjs";
import { SEMANTIC_STATUS } from "../lib/shadow-semantic-vocabulary.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rpt = (...p) => join(ROOT, "reports", "flow-v11", ...p);

// ── schema validation ────────────────────────────────────────────────────────
test("flow presentation: reuses shadow-flow-export/1.0 (no new row schema) + versions the extension", () => {
  const { rowExport, mapping } = buildFlowDemoPackage();
  assert.equal(rowExport.schema_version, FLOW_EXPORT_VERSION);
  assert.equal(rowExport.csv.split("\n")[0], FLOW_EXPORT_COLUMNS.join(","));
  assert.equal(mapping.presentation_version, FLOW_PRESENTATION_VERSION);
  assert.equal(mapping.export_contract, FLOW_EXPORT_VERSION);
});

test("flow presentation: every node carries the required fields", () => {
  const m = buildFlowPresentationMapping();
  for (const n of m.nodes) {
    for (const f of ["id", "type", "label_en", "label_zh", "status", "status_family", "group", "source_ref", "refs"])
      assert.ok(n[f] !== undefined && n[f] !== "", `node ${n.id} missing ${f}`);
    assert.ok(["center", "left-case", "ring-council", "right-downstream", "path-lineage", "verification-area"].includes(n.group), `unknown group ${n.group}`);
  }
});

// ── JSON/CSV parity ──────────────────────────────────────────────────────────
test("flow presentation: JSON ↔ CSV parity (rows, nodes, edges)", () => {
  const { mapping, rowExport, nodesCsv, edgesCsv } = buildFlowDemoPackage();
  assert.equal(rowExport.csv.trim().split("\n").length - 1, rowExport.row_count);
  assert.equal(nodesCsv.trim().split("\n").length - 1, mapping.nodes.length);
  assert.equal(edgesCsv.trim().split("\n").length - 1, mapping.edges.length);
});

// ── stable IDs + deterministic ordering ──────────────────────────────────────
test("flow presentation: IDs are unique and two builds are byte-identical", () => {
  const a = buildFlowDemoPackage();
  const b = buildFlowDemoPackage();
  const ids = a.mapping.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate node id");
  const eids = a.mapping.edges.map((e) => e.id);
  assert.equal(new Set(eids).size, eids.length, "duplicate edge id");
  assert.equal(JSON.stringify(a.mapping), JSON.stringify(b.mapping));
  assert.equal(a.nodesCsv, b.nodesCsv);
  assert.equal(a.edgesCsv, b.edgesCsv);
  assert.equal(a.mapping.generated_at, "2026-07-22T00:00:00.000Z"); // fixture timestamp, not wall-clock
});

// ── no dangling references ───────────────────────────────────────────────────
test("flow presentation: no dangling edge / first-failure / downstream references", () => {
  const m = buildFlowPresentationMapping();
  const ids = new Set(m.nodes.map((n) => n.id));
  for (const e of m.edges) {
    assert.ok(ids.has(e.from), `edge ${e.id} dangling from ${e.from}`);
    assert.ok(ids.has(e.to), `edge ${e.id} dangling to ${e.to}`);
  }
  assert.ok(ids.has(m.first_failure), "first_failure references a missing node");
  for (const d of m.affected_downstream) assert.ok(ids.has(d), `downstream ${d} missing`);
});

// ── first-failure + downstream validity ──────────────────────────────────────
test("flow presentation: first failure is the spatial center with FIRST_FAILURE status; downstream statuses match", () => {
  const m = buildFlowPresentationMapping();
  const ff = m.nodes.find((n) => n.id === m.first_failure);
  assert.equal(ff.group, "center");
  assert.equal(ff.status, "FIRST_FAILURE");
  assert.equal(ff.refs.is_first_failure, true);
  for (const d of m.affected_downstream) {
    const node = m.nodes.find((n) => n.id === d);
    assert.equal(node.status, "AFFECTED_DOWNSTREAM");
    assert.equal(node.refs.is_affected_downstream, true);
  }
  // Flow never recomputes Shadow conclusions: statuses are literal copies of the fixture scenario
  for (const [id, st] of Object.entries(m.scenarios[PRESENTED_SCENARIO].entity_status)) {
    assert.equal(m.nodes.find((n) => n.id === id).status, st);
  }
});

test("flow presentation: human review and approval are distinct nodes; verification is separate from business conclusion", () => {
  const m = buildFlowPresentationMapping();
  const review = m.nodes.find((n) => n.id === "presentation:human-review");
  const approval = m.nodes.find((n) => n.id === "presentation:approval");
  assert.notEqual(review.status, approval.status);
  assert.equal(approval.status, "NOT_PRESENT"); // honest: the fixture has no granted approval
  const verifyNodes = m.nodes.filter((n) => n.group === "verification-area");
  assert.ok(verifyNodes.length >= 4);
  const analytical = m.nodes.find((n) => n.id === "presentation:verify-analytical");
  assert.equal(analytical.status, "NOT_EVALUATED"); // integrity ≠ correctness, preserved in Flow
});

// ── bilingual completeness ───────────────────────────────────────────────────
test("flow presentation: every node is bilingual (EN + ZH, non-empty, distinct fields)", () => {
  const m = buildFlowPresentationMapping();
  for (const n of m.nodes) {
    assert.ok(n.label_en.trim().length > 0, `${n.id} empty label_en`);
    assert.ok(n.label_zh.trim().length > 0, `${n.id} empty label_zh`);
  }
  // status vocabulary itself is bilingual via the shared vocabulary
  for (const n of m.nodes.filter((x) => SEMANTIC_STATUS[x.status])) {
    assert.ok(SEMANTIC_STATUS[n.status].text_zh.length > 0);
  }
});

// ── privacy / sanitization ───────────────────────────────────────────────────
test("flow demo package: no private fields (users, paths, serials, credentials, tokens, PII)", () => {
  const { mapping, rowExport, manifest } = buildFlowDemoPackage();
  const s = JSON.stringify({ mapping, rowExport, manifest });
  for (const pattern of [
    /\/Users\//, /alexji/i, /sk-ant-/, /AIza/, /BEGIN [A-Z ]*PRIVATE KEY/, /password/i,
    /\bssn\b/i, /api[_-]?key/i, /bearer /i, /pairing[_-]?code/i, /serial[_-]?number/i,
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN shape
  ]) assert.equal(pattern.test(s), false, `private pattern ${pattern} found in package`);
});

// ── honesty flags ────────────────────────────────────────────────────────────
test("flow demo manifest: physical flags stay false, network stays false, fixture label carried", () => {
  const { manifest, rowExport } = buildFlowDemoPackage();
  assert.equal(manifest.network_used, false);
  assert.equal(manifest.physical_device_validated, false);
  assert.equal(manifest.mode_label, "FIXTURE MODEL");
  assert.equal(manifest.shadow_source_commit, "84561eb");
  assert.deepEqual(manifest.language_support, ["en", "zh"]);
  assert.ok(rowExport.rows.every((r) => r.mode_label === "FIXTURE MODEL"));
  assert.ok(manifest.capability.not_claimed.some((c) => /native Shadow Lens/i.test(c)));
});

// ── no silent network push ───────────────────────────────────────────────────
test("flow adapter: cannot silently perform a live network push", async () => {
  assert.equal(resolveFlowPresenter().kind, "offline-mock"); // default stays offline
  let fetched = false;
  const p = new WebOrApiFlowPresenter({ enabled: false, fetchImpl: async () => { fetched = true; } });
  const h = await p.prepare(BANKING_NARRATIVE);
  assert.equal(h.state, FlowHandoffState.NOT_AVAILABLE);
  assert.equal(h.network_used, false);
  assert.equal(fetched, false);
  // the mapping builder itself has no network surface at all (pure fs + fixtures)
  const src = readFileSync(join(ROOT, "apps/shadow-lens/flow/flow-presentation-mapping.mjs"), "utf8");
  assert.equal(/fetch\(|https?:\/\/|XMLHttpRequest|net\.|axios/i.test(src), false, "mapping builder must be network-free");
});

// ── committed package matches a fresh build (canonical fixture → deterministic output) ─
test("flow demo package: committed reports/flow-v11 files match a fresh deterministic build", () => {
  const { mapping, rowExport, nodesCsv, edgesCsv, manifest } = buildFlowDemoPackage();
  assert.equal(readFileSync(rpt("shadow-flow-presentation-mapping.json"), "utf8"), JSON.stringify(mapping, null, 2) + "\n");
  assert.equal(readFileSync(rpt("shadow-flow-demo-manifest.json"), "utf8"), JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(readFileSync(rpt("demo-package", "shadow-flow-demo-export.json"), "utf8"), JSON.stringify(rowExport, null, 2) + "\n");
  assert.equal(readFileSync(rpt("demo-package", "shadow-flow-demo-export.csv"), "utf8"), rowExport.csv);
  assert.equal(readFileSync(rpt("demo-package", "shadow-flow-presentation-nodes.csv"), "utf8"), nodesCsv);
  assert.equal(readFileSync(rpt("demo-package", "shadow-flow-presentation-edges.csv"), "utf8"), edgesCsv);
});
