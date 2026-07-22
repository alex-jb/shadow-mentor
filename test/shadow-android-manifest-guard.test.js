// Regression guard: the base guided-story candidate must stay offline / least-privilege. The
// INTERNET permission was declared by Unity's engine library by default; we strip it with a custom
// main manifest (tools:node="remove"). This test fails if that fix is removed, and — when an APK is
// present — asserts the built APK declares no forbidden permission.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "apps/shadow-lens/unity/Assets/Plugins/Android/AndroidManifest.xml");

test("custom main manifest exists and removes INTERNET via the manifest merger", () => {
  assert.ok(existsSync(MANIFEST), "Assets/Plugins/Android/AndroidManifest.xml must exist");
  const m = readFileSync(MANIFEST, "utf8");
  assert.match(m, /xmlns:tools=/, "declares the tools namespace");
  assert.match(m, /android\.permission\.INTERNET"\s+tools:node="remove"/, "removes INTERNET via tools:node=remove");
});

test("the base build script never force-adds INTERNET", () => {
  const build = readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Editor/GuidedStory/ShadowGuidedStoryAndroidBuild.cs"), "utf8");
  assert.match(build, /forceInternetPermission\s*=\s*false/, "base candidate sets forceInternetPermission = false");
  // if it were ever set to true, this guard fails
  assert.equal(/forceInternetPermission\s*=\s*true/.test(build), false, "must not force INTERNET on the base candidate");
});

test("built APK (when present) declares no forbidden permission", () => {
  const apk = join(ROOT, "apps/shadow-lens/unity/Build/Android/shadow-lens-guided-story-v5-candidate.apk");
  if (!existsSync(apk)) return; // APK is a gitignored build artifact; the source guards above still enforce the fix
  const res = execFileSync("node", [join(ROOT, "scripts/audit-android-permissions.mjs"), apk], { encoding: "utf8" });
  assert.match(res, /least privilege/, "permission audit passes");
});
