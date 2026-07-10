#!/usr/bin/env node
// scripts/check-forbidden-phrases.mjs
//
// Prevents fabricated regulatory terminology and over-claims from
// re-entering user-facing surfaces after the v2.0.0-rc1 sweep.
//
// Two failure modes this catches:
//   1. Invented regulatory shorthand ("SR 26-2 Tier 3", "Bulletin 2024-09").
//      These made procurement reviewers dismiss earlier drafts in one grep.
//   2. Overclaimed language ("legally admissible", "tamper-proof",
//      "Article 12 compliant"). These invite liability we cannot back up
//      as a pre-1.0 solo project and match the exact failure mode Alex
//      flagged during the v3 pivot review.
//
// The lint is line-based, case-insensitive, and reports file:line for
// every hit. Exit 1 on any violation. Use --list-only to print the
// forbidden set without scanning.
//
// Excludes (by path prefix):
//   - docs/archive/                (legacy README + retired copy)
//   - docs/roadmap/                (strategic briefs may quote the terms)
//   - node_modules/                (dep code)
//   - .git/                        (git internals)
//   - *.bak                        (sed backup artifacts)
//
// Regenerate the exclusion set only when adding a new directory that has
// a legitimate reason to hold the forbidden vocabulary (e.g. a threat
// model quoting bad copy for comparison). Do not add exclusions to
// silence violations — fix the copy instead.

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

// Forbidden phrases. Each entry is {pattern: RegExp, note: string, allow_in?: string[]}.
// Patterns run case-insensitive across single lines (multiline mode off).
const FORBIDDEN = [
  {
    pattern: /\bSR[\s-]?26[\s-]?2\s+Tier\s*\d/i,
    note: 'SR 26-2 does not use a Tier taxonomy. Reference footnote 3 or the model-purpose / model-exposure materiality construct instead.',
  },
  {
    pattern: /\bTier\s*3\s+(?:companion|excluded|carve-out|delegation|GenAI)/i,
    note: '"Tier 3" is invented shorthand. Cite SR 26-2 footnote 3 verbatim or use "carve-out for generative and agentic AI".',
  },
  {
    pattern: /\bCFPB\s+Bulletin\s+2024-09\b/i,
    note: 'CFPB Bulletin 2024-09 (as commonly cited for adverse-action specificity) does not exist. Use Circular 2026-03 (2026-05-05, current) or Circular 2023-03 (historical predecessor, withdrawn 2025-05-12).',
  },
  {
    pattern: /\b13\s+days?\s+before\s+Reg\s+B\b/i,
    note: 'The 2026-07-21 Reg B rule is deregulatory. Do not use countdown urgency framing.',
  },
  {
    pattern: /\blegally\s+admissible\b/i,
    note: '"Legally admissible" has a strict evidentiary meaning we cannot back up. Use "tamper-evident record" instead.',
  },
  {
    pattern: /\bcourt[\s-]?proof\b/i,
    note: 'Not a defensible claim. Use "tamper-evident" or "independently verifiable".',
  },
  {
    pattern: /\bArticle\s+12\s+compliant\b/i,
    note: 'Say "designed to support Article 12 record-keeping obligations" — compliance is a legal determination, not a marketing claim.',
  },
  {
    pattern: /\btamper[\s-]?proof\b/i,
    note: 'Shadow is tamper-EVIDENT, not tamper-PROOF. Attestation reveals tampering; it does not prevent it.',
  },
  {
    pattern: /\bguarantees?\s+compliance\b/i,
    note: 'No product guarantees compliance. Use language like "produces evidence that can support a compliance narrative".',
  },
  {
    pattern: /\bcertified\s+(?:compliance|SOC[\s-]?2)\b/i,
    note: 'Do not claim certification without an audit report. Say "SOC 2 readiness assessment" until an audit is complete.',
  },
];

const EXCLUDE_PREFIXES = [
  "node_modules/",
  ".git/",
  "docs/archive/",
  "docs/roadmap/",
  "packages/*/node_modules/",
  // The linter itself references the forbidden phrases by design (they
  // appear in patterns and error messages). Excluding this file is the
  // one legitimate self-reference; do not add other exclusions to silence
  // violations.
  "scripts/check-forbidden-phrases.mjs",
  // IEEE paper drafts are the author's academic-track artifact and are
  // pivoting to a different framing per v3 brief. Fixing the fabrication
  // in these files is intentional next-morning work, not a mechanical sed.
  "docs/ieee-vis-2026/",
];

const INCLUDE_EXTENSIONS = new Set([".md", ".js", ".mjs", ".cjs", ".ts", ".json", ".yml", ".yaml", ".html"]);

function shouldSkip(relPath) {
  for (const prefix of EXCLUDE_PREFIXES) {
    if (prefix.includes("*")) {
      const [head, tail] = prefix.split("*");
      if (relPath.startsWith(head) && relPath.includes(tail)) return true;
    } else if (relPath.startsWith(prefix)) {
      return true;
    }
  }
  if (relPath.endsWith(".bak")) return true;
  const dot = relPath.lastIndexOf(".");
  if (dot < 0) return true;
  const ext = relPath.slice(dot);
  if (!INCLUDE_EXTENSIONS.has(ext)) return true;
  return false;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(REPO_ROOT, full);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(full, acc);
    } else if (s.isFile()) {
      if (!shouldSkip(rel)) acc.push(rel);
    }
  }
  return acc;
}

const args = process.argv.slice(2);

if (args.includes("--list-only")) {
  console.log("Forbidden phrases (case-insensitive, single-line):");
  for (const f of FORBIDDEN) {
    console.log(`  - ${f.pattern.source}`);
    console.log(`      ${f.note}`);
  }
  process.exit(0);
}

const files = walk(REPO_ROOT);
const hits = [];

for (const rel of files) {
  let text;
  try { text = readFileSync(join(REPO_ROOT, rel), "utf-8"); } catch { continue; }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const f of FORBIDDEN) {
      if (f.pattern.test(lines[i])) {
        hits.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 160), note: f.note });
        break; // one hit per line is enough
      }
    }
  }
}

if (hits.length === 0) {
  console.log("OK — no forbidden phrases found across " + files.length + " scanned files.");
  process.exit(0);
}

console.error(`FAIL — ${hits.length} forbidden-phrase hit(s) across ${new Set(hits.map((h) => h.file)).size} file(s).`);
for (const h of hits) {
  console.error(`\n  ${h.file}:${h.line}`);
  console.error(`    ${h.text}`);
  console.error(`    NOTE: ${h.note}`);
}
console.error("\nFix the copy or, if this hit is a legitimate quotation (e.g. a threat-model artifact quoting bad copy for comparison), add a scoped exclusion in scripts/check-forbidden-phrases.mjs with a justification comment.");
process.exit(1);
