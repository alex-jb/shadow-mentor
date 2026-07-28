// Bilingual locale parity for the verifier: every EN key has a zh-CN translation, no key is
// missing or empty on either side, and the status/decision terminology keeps its distinctions
// across languages (ACCEPTED_WITH_WARNINGS ≠ QUARANTINED, etc.).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EN = JSON.parse(readFileSync(join(ROOT, "verify/locales/en.json"), "utf8"));
const ZH = JSON.parse(readFileSync(join(ROOT, "verify/locales/zh-CN.json"), "utf8"));

test("every English key has a Simplified-Chinese translation (and vice versa)", () => {
  const enKeys = Object.keys(EN).filter((k) => k !== "$locale");
  const zhKeys = new Set(Object.keys(ZH));
  const missing = enKeys.filter((k) => !zhKeys.has(k));
  assert.deepEqual(missing, [], "zh-CN missing keys: " + missing.join(", "));
  const extra = Object.keys(ZH).filter((k) => k !== "$locale" && !(k in EN));
  assert.deepEqual(extra, [], "zh-CN has keys EN lacks: " + extra.join(", "));
});

test("no translation value is empty", () => {
  for (const [k, v] of Object.entries(ZH)) assert.ok(String(v).trim().length, `empty zh-CN value for ${k}`);
  for (const [k, v] of Object.entries(EN)) assert.ok(String(v).trim().length, `empty en value for ${k}`);
});

test("the two distinct ingest states stay distinct in both languages", () => {
  assert.notEqual(EN["ingest.ACCEPTED_WITH_WARNINGS"], EN["ingest.QUARANTINED"]);
  assert.notEqual(ZH["ingest.ACCEPTED_WITH_WARNINGS"], ZH["ingest.QUARANTINED"]);
  assert.equal(ZH["ingest.ACCEPTED_WITH_WARNINGS"], "有警告地接受");
  assert.equal(ZH["ingest.QUARANTINED"], "已隔离");
});

test("self-trust wording is 'assets match signed manifest', never 'self-verified = trusted'", () => {
  assert.equal(EN["self.result.match"], "ASSETS MATCH SIGNED MANIFEST");
  assert.equal(ZH["self.result.match"], "资源与已签名清单一致");
  for (const L of [EN, ZH]) {
    assert.ok(L["self.result.no_independent"], "must carry INDEPENDENT COMPARISON NOT PERFORMED");
    assert.ok(/independent|独立/i.test(L["self.boundary"]), "trust boundary must mention independent channel");
  }
});

test("the six independent evidence statuses exist in both languages", () => {
  for (const s of ["VERIFIED", "FAILED", "NOT_PRESENT", "NOT_CHECKED", "UNSUPPORTED", "MALFORMED"]) {
    assert.ok(EN[`status.${s}`], `EN missing status ${s}`);
    assert.ok(ZH[`status.${s}`], `zh missing status ${s}`);
  }
});
