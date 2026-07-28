# Official Unity MCP — package resolution (`com.unity.ai.assistant@2.0.0-pre.1`)

Audited in a **disposable Unity project outside this repository**, containing no Shadow assets, no
XREAL SDK, no candidate APK, no credentials. The Shadow V11 worktree was never opened in Unity and
its `Packages/manifest.json` / `packages-lock.json` were never touched.

## Requested vs resolved

| Field | Value |
|---|---|
| Requested | `com.unity.ai.assistant@2.0.0-pre.1` (pinned, never `latest`) |
| Resolved | `com.unity.ai.assistant` **2.0.0-pre.1** — exact match |
| Source | Unity package registry, materialized into the project's `Library/PackageCache` |
| Upstream repo (from `package.json`) | Unity-internal (`github.cds.internal.unity3d.com/unity/muse-editor.git`) — **not publicly readable** |
| Declared editor requirement | **`unity: 6000.0`, `unityRelease: 60f1`** |
| Editor used by Shadow | **6000.0.23f1** |

## Unity 6000.0.23f1 compatibility

**The package declares a minimum editor release of `6000.0.60f1`. Shadow is on `6000.0.23f1`, which
is 37 releases below the declared minimum.**

The package did resolve and materialize into the PackageCache of a 6000.0.23f1 project — UPM does not
hard-block on `unityRelease` — but the declaration is the vendor's own supported-version statement.
Running it on 23f1 would be an unsupported configuration, and Shadow's editor version is pinned by
every candidate build in this project (candidates 01–04 and the stable APK were all produced with
6000.0.23f1).

This is an **independent blocker** from the security findings: even if the security surface were
acceptable, adopting this package would require moving Shadow's editor version, which is out of scope
here and would invalidate the candidate-build baseline.

Batchmode note: the post-install editor launch did not exit within a 7-minute budget and was
terminated. The log shows the licensing client failing signature validation
(`LicensingClient has failed validation; ignoring` / `Access token is unavailable`), consistent with
an editor waiting on account state for an AI package. Package resolution itself completed
(`Done registering packages`) and the PackageCache contents were fully materialized, which is what
the audit needs. **No account was signed in and no AI provider was authenticated.**

## Dependencies pulled in

`com.unity.nuget.newtonsoft-json@3.2.1` · `com.unity.serialization@3.1.1` ·
`com.unity.cloud.gltfast@6.14.1` · `com.unity.mathematics@1.3.2` · `com.unity.2d.sprite@1.0.0` ·
`com.unity.modules.unitywebrequest` · `com.unity.modules.uielements`

`2.0.0-pre.1` is a **monopackage merge**: its changelog records that `com.unity.ai.toolkit` and
`com.unity.ai.generators` were merged into `com.unity.ai.assistant`. Installing "the MCP server"
therefore also installs the AI asset generators (image/mesh/sound/animation/PBR), the model selector,
account/compliance modules, and a Codex ACP gateway — not an MCP server alone.

## Decision inputs produced here

- exact pinned version resolves: **yes**
- vendor-declared editor compatibility with 6000.0.23f1: **no** (`60f1` required)
- package source publicly auditable: **partially** — 1811 C# files are readable; the relay is not
  (see `OFFICIAL_UNITY_MCP_INSTALL_SIDE_EFFECTS.md`)
