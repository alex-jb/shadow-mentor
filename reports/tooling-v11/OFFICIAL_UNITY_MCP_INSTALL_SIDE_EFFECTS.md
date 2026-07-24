# Official Unity MCP — installation side effects, relay auditability, IPC surface

## Package composition

| Class | Count / content |
|---|---|
| `SOURCE_AVAILABLE` | **1811 C# files** — `Editor/`, `Runtime/`, `Modules/` including the whole `Unity.AI.MCP.Editor` module (tools, registry, settings, connection, security) |
| `MANAGED_BINARY_ONLY` | **15 managed DLLs** — `Microsoft.CodeAnalysis.dll` + `Microsoft.CodeAnalysis.CSharp.dll` (Roslyn), `Microsoft.ML.Tokenizers.dll`, `Google.Protobuf.dll`, `System.Text.Json.dll`, `System.Reflection.Metadata.dll`, `Markdig`, `System.Runtime.CompilerServices.Unsafe.dll`, … |
| `NATIVE_BINARY_ONLY` | **the relay and the ACP gateway** — see table below. No source ships for either. |
| `DOCUMENTATION_ONLY` | `Documentation~`, `README.md`, `CHANGELOG.md`, `Third Party Notices.md`, `LICENSE.md` |

The Roslyn C# compiler DLLs are present because a shipped tool compiles and executes C# at runtime
(see `Unity.RunCommand` in the capability matrix).

## Relay — binary only

`RelayApp~/relay.json`: `{"name":"unity-ai-relay","version":"1.0.11","protocolVersion":"1.0","capabilities":["acp","replay"]}`

| File | Size (bytes) | SHA-256 (first 16) | Type |
|---|---|---|---|
| `relay_mac_arm64` | 25,870,534 | `7f5a8e440304705b` | Zip archive (packed app bundle) |
| `relay_mac_x64` | 28,177,011 | `1e04debd8f4b1c7c` | Zip archive (packed app bundle) |
| `relay_linux` | 117,724,776 | `a64c55f1e12535c2` | ELF 64-bit x86-64 |
| `relay_win.exe` | 129,099,696 | `93d172b46a1c941d` | PE32+ x86-64 |
| `gateway/codex-acp-darwin-arm64` | 71,678,880 | `8b56187f031a0955` | Mach-O 64-bit arm64 |
| `gateway/codex-acp-darwin-x64` | 75,811,248 | `c7175206cea7c8ee` | Mach-O 64-bit x86_64 |
| `gateway/codex-acp.exe` | 75,316,704 | `ce226fbe9ee5e32d` | PE32+ x86-64 |

**"Official Unity package" is not the same as "fully auditable source."** The component that sits
between an external MCP client and the Unity Editor is shipped **binary-only**, and the package
additionally bundles a **Codex ACP gateway** binary — a client for a third-party agent provider.
Any claim that the relay enforces a restriction cannot be verified from this package.

## IPC / network surface (Editor side — source-available, therefore verifiable)

- Transport is a **Unix domain socket** (`Connection/UnixSocketListener.cs`, `UnixSocketTransport.cs`)
  on macOS/Linux and a **named pipe** (`NamedPipeListener.cs`) on Windows.
- **No `TcpListener`, no `IPAddress`, no socket bind to an IP interface anywhere in the Editor
  bridge.** The Editor side therefore opens no network port and cannot be reached from another host.
- The relay's own listening behaviour is **not auditable** (binary). Statements about what the relay
  binds to are outside what this audit can prove.

## Approval model

- `Security/` implements real client validation: `ConnectionValidator`, `ProcessValidator`,
  `ExecutableIdentityCollector`/`Comparer`, `ParentProcessHelper`, `McpSessionTokenRegistry`,
  `SecurityTierClassifier` (tier `Trusted` requires "Server is Unity's AND client is signed").
- `Bridge.cs` sends `approval_pending` / `approval_denied` protocol messages, so a new external client
  must be approved by the operator before its commands are processed.
- Approvals persist in **`Library/AI.MCP/connections.asset`** (`ScriptableSingleton` with
  `FilePathAttribute.Location.ProjectFolder`) → approval is **per project**, remembered across
  sessions, and a previously approved client reconnects without re-prompting. Revocation means
  clearing that registry entry (project-local, under `Library/`, which is not committed).

## Writes outside the project

Within the audit project, package installation wrote only to the project's own `Packages/manifest.json`,
`Library/PackageCache/`, and Unity's normal editor state. No pre-existing relay directory existed
before this task, and none was created outside the disposable project during it. The relay binaries
ship **inside** the PackageCache copy of the package.

## Removal

Delete the `com.unity.ai.assistant` entry from `Packages/manifest.json` and let UPM re-resolve; the
PackageCache copy (including the relay binaries) is removed with it. Approval state is a project-local
file under `Library/`. Because the entire evaluation ran in a disposable project outside this
repository, removal for Shadow is a no-op: **nothing was installed into any Shadow worktree.**
