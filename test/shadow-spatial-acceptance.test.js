// §12 spatial-agent acceptance package: reproducible, honestly labeled, tamper-detected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../scripts/gen-spatial-acceptance.mjs";

test("acceptance package covers 3 cases with honest labels + tamper detection", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sls-spatial-"));
  const r = await generate(dir);
  assert.equal(r.cases.length, 3);
  assert.equal(existsSync(join(dir, "MANIFEST.json")), true);
  for (const c of r.cases) {
    assert.equal(c.labels.session, "REAL SESSION");
    assert.equal(c.labels.model, "FIXTURE MODEL");     // no live model claimed
    assert.equal(c.labels.device, "DEVICE VALIDATION PENDING");
    assert.equal(c.tamper.detected, true);
  }
  // the grounded case executed a client action; the ungrounded case did not
  const grounded = r.cases.find((c) => c.grounded);
  assert.ok(grounded.client_validation.valid.length >= 1);
  const ungrounded = r.cases.find((c) => !c.grounded);
  assert.equal(ungrounded.requested_actions.length, 0);
  // no private key leaks into a case file
  const files = r.cases.map((_, i) => `case-${i}-${r.cases[i].profile}.json`);
  for (const f of files) assert.equal(/PRIVATE KEY/.test(readFileSync(join(dir, f), "utf8")), false);
});
