# Official Unity MCP — capability matrix (`com.unity.ai.assistant@2.0.0-pre.1`)

Every row is read from the tool's `[McpTool(...)]` attribute and its handler source in
`Modules/Unity.AI.MCP.Editor/Tools/`, plus the action enums in `Tools/Parameters/`. No row is
classified from the tool's name. Machine-readable: `official-unity-mcp-tools.json`.

19 tools ship with `[McpTool]` attributes. (Ten further `[McpTool("greet_person")]`-style names appear
only inside XML doc-comment examples and do not register.)

| MCP name | Groups | Actions in the one tool | Classification | Safe for a Shadow read-only profile? |
|---|---|---|---|---|
| `Unity.RunCommand` | `core`,`scripting`, **`EnabledByDefault = true`** | "Compile and execute a C# script in the Unity Editor" | **EXECUTE_CODE** | **No — must be disabled** |
| `Unity.ManageMenuItem` | `core`,`editor` | `EditorApplication.ExecuteMenuItem(menuPath)` | **EXECUTE_CODE** | No |
| `Unity.ManageScene` | `core`,`scene` | `Create`, `Load`, `Save`, `GetHierarchy`, `GetActive`, `GetBuildSettings` | **MIXED_READ_WRITE** | No — reads fused with create/load/save |
| `Unity.ManageGameObject` | `core`,`scene` | `find`, `get_components`, `create`, `modify`, `delete`, `add_component`, `remove_component`, `set_component_property` | **MIXED_READ_WRITE** / DELETE_OR_DESTRUCTIVE | No — the exact reads needed are fused with mutation |
| `Unity.ManageEditor` | `core`,`editor` | `Play`, `Pause`, `Stop`, `GetState`, `GetProjectRoot`, tag/layer management | **MIXED_READ_WRITE** / BUILD_OR_RUN | No — Play Mode in the same tool as `GetState` |
| `Unity.ManageAsset` | `core`,`assets` | `Import`, `Create`, `Modify`, … | **WRITE_PROJECT** | No |
| `Unity.ReadConsole` | `debug`,`editor` | `Get` **and** `Clear` (reflects `UnityEditor.LogEntries.Clear`) | **MIXED_READ_WRITE** | No — Get and Clear are not separable server-side |
| `Unity.ManageScript` | `core`,`scripting` | script read/create/update/delete | **MIXED_READ_WRITE** | No |
| `Unity.CreateScript` | `core`,`scripting` | create C# file | WRITE_PROJECT | No |
| `Unity.DeleteScript` | `core`,`scripting` | delete C# file | **DELETE_OR_DESTRUCTIVE** | No |
| `Unity.ApplyTextEdits` | `core`,`scripting` | apply text edits to files | WRITE_PROJECT | No |
| `Unity.ScriptApplyEdits` | `core`,`scripting` | structured script edits | WRITE_PROJECT | No |
| `Unity.ManageShader` | `assets`,`scripting` | shader create/edit/delete | WRITE_PROJECT | No |
| `Unity.ImportExternalModel` | `core`,`assets` | import external model files | WRITE_PROJECT / EXTERNAL | No |
| `Unity.ValidateScript` | `core`,`scripting` | Roslyn validation of C# | MIXED (compiles input) | No |
| `Unity.ManageScript_capabilities` | `core`,`scripting` | capability report | PURE_READ | Yes, but useless for XR/UX review |
| `Unity.GetSha` | `core`,`scripting` | file hash | PURE_READ | Yes, but useless for XR/UX review |
| `Unity.ListResources` | `core`,`resources` | list project resources | **PURE_READ** | Yes |
| `Unity.ReadResource` | `core`,`resources` | read a resource's content | **PURE_READ** | Yes |
| `Unity.FindInFile` | `core`,`resources` | search inside a file | **PURE_READ** | Yes |

## Dynamically registered tools

- `McpToolRegistry.DiscoverTools()` uses `TypeCache.GetMethodsWithAttribute<McpToolAttribute>()`,
  which scans **every loaded assembly** — any package or project script carrying `[McpTool]`
  auto-registers.
- `McpToolRegistry.RegisterTool(...)` allows arbitrary runtime registration.
- `Adapters/AgentToolMcpAdapter.cs` automatically re-exports the AI Assistant's own **AgentTools** as
  MCP tools (`ToolCategory.Assistant`), and re-runs registration on domain reload.

The exposed tool set is therefore **not a fixed list** — it grows with whatever assemblies are loaded
in the project being inspected.

## What the four clean reads can and cannot do

`Unity.ListResources`, `Unity.ReadResource`, `Unity.FindInFile` (+ `Unity.GetSha`) operate on **files**.
They cannot return a scene graph, resolved component values, `Camera.main`, XR Origin state, canvas
render modes, or anything else that requires the live Editor object model. Everything the Shadow
XR/UX audit actually needs (§11 of the task) is only reachable through `Unity.ManageScene` and
`Unity.ManageGameObject` — both of which are mixed read/write tools.

**Reading files is something this session can already do directly with normal file tools, without
Unity, without a relay, and without any of this risk surface.** The MCP connection adds nothing that
is both useful and safe.
