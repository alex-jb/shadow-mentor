// freeze-apk.sh makes a built APK an IMMUTABLE stage artifact (SHA-256 + read-only copy) and
// refuses to overwrite a frozen record with a different hash. Runs the real script in a temp dir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, copyFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "apps/shadow-lens/demo/wednesday/freeze-apk.sh");

function stage() {
  const dir = mkdtempSync(join(tmpdir(), "apk-freeze-"));
  copyFileSync(SRC, join(dir, "freeze-apk.sh")); chmodSync(join(dir, "freeze-apk.sh"), 0o755);
  return dir;
}
const run = (dir, apk, label) => spawnSync("bash", [join(dir, "freeze-apk.sh"), apk, label], { encoding: "utf8" });

test("freezes an APK with its real SHA-256 and a read-only copy", () => {
  const dir = stage();
  const apk = join(dir, "app.apk"); writeFileSync(apk, "PK\x03\x04 fake apk bytes v1");
  const expect = createHash("sha256").update(readFileSync(apk)).digest("hex");
  const r = run(dir, apk, "mock-stable");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const rec = JSON.parse(readFileSync(join(dir, "frozen", "mock-stable.frozen.json"), "utf8"));
  assert.equal(rec.sha256, expect);
  assert.equal(rec.label, "mock-stable");
  assert.ok(existsSync(join(dir, "frozen", `mock-stable-${rec.commit}.apk`)));
});

test("re-freezing identical bytes is a no-op (immutable, idempotent)", () => {
  const dir = stage();
  const apk = join(dir, "app.apk"); writeFileSync(apk, "identical bytes");
  assert.equal(run(dir, apk, "mock-stable").status, 0);
  const again = run(dir, apk, "mock-stable");
  assert.equal(again.status, 0);
  assert.match(again.stdout, /already frozen/);
});

test("re-freezing DIFFERENT bytes under the same label+commit is REFUSED", () => {
  const dir = stage();
  const apk = join(dir, "app.apk"); writeFileSync(apk, "version 1");
  assert.equal(run(dir, apk, "mock-stable").status, 0);
  writeFileSync(apk, "version 2 — different"); // same path/label/commit, different content
  const r = run(dir, apk, "mock-stable");
  assert.notEqual(r.status, 0, "must refuse to overwrite a frozen artifact with a different hash");
  assert.match(r.stdout + r.stderr, /REFUSING|immutable/);
});

test("missing APK path fails cleanly", () => {
  const dir = stage();
  const r = run(dir, join(dir, "nope.apk"), "mock-stable");
  assert.notEqual(r.status, 0);
});
