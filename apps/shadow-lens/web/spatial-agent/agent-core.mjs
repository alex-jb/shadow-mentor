// apps/shadow-lens/web/spatial-agent/agent-core.mjs
// §10 deterministic routing + the grounded agent core. Two paths:
//  A) deterministic commands (show sources / show audit / verify / reset / risks / review /
//     document) bypass the LLM entirely and use the closed command → mode/action mapping.
//  B) grounded questions resolve against the REAL session via server tools, producing citations
//     (source_id + quote) and VALIDATED client actions. Verification answers ALWAYS come from
//     the real verifier. When an answer can't be grounded, it returns honestly with NO actions.
// Document/scene text + the query are UNTRUSTED — they can never change tool routing (the
// routing vocabulary is a fixed closed set, not model-chosen).
import { runServerTool } from "./server-tools.mjs";
import { validateActions } from "./client-actions.mjs";
import { FixtureSpatialAgentProvider } from "./providers.mjs";

const DET = [
  { re: /\b(show|open)\s+sources?\b|source mode/, mode: "source", cmd: "SHOW_SOURCE" },
  { re: /\b(show|open)\s+audit\b|audit mode/, mode: "audit", cmd: "SHOW_AUDIT" },
  { re: /\b(show|open)\s+risks?\b|risk mode/, mode: "risk", cmd: "SHOW_RISK" },
  { re: /\b(show|open)\s+review\b|council|review mode/, mode: "review", cmd: "SHOW_REVIEW" },
  { re: /\bverify\b/, mode: null, cmd: "VERIFY" },
  { re: /\breset\b|return to (work|document)/, mode: "document", cmd: "RESET" },
  { re: /\b(show|open)\s+document\b|document mode/, mode: "document", cmd: "DOCUMENT" },
];

export function routeDeterministic(query) {
  const q = String(query ?? "").toLowerCase();
  for (const d of DET) if (d.re.test(q)) return d;
  return null;
}

const modeAction = (mode) => ({ document: "open_document_mode", source: "open_source_mode", risk: "open_risk_mode", review: "open_review_mode", audit: "open_audit_mode" }[mode]);

/**
 * @param {object} p - { session, scene, bundle, publicKeyPem, query, current_mode, provider? }
 *   provider (optional) resolves grounded questions; defaults to the deterministic FIXTURE provider.
 *   The deterministic command path (verify/show X) NEVER uses a model.
 * @returns {Promise<{text, citations, actions, verification_summary, grounded, model}>}
 */
export async function runSpatialAgent(p) {
  const { session, scene, query } = p;
  const out = { text: "", citations: [], actions: [], verification_summary: null, grounded: false, model: "deterministic" };

  const det = routeDeterministic(query);
  if (det) {
    if (det.cmd === "VERIFY") {
      const v = runServerTool("verify_bundle", {}, session, p);
      out.verification_summary = v.ok ? { record_integrity: v.verified ? "verified" : "failed", failed_seq: v.failed_seq, reason: v.reason } : null;
      out.text = v.ok ? (v.verified ? "Record integrity verified against the signed bundle." : `Verification FAILED at sequence ${v.failed_seq}: ${v.reason}.`) : "No bundle available to verify.";
      out.grounded = true; // comes from the real verifier
      out.actions = det ? [] : [];
      return out;
    }
    const acts = [{ name: modeAction(det.mode), args: {} }];
    out.actions = validateActions(acts, scene).valid;
    out.text = `Switched to ${det.mode} mode.`;
    out.grounded = true; // structural command, no factual claim to cite
    return out;
  }

  // Grounded question path — delegated to the resolved provider (FIXTURE by default; LIVE only via
  // explicit env). The provider is constrained to the same tools + validation; citations must cite
  // real source_ids and actions are validated against the scene. No silent fixture→live switch.
  const provider = p.provider ?? new FixtureSpatialAgentProvider();
  const g = await provider.resolveGrounded({ session, scene, query });
  out.model = g.model ?? out.model;
  if (g.grounded) {
    out.grounded = true;
    out.text = g.text;
    out.citations = g.citations ?? [];
    // re-validate the provider's actions against the scene at THIS boundary too (defense in depth)
    out.actions = validateActions(g.actions ?? [], scene).valid;
    return out;
  }

  // Cannot ground → honest, no spatial/destructive actions.
  out.text = g.text || "I can't ground that in this session's evidence. Try naming a source or claim, or use Show Sources / Show Audit / Verify.";
  out.grounded = false;
  out.actions = [];
  return out;
}
