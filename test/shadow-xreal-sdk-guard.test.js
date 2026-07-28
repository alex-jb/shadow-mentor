// Regression guards for the operator-local XREAL SDK strategy: the committed tree must NEVER contain
// an absolute ~/Downloads path, a file: tarball reference, or the licensed SDK binary. The base
// project must build without the SDK (no SHADOW_XREAL_SDK define committed, no com.xreal.xr in the
// committed manifest). The imageconversion module (a built-in Unity module) IS expected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tracked = () => execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);

test("no tracked file contains an absolute ~/Downloads or /Users/.../com.xreal path", () => {
  for (const f of tracked()) {
    if (/\.(md|sh|mjs|js|json|cs|txt)$/.test(f) === false) continue;
    if (f.includes("shadow-xreal-sdk-guard.test.js")) continue; // this guard names the pattern
    const t = readFileSync(join(ROOT, f), "utf8");
    assert.equal(/file:\/Users\/[^"]*com\.xreal/.test(t), false, `${f} has a committed absolute file: path to the SDK`);
    assert.equal(/["']\/Users\/[a-z]+\/Downloads\/com\.xreal/.test(t), false, `${f} hardcodes ~/Downloads SDK path`);
  }
});

test("the licensed SDK tarball / package is not committed", () => {
  for (const f of tracked()) {
    assert.equal(/com\.xreal\.xr\.tar\.gz$/.test(f), false, "the 248MB SDK tarball must not be committed");
    assert.equal(/PackageCache\/com\.xreal\.xr/.test(f), false, "the imported SDK package must not be committed");
  }
});

test("the working-tree manifest has no com.xreal.xr DEPENDENCY (a // comment mentioning it is fine)", () => {
  const m = JSON.parse(readFileSync(join(ROOT, "apps/shadow-lens/unity/Packages/manifest.json"), "utf8"));
  assert.equal("com.xreal.xr" in (m.dependencies ?? {}), false, "the licensed SDK must not be a committed dependency");
  // the built-in imageconversion module IS expected (it fixes the SDK's Camera-Features build)
  assert.ok("com.unity.modules.imageconversion" in (m.dependencies ?? {}), "imageconversion module present");
});

test("the reproducible setup + check scripts exist and are portable", () => {
  for (const s of ["scripts/setup-local-xreal-sdk.sh", "scripts/check-local-xreal-sdk.sh"]) {
    assert.ok(existsSync(join(ROOT, s)), `${s} exists`);
    const t = readFileSync(join(ROOT, s), "utf8");
    assert.equal(/\/Users\/[a-z]+\//.test(t), false, `${s} must not hardcode a user path`);
  }
});

test("the gated Xreal assembly is excluded without the define (defineConstraints)", () => {
  const asm = JSON.parse(readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Xreal/ShadowLens.Xreal.asmdef"), "utf8"));
  assert.ok((asm.defineConstraints ?? []).includes("SHADOW_XREAL_SDK"), "asmdef must be gated by SHADOW_XREAL_SDK");
  assert.ok(asm.references.includes("Unity.XR.XREAL"), "references the real SDK assembly");
});
