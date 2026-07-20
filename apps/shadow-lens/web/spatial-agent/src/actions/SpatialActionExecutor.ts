// apps/shadow-lens/web/spatial-agent/src/actions/SpatialActionExecutor.ts
// §3 — Executes a validated client action against a SpatialView and returns an HONEST status:
// EXECUTED / REJECTED / TARGET_NOT_FOUND / UNSUPPORTED_BY_CLIENT / RENDER_FAILED. No silent
// no-op. Re-validates on the client (never trusts the server's request) using the SHARED
// client-actions registry — no duplicated action schema.
import { validateAction } from "../../client-actions.mjs";
import { ExecStatus } from "../app/types.ts";
import type { AgentAction, SceneGraph, SpatialView, ExecStatusT, ExecutionRecord } from "../app/types.ts";

const modeFor: Record<string, string> = {
  open_document_mode: "document", open_source_mode: "source", open_risk_mode: "risk",
  open_review_mode: "review", open_audit_mode: "audit", open_experiment_mode: "experiment",
  open_code_replay_mode: "code",
};
const walkFor: Record<string, string> = {
  start_audit_walkthrough: "audit", start_experiment_walkthrough: "experiment", start_code_walkthrough: "code",
};

export class SpatialActionExecutor {
  private view: SpatialView;
  constructor(view: SpatialView) { this.view = view; }

  execute(action: AgentAction, scene: SceneGraph): ExecutionRecord {
    const targetId = action?.args?.object_id ?? action?.args?.source_id ?? action?.args?.claim_id ?? null;
    const rec: ExecutionRecord = {
      requested_action: action?.name ?? "?", target_object_id: targetId,
      validation_status: "pending", execution_status: ExecStatus.REJECTED, visible_result: false, error_code: null,
    };

    // 1 — re-validate on the client against the REAL scene graph.
    const v = validateAction(action, scene) as { ok: boolean; code: string; error?: string };
    rec.validation_status = v.ok ? "valid" : v.code;
    if (!v.ok) {
      rec.execution_status = v.code === "target_not_found" ? ExecStatus.TARGET_NOT_FOUND : ExecStatus.REJECTED;
      rec.error_code = v.error ?? v.code;
      return rec;
    }

    // 2 — capability check.
    if (!this.view.supports(action.name)) {
      rec.execution_status = ExecStatus.UNSUPPORTED_BY_CLIENT;
      rec.error_code = "unsupported_by_client";
      return rec;
    }

    // 3 — perform the visible change; a throw or a false return is honest, never a silent pass.
    try {
      rec.visible_result = this.perform(action);
      rec.execution_status = rec.visible_result ? ExecStatus.EXECUTED : ExecStatus.RENDER_FAILED;
      if (!rec.visible_result) rec.error_code = "no_visible_change";
    } catch (e) {
      rec.execution_status = ExecStatus.RENDER_FAILED;
      rec.error_code = String((e as Error)?.message ?? e);
    }
    return rec;
  }

  private perform(a: AgentAction): boolean {
    const n = a.name;
    if (n in modeFor) return this.view.setMode(modeFor[n]);
    if (n in walkFor) return this.view.startWalkthrough(walkFor[n]);
    switch (n) {
      case "select_object": return this.view.selectObject(a.args.object_id);
      case "focus_object": return this.view.focusObject(a.args.object_id);
      case "move_camera_to_object": return this.view.moveCameraTo(a.args.object_id);
      case "highlight_source": return this.view.highlight(a.args.source_id);
      case "highlight_claim": return this.view.highlight(a.args.claim_id);
      case "highlight_metric": return this.view.highlight(a.args.object_id);
      case "show_tamper_diff": return this.view.showTamperDiff();
      case "show_verification_failure": return this.view.showVerificationFailure();
      case "return_to_workspace": return this.view.returnToWorkspace();
      case "clear_selection": return this.view.clearSelection();
      default: return false;
    }
  }

  // Execute a list sequentially → per-action records + an overall DONE/PARTIAL/FAILED verdict.
  executeAll(actions: AgentAction[], scene: SceneGraph): { records: ExecutionRecord[]; verdict: ExecStatusT | "DONE" | "PARTIAL" | "FAILED" } {
    const records = (actions ?? []).map((a) => this.execute(a, scene));
    const executed = records.filter((r) => r.execution_status === ExecStatus.EXECUTED).length;
    let verdict: "DONE" | "PARTIAL" | "FAILED" = "DONE";
    if (records.length === 0) verdict = "DONE";
    else if (executed === 0) verdict = "FAILED";
    else if (executed < records.length) verdict = "PARTIAL";
    return { records, verdict };
  }
}
