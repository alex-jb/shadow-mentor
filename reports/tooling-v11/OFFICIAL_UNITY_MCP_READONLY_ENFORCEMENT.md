# Official Unity MCP — is read-only actually enforced?

## Classification

```
CLIENT_ALLOWLIST_ONLY
```

Not `SERVER_ENFORCED`. Not `EDITOR_REGISTRY_ENFORCED`.

## The finding, from source

Disabling a tool affects **discovery only**. It does not affect **execution**.

`Modules/Unity.AI.MCP.Editor/Bridge.cs` → `ExecuteCommandAsync(...)`:

```csharp
// Route command through the registry
object result = await McpToolRegistry.ExecuteToolAsync(command.type, paramsObject);
```

`ToolRegistry/McpToolRegistry.cs` → `ExecuteToolAsync(...)`:

```csharp
if (!k_Tools.TryGetValue(toolName, out var handler))
    throw new ArgumentException($"Tool '{toolName}' not found. ...");
...
var result = await handler.ExecuteAsync(parameters);
```

`k_Tools` is the **full discovered registry**, not the enabled subset. **`IsToolEnabled` is never
consulted on the execution path.** Its only two call sites are:

```csharp
// McpToolRegistry.GetAvailableTools  — the `get_available_tools` discovery response
if (ignoreEnabledState || settings.IsToolEnabled(name)) toolsList.Add(...);
// McpToolRegistry (tool info for the settings UI)
IsEnabled = settings.IsToolEnabled(name),
```

**Consequence:** a client that disables `Unity.RunCommand` in the settings UI removes it from the
advertised tool list, and then a command whose `type` is `Unity.RunCommand` still compiles and
executes C# in the Editor. The toggle is a *visibility* control, not an *authorisation* control.

## Point-by-point answers

| Question | Answer | Evidence |
|---|---|---|
| Can tools be disabled individually? | Yes | `MCPSettings.SetToolEnabled` + `disabledToolOverrides` |
| Do disabled tools disappear from discovery? | **Yes** | `GetAvailableTools` filters on `IsToolEnabled` |
| Are disabled tools rejected when invoked directly? | **No** | `ExecuteToolAsync` has no enabled-state check |
| Do action-level allowlists exist? | **No** | no per-action gate anywhere in `Tools/` or the registry |
| Can input schemas constrain action values? | Not as a security control — the schema is generated from the params type (`SchemaGenerator`), and the handler switches on the action itself | `Tools/Parameters/*.cs` |
| Enforced by the relay? | **Unverifiable** — the relay is binary-only | `RelayApp~/relay_*` |
| Enforced by the Editor registry? | **No** (execution path) | above |
| Client-side only? | **Effectively yes** | above |
| Category filtering granularity | Category, not tool; `ToolCategory.Core` is in `AlwaysEnabledCategories` and cannot be disabled; `ShouldIncludeTool` is **OR** across a tool's categories | `ToolRegistry/ToolCategories.cs` |
| Do custom tools register automatically? | **Yes** — `TypeCache.GetMethodsWithAttribute<McpToolAttribute>()` across all loaded assemblies, plus `RegisterTool(...)`, plus `AgentToolMcpAdapter` re-exporting Assistant AgentTools | `McpToolRegistry.DiscoverTools`, `Adapters/AgentToolMcpAdapter.cs` |
| Can custom tools bypass the visible toggles? | They appear in settings, but since execution is ungated, a name is enough | above |
| Do ResourceTools expose project files? | Yes — `ListResources` / `ReadResource` / `FindInFile` | `Tools/ResourceTools.cs` |
| Can ResourceTools write? | No — all three are read paths | `Tools/ResourceTools.cs` |
| Are tool settings project-local or user-global? | Category state is in **EditorPrefs** (`UnityMCP.EnabledCategories`, user-global); per-tool overrides live in MCP settings | `ToolCategories.cs` |
| Is client approval per project? | Yes — `Library/AI.MCP/connections.asset`, `FilePathAttribute.Location.ProjectFolder` | `Connection/ConnectionRegistry.cs` |
| Do approved clients reconnect automatically? | Yes — the registry persists | above |
| Is there a first-class external-client read-only mode? | **No** | no such mode exists in the source |

## Note on the category system

Even the *discovery* filter is weaker than it looks. Every destructive tool is tagged `core`:
`RunCommand{core,scripting}`, `DeleteScript{core,scripting}`, `ManageAsset{core,assets}`,
`ManageGameObject{core,scene}`, `ManageScene{core,scene}`, `ManageMenuItem{core,editor}`,
`ImportExternalModel{core,assets}`. `ToolCategories.AlwaysEnabledCategories = Core` and
`ShouldIncludeTool` returns true if **any** of a tool's categories is enabled — so turning off the
"Scripting", "Assets", "Scene" and "Editor" categories does not remove them from the category filter's
perspective. Only the per-tool override reaches them, and that override does not bind execution.

## What would be required for a safe read-only setup

1. A filtering proxy between the MCP client and the relay that rejects `tools/call` for any name
   outside an allowlist **and** inspects the `action` field of mixed tools. Name-level filtering alone
   is insufficient because every needed read shares a tool with writes.
2. That proxy would still only constrain traffic that goes through it. The Unity Editor's Unix socket
   remains reachable by any local process that passes client approval, and the approval registry
   remembers prior approvals.
3. It cannot compensate for the ungated execution path — it relocates the control to a component
   outside the vendor's trust boundary.

**No safety control here can be described as read-only without depending on the client behaving.**
That is exactly the condition the task defines as "not safely read-only."
