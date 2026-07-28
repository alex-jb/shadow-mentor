// Flow export contract + offline presenter: versioned, deterministic, non-secret, and NEVER
// touches the network in the Mock (offline) path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BANKING_NARRATIVE } from "../apps/shadow-lens/fixtures/banking-narrative.mjs";
import { exportFlowContract, FLOW_EXPORT_VERSION, FLOW_EXPORT_COLUMNS } from "../apps/shadow-lens/flow/flow-export-contract.mjs";
import { OfflineMockFlowPresenter, WebOrApiFlowPresenter, resolveFlowPresenter, FlowHandoffState } from "../apps/shadow-lens/flow/flow-presenter.mjs";

test("export is versioned + carries council/metric/evidence/relationship rows", () => {
  const ex = exportFlowContract(BANKING_NARRATIVE);
  assert.equal(ex.schema_version, FLOW_EXPORT_VERSION);
  assert.equal(ex.case_id, "case-2026-Q3-0042");
  const types = new Set(ex.rows.map((r) => r.row_type));
  for (const t of ["council", "metric", "evidence", "relationship"]) assert.ok(types.has(t), `missing ${t} rows`);
  assert.equal(ex.rows.filter((r) => r.row_type === "council").length, 5); // five voices
});

test("export is deterministic (same input → byte-identical output)", () => {
  const a = exportFlowContract(BANKING_NARRATIVE);
  const b = exportFlowContract(BANKING_NARRATIVE);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.csv, b.csv);
  // no wall-clock: generated_at is the fixed fixture timestamp
  assert.equal(a.generated_at, "2026-07-22T00:00:00.000Z");
});

test("export carries the FIXTURE MODEL label + signed status (honesty preserved)", () => {
  const ex = exportFlowContract(BANKING_NARRATIVE);
  assert.ok(ex.rows.every((r) => r.mode_label === "FIXTURE MODEL"));
  assert.ok(ex.rows.every((r) => r.signed_result_status === "sealed-verified"));
});

test("CSV header is the stable closed column set", () => {
  const ex = exportFlowContract(BANKING_NARRATIVE);
  assert.equal(ex.csv.split("\n")[0], FLOW_EXPORT_COLUMNS.join(","));
});

test("export contains NO secrets (no keys/PII patterns)", () => {
  const s = JSON.stringify(exportFlowContract(BANKING_NARRATIVE));
  assert.equal(/sk-ant-|AIza|BEGIN [A-Z ]*PRIVATE KEY|password|ssn|api[_-]?key/i.test(s), false);
});

test("offline presenter prepares WITHOUT network + explains the separate launch", () => {
  const p = new OfflineMockFlowPresenter();
  const h = p.prepare(BANKING_NARRATIVE);
  assert.equal(h.state, FlowHandoffState.PREPARED);
  assert.equal(h.network_used, false);
  assert.match(h.explanation, /launched separately|does not embed|offline/i);
  assert.equal(h.export.schema_version, FLOW_EXPORT_VERSION);
});

test("resolveFlowPresenter defaults to offline; live requires the explicit flag", () => {
  assert.equal(resolveFlowPresenter().kind, "offline-mock");
  assert.equal(resolveFlowPresenter({ live: true }).kind, "web-api");
});

test("the live presenter does nothing (no network) unless its flag is enabled", async () => {
  let fetched = false;
  const p = new WebOrApiFlowPresenter({ enabled: false, fetchImpl: async () => { fetched = true; } });
  const h = await p.prepare(BANKING_NARRATIVE);
  assert.equal(h.state, FlowHandoffState.NOT_AVAILABLE);
  assert.equal(h.network_used, false);
  assert.equal(fetched, false);
});

test("offline mode works with no Flow credentials present", () => {
  const saved = process.env.FLOW_API_KEY; delete process.env.FLOW_API_KEY;
  try {
    const h = new OfflineMockFlowPresenter().prepare(BANKING_NARRATIVE);
    assert.equal(h.state, FlowHandoffState.PREPARED);
    assert.equal(h.network_used, false);
  } finally { if (saved !== undefined) process.env.FLOW_API_KEY = saved; }
});
