#!/usr/bin/env node
// scripts/build-verify-html.mjs
//
// Single-source the browser verifier: the matrix-verify crypto core lives ONCE
// in packages/attest-core/verify-bundle.browser.mjs (BROWSER_VERIFY_MATRIX_JS)
// and is injected into verify.html between the //__VERIFY_MATRIX_START/END__
// markers. This kills the hand-copy drift where verify.html, the shared module,
// and the parity test each carried their own copy of the algorithm.
//
//   node scripts/build-verify-html.mjs           # inject + write verify.html
//   node scripts/build-verify-html.mjs --check    # exit 1 if verify.html is stale (CI drift gate)
//
// Exit codes: 0 in sync / written · 1 drift (--check) · 2 markers missing / error.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BROWSER_VERIFY_MATRIX_JS } from "../packages/attest-core/verify-bundle.browser.mjs";

const HTML = fileURLToPath(new URL("../verify.html", import.meta.url));
const check = process.argv.includes("--check");

const REGION = /(\/\/__VERIFY_MATRIX_START__[^\n]*\n)([\s\S]*?)(\n[ \t]*\/\/__VERIFY_MATRIX_END__)/;

const src = readFileSync(HTML, "utf8");
if (!REGION.test(src)) {
  process.stderr.write("build-verify-html: markers //__VERIFY_MATRIX_START__ … //__VERIFY_MATRIX_END__ not found in verify.html\n");
  process.exit(2);
}

const next = src.replace(REGION, (_m, start, _body, end) => start + BROWSER_VERIFY_MATRIX_JS + end);

if (check) {
  if (next !== src) {
    process.stderr.write("✗ verify.html is out of sync with packages/attest-core/verify-bundle.browser.mjs\n  run: npm run build:verify-html\n");
    process.exit(1);
  }
  process.stdout.write("✓ verify.html matches the single-source verifier module\n");
  process.exit(0);
}

if (next === src) {
  process.stdout.write("✓ verify.html already up to date\n");
  process.exit(0);
}
writeFileSync(HTML, next);
process.stdout.write("✓ rebuilt verify.html from verify-bundle.browser.mjs (BROWSER_VERIFY_MATRIX_JS)\n");
process.exit(0);
