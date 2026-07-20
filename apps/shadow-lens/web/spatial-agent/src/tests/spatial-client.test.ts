// apps/shadow-lens/web/spatial-agent/src/tests/spatial-client.test.ts
// Deterministic tests for the institutional web spatial client's pure logic (no browser/WebGL).
// A MockSpatialView stands in for the Three.js renderer; the real endpoint handler is the
// injected "fetch" so the full query flow is exercised end-to-end. Node 24 type-strips the .ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import spatialHandler from "../../../../../../api/shadow-lens/spatial-agent.js";
import { SpatialAgentClient } from "../app/SpatialAgentClient.ts";
import { SessionLoader } from "../app/SessionLoader.ts";
import { ShadowSpatialApp } from "../app/ShadowSpatialApp.ts";
import { SpatialActionExecutor } from "../actions/SpatialActionExecutor.ts";
import { ActionExecutionReporter } from "../app/ActionExecutionReporter.ts";
import { workspaceFor } from "../profiles/workspaces.ts";
import { FlowState, ExecStatus } from "../app/types.ts";
import type { SpatialView, SceneGraph } from "../app/types.ts";

// Adapts the Vercel-style (req,res) handler into a fetch(url, init) the client can call.
function handlerFetch(): typeof fetch {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    let statusCode = 200, payload: unknown = null;
    const res = {
      setHeader() {}, status(c: number) { statusCode = c; return this; },
      json(p: unknown) { payload = p; return this; }, end() { return this; },
    };
    await spatialHandler({ method: init?.method ?? "POST", body, headers: {} }, res);
    return { ok: statusCode < 400, status: statusCode, json: async () => payload };
  }) as unknown as typeof fetch;
}

class MockView implements SpatialView {
  mode = "document"; selected: string | null = null; highlighted: string | null = null;
  walkthrough: string | null = null; tamper = false; unsupported = new Set<string>();
  setMode(m: string) { this.mode = m; return true; }
  selectObject(id: string) { this.selected = id; return true; }
  focusObject(id: string) { this.selected = id; return true; }
  highlight(id: string) { this.highlighted = id; return true; }
  moveCameraTo(_id: string) { return true; }
  startWalkthrough(k: string) { this.walkthrough = k; return true; }
  showTamperDiff() { this.tamper = true; return true; }
  showVerificationFailure() { return true; }
  returnToWorkspace() { this.mode = "document"; this.selected = null; this.highlighted = null; return true; }
  clearSelection() { this.selected = null; return true; }
  supports(a: string) { return !this.unsupported.has(a); }
}

async function loadScene(profile: string): Promise<{ session_id: string; scene: SceneGraph }> {
  const loader = new SessionLoader({ fetchImpl: handlerFetch() });
  const r = await loader.load(profile);
  assert.equal(r.ok, true);
  return { session_id: (r as any).loaded.session_id, scene: (r as any).loaded.scene };
}

test("real session loads with a server-built scene graph", async () => {
  const { scene } = await loadScene("data-science-v1");
  assert.ok(scene.objects.length > 0);
  assert.equal(scene.scene_version, "shadow-evidence-scene-v1");
});

test("three profile selectors resolve to distinct workspaces", () => {
  assert.equal(workspaceFor("banking-v1").defaultMode, "document");
  assert.equal(workspaceFor("data-science-v1").defaultMode, "experiment");
  assert.equal(workspaceFor("coding-agent-v1").defaultMode, "code");
});

test("grounded query renders answer + citations + executes a validated highlight (E2E)", async () => {
  const { session_id, scene } = await loadScene("data-science-v1");
  const view = new MockView();
  const app = new ShadowSpatialApp({ client: new SpatialAgentClient({ fetchImpl: handlerFetch() }), view });
  const out = await app.runQuery({ session_id, profile: "data-science-v1", scene, query: "show the source supporting the first finding" });
  assert.equal(out.state, FlowState.DONE);
  assert.ok(out.response!.citations.length >= 1);
  assert.ok(out.records.some((r) => r.execution_status === ExecStatus.EXECUTED));
  assert.match(out.lastAction, /EXECUTED/);
  assert.ok(view.highlighted, "a source should be visibly highlighted");
});

test("ungrounded query executes NO action and reports UNGROUNDED", async () => {
  const { session_id, scene } = await loadScene("data-science-v1");
  const view = new MockView();
  const app = new ShadowSpatialApp({ client: new SpatialAgentClient({ fetchImpl: handlerFetch() }), view });
  const out = await app.runQuery({ session_id, profile: "data-science-v1", scene, query: "what is the meaning of life" });
  assert.equal(out.state, FlowState.UNGROUNDED);
  assert.equal(out.records.length, 0);
  assert.equal(view.highlighted, null);
});

test("backend unavailable → FAILED", async () => {
  const failFetch = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  const view = new MockView();
  const app = new ShadowSpatialApp({ client: new SpatialAgentClient({ fetchImpl: failFetch }), view });
  const out = await app.runQuery({ session_id: "x", profile: "data-science-v1", scene: { objects: [] } as any, query: "verify" });
  assert.equal(out.state, FlowState.FAILED);
});

test("malformed response → FAILED", async () => {
  const badFetch = (async () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }) })) as unknown as typeof fetch;
  const app = new ShadowSpatialApp({ client: new SpatialAgentClient({ fetchImpl: badFetch }), view: new MockView() });
  const out = await app.runQuery({ session_id: "x", profile: "data-science-v1", scene: { objects: [] } as any, query: "verify" });
  assert.equal(out.state, FlowState.FAILED);
});

test("executor: unknown action REJECTED; unknown id TARGET_NOT_FOUND; unsupported UNSUPPORTED_BY_CLIENT; render fail RENDER_FAILED", () => {
  const scene: SceneGraph = { scene_version: "v", session_id: "s", profile_id: "data-science-v1", objects: [{ id: "metric_auc", type: "metric", label: "AUC" }], relations: [] };
  const view = new MockView();
  const ex = new SpatialActionExecutor(view);
  assert.equal(ex.execute({ name: "eval_js", args: {} }, scene).execution_status, ExecStatus.REJECTED);
  assert.equal(ex.execute({ name: "highlight_metric", args: { object_id: "ghost" } }, scene).execution_status, ExecStatus.TARGET_NOT_FOUND);
  view.unsupported.add("open_audit_mode");
  assert.equal(ex.execute({ name: "open_audit_mode", args: {} }, scene).execution_status, ExecStatus.UNSUPPORTED_BY_CLIENT);
  const failView = new MockView(); failView.highlight = () => false; // no visible change
  assert.equal(new SpatialActionExecutor(failView).execute({ name: "highlight_metric", args: { object_id: "metric_auc" } }, scene).execution_status, ExecStatus.RENDER_FAILED);
});

test("execution reporter records only material events with confirmation fields", () => {
  const rep = new ActionExecutionReporter({ now: () => 123, platform: "web" });
  const ev = rep.build("s", "q1", { requested_action: "highlight_source", target_object_id: "metric_auc", validation_status: "valid", execution_status: ExecStatus.EXECUTED, visible_result: true, error_code: null });
  assert.equal(ev.execution_status, "EXECUTED");
  assert.equal(ev.visible_result, true);
  assert.equal(ev.timestamp, 123);
});

test("screenshot is disabled by default (not sent unless enabled)", async () => {
  let sentBody: any = null;
  const okResp = { ok: true, status: 200, json: async () => ({ text: "x", actions: [], citations: [], grounded: true, model: "m", latency_ms: 1, verification_summary: null }) };
  const spyFetch = (async (_u: string, init: RequestInit) => { sentBody = JSON.parse(String(init.body)); return okResp; }) as unknown as typeof fetch;
  const client = new SpatialAgentClient({ fetchImpl: spyFetch });
  await client.ask({ session_id: "s", query: "verify", profile: "data-science-v1", screenshot: { included: false, base64: "AAAA" } });
  assert.equal(sentBody.screenshot_base64, undefined);
  await client.ask({ session_id: "s", query: "verify", profile: "data-science-v1", screenshot: { included: true, base64: "AAAA" } });
  assert.equal(sentBody.screenshot_base64, "AAAA");
});

// ── the three required end-to-end questions (deterministic) ──
test("E2E · banking-style: 'show the source supporting the highest-risk finding'", async () => {
  const { session_id, scene } = await loadScene("data-science-v1"); // ds scene has metric sources + claims
  const view = new MockView();
  const app = new ShadowSpatialApp({ client: new SpatialAgentClient({ fetchImpl: handlerFetch() }), view });
  const out = await app.runQuery({ session_id, profile: "data-science-v1", scene, query: "show the source supporting the finding" });
  assert.equal(out.response!.grounded, true);
  assert.ok(out.records.some((r) => r.requested_action === "highlight_source" && r.execution_status === ExecStatus.EXECUTED));
});

test("E2E · verify: deterministic command hits the real verifier", async () => {
  const { session_id, scene } = await loadScene("coding-agent-v1");
  const view = new MockView();
  const app = new ShadowSpatialApp({ client: new SpatialAgentClient({ fetchImpl: handlerFetch() }), view });
  const out = await app.runQuery({ session_id, profile: "coding-agent-v1", scene, query: "verify this record" });
  assert.equal(out.response!.verification_summary!.record_integrity, "verified");
});

test("E2E · reset restores default workspace", async () => {
  const { session_id, scene } = await loadScene("data-science-v1");
  const view = new MockView();
  const app = new ShadowSpatialApp({ client: new SpatialAgentClient({ fetchImpl: handlerFetch() }), view });
  await app.runQuery({ session_id, profile: "data-science-v1", scene, query: "open audit mode" });
  app.reset();
  assert.equal(app.state, FlowState.READY);
  assert.equal(view.mode, "document");
});
