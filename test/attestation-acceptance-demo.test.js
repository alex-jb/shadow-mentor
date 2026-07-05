// Smoke test wrapping bin/attestation-acceptance-demo.mjs — the
// integration story that ties v1.4.0 signing → v1.5.4 CLI into one
// script a procurement reviewer can run from a fresh clone.
//
// If any of the 5 releases regresses (attestation module contract,
// loan-council handler shape, verify-attestation endpoint shape,
// MCP tool dispatch, or the keypair generator), this test breaks
// with the exact failing step number in the demo output.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const DEMO = join(process.cwd(), "bin", "attestation-acceptance-demo.mjs");

describe("attestation acceptance demo (v1.4.0 → v1.5.4 integration)", () => {
  test("demo file exists and is executable", () => {
    assert.equal(existsSync(DEMO), true, "bin/attestation-acceptance-demo.mjs missing");
    if (process.platform !== "win32") {
      // Owner exec bit set. Not sensitive to group/other bits.
      const mode = statSync(DEMO).mode;
      assert.ok(mode & 0o100, "demo script is not owner-executable");
    }
  });

  test("demo runs end-to-end and exits 0 in under 5 seconds", () => {
    const started = Date.now();
    const r = spawnSync("node", [DEMO], {
      encoding: "utf8",
      timeout: 5000,  // 5s budget — real run is ~250ms locally
      env: { ...process.env, NO_COLOR: "1" },  // strip ANSI for stable matches
    });
    const elapsed = Date.now() - started;
    assert.equal(r.status, 0,
      `demo failed (exit ${r.status}) — regressed a release in the chain.\n` +
      `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    assert.ok(elapsed < 5000, `demo took ${elapsed}ms — too slow for a smoke test`);
  });

  test("demo output covers every dispatch surface", () => {
    const r = spawnSync("node", [DEMO], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    assert.equal(r.status, 0);
    // Assertions pin the labels — if a step label drifts, the demo
    // is silently no longer proving what it claims to prove.
    for (const label of [
      "[1/6] Generate Ed25519 keypair",
      "[2/6] Run /api/loan-council in-process",
      "[3/6] Verify with lib/attestation.js",
      "[4/6] Verify with POST /api/verify-attestation",
      "[5/6] Verify with shadow_verify_attestation (MCP)",
      "[6/6] Tamper detection catches silent verdict flip",
    ]) {
      assert.ok(r.stdout.includes(label),
        `demo step label drifted: "${label}" not found in output`);
    }
    assert.match(r.stdout, /All 6 acceptance steps passed/);
  });

  test("demo actually verifies tamper detection (step 6 is not a no-op)", () => {
    const r = spawnSync("node", [DEMO], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    assert.equal(r.status, 0);
    // The tamper step must explicitly show it caught a mismatch.
    // If someone breaks step 6 to always return ok, the demo would
    // still exit 0 — this assertion catches that regression.
    assert.match(r.stdout, /output commitment mismatch/,
      "demo tamper step 6 did not surface the mismatch reason — silent regression risk");
  });
});
