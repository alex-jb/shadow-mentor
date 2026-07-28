// apps/shadow-lens/web/spatial-agent/server-tools.mjs
// §5 — Closed server-side tool allowlist for the spatial agent. Every tool operates on the
// REAL signed session; every returned id is validated against it. verify_bundle invokes the
// REAL Shadow verifier — an LLM is NEVER asked whether a bundle is valid. No hidden
// chain-of-thought is returned: only concise stored fields.
import { verifyBundle } from "../../../../packages/attest-core/session.js";

export const SERVER_TOOLS = [
  "find_claim", "find_source", "resolve_source", "describe_session", "describe_risk",
  "compare_reviewers", "find_audit_event", "verify_bundle", "get_verification_failure",
  "get_profile_summary",
];

const err = (m) => ({ ok: false, error: m });
const claimsOf = (s) => s?.claims ?? [];
const sourcesOf = (s) => s?.source_map ?? [];

// Run a server tool by name against a session. `ctx` carries {bundle, publicKeyPem} for verify.
export function runServerTool(name, args = {}, session, ctx = {}) {
  if (!SERVER_TOOLS.includes(name)) return err(`unknown server tool ${name}`);
  const q = String(args.query ?? "").toLowerCase();

  switch (name) {
    case "find_claim": {
      const hits = claimsOf(session).filter((c) => (c.claim_id + " " + (c.text ?? "")).toLowerCase().includes(q));
      return { ok: true, claims: hits.map((c) => ({ claim_id: c.claim_id, text: c.text, validation_status: c.validation_status, source_ids: c.source_ids ?? [] })) };
    }
    case "find_source": {
      const hits = sourcesOf(session).filter((e) => (e.source_id + " " + (e.text ?? e.content ?? "")).toLowerCase().includes(q));
      return { ok: true, sources: hits.map((e) => ({ source_id: e.source_id, preview: e.text ?? e.content })) };
    }
    case "resolve_source": {
      const e = sourcesOf(session).find((x) => x.source_id === args.source_id);
      if (!e) return err(`unknown source_id ${args.source_id}`);
      const related = claimsOf(session).filter((c) => (c.source_ids ?? []).includes(e.source_id)).map((c) => c.claim_id);
      return { ok: true, source_id: e.source_id, quote: e.text ?? e.content ?? "", confidence: e.confidence ?? null, bounding_box: e.bounding_box_normalized ?? null, related_claim_ids: related };
    }
    case "describe_session":
      return { ok: true, session_id: session?.session_id, profile: session?.profile?.name ?? "generic",
        source_count: sourcesOf(session).length, claim_count: claimsOf(session).length,
        record_integrity: session?.verification?.record_integrity };
    case "describe_risk": {
      const sev = { info: 0.1, ok: 0.2, warn: 0.6, bad: 0.85, critical: 1.0 };
      const risks = claimsOf(session).filter((c) => c.validation_status === "source_bound")
        .map((c) => ({ claim_id: c.claim_id, severity: c.severity ?? null, risk: sev[c.severity] ?? 0.5, source_ids: c.source_ids ?? [] }))
        .sort((a, b) => b.risk - a.risk);
      return { ok: true, risks };
    }
    case "compare_reviewers":
      return { ok: true, reviewers: (session?.reviewers ?? []).map((r) => ({
        reviewer_id: r.reviewer_id, stance: r.decision, override_rationale: r.override_rationale ?? null })) };
    case "find_audit_event": {
      const stage = String(args.stage ?? q).toLowerCase();
      const known = ["capture", "ocr", "sources", "claims", "reviewers", "human", "signature", "verify",
        "dataset", "features", "candidates", "evaluation", "selected", "issue", "commands", "diffs", "tests", "security", "commit"];
      return known.includes(stage) ? { ok: true, stage } : err(`unknown audit stage ${stage}`);
    }
    case "verify_bundle": {
      if (!ctx.bundle || !ctx.publicKeyPem) return err("no bundle/key available to verify");
      const v = verifyBundle(ctx.bundle, { publicKey: ctx.publicKeyPem }); // REAL verifier, not an LLM
      return { ok: true, verified: v.ok, failed_seq: v.ok ? null : (v.failedSeq ?? v.error?.seq ?? null), reason: v.ok ? null : (v.reason ?? v.error?.reason ?? "broken") };
    }
    case "get_verification_failure": {
      const rv = session?.verification;
      if (rv?.record_integrity !== "failed") return { ok: true, failed: false };
      return { ok: true, failed: true, failed_seq: rv.failed_seq ?? null, reason: rv.failure_reason ?? null };
    }
    case "get_profile_summary": {
      const d = session?.profile?.data ?? {};
      return { ok: true, profile: session?.profile?.name ?? "generic",
        keys: Object.keys(d), selected_model: d.selected_model ?? null, final_commit: d.final_commit ?? null };
    }
  }
}
