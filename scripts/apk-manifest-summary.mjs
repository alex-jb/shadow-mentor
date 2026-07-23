#!/usr/bin/env node
// scripts/apk-manifest-summary.mjs
// Deterministic APK manifest summary for the V11 device-validation diff. Parses `aapt2 dump xmltree`
// + `aapt2 dump badging` into a stable JSON shape so the official XREAL control APK and a Shadow
// candidate can be compared field-by-field instead of by eye. Emits no absolute paths.
//
//   node scripts/apk-manifest-summary.mjs <apk> [--label <name>] [--out <json>]
//
// aapt2 is located from the Unity Android module or PATH; pass --aapt2 to override.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

export function findAapt2(explicit) {
  if (explicit) return explicit;
  const roots = [
    "/Applications/Unity/Hub/Editor/6000.0.23f1/PlaybackEngines/AndroidPlayer/SDK/build-tools",
    join(process.env.HOME ?? "", "Library/Android/sdk/build-tools"),
  ];
  for (const r of roots) {
    if (!existsSync(r)) continue;
    const vs = readdirSync(r).sort();
    for (const v of vs.reverse()) {
      const p = join(r, v, "aapt2");
      if (existsSync(p)) return p;
    }
  }
  return null;
}

// aapt2 xmltree is an indented tree: `E: tag (line=N)` and `A: attr(0xNNN)="value" (Raw: "value")`.
// Parse it into nested {tag, attrs, children} without depending on aapt2 formatting beyond indent.
export function parseXmlTree(text) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [{ indent: -1, node: root }];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const t = line.trim();
    if (t.startsWith("E: ")) {
      const tag = t.slice(3).replace(/\s*\(line=\d+\).*$/, "").trim();
      const node = { tag, attrs: {}, children: [] };
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      (stack[stack.length - 1]?.node ?? root).children.push(node);
      stack.push({ indent, node });
    } else if (t.startsWith("A: ")) {
      const body = t.slice(3);
      const m = body.match(/^([^(=\s]+)(?:\([^)]*\))?=(.*)$/);
      if (!m) continue;
      // aapt2 prints attributes fully namespaced: `http://schemas.android.com/apk/res/android:name`
      const name = m[1].replace(/^https?:\/\/schemas\.android\.com\/apk\/res\/android:/, "").replace(/^android:/, "");
      let value = m[2].trim();
      const rawM = value.match(/\(Raw:\s*"([^"]*)"\)/);
      if (rawM) value = rawM[1];
      else value = value.replace(/^"|"$/g, "");
      const owner = stack[stack.length - 1]?.node;
      if (owner) owner.attrs[name] = value;
    }
  }
  return root;
}

const find = (node, tag) => node.children.filter((c) => c.tag === tag);
const deep = (node, tag, acc = []) => {
  for (const c of node.children) { if (c.tag === tag) acc.push(c); deep(c, tag, acc); }
  return acc;
};

export function summarize(tree) {
  const manifest = find(tree, "manifest")[0] ?? tree;
  const app = find(manifest, "application")[0] ?? { attrs: {}, children: [] };
  const metaOf = (n) => Object.fromEntries(find(n, "meta-data").map((m) => [m.attrs.name, m.attrs.value ?? ""]));
  const intentFilters = (n) =>
    find(n, "intent-filter").map((f) => ({
      actions: find(f, "action").map((a) => a.attrs.name).sort(),
      categories: find(f, "category").map((a) => a.attrs.name).sort(),
    }));
  const actShape = (a) => ({
    name: a.attrs.name,
    exported: a.attrs.exported ?? "(unset)",
    launchMode: a.attrs.launchMode ?? "(unset)",
    taskAffinity: a.attrs.taskAffinity ?? "(unset)",
    screenOrientation: a.attrs.screenOrientation ?? "(unset)",
    targetActivity: a.attrs.targetActivity,
    meta: metaOf(a),
    intentFilters: intentFilters(a),
  });
  const activities = find(app, "activity").map(actShape).sort((x, y) => x.name.localeCompare(y.name));
  const aliases = find(app, "activity-alias").map(actShape).sort((x, y) => x.name.localeCompare(y.name));
  const launchers = [...activities, ...aliases]
    .filter((a) => a.intentFilters.some((f) => f.actions.includes("android.intent.action.MAIN") &&
      f.categories.includes("android.intent.category.LAUNCHER")))
    .map((a) => a.name);
  return {
    package: manifest.attrs.package,
    versionCode: manifest.attrs.versionCode,
    versionName: manifest.attrs.versionName,
    minSdk: (find(manifest, "uses-sdk")[0]?.attrs.minSdkVersion) ?? null,
    targetSdk: (find(manifest, "uses-sdk")[0]?.attrs.targetSdkVersion) ?? null,
    applicationLabel: app.attrs.label ?? null,
    applicationMeta: metaOf(app),
    launcherActivities: launchers.sort(),
    activities,
    activityAliases: aliases,
    services: find(app, "service").map((s) => ({ name: s.attrs.name, exported: s.attrs.exported ?? "(unset)" })).sort((a, b) => a.name.localeCompare(b.name)),
    providers: find(app, "provider").map((p) => ({ name: p.attrs.name, authorities: p.attrs.authorities, exported: p.attrs.exported ?? "(unset)" })).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    queries: deep(manifest, "queries").flatMap((q) => q.children.map((c) => ({ kind: c.tag, name: c.attrs.name ?? c.attrs.action }))),
    usesPermissions: find(manifest, "uses-permission").map((p) => p.attrs.name).sort(),
    usesFeatures: find(manifest, "uses-feature").map((f) => ({ name: f.attrs.name ?? `glEs:${f.attrs.glEsVersion}`, required: f.attrs.required ?? "(unset)" })).sort((a, b) => a.name.localeCompare(b.name)),
    usesNativeLibraries: find(app, "uses-native-library").map((l) => ({ name: l.attrs.name, required: l.attrs.required ?? "(unset)" })),
  };
}

export function apkStructure(apk, aapt2) {
  const tree = execFileSync(aapt2, ["dump", "xmltree", "--file", "AndroidManifest.xml", apk], { maxBuffer: 64 << 20 }).toString();
  const badging = execFileSync(aapt2, ["dump", "badging", apk], { maxBuffer: 64 << 20 }).toString();
  const s = summarize(parseXmlTree(tree));
  const libs = execFileSync("unzip", ["-Z1", apk], { maxBuffer: 64 << 20 }).toString()
    .split("\n").filter((l) => l.startsWith("lib/"));
  const abis = [...new Set(libs.map((l) => l.split("/")[1]))].sort();
  const xrealLibs = libs.filter((l) => /nr_|xreal|NRSDK/i.test(l)).map((l) => basename(l)).sort();
  const bytes = statSync(apk).size;
  return {
    ...s,
    abis,
    nativeLibraryCount: libs.length,
    xrealNativeLibraries: [...new Set(xrealLibs)],
    apk: { fileName: basename(apk), bytes, sha256: createHash("sha256").update(readFileSync(apk)).digest("hex") },
    badgingLaunchable: [...badging.matchAll(/^launchable-activity: name='([^']+)'/gm)].map((m) => m[1]),
  };
}

// Fields that decide whether an app can be discovered + launched as an XREAL MR entry. Everything
// else is app identity or content and must not be reported as an MR-handoff difference.
export const MR_CRITICAL_FIELDS = [
  "launcherActivities", "applicationMeta.nreal_sdk", "applicationMeta.com.nreal.supportDevices",
  "applicationMeta.nr_features", "applicationMeta.com.xreal.entry", "applicationMeta.com.xreal.mainActivity",
  "activityNames", "activityAliasNames", "activityIntentFilters", "activityExported",
  "activityTaskAffinity", "activityLaunchMode", "xrealNativeLibraries", "minSdk", "targetSdk", "abis",
];
// Identity fields that MUST differ between two distinct apps — never a finding.
export const EXPECTED_DIFFERENT = ["package", "versionCode", "versionName", "applicationLabel", "apk", "label"];

const flatten = (s) => {
  const f = {
    launcherActivities: (s.launcherActivities ?? []).join(","),
    activityNames: (s.activities ?? []).map((a) => a.name).join(","),
    activityAliasNames: (s.activityAliases ?? []).map((a) => a.name).join(","),
    activityIntentFilters: JSON.stringify((s.activities ?? []).map((a) => [a.name, a.intentFilters])),
    activityExported: JSON.stringify((s.activities ?? []).map((a) => [a.name, a.exported])),
    activityTaskAffinity: JSON.stringify((s.activities ?? []).map((a) => [a.name, a.taskAffinity])),
    activityLaunchMode: JSON.stringify((s.activities ?? []).map((a) => [a.name, a.launchMode])),
    xrealNativeLibraries: (s.xrealNativeLibraries ?? []).join(","),
    minSdk: s.minSdk, targetSdk: s.targetSdk, abis: (s.abis ?? []).join(","),
    services: (s.services ?? []).map((x) => x.name).join(","),
    providers: (s.providers ?? []).map((x) => x.name).join(","),
    usesPermissions: (s.usesPermissions ?? []).join(","),
  };
  for (const [k, v] of Object.entries(s.applicationMeta ?? {})) f[`applicationMeta.${k}`] = v;
  for (const k of ["com.xreal.entry", "com.xreal.mainActivity"]) if (!(`applicationMeta.${k}` in f)) f[`applicationMeta.${k}`] = "(absent)";
  return f;
};

// Compare a control summary against a candidate summary. Returns same/different field lists, with
// MR-critical fields separated from the rest so a cosmetic difference can never be read as a cause.
export function diffSummaries(control, candidate) {
  const a = flatten(control), b = flatten(candidate);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const same = [], different = [];
  for (const k of keys) {
    const rec = { field: k, control: a[k] ?? "(absent)", candidate: b[k] ?? "(absent)", mrCritical: MR_CRITICAL_FIELDS.includes(k) };
    (String(a[k]) === String(b[k]) ? same : different).push(rec);
  }
  const mrCriticalDifferences = different.filter((d) => d.mrCritical);
  return {
    controlLabel: control.label, candidateLabel: candidate.label,
    mrCriticalFieldsCompared: MR_CRITICAL_FIELDS.length,
    mrCriticalIdentical: mrCriticalDifferences.length === 0,
    mrCriticalDifferences,
    otherDifferences: different.filter((d) => !d.mrCritical),
    identicalFields: same.map((s) => s.field),
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith("apk-manifest-summary.mjs");
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  if (args[0] === "--diff") {
    const [ctrl, cand] = [opt("--control"), opt("--candidate")];
    const d = diffSummaries(JSON.parse(readFileSync(ctrl, "utf8")), JSON.parse(readFileSync(cand, "utf8")));
    const json = JSON.stringify(d, null, 2);
    if (opt("--out")) { writeFileSync(opt("--out"), json + "\n"); console.error("wrote " + opt("--out")); }
    else console.log(json);
    process.exit(0);
  }
  const apk = args.find((a) => !a.startsWith("--") && a.endsWith(".apk"));
  const aapt2 = findAapt2(opt("--aapt2"));
  if (!apk || !existsSync(apk)) { console.error("usage: node scripts/apk-manifest-summary.mjs <apk> [--label X] [--out file.json]"); process.exit(2); }
  if (!aapt2) { console.error("aapt2 not found — pass --aapt2 <path>"); process.exit(2); }
  const out = { label: opt("--label") ?? basename(apk), ...apkStructure(apk, aapt2) };
  const json = JSON.stringify(out, null, 2);
  if (opt("--out")) { writeFileSync(opt("--out"), json + "\n"); console.error("wrote " + opt("--out")); }
  else console.log(json);
}
