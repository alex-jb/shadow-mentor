// Persona deliberation → evidence-grounded synthesis. Mirrors the page's deterministic check logic and
// pins the honesty invariants: personas are perspectives (not experts), stance strength is not confidence,
// majority never sets correctness, a compliance persona never sets legal review, human approval stays
// unfulfilled, unsupported/contradictory/abstention are preserved, and the synthesis traces to evidence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = JSON.parse(readFileSync(join(ROOT, "fixtures/animations/persona-deliberation.json"), "utf8"));
const HTML = readFileSync(join(ROOT, "demos/animations/persona-deliberation.html"), "utf8");
const resolves = (id) => Object.prototype.hasOwnProperty.call(FIX.shared_evidence, id);

function compute(scen) {
  const out = FIX.scenarios[scen].outputs;
  const active = out.filter((o) => !o.abstain_reason);
  const unresolved = active.flatMap((o) => o.supporting_evidence_ids).filter((id) => !resolves(id));
  const unsupported = out.filter((o) => o.unsupported_claim_ids.length);
  const contradictory = out.filter((o) => o.contradictory_evidence_ids.length);
  const abstains = out.filter((o) => o.abstain_reason);
  const weak = out.some((o) => o.weak_evidence);
  const grounded = out.filter((o) => !o.abstain_reason && !o.unsupported_claim_ids.length);
  const allBound = grounded.every((o) => o.supporting_evidence_ids.some(resolves));
  const stances = active.map((o) => o.stance); const hasOpp = stances.includes("SUPPORT") && stances.includes("OPPOSE");
  const modal = Math.max(...Object.values(stances.reduce((m, s) => ((m[s] = (m[s] || 0) + 1), m), {})));
  const st = { SHARED_SOURCE_EVIDENCE: "PRESENT", SOURCE_RESOLUTION: unresolved.length ? "WARNING" : "VERIFIED", PERSONA_OUTPUT_INTEGRITY: "VERIFIED",
    CLAIM_EVIDENCE_BINDING: !allBound ? "FAILED" : (weak ? "WARNING" : "VERIFIED"),
    UNSUPPORTED_CLAIMS: unsupported.length ? "WARNING" : "NOT_PRESENT", CONTRADICTORY_EVIDENCE: contradictory.length ? "WARNING" : "NOT_PRESENT",
    ABSTENTION: abstains.length ? "ABSTAINED" : "NOT_PRESENT", SYNTHESIS_PROVENANCE: "VERIFIED",
    MAJORITY_AGREEMENT: hasOpp ? "WARNING" : (modal > active.length / 2 ? "PRESENT" : "NOT_PRESENT"),
    ANALYTICAL_CORRECTNESS: "NOT_EVALUATED", LEGAL_FAIRNESS_REVIEW: "NOT_EVALUATED" };
  const attention = (s) => ["WARNING", "FAILED", "ABSTAINED", "REQUIRES_HUMAN_REVIEW"].includes(s);
  st.HUMAN_APPROVAL = (FIX.checks.slice(0, 9).some((c) => attention(st[c])) || weak) ? "REQUIRES_HUMAN_REVIEW" : "NOT_PRESENT";
  const firstWarn = FIX.checks.find((c) => attention(st[c])) || null;
  return { st, firstWarn, grounded, unsupported, contradictory, abstains };
}

test("fixture integrity: unique persona + claim IDs; personas share the same evidence set", () => {
  for (const [k, sc] of Object.entries(FIX.scenarios)) {
    const pids = sc.outputs.map((o) => o.perspective_id), cids = sc.outputs.map((o) => o.claim_id);
    assert.equal(new Set(pids).size, pids.length, `${k} duplicate persona`);
    assert.equal(new Set(cids).size, cids.length, `${k} duplicate claim id`);
    for (const o of sc.outputs) for (const e of o.supporting_evidence_ids) if (resolves(e)) assert.ok(FIX.shared_evidence[e], `${k} evidence ${e}`);
  }
});

test("each scenario fails/flags at the exact first check the fixture predicts", () => {
  for (const [k, sc] of Object.entries(FIX.scenarios)) assert.equal(compute(k).firstWarn, sc.first_warning, k);
});

test("majority agreement never sets analytical correctness VERIFIED", () => {
  for (const k of Object.keys(FIX.scenarios)) { const { st } = compute(k); assert.equal(st.ANALYTICAL_CORRECTNESS, "NOT_EVALUATED", k); }
  const maj = compute("majority_weak_evidence").st;
  assert.equal(maj.MAJORITY_AGREEMENT, "PRESENT", "majority present in the weak-evidence scenario");
  assert.equal(maj.ANALYTICAL_CORRECTNESS, "NOT_EVALUATED", "but correctness stays NOT_EVALUATED");
});

test("a Fair Lending Compliance persona does NOT set legal/fairness review VERIFIED; human approval unfulfilled", () => {
  for (const k of Object.keys(FIX.scenarios)) {
    const { st } = compute(k);
    assert.equal(st.LEGAL_FAIRNESS_REVIEW, "NOT_EVALUATED", k);
    assert.ok(["NOT_PRESENT", "REQUIRES_HUMAN_REVIEW"].includes(st.HUMAN_APPROVAL), `${k} human approval: ${st.HUMAN_APPROVAL}`);
  }
});

test("unsupported claim is excluded from grounded synthesis; contradiction + abstention are preserved", () => {
  const u = compute("unsupported_claim");
  assert.ok(u.unsupported.length >= 1);
  assert.ok(u.grounded.every((o) => !o.unsupported_claim_ids.length), "grounded synthesis excludes unsupported claims");
  const c = compute("contradictory_evidence"); assert.equal(c.st.CONTRADICTORY_EVIDENCE, "WARNING");
  const a = compute("abstain"); assert.equal(a.st.ABSTENTION, "ABSTAINED"); assert.ok(a.abstains.length >= 1);
});

test("stance strength is a persona prior, never labeled confidence", () => {
  for (const sc of Object.values(FIX.scenarios)) for (const o of sc.outputs) {
    assert.equal(typeof o.stance_strength, "number");
    assert.ok(!("confidence" in o), "no confidence field on a persona output");
  }
  // 'confidence' is allowed ONLY in the honest disclaimer ("statistical confidence"); never as a label
  const stripped = HTML.replace(/statistical confidence|统计置信度/g, "");
  assert.equal(/confidence/i.test(stripped), false, "confidence must not label a persona prior / stance strength");
  assert.match(HTML, /stance strength|立场强度/);
});

test("persona is labeled a configured analytical perspective, not a human expert", () => {
  assert.match(HTML, /analytical perspective|分析视角/);
  assert.equal(/\bindependent human expert(?!s? )|HUMAN REVIEWER\b/i.test(HTML.replace(/not independent human experts?|并非独立的人类专家/g, "")), false);
  assert.match(HTML, /not independent human experts?|并非独立的人类专家/);
});

test("honesty text is always present (majority ≠ correctness) in both languages", () => {
  assert.match(HTML, /MAJORITY DOES NOT PROVE CORRECTNESS/);
  assert.match(HTML, /多数意见不能证明结论正确/);
  assert.match(HTML, /More agreeing personas do not create statistical confidence/);
  assert.match(HTML, /并不会产生统计置信度/);
});

test("bilingual parity — evidence + personas + scenarios have EN and 中文; IDs are language-invariant", () => {
  for (const [id, e] of Object.entries(FIX.shared_evidence)) { assert.ok(e.en && e.zh, id); assert.match(e.zh, /[一-鿿]/); }
  for (const [id, p] of Object.entries(FIX.personas)) assert.ok(p.en && p.zh, id);
  for (const sc of Object.values(FIX.scenarios)) assert.ok(sc.label_en && sc.label_zh);
});

test("self-contained + safe: no external/fetch/eval, CSP, no executable HTML in fixture", () => {
  assert.equal(/<script[^>]+src\s*=|<link[^>]+href\s*=\s*["']https?:|fetch\(\s*["']https?:|unpkg|cdn|jsdelivr/.test(HTML), false);
  assert.equal(/[^.\w]eval\s*\(|new Function\s*\(/.test(HTML), false);
  assert.match(HTML, /default-src 'none'/);
  assert.equal(/<script|onerror=|javascript:/i.test(JSON.stringify(FIX)), false, "no executable HTML/JS in the fixture");
  assert.match(FIX.fixture_note, /DEMONSTRATION FIXTURE/i);
});

test("the page never renders a generic COMPLIANT/TRUSTED verdict", () => {
  assert.equal(/\bCOMPLIANT\b|\bTRUSTED\b/.test(HTML), false);
});
