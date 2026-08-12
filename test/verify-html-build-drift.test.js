// test/verify-html-build-drift.test.js
//
// Drift gate: verify.html's matrix verifier is single-sourced in
// packages/attest-core/verify-bundle.browser.mjs (BROWSER_VERIFY_MATRIX_JS) and
// injected by scripts/build-verify-html.mjs. This test fails if the committed
// verify.html is out of sync with the module — i.e. someone hand-edited the
// verifier inside verify.html instead of editing the module and rebuilding.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { BROWSER_VERIFY_MATRIX_JS } from "../packages/attest-core/verify-bundle.browser.mjs";

const BUILD = fileURLToPath(new URL("../scripts/build-verify-html.mjs", import.meta.url));
const HTML = fileURLToPath(new URL("../verify.html", import.meta.url));

test("verify.html is in sync with the single-source verifier module (npm run check:verify-html)", () => {
  // exit 0 => in sync; exit 1 => stale (drift). Throws on non-zero.
  const out = execFileSync("node", [BUILD, "--check"], { encoding: "utf8" });
  assert.match(out, /matches the single-source/);
});

test("the injected region is exactly the module export (no transform)", () => {
  const html = readFileSync(HTML, "utf8");
  const m = html.match(/\/\/__VERIFY_MATRIX_START__[^\n]*\n([\s\S]*?)\n[ \t]*\/\/__VERIFY_MATRIX_END__/);
  assert.ok(m, "verify.html must carry the //__VERIFY_MATRIX_START/END__ markers");
  assert.equal(m[1], BROWSER_VERIFY_MATRIX_JS);
});
