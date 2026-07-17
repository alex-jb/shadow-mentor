// lib/evidence-packet.js
// Turn a verified Shadow evidence bundle + its Banking Evidence Profile
// conformance into an examiner-ready packet — the human-readable artifact a
// fair-lending examiner or internal-audit reviewer actually reads: one credit
// decision, the evidence it carries, each item's regulatory hook, and an honest
// conclusion about what the record does and does not establish.
import { checkBankingProfileV1 } from "./enforce-banking-profile.js";

const ICON = { present: "✓", missing: "✗", "n/a": "—", unknown: "·" };

/**
 * @param {object} bundle
 * @param {object} [opts]
 * @param {object} [opts.verified] — verifyBundle result (enables the integrity line)
 * @param {object} [opts.payloads] — {seq|payload_ref -> payload} for value-level checks
 * @returns {object} a structured examiner packet
 */
export function buildExaminerPacket(bundle, { verified = null, payloads = null } = {}) {
  const h = bundle.header || {};
  const profile = checkBankingProfileV1(bundle, { verified, payloads });
  const trust = verified?.trustLevel || (verified?.ok ? "SELF_SIGNED" : null);
  const integrity = verified == null ? "not checked (no public key supplied)"
    : verified.ok ? `verified (${trust})` : `FAILED — ${verified.error?.reason || verified.reason || "broken"}`;

  return {
    packet_version: "1.0",
    generated_from: "Shadow evidence bundle",
    decision: {
      session_id: h.session_id ?? null,
      agent: h.agent ? `${h.agent.name}@${h.agent.version}` : null,
      decided_at_utc: h.session_started_at_utc ?? null,
      sealed_at_utc: h.session_ended_at_utc ?? null,
      event_count: Array.isArray(bundle.events) ? bundle.events.length : 0,
      models: (h.models || []).map((m) => m.model_id).filter(Boolean),
      outcome: profile.adverse === true ? "adverse (deny/counteroffer/incomplete)"
        : profile.adverse === false ? "approved" : "not determinable without payloads",
    },
    integrity,
    conformance: {
      profile: profile.profile,
      profile_version: profile.profile_version,
      result: profile.pass ? "CONFORMS" : "NON-CONFORMANT",
      coverage_pct: profile.coverage_pct,
      missing_required: profile.missing_required,
    },
    evidence: profile.fields.map((f) => ({
      requirement: f.label, id: f.id, level: f.level, reg_hooks: f.reg_hooks,
      status: f.status, detail: f.detail,
    })),
    // Honest bounds — the three-layer trust discipline.
    conclusion: buildConclusion(profile, verified),
  };
}

function buildConclusion(profile, verified) {
  const parts = [];
  if (verified?.ok) parts.push("The record is tamper-evident: the chain is intact and the signature is valid, so it was not altered after signing.");
  else if (verified) parts.push("Integrity verification FAILED — treat this record as unreliable until resolved.");
  else parts.push("Integrity was not checked (supply the public key to confirm the record was not altered).");
  parts.push(profile.pass
    ? `It conforms to ${profile.profile} (${profile.coverage_pct}% of evidence slots present): the examiner-required evidence for a credit decision is present.`
    : `It is NON-CONFORMANT to ${profile.profile}: missing required evidence — ${profile.missing_required.join(", ") || "none"}.`);
  parts.push("Structural conformance confirms the required evidence exists and is tamper-evident. It does NOT certify that the decision was correct, fair, or compliant — that is a separate determination.");
  return parts.join(" ");
}

/** Render the packet as examiner-readable markdown. */
export function renderPacketMarkdown(p) {
  const d = p.decision, c = p.conformance;
  const rows = p.evidence.map((e) =>
    `| ${ICON[e.status] || "·"} ${e.status} | ${e.requirement} | ${e.level} | ${e.reg_hooks.join("; ")} | ${e.detail} |`).join("\n");
  return [
    `# Credit-decision evidence packet`,
    ``,
    `- **Decision (session) id:** ${d.session_id ?? "—"}`,
    `- **Agent:** ${d.agent ?? "—"}   **Models:** ${d.models.join(", ") || "—"}`,
    `- **Decided:** ${d.decided_at_utc ?? "—"}   **Sealed:** ${d.sealed_at_utc ?? "—"}   **Events:** ${d.event_count}`,
    `- **Outcome:** ${d.outcome}`,
    `- **Integrity:** ${p.integrity}`,
    `- **Profile ${c.profile} ${c.profile_version}:** **${c.result}** (coverage ${c.coverage_pct}%)${c.missing_required.length ? ` — missing required: ${c.missing_required.join(", ")}` : ""}`,
    ``,
    `## Evidence`,
    ``,
    `| Status | Requirement | Level | Regulatory hook | Where / detail |`,
    `|---|---|---|---|---|`,
    rows,
    ``,
    `## Conclusion`,
    ``,
    p.conclusion,
    ``,
  ].join("\n");
}
