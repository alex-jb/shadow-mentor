// apps/shadow-lens/flow/flow-presenter.mjs
// The Flow presentation boundary. Flow is a SEPARATE presentation layer, not a runtime dependency
// of the deterministic Mock demo. The offline presenter prepares + references the export locally and
// NEVER makes a network request; a future web/API presenter is behind an explicit feature flag and
// is the only one that may reach the network. Mirrored in Unity by IFlowPresenter (C#).
import { exportFlowContract } from "./flow-export-contract.mjs";

export const FlowHandoffState = Object.freeze({ PREPARED: "PREPARED", NOT_AVAILABLE: "NOT_AVAILABLE" });

// IFlowPresenter (shape): prepare(narrative) -> { state, title, case_id, export, network_used, explanation }

export class OfflineMockFlowPresenter {
  get kind() { return "offline-mock"; }
  // No network, no credentials. Prepares the dataset + a handoff state to DISPLAY on stage.
  prepare(narrative) {
    if (!narrative) return { state: FlowHandoffState.NOT_AVAILABLE, network_used: false, explanation: "no narrative to present" };
    const ex = exportFlowContract(narrative);
    return {
      state: FlowHandoffState.PREPARED,
      title: ex.title,
      case_id: ex.case_id,
      export: ex,
      network_used: false,
      explanation: "Flow dataset prepared offline. The full Flow spatial story is launched separately — this demo does not embed or fetch it.",
    };
  }
}

// Future live presenter — DISABLED unless an explicit feature flag is set. Never used by the Mock
// demo. Even here, it does not run without the flag (honest, no accidental network).
export class WebOrApiFlowPresenter {
  constructor({ enabled = false, fetchImpl = null, baseUrl = "" } = {}) { this.enabled = enabled; this.fetchImpl = fetchImpl; this.baseUrl = baseUrl; }
  get kind() { return "web-api"; }
  async prepare(narrative) {
    if (!this.enabled) return { state: FlowHandoffState.NOT_AVAILABLE, network_used: false, explanation: "live Flow presenter disabled (feature flag off)" };
    const ex = exportFlowContract(narrative);
    // a real implementation would POST ex to the Flow workspace API here (behind the flag).
    return { state: FlowHandoffState.PREPARED, title: ex.title, case_id: ex.case_id, export: ex, network_used: true, explanation: "live Flow presenter (feature-flagged)" };
  }
}

// Resolve the presenter. Default = offline. Live only with an explicit flag — no silent network.
export function resolveFlowPresenter({ live = false, fetchImpl = null } = {}) {
  return live ? new WebOrApiFlowPresenter({ enabled: true, fetchImpl }) : new OfflineMockFlowPresenter();
}
