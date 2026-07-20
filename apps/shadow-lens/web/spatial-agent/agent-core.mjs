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
 * @param {object} p - { session, scene, bundle, publicKeyPem, query, current_mode }
 * @returns {{text, citations, actions, verification_summary, grounded, model}}
 */
export function runSpatialAgent(p) {
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

  // Grounded question path (fixture/offline heuristic — a live LLM would slot in here, still
  // constrained to the same tools + validation). Resolve a source/claim the query references.
  const src = firstReferencedSource(session, query);
  if (src) {
    const r = runServerTool("resolve_source", { source_id: src }, session, p);
    if (r.ok) {
      out.citations = [{ source_id: r.source_id, evidence_sequence: null, quote: r.quote }];
      out.text = `Source ${r.source_id}: "${r.quote}" (confidence ${r.confidence ?? "n/a"}). Supports ${r.related_claim_ids.join(", ") || "no claim"}.`;
      out.actions = validateActions([{ name: "open_source_mode", args: {} }, { name: "highlight_source", args: { source_id: r.source_id } }], scene).valid;
      out.grounded = true;
      return out;
    }
  }

  // Cannot ground → honest, no spatial/destructive actions.
  out.text = "I can't ground that in this session's evidence. Try naming a source or claim, or use Show Sources / Show Audit / Verify.";
  out.grounded = false;
  out.actions = [];
  return out;
}

// Find a source the query references — by explicit source_id, or by a claim it names. Never
// invents an id; only returns ids present in the session.
function firstReferencedSource(session, query) {
  const q = String(query ?? "").toLowerCase();
  for (const e of session?.source_map ?? []) if (q.includes(e.source_id.toLowerCase())) return e.source_id;
  // "first finding / first claim" → the first source-bound claim's first cited source
  if (/first (finding|claim)|the finding/.test(q)) {
    const c = (session?.claims ?? []).find((x) => x.validation_status === "source_bound");
    if (c?.source_ids?.length) return c.source_ids[0];
  }
  // match a source by a keyword in its text (e.g. "DTI")
  for (const e of session?.source_map ?? []) {
    const kw = (e.text ?? e.content ?? "").toLowerCase().split(/[\s:]+/).filter((w) => w.length > 3);
    if (kw.some((w) => q.includes(w))) return e.source_id;
  }
  return null;
}
