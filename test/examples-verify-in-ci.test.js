// Drift-detection tests for examples/verify-in-ci/ — the drop-in bank CI
// integration for the public HTTP verifier shipped in v1.5.2.
//
// This example is not a test but a *contract with bank ops teams*. If the
// endpoint field names change (e.g. we rename `original_request` → `req`)
// or the example scripts get renamed / deleted, every downstream bank that
// forked this example silently breaks. These tests catch that drift.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = join(__dirname, "..", "examples", "verify-in-ci");

describe("examples/verify-in-ci drift gates", () => {
  test("all three example files exist (README + workflow + script)", () => {
    for (const name of ["README.md", "verify.yml", "verify.sh"]) {
      assert.equal(existsSync(join(EXAMPLE_DIR, name)), true,
        `examples/verify-in-ci/${name} missing`);
    }
  });

  test("verify.sh POSTs the exact 4 fields the /api/verify-attestation contract expects", () => {
    const sh = readFileSync(join(EXAMPLE_DIR, "verify.sh"), "utf8");
    // If any of these field names change in the endpoint, the shell script
    // breaks silently in every bank's CI. Pin them.
    for (const field of ["attestation", "original_request", "original_response", "public_key"]) {
      assert.ok(sh.includes(field),
        `verify.sh missing required POST body field "${field}" — endpoint contract broken`);
    }
  });

  test("verify.sh targets /api/verify-attestation, not any other path", () => {
    const sh = readFileSync(join(EXAMPLE_DIR, "verify.sh"), "utf8");
    assert.ok(sh.includes("/api/verify-attestation"),
      "verify.sh no longer points at /api/verify-attestation");
  });

  test("verify.sh checks .ok field on the response (not .verified or anything else)", () => {
    const sh = readFileSync(join(EXAMPLE_DIR, "verify.sh"), "utf8");
    assert.ok(sh.includes("jq -r '.ok'"),
      "verify.sh no longer parses the .ok field — response-shape drift with the endpoint");
  });

  test("verify.yml references the SHADOW_URL variable + PUBLIC_KEY secret by exact name", () => {
    const yml = readFileSync(join(EXAMPLE_DIR, "verify.yml"), "utf8");
    // These two names are stamped in bank CI configs. Renaming here means
    // every bank has to update their GH Actions secrets.
    assert.ok(yml.includes("vars.SHADOW_URL"),
      "verify.yml no longer reads vars.SHADOW_URL — bank CI configs will silently break");
    assert.ok(yml.includes("secrets.SHADOW_ATTESTATION_PUBLIC_KEY"),
      "verify.yml no longer reads secrets.SHADOW_ATTESTATION_PUBLIC_KEY — bank CI configs will silently break");
  });

  test("verify.yml triggers on the audit-log path pattern the README documents", () => {
    const yml = readFileSync(join(EXAMPLE_DIR, "verify.yml"), "utf8");
    const readme = readFileSync(join(EXAMPLE_DIR, "README.md"), "utf8");
    // Both must agree on where responses are persisted, else bank ops
    // team sets up their audit-log dir per the README and the workflow
    // silently never fires.
    assert.ok(yml.includes("audit-log/**/*.json"),
      "verify.yml no longer watches audit-log/**/*.json");
    assert.ok(readme.includes("audit-log/**/*.json"),
      "README.md no longer references the audit-log/**/*.json path");
  });

  test("README documents exit-code contract (0 / 1 / 2)", () => {
    const readme = readFileSync(join(EXAMPLE_DIR, "README.md"), "utf8");
    // Bank ops teams pipe this into higher-level orchestrators that
    // interpret exit codes. Pin the contract.
    for (const code of ["0 —", "1 —", "2 —"]) {
      assert.ok(readme.includes(code),
        `README.md missing exit-code documentation for "${code}"`);
    }
  });
});
