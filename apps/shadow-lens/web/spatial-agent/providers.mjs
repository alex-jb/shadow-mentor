// apps/shadow-lens/web/spatial-agent/providers.mjs
// §11 — the model provider adapter. The endpoint resolves ONE provider; the fixture provider is
// the deterministic fallback and is never silently replaced by the live one. The live provider is
// enabled ONLY by explicit env config, holds no key in the client (the server injects the LLM),
// constrains output to the closed tools/actions, rejects unknown source_ids/actions, records the
// model id + prompt hash, and times out. Verification NEVER goes through a model (the deterministic
// command path owns the real verifier).
import crypto from "node:crypto";
import { runServerTool } from "./server-tools.mjs";
import { validateActions } from "./client-actions.mjs";

export const ProviderKind = Object.freeze({ FIXTURE: "FIXTURE MODEL", LIVE: "LIVE MODEL", UNAVAILABLE: "MODEL UNAVAILABLE" });

const promptHash = (q) => "sha256:" + crypto.createHash("sha256").update(String(q ?? "")).digest("hex");

// Find a source the query references — deterministic, never invents an id (moved from agent-core).
function firstReferencedSource(session, query) {
  const q = String(query ?? "").toLowerCase();
  for (const e of session?.source_map ?? []) if (q.includes(e.source_id.toLowerCase())) return e.source_id;
  if (/first (finding|claim)|the finding|highest.risk/.test(q)) {
    const c = (session?.claims ?? []).find((x) => x.validation_status === "source_bound");
    if (c?.source_ids?.length) return c.source_ids[0];
  }
  for (const e of session?.source_map ?? []) {
    const kw = (e.text ?? e.content ?? "").toLowerCase().split(/[\s:]+/).filter((w) => w.length > 3);
    if (kw.some((w) => q.includes(w))) return e.source_id;
  }
  return null;
}

// ── FIXTURE (deterministic, offline) — the default + fallback ──
export class FixtureSpatialAgentProvider {
  get kind() { return ProviderKind.FIXTURE; }
  async resolveGrounded({ session, scene, query }) {
    const src = firstReferencedSource(session, query);
    if (!src) return { grounded: false, text: "", citations: [], actions: [], model: "deterministic-fixture", prompt_hash: promptHash(query) };
    const r = runServerTool("resolve_source", { source_id: src }, session);
    if (!r.ok) return { grounded: false, text: "", citations: [], actions: [], model: "deterministic-fixture", prompt_hash: promptHash(query) };
    const actions = validateActions([{ name: "open_source_mode", args: {} }, { name: "highlight_source", args: { source_id: r.source_id } }], scene).valid;
    return {
      grounded: true, model: "deterministic-fixture", prompt_hash: promptHash(query),
      text: `Source ${r.source_id}: "${r.quote}" (confidence ${r.confidence ?? "n/a"}). Supports ${r.related_claim_ids.join(", ") || "no claim"}.`,
      citations: [{ source_id: r.source_id, evidence_sequence: null, quote: r.quote }], actions,
    };
  }
}

// ── LIVE (explicit env only; server-injected LLM; strict validation) ──
export class LiveSpatialAgentProvider {
  constructor({ llm, model = "live", timeoutMs = 15000 } = {}) { this.llm = llm; this.model = model; this.timeoutMs = timeoutMs; }
  get kind() { return ProviderKind.LIVE; }

  async resolveGrounded({ session, scene, query }) {
    const ph = promptHash(query);
    const ids = new Set((session?.source_map ?? []).map((e) => e.source_id));
    const system =
      "Answer ONLY from the provided evidence. Cite source_id values that exist. Output strict JSON: " +
      '{"text":str,"citations":[{"source_id":str,"quote":str}],"actions":[{"name":str,"args":{}}]}. ' +
      "Actions may only be from the allowed set; never invent source_ids.";
    const fenced = (session?.source_map ?? []).map((e) => `${e.source_id}: ${e.text ?? e.content ?? ""}`).join("\n");

    let raw;
    try {
      raw = await withTimeout(this.llm(system, fenced + "\n\nQUESTION: " + query), this.timeoutMs);
    } catch (e) {
      return { grounded: false, text: `live model error: ${String(e?.message ?? e)}`, citations: [], actions: [], model: this.model, prompt_hash: ph };
    }
    let out = raw;
    if (typeof raw === "string") { try { out = JSON.parse(raw); } catch { return { grounded: false, text: "live model returned non-JSON", citations: [], actions: [], model: this.model, prompt_hash: ph }; } }

    // validate citations against the REAL source map — unknown ids are dropped (never rendered)
    const citations = (out?.citations ?? []).filter((c) => c && ids.has(c.source_id)).map((c) => ({ source_id: c.source_id, evidence_sequence: null, quote: String(c.quote ?? "") }));
    // validate actions against the closed allowlist + the real scene
    const actions = validateActions(out?.actions ?? [], scene).valid;
    const grounded = citations.length > 0; // factual answer requires a real citation
    return { grounded, text: String(out?.text ?? ""), citations, actions, model: this.model, prompt_hash: ph };
  }
}

// ── UNAVAILABLE (live requested but not configured — honest, no fake success) ──
export class UnavailableSpatialAgentProvider {
  get kind() { return ProviderKind.UNAVAILABLE; }
  async resolveGrounded({ query }) {
    return { grounded: false, text: "live model not configured; fixture mode available", citations: [], actions: [], model: "unavailable", prompt_hash: promptHash(query) };
  }
}

// Resolve the provider from env. NEVER silently switches fixture→live: live requires
// SHADOW_LENS_LIVE_MODEL=1. If live is requested but no LLM is injected/configured → UNAVAILABLE.
export function resolveProvider({ env = process.env, llm = null } = {}) {
  const wantsLive = env.SHADOW_LENS_LIVE_MODEL === "1";
  if (!wantsLive) return new FixtureSpatialAgentProvider();
  if (!llm) return new UnavailableSpatialAgentProvider();
  return new LiveSpatialAgentProvider({ llm, model: env.SHADOW_LENS_LIVE_MODEL_ID || "live" });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(promise).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
