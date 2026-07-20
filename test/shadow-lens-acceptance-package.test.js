// The acceptance package is reproducible through one command and always contains a pristine
// verification + a real tamper failure. This test runs the generator into a temp dir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../scripts/gen-acceptance-package.mjs";

test("acceptance package generates a pristine-verified + tamper-detected bundle set", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sls-accept-"));
  const r = await generate(dir);
  assert.equal(r.pristine_verified, true);
  assert.equal(r.tamper_detected, true);

  for (const f of ["session.json", "evidence-bundle.json", "public-key.pem", "verification.json", "tampered-bundle.json", "failure-result.json", "flow-audit.csv", "api-transcript.json", "MANIFEST.json"]) {
    assert.equal(existsSync(join(dir, f)), true, `missing ${f}`);
  }
  // the failure result names a real reason, not a placeholder
  const failure = JSON.parse(readFileSync(join(dir, "failure-result.json"), "utf8"));
  assert.equal(failure.ok, false);
  assert.ok(failure.reason, "tamper failure must carry a reason");
  // the api transcript never leaks a private key
  const transcript = readFileSync(join(dir, "api-transcript.json"), "utf8");
  assert.equal(/PRIVATE KEY/.test(transcript), false);
});
