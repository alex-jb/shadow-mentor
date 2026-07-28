// §7 execution-events endpoint: records material action events only, drops telemetry.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { filterMaterialEvents } from "../api/shadow-lens/execution-events.js";

function mockRes() {
  return { statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; }, end() { return this; } };
}

test("keeps material action events, drops telemetry + malformed", () => {
  const kept = filterMaterialEvents([
    { requested_action: "highlight_source", execution_status: "EXECUTED" },
    { requested_action: "camera_frame", execution_status: "EXECUTED" }, // telemetry — dropped
    { requested_action: "gaze", execution_status: "EXECUTED" },         // telemetry — dropped
    { requested_action: "?", execution_status: "EXECUTED" },            // no action — dropped
    { requested_action: "open_audit_mode", execution_status: "REJECTED" },
    { requested_action: "focus_object", execution_status: "not_a_status" }, // bad status — dropped
  ]);
  assert.equal(kept.length, 2);
});

test("endpoint records material count, rejects GET, no-store", () => {
  const g = mockRes(); handler({ method: "GET", headers: {} }, g); assert.equal(g.statusCode, 405);
  const r = mockRes();
  handler({ method: "POST", headers: {}, body: { events: [
    { requested_action: "highlight_source", execution_status: "EXECUTED" },
    { requested_action: "mouse_move", execution_status: "EXECUTED" },
  ] } }, r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.recorded, 1);
  assert.equal(r.body.dropped, 1);
  assert.equal(r.headers["Cache-Control"], "no-store");
});

test("CORS never reflects Origin: null", () => {
  const r = mockRes();
  handler({ method: "OPTIONS", headers: { origin: "null" } }, r);
  assert.equal(r.headers["Access-Control-Allow-Origin"], undefined);
});
