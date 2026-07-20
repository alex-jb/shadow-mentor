// apps/shadow-lens/web/spatial-agent/src/app/SessionLoader.ts
// Loads a REAL signed demonstration session + its server-built scene graph (source of truth).
// The scene comes from the server, not invented client-side. fetch is injectable → testable.
import type { SceneGraph } from "./types.ts";

export interface LoadedSession { session_id: string; profile: string; scene: SceneGraph; verification: unknown; }

export class SessionLoader {
  private opts: { baseUrl?: string; fetchImpl?: typeof fetch };
  constructor(opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {}) { this.opts = opts; }

  async load(profile: string): Promise<{ ok: true; loaded: LoadedSession } | { ok: false; error: string }> {
    const f = this.opts.fetchImpl ?? (globalThis.fetch as typeof fetch);
    let res: Response;
    try {
      res = await f(`${this.opts.baseUrl ?? ""}/api/shadow-lens/spatial-agent`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ load: true, profile }),
      });
    } catch (e) { return { ok: false, error: `backend unavailable: ${String((e as Error)?.message ?? e)}` }; }
    if (!res.ok) return { ok: false, error: `load HTTP ${res.status}` };
    let data: LoadedSession;
    try { data = (await res.json()) as LoadedSession; } catch { return { ok: false, error: "malformed load response" }; }
    if (!data?.scene?.objects) return { ok: false, error: "load response missing scene" };
    return { ok: true, loaded: data };
  }
}
