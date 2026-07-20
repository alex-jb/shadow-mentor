// apps/shadow-lens/web/spatial-agent/src/main.ts
// Browser entry: wires SessionLoader → SceneGraphRenderer (SpatialView) → ShadowSpatialApp
// (the tested query flow) → InstitutionalUI. AUTHORED for the browser — the flow logic it drives
// is covered by src/tests/spatial-client.test.ts; this file is the thin DOM/Three wiring.
import { SessionLoader } from "./app/SessionLoader.ts";
import { SpatialAgentClient } from "./app/SpatialAgentClient.ts";
import { ShadowSpatialApp } from "./app/ShadowSpatialApp.ts";
import { ActionExecutionReporter } from "./app/ActionExecutionReporter.ts";
import { SceneGraphRenderer } from "./scene/SceneGraphRenderer.ts";
import { InstitutionalUI } from "./ui/InstitutionalUI.ts";
import { workspaceFor } from "./profiles/workspaces.ts";
import type { SceneGraph } from "./app/types.ts";

async function boot(profile: string, mount: HTMLElement) {
  mount.innerHTML = "";
  const ui = new InstitutionalUI(mount);
  const canvasHost = document.createElement("div");
  canvasHost.style.cssText = "position:absolute;inset:0;z-index:-1";
  mount.appendChild(canvasHost);

  ui.setState("QUERYING");
  const loaded = await new SessionLoader().load(profile);
  if (!loaded.ok) { ui.setState(`FAILED — ${loaded.error}`); return; }
  const scene: SceneGraph = loaded.loaded.scene;

  const renderer = new SceneGraphRenderer(canvasHost, scene);
  const app = new ShadowSpatialApp({
    client: new SpatialAgentClient(),
    view: renderer,
    reporter: new ActionExecutionReporter({ fetchImpl: fetch, platform: "web", now: () => Date.now() }),
    onState: (s) => ui.setState(s),
  });

  const ws = workspaceFor(loaded.loaded.profile);
  ui.setResult(`${ws.title} — ${scene.objects.length} evidence objects`);
  ui.setTrust({
    "RECORD INTEGRITY": String((loaded.loaded.verification as any)?.record_integrity ?? "unknown"),
    "SOURCE COVERAGE": `${(loaded.loaded.verification as any)?.source_coverage_pct ?? "—"}%`,
    "ANALYSIS CONFIDENCE": "not tested", "HUMAN REVIEW": String((loaded.loaded.verification as any)?.human_review ?? "pending"),
    "DATA FRESHNESS": "—", "EXTERNAL ANCHOR": "none",
  });
  ui.setState("READY");

  const run = async (query: string) => {
    ui.clearAnswer();
    const out = await app.runQuery({ session_id: loaded.loaded.session_id, profile: loaded.loaded.profile, scene, query });
    if (out.response) ui.showAnswer(out.response);
    ui.setLastAction(out.lastAction);
    ui.setState(out.state);
  };
  ui.onQuery = run;
  ui.onCommand = run;      // deterministic commands go through the same endpoint (server routes them)
  ui.onProfile = (p) => boot(p, mount);
}

const mount = document.getElementById("app")!;
boot("data-science-v1", mount);
