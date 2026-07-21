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
