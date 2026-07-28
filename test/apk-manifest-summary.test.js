// The candidate-05 decision rests on the official-control vs Shadow-candidate manifest diff, so the
// parser + differ are pinned here. Pure functions only — no APK, no aapt2, no device required.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseXmlTree, summarize, diffSummaries, MR_CRITICAL_FIELDS } from "../scripts/apk-manifest-summary.mjs";

// aapt2 prints attributes fully namespaced and nests children deeper than their parent's attributes.
const TREE = `N: android=http://schemas.android.com/apk/res/android
  E: manifest (line=2)
    A: android:versionCode(0x0101021b)=(type 0x10)0x72
    A: android:versionName(0x0101021c)="0.11-x" (Raw: "0.11-x")
    A: package="com.example.app" (Raw: "com.example.app")
    E: uses-sdk (line=5)
      A: android:minSdkVersion(0x0101020c)=(type 0x10)0x1d
      A: android:targetSdkVersion(0x01010270)=(type 0x10)0x22
    E: uses-permission (line=8)
      A: android:name(0x01010003)="android.permission.INTERNET" (Raw: "android.permission.INTERNET")
    E: application (line=10)
      A: android:label(0x01010001)=@0x7f060005
      E: meta-data (line=12)
        A: http://schemas.android.com/apk/res/android:name(0x01010003)="nreal_sdk" (Raw: "nreal_sdk")
        A: http://schemas.android.com/apk/res/android:value(0x01010024)="true" (Raw: "true")
      E: meta-data (line=15)
        A: http://schemas.android.com/apk/res/android:name(0x01010003)="com.nreal.supportDevices" (Raw: "com.nreal.supportDevices")
        A: http://schemas.android.com/apk/res/android:value(0x01010024)="1|XrealLight|2|XrealAir" (Raw: "1|XrealLight|2|XrealAir")
      E: activity (line=18)
        A: http://schemas.android.com/apk/res/android:name(0x01010003)="ai.nreal.activitylife.NRXRActivity" (Raw: "ai.nreal.activitylife.NRXRActivity")
        A: http://schemas.android.com/apk/res/android:exported(0x01010010)=(type 0x12)0xffffffff
        A: http://schemas.android.com/apk/res/android:taskAffinity(0x0101001b)="xreal.unity" (Raw: "xreal.unity")
        E: intent-filter (line=22)
          E: action (line=23)
            A: http://schemas.android.com/apk/res/android:name(0x01010003)="android.intent.action.MAIN" (Raw: "android.intent.action.MAIN")
          E: category (line=25)
            A: http://schemas.android.com/apk/res/android:name(0x01010003)="android.intent.category.LAUNCHER" (Raw: "android.intent.category.LAUNCHER")
      E: activity (line=28)
        A: http://schemas.android.com/apk/res/android:name(0x01010003)="com.unity3d.player.UnityPlayerActivity" (Raw: "com.unity3d.player.UnityPlayerActivity")
`;

test("parser strips the android namespace from attribute names", () => {
  const s = summarize(parseXmlTree(TREE));
  assert.equal(s.package, "com.example.app");
  assert.equal(s.versionName, "0.11-x");
  assert.equal(s.minSdk, "(type 0x10)0x1d"); // raw form is preserved verbatim, never invented
  assert.deepEqual(s.activities.map((a) => a.name), [
    "ai.nreal.activitylife.NRXRActivity",
    "com.unity3d.player.UnityPlayerActivity",
  ]);
});

test("application meta-data is read from the application element, not from activities", () => {
  const s = summarize(parseXmlTree(TREE));
  assert.equal(s.applicationMeta.nreal_sdk, "true");
  assert.equal(s.applicationMeta["com.nreal.supportDevices"], "1|XrealLight|2|XrealAir");
  // the activity's OWN meta must not leak up into applicationMeta
  assert.equal(s.applicationMeta["unityplayer.UnityActivity"], undefined);
});

test("launcher activity is derived from MAIN+LAUNCHER, not from declaration order", () => {
  const s = summarize(parseXmlTree(TREE));
  assert.deepEqual(s.launcherActivities, ["ai.nreal.activitylife.NRXRActivity"]);
});

test("an intent-filter nested under an activity binds to that activity", () => {
  const s = summarize(parseXmlTree(TREE));
  const nrxr = s.activities.find((a) => a.name.endsWith("NRXRActivity"));
  const unity = s.activities.find((a) => a.name.startsWith("com.unity3d"));
  assert.equal(nrxr.intentFilters.length, 1);
  assert.equal(unity.intentFilters.length, 0); // must NOT inherit the sibling's filter
  assert.equal(nrxr.taskAffinity, "xreal.unity");
});

const base = () => ({ label: "x", ...summarize(parseXmlTree(TREE)), xrealNativeLibraries: ["libXREALXRPlugin.so"], abis: ["arm64-v8a"] });

test("identity-only differences are NOT reported as MR-critical", () => {
  const control = { ...base(), label: "control" };
  const candidate = { ...base(), label: "candidate", package: "com.other", versionName: "9.9", versionCode: "999" };
  const d = diffSummaries(control, candidate);
  assert.equal(d.mrCriticalIdentical, true);
  assert.equal(d.mrCriticalDifferences.length, 0);
  assert.equal(d.otherDifferences.length, 0);
});

test("a missing MR meta-data IS reported as an MR-critical difference", () => {
  const control = base();
  const candidate = base();
  delete candidate.applicationMeta.nreal_sdk;
  const d = diffSummaries(control, candidate);
  assert.equal(d.mrCriticalIdentical, false);
  const f = d.mrCriticalDifferences.find((x) => x.field === "applicationMeta.nreal_sdk");
  assert.equal(f.control, "true");
  assert.equal(f.candidate, "(absent)");
});

test("com.xreal.entry is always compared, even when absent from both APKs", () => {
  // isEntryApp() reads this application meta-data, so its ABSENCE is a fact the diff must state
  // rather than silently omit.
  const d = diffSummaries(base(), base());
  assert.ok(d.identicalFields.includes("applicationMeta.com.xreal.entry"));
  assert.ok(MR_CRITICAL_FIELDS.includes("applicationMeta.com.xreal.entry"));
});

test("a launcher-activity change is MR-critical", () => {
  const control = base();
  const candidate = base();
  candidate.launcherActivities = ["com.unity3d.player.UnityPlayerActivity"];
  const d = diffSummaries(control, candidate);
  assert.equal(d.mrCriticalIdentical, false);
  assert.ok(d.mrCriticalDifferences.some((x) => x.field === "launcherActivities"));
});
