# Official Unity MCP — connection decision

## Decision

```
NOT_SAFE_FOR_EXTERNAL_READONLY
```

Claude Code was **not** connected to Unity. No Shadow worktree was opened in Unity. The
`chore/shadow-v11-unity-mcp-ux-readonly` evaluation worktree was **not** created, per the §8 gate.

## Gate results

| Requirement for `SAFE_TO_CONNECT_ISOLATED_READONLY` | Result |
|---|---|
| exact pinned package resolves | **pass** — `2.0.0-pre.1` resolved exactly |
| package compiles / is supported on the target editor | **fail** — declares `unityRelease: 60f1`; Shadow is on `6000.0.23f1` |
| relay behaviour is understood | **fail** — relay is binary-only (4 platform builds + a Codex ACP gateway binary); its behaviour cannot be verified |
| no uncontrolled network listener | **partial pass** — the Editor bridge uses a Unix domain socket / named pipe with no TCP bind; the relay's own behaviour is unauditable |
| direct external connection requires approval | **pass** — `approval_pending` / `approval_denied` protocol + `ConnectionValidator` / `SecurityTierClassifier` |
| approvals can be revoked | **pass** — project-local `Library/AI.MCP/connections.asset` |
| only pure read tools are exposed | **fail** — the reads the audit needs exist only inside mixed tools |
| disabled tools are removed **or rejected** Editor/server-side | **fail** — removed from discovery, **not rejected on execution** |
| required reads do not share a tool with writes | **fail** — `ManageScene`, `ManageGameObject`, `ManageEditor`, `ReadConsole` each fuse the needed read with create/save/delete/Play/Clear |
| dynamic/custom tools cannot bypass the allowlist | **fail** — `TypeCache` discovery across all assemblies + `RegisterTool` + `AgentToolMcpAdapter` auto-registration, and execution is ungated |
| rollback proven | **pass** — nothing was installed into any Shadow worktree |
| no safety control depends only on prompt discipline | **fail** — with execution ungated, "do not call the write tools" is precisely prompt discipline |

Six failures. Any one of the last four is disqualifying on its own.

## Why not `SAFE_ONLY_WITH_ADDITIONAL_PROXY_FILTER`

A proxy could reject `tools/call` by name and even by `action` value. It would not fix the root
condition: the Unity Editor executes any tool named on the socket, regardless of settings. A proxy
moves the only real control outside the vendor's trust boundary and protects exactly one client path
while the socket stays open to any locally approved process. Calling that "read-only" would overstate
what is actually enforced.

## The pragmatic finding

The only genuinely pure-read tools are `Unity.ListResources`, `Unity.ReadResource`,
`Unity.FindInFile`, `Unity.GetSha` and `Unity.ManageScript_capabilities` — all **file-level**. They
cannot return a scene graph, resolved component values, `Camera.main`, XR Origin state, canvas render
modes, or clipping planes. Every observation the Shadow XR/UX audit wants requires
`Unity.ManageScene` / `Unity.ManageGameObject`, which are mixed read/write.

So the safe subset of this MCP surface delivers **only what plain file reading already delivers** —
which this session can do directly, with no relay, no approval state, and no execution surface. The
risk buys no capability.

## Consequences for the Shadow UX work

```
SHADOW_UX_AUDIT_BLOCKED_BY_MCP_SAFETY
```

The XR/UX/UI audit the operator actually wants is **not blocked as work** — only this delivery
mechanism is. Scene composition, camera setup, canvas/TMP configuration, panel geometry, bilingual
label handling and bootstrap order are all determined by files already in this repository
(`Assets/ShadowLens/Workspace/*.cs`, the V11 scene-construction code in
`Editor/ShadowV11BeamProCandidate.cs`, `demos/replay/3d/*`), and previous increments audited exactly
these surfaces from source plus real Editor PlayMode captures produced through the normal project
workflow — not through MCP.

Recommended next increment: run the Shadow XR/UX/UI audit **without** Unity MCP, from source plus the
existing EditMode/PlayMode capture harness (which already produces the 14-state × language × profile
matrix). That path needs no new trust surface, no Unity version change, and no package installation.

## Flags unchanged

`SHADOW_MR_PACKAGE_HANDOFF_PASSED` · `SHADOW_XREAL_LOADER_DEVICE_PASSED` ·
`AUDIT_WORKSPACE_RENDERED_IN_GLASSES` · `XREAL_3DOF_DEVICE_VALIDATED` ·
`BEAM_PRO_CONTROLLER_VALIDATED` · `OST_READABILITY_DEVICE_VALIDATED` · `PRODUCTION_READY` — all
remain **false**. candidate-05 not built. No UX change implemented.
