# Unity toolchain discovery

**Status: UNITY TOOLCHAIN FOUND AND VERIFIED RUNNING.** Corrects the prior increment's wrong
conclusion that "no Unity binary" was available — that was a PATH check only, not a real check.

## Verified facts
| Item | Value |
|---|---|
| Unity executable | `/Applications/Unity/Hub/Editor/6000.0.23f1/Unity.app/Contents/MacOS/Unity` (`test -x` → **UNITY_FOUND**) |
| Installed editors | `6000.0.23f1`, `6000.5.4f1` (Hub/Editor) |
| Project | `apps/shadow-lens/unity` |
| Project version | `m_EditorVersion: 6000.0.23f1` (exact match) |
| Android module | `PlaybackEngines/AndroidPlayer` present → **ANDROID_MODULE_FOUND** |
| Batchmode / license | launches + runs headless EditMode to completion, licensed (log shows clean shutdown + results XML) |
| Existing test scripts | `scripts/check-unity-android.sh`; capture harness `Assets/ShadowLens/Tests/PlayMode/ShadowLensV11CaptureHarness.cs` (env-gated `SHADOW_CAPTURE=1`) |
| Browser (visual acceptance) | Google Chrome present (`/Applications/Google Chrome.app`); no puppeteer/playwright module — drive via chrome-devtools MCP |

## EditMode baseline run (this session)
```
Unity -batchmode -nographics -projectPath apps/shadow-lens/unity \
      -runTests -testPlatform EditMode -testResults <xml> -logFile <log>
```
Result XML: **total=123 · passed=123 · failed=0 · skipped=0 · result="Passed"** (includes
`ShadowTokenParityTests`). So the generated-token C# adapter + design tokens compile and the semantic
parity holds in-engine.

## Invocation patterns for this increment
- EditMode tests: `-batchmode -nographics -runTests -testPlatform EditMode -testResults <xml>`
- PlayMode / capture harness: `SHADOW_CAPTURE=1 … -runTests -testPlatform PlayMode -testFilter ".*V11Capture.*"` (needs graphics; not `-nographics`)

## Correction logged
The previous `FLOW_INSPIRED_INCREMENT_STATUS.md` / `V11_FINAL_STATUS.md` claim that Unity was
unavailable was **wrong** and is superseded by this document. Unity work proceeds.
