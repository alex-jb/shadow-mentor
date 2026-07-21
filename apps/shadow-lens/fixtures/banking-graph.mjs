// The banking decision as a Claim–Evidence Graph — built from the SAME deterministic
// narrative the Unity stage and Flow export use (banking-narrative.mjs). This is the one
// fact source: the Unity audit arc walks provenanceChain(), the Flow export serializes it,
// and the offline verifier can re-hash exportGraph() to confirm nothing was altered.
import { createGraph, addNode, addEdge } from "../../../lib/claim-evidence-graph.mjs";
import { BANKING_NARRATIVE as N } from "./banking-narrative.mjs";

export function buildBankingGraph() {
  const g = createGraph();

  // source → snapshot → evidence (each metric/evidence item is grounded in a snapshot)
  addNode(g, { id: "src:loan-file", type: "source", label: "Loan application file" });
  addNode(g, { id: "snap:loan-file", type: "snapshot", label: "Sealed intake snapshot", snapshot_sha256: "demo-snapshot-hash" });
  addEdge(g, { type: "DERIVED_FROM", from: "snap:loan-file", to: "src:loan-file" });

  for (const ev of N.evidence) {
    addNode(g, { id: `ev:${ev.evidence_id}`, type: "evidence", label: ev.label });
    addEdge(g, { type: "DERIVED_FROM", from: `ev:${ev.evidence_id}`, to: "snap:loan-file" });
  }

  // policy nodes (current guidance; SR 26-2 supersedes SR 11-7)
  addNode(g, { id: "pol:regB", type: "policy", label: "Reg B / ECOA", version: "12 CFR 1002" });
  addNode(g, { id: "pol:sr26-2", type: "policy", label: "SR 26-2 (superseding SR 11-7)", version: "2026-04" });

  // one claim per council voice; each SUPPORTED by the evidence it cites, and voices that
  // cite policy APPLY it; dissent CHALLENGES the claims it disagrees with.
  for (const v of N.council) {
    const cid = `claim:${slug(v.voice)}`;
    addNode(g, {
      id: cid, type: "claim", label: v.voice,
      stance: v.stance, vote: v.vote,
      // persona prior, NOT model probability (see product-facts.json confidence_semantics)
      stance_strength: v.confidence, confidence_semantics: "persona_prior",
    });
  }

  // relationships from the narrative → typed edges
  for (const r of N.relationships) {
    const from = `claim:${slug(r.from)}`;
    if (r.type === "cites") addEdge(g, { type: "SUPPORTS", from: `ev:${r.to}`, to: from });
    else if (r.type === "disagrees") {
      addNode(g, { id: `dissent:${slug(r.from)}`, type: "dissent", label: `${r.from} dissents` });
      addEdge(g, { type: "CHALLENGED_BY", from: `claim:${slug(r.to)}`, to: `dissent:${slug(r.from)}` });
      addEdge(g, { type: "DERIVED_FROM", from: `dissent:${slug(r.from)}`, to: from });
    }
  }
  // Fair Lending applies Reg B; Risk applies SR 26-2 (so the policy nodes are wired)
  addEdge(g, { type: "APPLIES_POLICY", from: "claim:fair-lending-compliance", to: "pol:regB" });
  addEdge(g, { type: "APPLIES_POLICY", from: "claim:risk-officer", to: "pol:sr26-2" });

  // recommendation DERIVED_FROM every claim, then SEALED_BY the signature into an audit record
  addNode(g, {
    id: "rec:decision", type: "recommendation", label: N.decision.recommendation,
    risk_level: N.decision.risk_level, compliance_status: N.decision.compliance_status,
    dissent: N.decision.dissent, mode_label: N.decision.mode_label,
  });
  for (const v of N.council) addEdge(g, { type: "DERIVED_FROM", from: "rec:decision", to: `claim:${slug(v.voice)}` });

  addNode(g, { id: "sig:ed25519", type: "signature", label: "Ed25519 seal", signed_status: N.decision.signed_result_status });
  addNode(g, { id: "audit:record", type: "audit_record", label: "Audit record", audit_reference: N.decision.audit_reference });
  addEdge(g, { type: "SEALED_BY", from: "rec:decision", to: "sig:ed25519" });
  addEdge(g, { type: "DERIVED_FROM", from: "audit:record", to: "sig:ed25519" });

  return g;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
