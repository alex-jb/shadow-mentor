// apps/shadow-lens/web/spatial-agent/src/app/ShadowSpatialApp.ts
// §2 — The complete query flow as an explicit state machine:
// READY → QUERYING → ANSWER RECEIVED → VALIDATING ACTION → EXECUTING ACTION → DONE/PARTIAL/FAILED,
// or UNGROUNDED (no actions), or FAILED (backend/malformed). Never reports an action complete just
// because the server requested it — the executor confirms each visible change. Rendering-agnostic
// (drives a SpatialView) so it's testable with mocks.
import { FlowState } from "./types.ts";
import type { FlowStateT, SceneGraph, AgentResponse, ExecutionRecord, SpatialView } from "./types.ts";
import { SpatialActionExecutor } from "../actions/SpatialActionExecutor.ts";
import { SpatialAgentClient } from "./SpatialAgentClient.ts";
import { ActionExecutionReporter } from "./ActionExecutionReporter.ts";
import { QuerySequenceStore } from "../../query-sequence.mjs";

export interface QueryOutcome {
  state: FlowStateT;
  response?: AgentResponse;
  records: ExecutionRecord[];
  verdict: string;
  lastAction: string; // "highlight_source — EXECUTED"
}

export class ShadowSpatialApp {
  state: FlowStateT = FlowState.READY;
  lastActionLine = "LAST ACTION: —";
  private executor: SpatialActionExecutor;
  private seq: QuerySequenceStore;
  private deps: {
    client: SpatialAgentClient;
    view: SpatialView;
    reporter?: ActionExecutionReporter;
    onState?: (s: FlowStateT) => void;
    sequenceStore?: QuerySequenceStore; // durable, recovered from execution events (§1)
  };

  constructor(deps: {
    client: SpatialAgentClient;
    view: SpatialView;
    reporter?: ActionExecutionReporter;
    onState?: (s: FlowStateT) => void;
    sequenceStore?: QuerySequenceStore;
  }) {
    this.deps = deps;
    this.executor = new SpatialActionExecutor(deps.view);
    this.seq = deps.sequenceStore ?? new QuerySequenceStore();
  }

  private set(s: FlowStateT) { this.state = s; this.deps.onState?.(s); }

  async runQuery(params: {
    session_id: string; profile: string; scene: SceneGraph; query: string;
    current_mode?: string; screenshotEnabled?: boolean; screenshot_base64?: string;
    client_capabilities?: string[];
  }): Promise<QueryOutcome> {
    const query_id = this.seq.issue(params.session_id); // <session_id>:q<sequence>, recovered from events
    const empty: QueryOutcome = { state: this.state, records: [], verdict: "FAILED", lastAction: this.lastActionLine };
    this.set(FlowState.QUERYING);

    const r = await this.deps.client.ask({
      session_id: params.session_id, query: params.query, profile: params.profile,
      current_mode: params.current_mode, client_capabilities: params.client_capabilities,
      screenshot: { included: !!params.screenshotEnabled, base64: params.screenshotEnabled ? params.screenshot_base64 : undefined },
    });
    if (!r.ok) { this.set(FlowState.FAILED); return { ...empty, state: FlowState.FAILED, verdict: "FAILED" }; }

    const response = r.response;
    this.set(FlowState.ANSWER_RECEIVED);
    if (!response.grounded) {
      this.set(FlowState.UNGROUNDED);
      return { state: FlowState.UNGROUNDED, response, records: [], verdict: "UNGROUNDED", lastAction: this.lastActionLine };
    }

    this.set(FlowState.VALIDATING_ACTION);
    this.set(FlowState.EXECUTING_ACTION);
    const { records, verdict } = this.executor.executeAll(response.actions, params.scene);

    if (this.deps.reporter) await this.deps.reporter.report(params.session_id, query_id, records);

    const last = records[records.length - 1];
    if (last) this.lastActionLine = `LAST ACTION: ${last.requested_action} — ${last.execution_status}`;

    const finalState: FlowStateT = verdict === "DONE" ? FlowState.DONE : verdict === "PARTIAL" ? FlowState.PARTIAL : FlowState.FAILED;
    this.set(finalState);
    return { state: finalState, response, records, verdict, lastAction: this.lastActionLine };
  }

  reset() { this.deps.view.returnToWorkspace(); this.set(FlowState.READY); this.lastActionLine = "LAST ACTION: —"; }
}
