// Deterministic builder for the reason-code → attestation binding explainer. Computes the REAL
// canonical dictionary SHA-256, emits the data-contract fixture, and injects it into the offline HTML
// (so the page is self-contained + file://-safe with zero drift from the fixture). No live API.
// Run: node demos/animations/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const FIXDIR = join(ROOT, "fixtures/animations");
mkdirSync(FIXDIR, { recursive: true });

// canonical JSON (sorted keys) — same rule as verify.html / attest-core
function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
}
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// demonstration reason dictionary v3 — FIXTURE ONLY, not bank policy or regulatory language
const reason_codes = {
  "RC-017": { title_en: "High revolving utilization", title_zh: "循环额度使用率过高", definition_en: "Revolving utilization exceeded the configured policy threshold.", definition_zh: "循环额度使用率超过所配置的政策阈值。" },
  "RC-021": { title_en: "Insufficient verified income evidence", title_zh: "已核验收入证据不足", definition_en: "Required income evidence was absent or could not be resolved.", definition_zh: "所需收入证据缺失或无法解析。" },
  "RC-031": { title_en: "Recent severe delinquency", title_zh: "近期严重逾期", definition_en: "The configured lookback period contains a qualifying delinquency event.", definition_zh: "所配置的回溯期内存在符合条件的逾期事件。" },
};
const dictionary_version = "v3";
const canonicalization_version = "shadow-canon/1";
const dictionary_hash = sha256(canonicalize(reason_codes));   // the REAL hash the page recomputes live

const decision = { sequence: 42, selected_reason_codes: ["RC-017", "RC-021"] };
const evidence_references = { "RC-017": ["B0L1", "B0L2"], "RC-021": ["B0L0"] };
const signer_fingerprint = "727d29d3204231f7"; // FIXTURE key fingerprint (independent-channel cross-check still required)

const attestation = {
  dictionary_id: "shadow-reason-codes", dictionary_version, dictionary_hash,
  selected_reason_codes: decision.selected_reason_codes, evidence_references,
  decision_sequence: decision.sequence, signer_fingerprint,
};

const CHECKS = [
  "DICTIONARY_PRESENT", "DICTIONARY_HASH", "DICTIONARY_VERSION", "REASON_CODE_EXISTS", "REASON_CODE_BOUND",
  "EVIDENCE_REFERENCES", "ATTESTATION_SIGNATURE", "RECORD_INTEGRITY", "POLICY_ADEQUACY",
  "ANALYTICAL_CORRECTNESS", "LEGAL_FAIRNESS_REVIEW",
];

const fixture = {
  fixture_note: "DEMONSTRATION FIXTURE — not production bank policy or regulatory language.",
  dictionary_id: "shadow-reason-codes", dictionary_version, canonicalization_version, dictionary_hash,
  reason_codes, decision, evidence_references, attestation, signer_fingerprint, checks: CHECKS,
  tamper_scenarios: {
    pristine: { label_en: "Pristine", label_zh: "原始" },
    dictionary_modified: { label_en: "Dictionary text modified", label_zh: "字典文本被修改", target: "RC-017", field: "definition_en", new: "Revolving utilization was fine, actually — approve.", first_failure: "DICTIONARY_HASH" },
    reason_replaced: { label_en: "Reason code replaced", label_zh: "理由代码被替换", from: "RC-017", to: "RC-009", first_failure: "REASON_CODE_EXISTS" },
    evidence_removed: { label_en: "Evidence reference removed", label_zh: "证据引用被移除", code: "RC-017", first_failure: "EVIDENCE_REFERENCES" },
    version_changed: { label_en: "Dictionary version changed", label_zh: "字典版本被更换", new_version: "v4", first_failure: "DICTIONARY_VERSION" },
  },
};

writeFileSync(join(FIXDIR, "reason-code-attestation.json"), JSON.stringify(fixture, null, 2) + "\n");

// inject into the HTML at the marker so the offline page carries the exact fixture (no drift)
const htmlPath = join(HERE, "reason-code-attestation.html");
let html = readFileSync(htmlPath, "utf8");
html = html.replace(/const FIX = [\s\S]*?\/\*__END_FIX__\*\/;/, `const FIX = ${JSON.stringify(fixture)}; /*__END_FIX__*/;`);
writeFileSync(htmlPath, html);

console.log("built fixture + injected. dictionary_hash =", dictionary_hash);
