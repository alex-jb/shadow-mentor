// apps/shadow-lens/web/spatial-agent/src/app/types.ts
// Shared types for the institutional web spatial client. Erasable-only TypeScript (no enums)
// so Node 24 can type-strip + run the tests directly. Const objects stand in for enums.

export const FlowState = {
  READY: "READY",
  QUERYING: "QUERYING",
  ANSWER_RECEIVED: "ANSWER RECEIVED",
  VALIDATING_ACTION: "VALIDATING ACTION",
  EXECUTING_ACTION: "EXECUTING ACTION",
  DONE: "DONE",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
  UNGROUNDED: "UNGROUNDED",
} as const;
export type FlowStateT = (typeof FlowState)[keyof typeof FlowState];

export const ExecStatus = {
  EXECUTED: "EXECUTED",
  REJECTED: "REJECTED",
  TARGET_NOT_FOUND: "TARGET_NOT_FOUND",
  UNSUPPORTED_BY_CLIENT: "UNSUPPORTED_BY_CLIENT",
  RENDER_FAILED: "RENDER_FAILED",
} as const;
export type ExecStatusT = (typeof ExecStatus)[keyof typeof ExecStatus];

export interface Citation { source_id: string; evidence_sequence: number | null; quote: string; }
export interface AgentAction { name: string; args: Record<string, string>; }
export interface AgentResponse {
  text: string;
  citations: Citation[];
  actions: AgentAction[];
  verification_summary: unknown | null;
  grounded: boolean;
  model: string;
  latency_ms: number;
}
export interface SceneObject { id: string; type: string; label: string; status?: string; }
export interface SceneGraph { scene_version: string; session_id: string; profile_id: string; objects: SceneObject[]; relations: unknown[]; }

// The rendering surface the executor drives. A real SceneGraphRenderer implements this over
// Three.js; tests use a mock. Every method returns whether a VISIBLE change happened.
export interface SpatialView {
  setMode(mode: string): boolean;
  selectObject(id: string): boolean;
  focusObject(id: string): boolean;
  highlight(id: string): boolean;
  moveCameraTo(id: string): boolean;
  startWalkthrough(kind: string): boolean;
  showTamperDiff(): boolean;
  showVerificationFailure(): boolean;
  returnToWorkspace(): boolean;
  clearSelection(): boolean;
  supports(action: string): boolean; // client capability check
}

export interface ExecutionRecord {
  requested_action: string;
  target_object_id: string | null;
  validation_status: string;
  execution_status: ExecStatusT;
  visible_result: boolean;
  error_code: string | null;
}
