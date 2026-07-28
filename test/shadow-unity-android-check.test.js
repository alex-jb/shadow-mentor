// §5 regression: check-unity-android.sh detects the Android modules whether Unity Hub stores them
// BESIDE Unity.app (<root>/PlaybackEngines/AndroidPlayer) or under Unity.app/Contents, and reports
// MISS when neither exists. Builds fixture install roots and runs the real script.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/check-unity-android.sh");

// Populate a full AndroidPlayer tree (SDK/NDK/OpenJDK/adb/IL2CPP) under `playerDir`.
function fullPlayer(playerDir) {
  mkdirSync(join(playerDir, "SDK", "platform-tools"), { recursive: true });
  const adb = join(playerDir, "SDK", "platform-tools", "adb");
  writeFileSync(adb, "#!/bin/sh\n"); chmodSync(adb, 0o755);
  mkdirSync(join(playerDir, "NDK"), { recursive: true });
  mkdirSync(join(playerDir, "OpenJDK"), { recursive: true });
  mkdirSync(join(playerDir, "Variations", "il2cpp"), { recursive: true }); // version-variant name
}
function run(root) { return spawnSync("bash", [SCRIPT, root], { encoding: "utf8", env: { ...process.env, PATH: "/usr/bin:/bin" } }); }

test("modules stored BESIDE Unity.app (<root>/PlaybackEngines/AndroidPlayer)", () => {
  const root = mkdtempSync(join(tmpdir(), "unity-beside-"));
  fullPlayer(join(root, "PlaybackEngines", "AndroidPlayer"));
  const r = run(root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ALL PRESENT/);
  assert.match(r.stdout, /Android Build Support:/);
  assert.match(r.stdout, /IL2CPP Android support:/);
});

test("modules stored under Unity.app/Contents/PlaybackEngines/AndroidPlayer", () => {
  const root = mkdtempSync(join(tmpdir(), "unity-contents-"));
  fullPlayer(join(root, "Unity.app", "Contents", "PlaybackEngines", "AndroidPlayer"));
  const r = run(root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ALL PRESENT/);
});

test("passing the .app/Contents path still normalizes to the install root", () => {
  const root = mkdtempSync(join(tmpdir(), "unity-arg-"));
  fullPlayer(join(root, "PlaybackEngines", "AndroidPlayer"));
  const r = run(join(root, "Unity.app", "Contents"));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ALL PRESENT/);
});

test("neither path present → MISS + non-zero exit + install steps", () => {
  const root = mkdtempSync(join(tmpdir(), "unity-none-"));
  const r = run(root);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /MISS Android Build Support/);
  assert.match(r.stdout, /Add Modules/);
});

test("IL2CPP detection tolerates a version-variant directory name", () => {
  const root = mkdtempSync(join(tmpdir(), "unity-il2-"));
  const player = join(root, "PlaybackEngines", "AndroidPlayer");
  fullPlayer(player);
  // rename-ish: also add a variant folder that only matches the glob
  mkdirSync(join(player, "Variations", "il2cpp_arm64"), { recursive: true });
  const r = run(root);
  assert.match(r.stdout, /IL2CPP Android support:/);
});
