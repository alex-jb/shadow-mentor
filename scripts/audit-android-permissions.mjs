#!/usr/bin/env node
// Least-privilege permission gate for the guided-story BASE candidate. Runs `aapt dump permissions`
// on the APK and fails (exit 1) if any forbidden permission is present. Used as a build/CI gate and
// by test/shadow-android-manifest-guard.test.js. If aapt or the APK is absent it reports that and
// exits 0 for the static path (the manifest-source guard in the test still enforces the fix).
//
//   node scripts/audit-android-permissions.mjs [apk-path]
import { existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// The base candidate must NOT declare any of these.
const FORBIDDEN = [
  "android.permission.INTERNET",
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
];

function findAapt() {
  const bt = "/Applications/Unity/Hub/Editor/6000.0.23f1/PlaybackEngines/AndroidPlayer/SDK/build-tools";
  if (existsSync(bt)) {
    for (const v of readdirSync(bt).sort().reverse()) {
      const p = join(bt, v, "aapt");
      if (existsSync(p)) return p;
    }
  }
  const env = process.env.ANDROID_SDK_ROOT;
  if (env && existsSync(join(env, "build-tools"))) {
    for (const v of readdirSync(join(env, "build-tools")).sort().reverse()) {
      const p = join(env, "build-tools", v, "aapt");
      if (existsSync(p)) return p;
    }
  }
  return null;
}

const apk = process.argv[2] || "apps/shadow-lens/unity/Build/Android/shadow-lens-guided-story-v5-candidate.apk";
if (!existsSync(apk)) { console.log(`[perm-audit] APK not present (${apk}); static manifest guard still applies.`); process.exit(0); }
const aapt = findAapt();
if (!aapt) { console.log("[perm-audit] aapt not found; static manifest guard still applies."); process.exit(0); }

const out = execFileSync(aapt, ["dump", "permissions", apk], { encoding: "utf8" });
const declared = [...out.matchAll(/uses-permission:\s*name='([^']+)'/g)].map((m) => m[1]);
const bad = declared.filter((p) => FORBIDDEN.includes(p));
console.log(`[perm-audit] declared: ${declared.join(", ") || "(none)"}`);
if (bad.length) { console.error(`[perm-audit] FORBIDDEN permission(s) present: ${bad.join(", ")}`); process.exit(1); }
console.log("[perm-audit] OK — least privilege (no INTERNET/camera/mic/storage/location).");
process.exit(0);
