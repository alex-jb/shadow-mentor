# Device candidate history

| Candidate | SHA-256 (prefix) | app-label | launchable | status |
|---|---|---|---|---|
| shadow-lens-v11-beampro-candidate-01.apk | 8ea859df | unity | **NO** (no MAIN/LAUNCHER; UnityPlayerActivity exported=false) | FAILED on device — preserved as evidence |
| shadow-lens-v11-beampro-candidate-02.apk | 6ee4d4ff | **Shadow Lens** | **YES** (UnityPlayerActivity exported=true + MAIN + LAUNCHER) | BUILT + aapt-launchable; on-device PENDING Alex |

## candidate-01 → candidate-02 defect + fix
- **Defect (device-diagnosed):** the final merged manifest had `UnityPlayerActivity` but no MAIN
  intent, no LAUNCHER category, `exported=false` → `monkey`: "No activities found to run";
  `am start`: SecurityException (not exported). aapt: no launchable-activity.
- **Root cause:** the offline base manifest `Assets/Plugins/Android/AndroidManifest.xml` declares
  `<application>` with **no activity** (it only strips INTERNET). Because it is present, it REPLACES
  Unity's default launcher manifest, so the MAIN/LAUNCHER + exported activity are lost. candidate-01
  did not stash it (candidate-01's build predates the fix); the XREAL candidate is not the offline
  build.
- **Fix (candidate-02):** the build now STASHES that manifest during the XREAL build (same as the
  V8/V10 XREAL builds → Unity generates its default launcher manifest with MAIN/LAUNCHER +
  exported=true), sets `productName = "Shadow Lens"`, and runs a mandatory post-build **aapt2
  launchability assertion** (package/versionName/versionCode/application-label/exactly-one
  launchable-activity == UnityPlayerActivity) that **fails the build** if any check fails. Assertion
  PASSED. candidate-01 is preserved unchanged as failed evidence.

Preserved: candidate-01 (8ea859df) · stable v10-core (9efadf0a) · frozen verifier (c478b46f) — all
unchanged. ARM64 · IL2CPP · minSdk29 · target34 · camera OFF · Eye OFF · non-production-signed ·
AuditWorkspace default — all kept.
