# Capture health — operator acceptance / 操作者验收

`shadow-record status` 只观察本地采集状态，帮助区分缓存中、未封存、已验证和异常产物。它不会恢复会话、补写事件、封包、创建目录或写错误日志，也不会调用签名私钥加载器。输出仅包含状态、计数和诊断码，不回显钩子内容、模型身份、文件路径或日志原文。

`status` observes local capture artifacts without recovery, event writes, sealing, directory creation or error-log writes. It does not load the signing private key. Output contains states, counts and diagnostic codes rather than hook contents, model identities, filesystem paths or raw logs.

## Commands / 命令

From the repository root / 在仓库根目录执行：

```bash
SHADOW_DIR="/path/to/capture" node packages/adapter-claude-code/bin/shadow-record.mjs status session-123
SHADOW_DIR="/path/to/capture" node packages/adapter-claude-code/bin/shadow-record.mjs status session-123 --json
SHADOW_DIR="/path/to/capture" node packages/adapter-claude-code/bin/shadow-record.mjs status session-123 --json --public-key "/path/to/ed25519-public.pem"
```

未设置 `SHADOW_DIR` 时使用 `~/.shadow`。验证默认读取 `keys/public.pem`；`--public-key` 可指定公开的 Ed25519 SPKI PEM（`BEGIN PUBLIC KEY`）。请只指定公钥文件：私钥 PEM 不被接受为验证材料，也不会打印其内容。会话 ID 为 1–128 个字符，首位必须是字母或数字，其余仅允许字母、数字、`.`、`_`、`-`。

The default directory is `~/.shadow`, with verification using `keys/public.pem` unless a public Ed25519 SPKI PEM is supplied. Private-key PEM is not accepted as verification material. Session IDs must match `[A-Za-z0-9][A-Za-z0-9._-]{0,127}`.

## States and exit codes / 状态与退出码

| `health_state`         | Exit | Observation / 观察结果                                                                                                                                                          |
| ---------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NO_CAPTURE_ARTIFACTS` |    1 | No buffered hooks, store or bundle observed; an empty queue also yields this state. / 未观察到缓存钩子、会话存储或包；空队列也属于此状态。                                      |
| `BUFFERED`             |    0 | Valid pending hooks await materialization. / 有效钩子仍在等待生成会话存储。                                                                                                     |
| `OPEN_UNSEALED`        |    0 | A structurally valid session store exists without a seal. / 会话存储结构有效，尚未封存。                                                                                        |
| `SEALED_VERIFIED`      |    0 | Bundle integrity verifies with the supplied public key and matches the sealed store. / 包通过公钥完整性验证，并与封存的会话存储一致。                                           |
| `SEALED_UNVERIFIABLE`  |    1 | A consistent sealed bundle is present, but an acceptable public key is unavailable. / 封存产物一致，但缺少可用的公钥。                                                          |
| `INCONSISTENT`         |    1 | Artifacts disagree, such as sealed data with pending hooks, a missing sealed bundle, or store/bundle mismatch. / 产物不一致，例如封存后仍有待处理钩子、缺少包或存储与包不匹配。 |
| `INVALID`              |    1 | Malformed, unsafe or oversized artifacts, or failed integrity checks, were detected. / 检出格式损坏、不安全、超限或完整性验证失败的产物。                                       |

无效会话 ID、未知或重复选项、缺少选项值返回 **2**。无法完成观察返回 **1**，只打印固定的失败说明。退出 **0** 不是采集完整、提供方真实或业务获批的证明。结构问题优先于产物一致性问题显示。

Invalid IDs or unsupported, duplicate or incomplete arguments exit **2**. Observation failures exit **1** with a fixed message. Exit **0** does not establish complete capture, provider authenticity or approval; malformed artifacts take precedence over consistency findings.

## JSON contract / JSON 契约

`schema_version` is **`shadow-capture-health/v1`**. Its boundary fields remain:

```text
read_only: true
capture_completeness: UNVERIFIED
provider_origin: UNVERIFIED
resume_support: UNSUPPORTED
snapshot_consistency: BEST_EFFORT_LOCAL_READ
```

`observations.pending` 提供存在性、有效性及钩子数；`store` 提供事件数与封存标志，验证程度为 `STRUCTURE_ONLY` 或 `MATCHED_VERIFIED_BUNDLE`；`bundle` 提供验证状态、事件数与终止分类。未观察或未检查的字段保留 `null`，不补造计数。

Pending, store and bundle observations distinguish presence, validation and counts. Store structure checks alone are not cryptographic verification. Missing or unchecked values remain `null`.

| `bundle.termination`       | Meaning / 含义                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT_SEALED`               | No classified sealed bundle. / 尚无可分类的封存包。                                                                                                             |
| `PARTIAL_SEAL`             | `header.session_ended_at_utc` is `null`. / 明确部分封存，结束时间为空。                                                                                         |
| `RECORDED_SESSION_END`     | A recorded `session_end` event has `actor=agent`, with an end time. / 有结束时间，并记录了 `actor=agent` 的结束事件。                                           |
| `MANUAL_OR_UNOBSERVED_END` | End time exists without that agent event; a manually appended end is kept separate. / 有结束时间，但未记录上述 agent 事件；人工补写的结束不会算作原生结束记录。 |

“Recorded” 描述签名记录中的事件分类，不认证事件来自真实 Claude 会话。人工或部分封存仍可能得到 `SEALED_VERIFIED`，因为终止分类与签名完整性相互独立。

“Recorded” describes the signed event classification, not authenticated Claude origin. A manual or partial seal can still be `SEALED_VERIFIED`; termination and integrity are separate observations.

## Limits and acceptance boundary / 限制与验收边界

- 单个待处理队列、会话存储、包或公钥文件限 **16 MiB**，超限拒绝。观察到的产物文件与采集子目录拒绝符号链接。文件读取检查变化，但多个文件之间没有原子快照保证。
  Each pending, store, bundle or public-key file is limited to **16 MiB**. Observed artifact files and capture subdirectories reject symlinks. Reads check for changes; there is no atomic snapshot across artifacts.
- `adapter-errors.log` 只观察存在性与字节大小，不读取内容；标为 **`GLOBAL_UNATTRIBUTED`**。`UNATTRIBUTED_ERROR_HISTORY` 不证明所查询会话发生了错误。
  Error-log metadata is global and unattributed. Historical log presence does not establish a failure in the requested session.
- 封存会话续接为 **`UNSUPPORTED`**。此命令不修复队列、不补齐漏失钩子、不执行模型或工具；公钥验证也不建立外部锚点、签名者身份、完整采集、提供方来源或业务批准。
  Sealed-session resume is unsupported. Status neither repairs capture nor runs a model or tool. Public-key integrity checks do not establish external anchors, signer identity, complete capture, provider origin or approval.

本轮验收范围为受控的合成钩子、只读检查与实际 CLI 子进程。**真实提供方会话尚未验收**；本地最佳努力观察不应被展示为完整运行证明。

Acceptance scope is controlled synthetic hooks, read-only observations and actual CLI subprocesses. **No real provider session has been accepted.** Best-effort local observations are not proof of a complete run.

Offline checks / 离线检查：

```bash
node --test test/adapter-claude-code-health.test.js test/adapter-claude-code-health-cli.test.js
```

Implementation: [health.js](../packages/adapter-claude-code/lib/health.js) · [status CLI](../packages/adapter-claude-code/bin/shadow-record.mjs).
