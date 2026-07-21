// Compilation-isolation guard for the Unity assemblies (catches the CS1069 class of failure
// statically, so the contract-drift test can't miss a module-reference regression again).
// Verifies: the CORE assembly never USES UnityWebRequest (comments allowed); the UnityTransport
// assembly declares the UnityEngine.UnityWebRequestModule precompiled reference + references the
// core; and the live transport uses the correct Unity 6 API/namespace.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SA = join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent");
const UT = join(SA, "UnityTransport");

// a non-comment line that contains the token
function usesToken(file, token) {
  return readFileSync(file, "utf8").split("\n").some((ln) => {
    const t = ln.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return false;
    return t.includes(token);
  });
}

test("CORE assembly never USES UnityWebRequest (only UnityTransport may)", () => {
  const coreFiles = readdirSync(SA).filter((f) => f.endsWith(".cs"));
  for (const f of coreFiles) {
    assert.equal(usesToken(join(SA, f), "UnityWebRequest"), false, `${f} uses UnityWebRequest — it must live in UnityTransport`);
    assert.equal(usesToken(join(SA, f), "using UnityEngine.Networking"), false, `${f} imports UnityEngine.Networking outside UnityTransport`);
  }
});

test("UnityTransport asmdef references the core + declares the UnityWebRequestModule", () => {
  const asm = JSON.parse(readFileSync(join(UT, "ShadowLens.SpatialAgent.UnityTransport.asmdef"), "utf8"));
  assert.ok(asm.references.includes("ShadowLens.SpatialAgent"), "must reference the core assembly");
  assert.equal(asm.overrideReferences, true, "overrideReferences must be true to add the module");
  assert.ok((asm.precompiledReferences ?? []).some((r) => /UnityWebRequestModule\.dll$/.test(r)), "must list UnityEngine.UnityWebRequestModule.dll");
});

test("live transport uses the correct Unity 6 API + namespace", () => {
  const src = readFileSync(join(UT, "ShadowSpatialAgentLiveTransport.cs"), "utf8");
  assert.match(src, /using UnityEngine\.Networking;/);
  assert.match(src, /new UnityWebRequest\(/);
  // guard against the wrong namespaces / a locally declared type
  assert.equal(/UnityEngine\.Network\b/.test(src.replace(/UnityEngine\.Networking/g, "")), false);
  assert.equal(/System\.Net\.UnityWebRequest/.test(src), false);
  assert.equal(/class\s+UnityWebRequest\b/.test(src), false);
});

test("core asmdef stays minimal (no override/module needed there)", () => {
  const core = JSON.parse(readFileSync(join(SA, "ShadowLens.SpatialAgent.asmdef"), "utf8"));
  assert.notEqual(core.overrideReferences, true, "core must not need overrideReferences");
});

test("Android build script imports the official build-report namespace (guards CS0246)", () => {
  const p = join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Editor/ShadowLensAndroidBuild.cs");
  const src = readFileSync(p, "utf8");
  // BuildResult/BuildReport must be reachable: either the using, or fully-qualified references.
  const hasUsing = /using UnityEditor\.Build\.Reporting;/.test(src);
  const fullyQualified = /UnityEditor\.Build\.Reporting\.BuildResult/.test(src);
  assert.ok(hasUsing || fullyQualified, "must import UnityEditor.Build.Reporting or fully-qualify BuildResult");
  assert.match(src, /BuildReport\s+\w+\s*=\s*BuildPipeline\.BuildPlayer/, "must use the official BuildReport return type");
  assert.match(src, /using UnityEditor;/, "must keep using UnityEditor (BuildPipeline/BuildPlayerOptions)");
});

test("Android build script lives in an Editor-only asmdef (not the Android player)", () => {
  const editorAsm = JSON.parse(readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Editor/ShadowLens.Editor.asmdef"), "utf8"));
  assert.deepEqual(editorAsm.includePlatforms, ["Editor"], "Editor asmdef must be Editor-only");
  assert.notEqual(editorAsm.overrideReferences, true, "Editor asmdef must not override-block Unity editor modules");
});

// ── §7 Android JNI isolation (guards the AndroidJavaObject CS1069) ──
const SL = join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens");
function csUsesToken(file, token) {
  return readFileSync(file, "utf8").split("\n").some((ln) => { const t = ln.trim(); return !t.startsWith("//") && !t.startsWith("*") && t.includes(token); });
}
function allCs(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...allCs(p)); else if (e.name.endsWith(".cs")) out.push(p);
  }
  return out;
}

test("AndroidJavaObject is used ONLY in the isolated AndroidBridge layer (Providers/)", () => {
  for (const f of allCs(SL)) {
    if (f.includes("/Providers/")) continue;
    assert.equal(csUsesToken(f, "AndroidJavaObject"), false, `${f} uses AndroidJavaObject outside the Android-specific assembly`);
    assert.equal(csUsesToken(f, "AndroidJavaClass"), false, `${f} uses AndroidJavaClass outside the Android-specific assembly`);
  }
});

test("ShadowLens.AndroidBridge asmdef references the JNI module + the core", () => {
  const asm = JSON.parse(readFileSync(join(SL, "Providers/ShadowLens.AndroidBridge.asmdef"), "utf8"));
  assert.ok(asm.references.includes("ShadowLens"), "must reference the ShadowLens core");
  assert.equal(asm.overrideReferences, true);
  assert.ok((asm.precompiledReferences ?? []).some((r) => /AndroidJNIModule\.dll$/.test(r)), "must reference UnityEngine.AndroidJNIModule.dll");
});

test("core ShadowLens asmdef does NOT reference the JNI module (isolation)", () => {
  const core = JSON.parse(readFileSync(join(SL, "ShadowLens.asmdef"), "utf8"));
  assert.equal((core.precompiledReferences ?? []).some((r) => /AndroidJNIModule/.test(r)), false);
  assert.equal(core.references.some((r) => /AndroidBridge/.test(r)), false, "core must not reference the AndroidBridge assembly (would be a cycle)");
});

test("Android JNI providers keep the platform guard; mocks remain in the core", () => {
  assert.match(readFileSync(join(SL, "Providers/AndroidBridgeProviders.cs"), "utf8"), /#if UNITY_ANDROID && !UNITY_EDITOR/);
  // the editor/desktop mock OCR provider is in the core (available without Android JNI)
  assert.ok(csUsesToken(join(SL, "Core/ShadowLensRuntime.cs"), "MockOcrProvider"));
});

test("androidjni built-in module is enabled in the Unity manifest", () => {
  const m = JSON.parse(readFileSync(join(ROOT, "apps/shadow-lens/unity/Packages/manifest.json"), "utf8"));
  assert.ok(m.dependencies["com.unity.modules.androidjni"], "com.unity.modules.androidjni must be enabled");
});

test("mock Android APK does not require SHADOW_XREAL_SDK", () => {
  const build = readFileSync(join(SL, "Editor/ShadowLensAndroidBuild.cs"), "utf8");
  assert.equal(/PlayerSettings.*SHADOW_XREAL_SDK.*=|SetScriptingDefineSymbols\([^)]*SHADOW_XREAL_SDK/.test(build), false, "the mock build must not set SHADOW_XREAL_SDK");
});
