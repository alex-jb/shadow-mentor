// apps/shadow-lens/web/spatial-agent/src/app/SpatialAgentClient.ts
// Posts a grounded query to the hardened /api/shadow-lens/spatial-agent endpoint and validates
// the response shape. fetch is injectable → testable without a server. Screenshot is included
// ONLY when explicitly enabled (§6); default off.
import type { AgentResponse } from "./types.ts";

export interface SpatialAgentClientOpts {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class SpatialAgentClient {
  private baseUrl: string;
  private fetchImpl: typeof fetch;
  private timeoutMs: number;
  constructor(o: SpatialAgentClientOpts = {}) {
    this.baseUrl = o.baseUrl ?? "";
    this.fetchImpl = o.fetchImpl ?? (globalThis.fetch as typeof fetch);
    this.timeoutMs = o.timeoutMs ?? 15000;
  }

  async ask(params: {
    session_id: string; query: string; profile: string;
    current_mode?: string; selected_object_id?: string;
    screenshot?: { included: boolean; base64?: string; sha256?: string };
    client_capabilities?: string[];
  }): Promise<{ ok: true; response: AgentResponse } | { ok: false; error: string; status?: number }> {
    if (!params.query || !params.query.trim()) return { ok: false, error: "empty query" };
    const body: Record<string, unknown> = {
      session_id: params.session_id, query: params.query, profile: params.profile,
      current_mode: params.current_mode, selected_object_id: params.selected_object_id,
      client_capabilities: params.client_capabilities,
    };
    // §6 — only attach the screenshot when explicitly enabled.
    if (params.screenshot?.included && params.screenshot.base64) body.screenshot_base64 = params.screenshot.base64;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/api/shadow-lens/spatial-agent`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: ctrl.signal,
      });
    } catch (e) {
      return { ok: false, error: `backend unavailable: ${String((e as Error)?.message ?? e)}` };
    } finally { clearTimeout(timer); }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json())?.error ?? msg; } catch { /* ignore */ }
      return { ok: false, error: msg, status: res.status };
    }
    let data: AgentResponse;
    try { data = (await res.json()) as AgentResponse; } catch { return { ok: false, error: "malformed response (not JSON)" }; }
    if (typeof data?.text !== "string" || !Array.isArray(data?.actions) || !Array.isArray(data?.citations)) {
      return { ok: false, error: "malformed response (missing text/actions/citations)" };
    }
    return { ok: true, response: data };
  }
}
