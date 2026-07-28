# candidate-03 runtime diagnosis (real Beam Pro + glasses log)

Source: `~/Desktop/beam-pro-v11-test/candidate-03-glasses-launch-03.txt` (2398 lines, 333 KB, real
Wi-Fi-ADB capture). Package com.shadowlens.xrealvoice, PID 28893, UnityPlayerActivity topResumed.

## Primary category (evidence-backed, single)
**`XR_LOADER_NOT_INITIALIZED`** — the XREAL XR loader began initialization but FAILED to complete.

### The decisive line
```
07-23 12:40:37.287  E Unity : Unable to start XREAL XR Plugin. Failed to get XREAL Settings.
     Unity.XR.XREAL.XREALXRLoader:Initialize()
     UnityEngine.XR.Management.XRManagerSettings:InitializeLoaderSync()
     UnityEngine.XR.Management.XRGeneralSettings:InitXRSDK()
```

## Root cause
`XREALSettings.GetSettings()` returned null at runtime because the **XREALSettings ScriptableObject was
never embedded in the player**. The XREAL SDK embeds it via `XREALBuildProcessor : XRBuildHelper<
XREALSettings>` (`BuildSettingsKey => "com.unity.xr.management.xrealsettings"`), which reads the config
object registered under that key in `EditorBuildSettings` and adds it as a preloaded asset. In this
project `ProjectSettings/EditorBuildSettings.asset` `m_configObjects` contains ONLY
`com.unity.xr.management.loader_settings` — the `com.unity.xr.management.xrealsettings` key is **absent**.
So the build helper embedded no settings → runtime `GetSettings()` == null → the plugin refused to
start → no XRDisplaySubsystem → the glasses stayed in Nebula OS and the Audit Workspace never rendered
in the glasses (it renders only on the Beam Pro phone display, displayId=0).

This happened because the loader was assigned programmatically (Assets/XR loader present) but the XREAL
settings were never registered as a build config object (that normally happens when the XREAL settings
UI is opened in XR Plug-in Management; a scripted setup skipped it).

## §2 — answers from evidence
| Question | Answer | Evidence |
|---|---|---|
| XRGeneralSettings initialize? | YES | `XRGeneralSettings:Awake()` / `InitXRSDK()` |
| XRManagerSettings present? | YES | `XRManagerSettings:InitializeLoaderSync()` |
| activeLoader type/name? | `Unity.XR.XREAL.XREALXRLoader` | `[XREALXRLoader] Init` + `XREALXRLoader:Initialize()` |
| XREALXRLoader initialize? | STARTED then FAILED | `Initialize()` → `E Unity: Unable to start XREAL XR Plugin` |
| XREALXRLoader start? | NO | plugin start aborted on the settings failure |
| XRDisplaySubsystem count / running? | none running | no display-subsystem-running lines; glasses stayed in Nebula OS |
| XRInputSubsystem running? | no | (plugin never started) |
| XREAL native libraries load? | YES | `XREALPackageVersion: 3.1.0`, `GetPluginVersion: 3.0.20251121`, `[XR][SessionManager] InitUnityInterfaces` |
| Bind to MyGlasses? | client bind present, but 3D session not established | `ClientBindService … bindService: has Bind`; `GlassesInitProvider … init successful` |
| Glasses plug event received? | init provider ran | `GlassesInitSetting init successful` |
| Device category recognized? | not reached | plugin aborted before device negotiation |
| Request to switch to 3D mode? | NO | plugin never started; no 3D-mode request |
| MyGlasses accept/reject 3D? | N/A | no request issued |
| Paused/resumed by Nebula? | app stayed focused/alive | topResumedActivity = UnityPlayerActivity, PID 28893 alive |
| Overlay/multi-resume permission denied? | no denial seen | no permission-denied lines |
| XR camera / XR Origin present? | **NO XR Origin in the scene** (see config diagnosis) | the built scene has a plain Main Camera + AuditWorkspaceBootstrap only |
| Process exit? | NO | remained alive, no SIGSEGV/FATAL/AndroidRuntime |

## Fix (candidate-04, evidence-justified)
Register the XREALSettings asset as the build config object before building:
`EditorBuildSettings.AddConfigObject("com.unity.xr.management.xrealsettings", <Assets/XR/Settings/XREALSettings.asset>, true)`.
Then `XRBuildHelper<XREALSettings>` embeds it → runtime `GetSettings()` succeeds → the XR plugin can
start. (Secondary: the built scene should also contain a valid XR camera/XR Origin, not just
Camera.main — addressed in candidate-04 if the settings fix alone does not bring up the display
subsystem on the next physical test.)

## Not claimed
No glasses rendering, no 3DoF/controller/OST validation — the plugin never started. Those stay FALSE
pending the next physical test of candidate-04.
