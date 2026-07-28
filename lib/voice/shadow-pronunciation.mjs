// Pronunciation: applies the locale lexicon to spoken text, producing pronunciation_tokens (the terms
// that were substituted) and a say-as hint map an SSML adapter can use. Full hashes are never expanded
// here (the normalizer already abbreviates them). Pure + deterministic.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cache = {};
export function loadLexicon(locale) {
  if (!cache[locale]) cache[locale] = JSON.parse(readFileSync(join(ROOT, `voice/pronunciation/${locale === "zh-CN" ? "zh-CN" : "en-US"}.json`), "utf8"));
  return cache[locale];
}

// Replace known technical terms with their spoken form; return {text, tokens}. Longest terms first so
// "Beam Pro" wins over "Beam". Evidence/claim IDs (E-101 etc.) are read char-by-char by rule.
export function applyPronunciation(text, locale = "en-US") {
  const lex = loadLexicon(locale);
  const terms = Object.keys(lex.terms).sort((a, b) => b.length - a.length);
  let out = String(text ?? "");
  const tokens = [];
  for (const term of terms) {
    const re = new RegExp(escapeRe(term), "g");
    if (re.test(out)) { out = out.replace(re, lex.terms[term].say); tokens.push(term); }
  }
  // evidence/claim ids like E-101 → "E one oh one" (en) / "E 一〇一" (zh)
  out = out.replace(/\b([A-Z])-(\d{2,4})\b/g, (m, letter, digits) => letter + " " + digits.split("").map((d) => readDigit(d, locale)).join(" "));
  return { text: out.replace(/\s+/g, " ").trim(), tokens };
}

function readDigit(d, locale) {
  if (locale === "zh-CN") return ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"][+d] ?? d;
  return ["oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][+d] ?? d;
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
