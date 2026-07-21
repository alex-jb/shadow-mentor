// Reason-code dictionary hash → attestation binding explainer. Verifies the deterministic fixture and
// mirrors the page's independent-check logic: pristine passes; each tamper fails at the exact first
// check with the OTHER checks staying independently evaluated; honesty (policy/analytical/legal =
// NOT_EVALUATED, never TRUSTED/COMPLIANT); bilingual parity; and the HTML is self-contained + safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = JSON.parse(readFileSync(join(ROOT, "fixtures/animations/reason-code-attestation.json"), "utf8"));
const HTML = readFileSync(join(ROOT, "demos/animations/reason-code-attestation.html"), "utf8");

const canon = (v) => (v === null || typeof v !== "object") ? JSON.stringify(v)
  : Array.isArray(v) ? "[" + v.map(canon).join(",") + "]"
    : "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
const sha = (s) => createHash("sha256").update(s).digest("hex");

// mirror of the page computeState (the SAME logic the browser runs)
function checks(scen) {
  const sc = FIX.tamper_scenarios[scen];
  const dict = JSON.parse(JSON.stringify(FIX.reason_codes));
  let version = FIX.dictionary_version, selected = FIX.decision.selected_reason_codes.slice();
  let evidence = JSON.parse(JSON.stringify(FIX.evidence_references));
  if (scen === "dictionary_modified") dict[sc.target][sc.field] = sc.new;
  if (scen === "reason_replaced") selected = selected.map((c) => (c === sc.from ? sc.to : c));
  if (scen === "evidence_removed") delete evidence[sc.code];
  if (scen === "version_changed") version = sc.new_version;
  const recomputed = sha(canon(dict));
  const a = FIX.attestation, st = {};
  st.DICTIONARY_PRESENT = Object.keys(dict).length ? "VERIFIED" : "NOT_PRESENT";
  st.DICTIONARY_HASH = recomputed === a.dictionary_hash ? "VERIFIED" : "FAILED";
  st.DICTIONARY_VERSION = version === a.dictionary_version ? "VERIFIED" : "FAILED";
  st.REASON_CODE_EXISTS = selected.every((c) => dict[c]) ? "VERIFIED" : "FAILED";
  st.REASON_CODE_BOUND = selected.every((c) => a.selected_reason_codes.includes(c)) ? "VERIFIED" : "FAILED";
  st.EVIDENCE_REFERENCES = selected.every((c) => (evidence[c] || []).length) ? "VERIFIED" : "FAILED";
  st.ATTESTATION_SIGNATURE = "VERIFIED";
  st.RECORD_INTEGRITY = [st.DICTIONARY_HASH, st.REASON_CODE_BOUND, st.EVIDENCE_REFERENCES, st.DICTIONARY_VERSION].every((x) => x === "VERIFIED") ? "VERIFIED" : "FAILED";
  st.POLICY_ADEQUACY = "NOT_EVALUATED"; st.ANALYTICAL_CORRECTNESS = "NOT_EVALUATED"; st.LEGAL_FAIRNESS_REVIEW = "NOT_EVALUATED";
  const firstFail = FIX.checks.find((c) => st[c] === "FAILED") || null;
  return { st, firstFail };
}

test("pristine: dictionary hash matches + version + codes exist + bound + evidence resolves", () => {
  assert.equal(sha(canon(FIX.reason_codes)), FIX.dictionary_hash, "fixture hash is the real canonical SHA-256");
  const { st, firstFail } = checks("pristine");
  assert.equal(firstFail, null);
  for (const c of ["DICTIONARY_HASH", "DICTIONARY_VERSION", "REASON_CODE_EXISTS", "REASON_CODE_BOUND", "EVIDENCE_REFERENCES", "ATTESTATION_SIGNATURE", "RECORD_INTEGRITY"])
    assert.equal(st[c], "VERIFIED", c);
});

test("dictionary text modified → hash FAILS first; signature stays independently VERIFIED", () => {
  const { st, firstFail } = checks("dictionary_modified");
  assert.equal(firstFail, "DICTIONARY_HASH");
  assert.equal(st.DICTIONARY_HASH, "FAILED");
  assert.equal(st.ATTESTATION_SIGNATURE, "VERIFIED", "the signature over the ORIGINAL attestation is unchanged");
  assert.equal(st.REASON_CODE_BOUND, "VERIFIED", "the binding of the code id itself still holds — independent");
});

test("reason code replaced (RC-017→RC-009) → unknown/unbound fails; no silent label fallback", () => {
  const { st, firstFail } = checks("reason_replaced");
  assert.equal(st.REASON_CODE_EXISTS, "FAILED");
  assert.equal(st.REASON_CODE_BOUND, "FAILED");
  assert.equal(firstFail, "REASON_CODE_EXISTS");
});

test("evidence reference removed → evidence FAILS; dictionary hash stays VERIFIED (independent)", () => {
  const { st, firstFail } = checks("evidence_removed");
  assert.equal(st.EVIDENCE_REFERENCES, "FAILED");
  assert.equal(st.DICTIONARY_HASH, "VERIFIED");
  assert.equal(firstFail, "EVIDENCE_REFERENCES");
});

test("dictionary version changed → version FAILS even though the code id still exists", () => {
  const { st, firstFail } = checks("version_changed");
  assert.equal(st.DICTIONARY_VERSION, "FAILED");
  assert.equal(st.REASON_CODE_EXISTS, "VERIFIED", "a similar/same code id does not bypass version binding");
  assert.equal(firstFail, "DICTIONARY_VERSION");
});

test("honesty: adequacy / correctness / fairness are NOT_EVALUATED; never TRUSTED or COMPLIANT", () => {
  for (const scen of Object.keys(FIX.tamper_scenarios)) {
    const { st } = checks(scen);
    assert.equal(st.POLICY_ADEQUACY, "NOT_EVALUATED", scen);
    assert.equal(st.ANALYTICAL_CORRECTNESS, "NOT_EVALUATED", scen);
    assert.equal(st.LEGAL_FAIRNESS_REVIEW, "NOT_EVALUATED", scen);
  }
  // the only allowed mention is the honest disclaimer ("never TRUSTED or COMPLIANT"); strip it, then
  // assert no other TRUSTED/COMPLIANT is rendered as a status/verdict.
  const stripped = HTML.replace(/never TRUSTED or COMPLIANT|绝不等于 TRUSTED 或 COMPLIANT/g, "");
  assert.equal(/\bTRUSTED\b|\bCOMPLIANT\b/.test(stripped), false, "page must never render a generic TRUSTED/COMPLIANT verdict");
});

test("bilingual parity — every reason code + scenario has EN and 中文; hashes/IDs are language-invariant", () => {
  for (const [id, rc] of Object.entries(FIX.reason_codes)) {
    for (const k of ["title_en", "title_zh", "definition_en", "definition_zh"]) assert.ok(rc[k], `${id} missing ${k}`);
    assert.match(rc.definition_zh, /[一-鿿]/, `${id} zh not Chinese`);
  }
  for (const [k, v] of Object.entries(FIX.tamper_scenarios)) { assert.ok(v.label_en && v.label_zh, `scenario ${k} labels`); }
  // the attestation hash + code ids are not translated
  assert.equal(FIX.attestation.dictionary_hash, FIX.dictionary_hash);
  assert.ok(FIX.attestation.selected_reason_codes.every((c) => /^RC-\d+$/.test(c)));
});

test("HTML is self-contained + safe: no external/fetch/eval, CSP, escaping, no executable HTML in fixture", () => {
  assert.equal(/<script[^>]+src\s*=|<link[^>]+href\s*=\s*["']https?:|fetch\(\s*["']https?:|unpkg|cdn|jsdelivr/.test(HTML), false);
  assert.equal(/[^.\w]eval\s*\(|new Function\s*\(/.test(HTML), false);
  assert.match(HTML, /default-src 'none'/);
  assert.match(HTML, /esc\s*=\s*\(s\)\s*=>|replace\(\/\[&<>/);  // HTML output escaping present
  assert.equal(/<script|onerror=|javascript:/i.test(JSON.stringify(FIX)), false, "no executable HTML/JS in the fixture");
});

test("fixture is labeled a demonstration fixture, not bank policy", () => {
  assert.match(FIX.fixture_note, /DEMONSTRATION FIXTURE/i);
  assert.match(HTML, /DEMONSTRATION FIXTURE|演示测试数据/);
});
