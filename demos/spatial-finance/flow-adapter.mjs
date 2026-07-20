// demos/spatial-finance/flow-adapter.mjs
// ─────────────────────────────────────────────────────────────────
// Shadow → Flow visualization adapter.
//
// Answers "how does Flow help us?" concretely: Flow (a.flow.gl) is the polished
// 3D display layer for XREAL One Pro — colorful, rotatable, filterable spatial
// data. Shadow stays the analysis + audit + signing engine; this adapter turns
// Shadow's output into row-per-node CSV datasets Flow imports TODAY (Flow's
// CSV import is confirmed public; the real-time Push Dataset API is the same
// row shape but gated on the open questions for the Flow team). Analysis, OCR,
// signing, and verification NEVER move into Flow — it is a display sink.
//
// Emits:
//   flow-portfolio.csv  — one row per holding → the 3D risk-return cloud
//                         (X=risk, Y=5y return, Z=confidence, size=weight, color=action)
//   flow-audit.csv      — one row per evidence-chain node → the 3D audit graph
//                         (seq, actor, produced_by, hash, verification_status)
//
// Run: node demos/replay/... no — from this dir: node flow-adapter.mjs
// ─────────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { verifyBundle } from "../../packages/attest-core/session.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");

// Mirrors the demo's unified contract (the single source both read).
const POSITIONS = [
  { t:"NVDA", w:.16, rc:.13, risk:.42, ret:.62, conf:.72, action:"hold" },
  { t:"MSFT", w:.13, rc:.09, risk:.26, ret:.34, conf:.80, action:"hold" },
  { t:"AAPL", w:.12, rc:.09, risk:.24, ret:.30, conf:.81, action:"hold" },
  { t:"GOOGL",w:.11, rc:.10, risk:.28, ret:.36, conf:.78, action:"hold" },
  { t:"AMZN", w:.10, rc:.10, risk:.30, ret:.40, conf:.75, action:"hold" },
  { t:"META", w:.09, rc:.10, risk:.33, ret:.44, conf:.73, action:"hold" },
  { t:"AVGO", w:.08, rc:.10, risk:.36, ret:.50, conf:.70, action:"hold" },
  { t:"RKLB", w:.07, rc:.11, risk:.58, ret:.88, conf:.55, action:"hold" },
  { t:"PLTR", w:.07, rc:.10, risk:.52, ret:.70, conf:.60, action:"trim" },
  { t:"TSLA", w:.07, rc:.10, risk:.55, ret:.55, conf:.52, action:"trim" },
];

function csv(rows) {
  const head = Object.keys(rows[0]);
  return [head.join(","), ...rows.map(r => head.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n") + "\n";
}

// portfolio dataset → the 3D risk-return cloud in Flow
const portfolioRows = POSITIONS.map(p => ({
  ticker: p.t, risk: p.risk, return_5y: p.ret, confidence: p.conf,
  weight_pct: Math.round(p.w * 100), risk_contribution_pct: Math.round(p.rc * 100), action: p.action,
}));

// audit dataset → the 3D audit graph in Flow. Reads the REAL signed reference banking
// bundle + verifies it, so every row is an actual event with its real hashes + a real
// per-event verification status — not a mock. Tamper the bundle and rows flip to BROKEN.
const refBundle = JSON.parse(readFileSync(resolve(REPO, "docs", "reference", "banking-decision.bundle.json"), "utf8"));
const refPem = readFileSync(resolve(REPO, "docs", "reference", "banking-decision.public.pem"), "utf8");
const verified = verifyBundle(refBundle, { publicKey: refPem });
const auditRows = refBundle.events.map((e) => ({
  seq: e.seq, actor: e.actor, event_type: e.event_type,
  payload_hash_8: String(e.payload_hash).slice(0, 8),
  prev_hash_8: e.prev_hash ? String(e.prev_hash).slice(0, 8) : "genesis",
  verification_status: verified.ok ? "verified"
    : (verified.failedSeq != null && e.seq >= verified.failedSeq ? "BROKEN" : "verified"),
}));

// council dataset → the 3D agent-council graph in Flow: center = Final
// Recommendation, spokes = the 5 voices, each with a support/oppose relation.
const COUNCIL = [
  { voice: "Final Recommendation", role: "verdict",   stance: "center", confidence: 0.74, note: "HOLD — balanced; DTI/risk within policy" },
  { voice: "Fundamental",          role: "analysis",  stance: "support", confidence: 0.80, note: "earnings + cash flow support the weights" },
  { voice: "Risk",                 role: "analysis",  stance: "support", confidence: 0.72, note: "VaR within appetite; concentration OK" },
  { voice: "Macro",                role: "analysis",  stance: "oppose",  confidence: 0.61, note: "rate path argues for trimming duration" },
  { voice: "Governance",           role: "control",   stance: "support", confidence: 0.83, note: "Reg B / policy thresholds satisfied" },
  { voice: "Skeptic",              role: "adversary", stance: "oppose",  confidence: 0.58, note: "crowded AI names; momentum fragility" },
];
const councilRows = COUNCIL.map((c) => ({
  voice: c.voice, role: c.role, relation_to_final: c.stance,
  confidence: c.confidence, is_center: c.stance === "center" ? 1 : 0, note: c.note,
}));

writeFileSync(resolve(HERE, "flow-portfolio.csv"), csv(portfolioRows));
writeFileSync(resolve(HERE, "flow-audit.csv"), csv(auditRows));
writeFileSync(resolve(HERE, "flow-council.csv"), csv(councilRows));

console.log("[flow-adapter] flow-portfolio.csv  — %d holdings (Scene 1: risk-return cloud)", portfolioRows.length);
console.log("[flow-adapter] flow-council.csv    — %d nodes (Scene 2: agent-council graph, center=Final)", councilRows.length);
console.log("[flow-adapter] flow-audit.csv      — %d chain nodes (Scene 3: audit trace from the REAL signed reference bundle, verified)", auditRows.length);
console.log("[flow-adapter] import into Flow Editor (CSV), or push the same rows via the Push Dataset API once its contract is confirmed. Flow renders the spatial layer; Shadow signs + verifies the data — the spatial engine is Flow's, not Shadow's.");
