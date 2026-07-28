// apps/shadow-lens/web/spatial-agent/src/app/ActionExecutionReporter.ts
// §7 — Reports MATERIAL execution events back to the evidence layer (client confirmation of what
// actually rendered). Records only material actions — never continuous camera frames or
// mouse/gaze telemetry. fetch + clock injectable → testable.
import type { ExecutionRecord } from "./types.ts";

export interface ExecutionEvent {
  session_id: string; query_id: string; requested_action: string;
  validation_status: string; execution_status: string; target_object_id: string | null;
  visible_result: boolean; error_code: string | null; client_platform: string; timestamp: number;
}

export class ActionExecutionReporter {
  private opts: { baseUrl?: string; fetchImpl?: typeof fetch; platform?: string; now?: () => number };
  constructor(opts: { baseUrl?: string; fetchImpl?: typeof fetch; platform?: string; now?: () => number } = {}) { this.opts = opts; }

  build(session_id: string, query_id: string, rec: ExecutionRecord): ExecutionEvent {
    return {
      session_id, query_id, requested_action: rec.requested_action,
      validation_status: rec.validation_status, execution_status: rec.execution_status,
      target_object_id: rec.target_object_id, visible_result: rec.visible_result,
      error_code: rec.error_code, client_platform: this.opts.platform ?? "web",
      timestamp: (this.opts.now ?? (() => 0))(),
    };
  }

  // Only material actions are reported; a no-op/telemetry record is dropped.
  async report(session_id: string, query_id: string, records: ExecutionRecord[]): Promise<ExecutionEvent[]> {
    const material = records.filter((r) => r.requested_action && r.requested_action !== "?");
    const events = material.map((r) => this.build(session_id, query_id, r));
    const f = this.opts.fetchImpl;
    if (f && events.length) {
      try {
        await f(`${this.opts.baseUrl ?? ""}/api/shadow-lens/execution-events`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }),
        });
      } catch { /* reporting is best-effort; never blocks the UI */ }
    }
    return events;
  }
}
