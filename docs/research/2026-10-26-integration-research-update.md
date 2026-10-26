# Shadow 深度研究更新：从集成平台收窄到验收证据

核验日期：2026 年 10 月 26 日（纽约）。延续 [10 月 15 日方向评审](./2026-10-15-project-direction-review.md)。本轮新增两组实际执行记录；只新增研究代码和文档，不改变 Shadow 产品运行逻辑。

## 决策变化

上轮优先验证“Agent 集成诊断与升级验收”。本轮将其定位进一步收窄为可复用的工程组件和研究试点，暂不投入独立通用平台。理由有两个：Scope 等现有工具直接覆盖配置比较与任务诊断；本轮复现的已知问题用普通、明确断言的集成测试就能判断。

值得继续验证的具体工作是：将失败记录变成最小复现，并让接手者准确区分“检查完成且通过”“发现失败”“没有覆盖”和“尚不能判断”。这不是已证明的市场空白或论文贡献。签名可以绑定一份报告，不能证明该报告检查充分、结论真实或有人实质复核。

## 实际执行一：FastMCP Host／Origin 故障机制

依据 [Data360 PR146](https://github.com/worldbank/data360-mcp/pull/146) 的公开修复，本轮使用真实 FastMCP 包构建最小 ASGI 应用，执行 10 个预先写定的配置场景。所有请求通过内存中的 TestClient；没有连接 Data360 服务，也没有调用模型。

| 检查 | 本轮观察 |
| --- | --- |
| 默认 base URL，health 与 MCP initialize | 都返回 200，响应内容符合预期 |
| 将外部域名直接设为 TestClient base URL | health 返回 200；该构造会隐式允许相同 server host |
| 默认 base URL，显式传入外部 Host | health 与 initialize 均返回 421 |
| 仅允许指定 Host，但传入不同 Origin | initialize 返回 403 |
| 明确允许指定 Host 和 Origin | initialize 返回 200，且 JSON-RPC 结果、协议与 serverInfo 正确 |
| 同一窄允许列表下的未知 Host／Origin | 分别返回 421／403 |
| wildcard 历史修复参照 | initialize 返回 200；只作研究对照，不作为生产配置建议 |

10 个场景全部与预期一致，其中 421／403 是预期拒绝，并不是 10 项业务操作成功。脚本显式固定 guard 开关，并拒绝不符合预定版本的主要依赖。

测试环境：Python 3.12.14；fastmcp-slim[server] 3.4.3、MCP 1.25.0、Starlette 1.3.1、HTTPX 0.28.1。完整版本清单与源码摘要见 [实际记录](../../research/integration-acceptance-20261026/observed-results.json)。Starlette 对 HTTPX 给出弃用警告，本轮保留 HTTPX 以对齐案例使用的版本。

**边界：这是已知故障的机制复现，不是完整 Data360 应用复现，也不是历史依赖升级前后环境的完整比较。** 多数传递依赖按本次安装时解析，并已另行固定版本。没有测量工具调用、业务最终状态或生产故障率。

本轮还核对了上游锁文件：PR123 前 base `9d1d59a4cb50f5570292380eee516a95701726c9` 锁 FastMCP 2.14.1；PR146 前 base `6ab140afe5a8cef9c0bb085b277037e58b945d87` 与合并提交 `355e8a7c83480f1fc8e78bbe03fba658d2389989` 均锁 FastMCP 3.4.3。此前目录只记录了依赖范围，不能将范围直接当成安装版本。PR123 的 merge SHA 与 issue 引用 SHA 分开保留，不据此认定任一引用错误。

上游已经加入四项针对性的回归检查。这支持“补齐部署测试”，不能支持“必须训练新的 AI 验证模型”。

## 实际执行二：验收器自己的历史假通过

[mcp-contracts 0.8.3 修复记录](https://github.com/mcp-contracts/mcp-contracts/blob/v0.8.3/CHANGELOG.md) 描述了发现失败被写成空接口的缺陷。本轮实际安装并比较 CLI／core／test 0.8.2 与 0.8.3。两组实际解析到相同 SDK 1.32.2、Zod 4.6.7，依赖锁文件一并保存。

使用不依赖 SDK 的本地 stdio fixture，声明 tools capability，再分别返回合法空列表、含一个工具的列表或 JSON-RPC `-32603`。保留逐条请求、响应、退出码、stdout、stderr 和生成的 baseline。

| 场景 | 0.8.2 实际结果 | 0.8.3 实际结果 |
| --- | --- | --- |
| 捕获合法空接口／非空接口 | 退出 0，正确生成合同 | 相同 |
| tools/list 失败时捕获接口 | stderr 有 Warning，但退出 0 并写入空合同 | 退出 2，报告 Discovery incomplete，不生成合同 |
| 合法空 baseline 对合法空接口 | 正常通过 | 正常通过 |
| 合法空 baseline 对发现失败 | 退出 0，changes 为空并报告 Contract unchanged | 退出 2，明确发现失败 |
| 已污染的空 baseline 对再次发现失败 | 退出 0，同样错误通过 | 该版本已拒绝生成这种新 baseline；本轮未额外跨版本运行此行 |
| 合法非空 baseline 对发现失败 | 退出 1，报告 alpha 工具被删除 | 退出 2，明确发现失败 |

共执行 13 次 CLI 命令，全部满足预定的退出码、实际交互及报告内容断言。最后一行是必要反例：旧版并非所有发现故障都会错误通过。问题应限定为“发现不完整被折叠为空接口，可能污染 baseline 并产生假通过”。旧版也有 stderr 警告，不能描述成完全没有告警。

本轮用的是已公开且已修复的历史缺陷与人工 fixture，没有发现新漏洞，也没有验证真实客户的业务错误。相关测试是读过修复后的开发用例，不能用于声称未知故障发现能力。[完整原始记录](../../research/integration-acceptance-20261026/discovery-observed-results.json) 可检查每次判定。

## 新产品与强基线

| 来源 | 已经覆盖 | 对本项目的影响 |
| --- | --- | --- |
| [Microsoft Scope，10 月 19 日官方发布](https://opensource.microsoft.com/blog/2026/10/19/introducing-scope-open-source-evaluation-for-ai-coding-agents/) | 多 Agent／模型／skills／MCP 配置、重复任务、DAG 验收条件、LLM Judge、执行轨迹与诊断；MIT | 版本化评估与诊断平台已经有直接实现。可本地 Docker Compose 运行，并非必须先部署 Kubernetes；运行 Agent 与 Judge 仍需相应 provider 访问 |
| [MCP Conformance](https://github.com/modelcontextprotocol/conformance/tree/c37eec888e1c6ff140af79987a40008548b7cc5f) | 协议、auth suite、会话、DNS rebinding、固定 requirements；区分实现的 wire 错误与 harness 错误 | 协议矩阵及 OAuth／会话检查不能当空白。某些不适用场景可 skip 并退出 0，使用方需看实际覆盖；这本身不是工具缺陷 |
| [mcp-contracts](https://github.com/mcp-contracts/mcp-contracts/tree/c2ae5824898d8c807a847431b8df5c32976671ed) | 除 schema diff，还有边界输入、用户 predicate、可选 Judge 和 CI；10/21–10/22 修复多项假通过／不完整报告问题 | 上轮将其只看作结构比较基线会低估竞争。历史问题适合作复现，修复后的版本是应比较的强基线 |
| [mcp-recorder](https://github.com/devhelmhq/mcp-recorder)、[MCP-VCR](https://github.com/MCP-VCR/mcp-vcr) | 官方仓库已提供记录、回放、snapshot／golden 比较与测试集成 | “在 schema diff 外加回放”本身也不构成差异化；其真实性能本轮未测 |

除上述两组探针实际使用的包外，本轮没有安装或运行这些评估平台，也没有为模型服务付费。

SDK 的 [最小 greet 迁移案例 #2977](https://github.com/modelcontextprotocol/typescript-sdk/issues/2977) 也已由 [PR3086](https://github.com/modelcontextprotocol/typescript-sdk/pull/3086) 于 10 月 23 日补充升级指南。它与上轮 #3422 属于相同协议时代问题，不增加一个独立故障样本；本轮未执行该协议复现。

## 最新论文和补查先例

| 原始论文 | 可借鉴的具体内容 | 不能据此声称 |
| --- | --- | --- |
| [Localizing Post-Wire Semantic Changes，2610.00182v1](https://arxiv.org/html/2610.00182v1)，本轮补查的已有先例 | 固定合法 MCP result，沿公开 carrier 检查特定消费者需要的信息；区分结构值、错误和富内容，还挑战测量器自身 | 人工 fixture 的差异不是生产失败率，也不是模型行为实验。其公开 artifact 按正文只从 normalized captures 重建分析，不重建框架执行环境；本轮未取得并运行 artifact |
| [EReg-Factory，10 月 18 日](https://arxiv.org/html/2610.25308v1) | 历史引入／修复提交、开发者测试、成对环境和独立 replay；防止 import 或环境搭建错误冒充 fail→pass | 历史版本对加证据包不是新的通用方法；其筛选排除 dependency updates，不能直接当依赖升级实验已完成。作者给出 replication link，本轮未验证包内容 |
| [VeriEvolve，10 月 21 日](https://arxiv.org/html/2610.29005v1) | 先构建可执行 evaluator，冻结后改进 workflow，再从外部发现的 false positive 修订 | 仍依赖外部 verifier 校准；正文说代码将于 publication 时发布，不能当现成开源直接采用。自生成验收器不能证明 Agent 自证正确 |
| [Self-Report Leakage，10 月 21 日](https://arxiv.org/html/2610.29609v1) | 保持任务和 trace 一致，仅改变 judge 是否看到 Agent 的完成声明；将声明解读与 claim-blind 轨迹检查分开 | 被动 trace 审查没有重新执行或读取实时系统，也不解决缺失或伪造日志；本轮没有复现模型实验 |

这些研究加强了 Shadow 的既有边界：记录可信、声明可信、执行效果正确、验收覆盖充分，是不同问题。通用的“再加一个 Judge”“生成验收条件”“签名后输出报告”都不足以直接建立论文新颖性。

## 下一项可证伪的研究

先研究第三方验收结果的导入语义：在明确要求的一组检查中，发现失败、跳过、不完整输出与真正执行通过，是否被下游错误归并为 PASS？比较各工具当前强版本的原生结果、普通脚本解析，以及候选的证据解释流程。覆盖来源和规则必须预先固定，不能看到失败后调整真值；不能把 ERROR 或 UNKNOWN 记成业务 FAIL。

已知修复只用于建立开发集。未来额外发现需在独立留出的工具版本和案例上检查，报告错误通过、错误拦截、UNKNOWN 比例、人工设置与维护时间；没有实际时间对照就不宣称节省排障成本。若当前工具原生处理已经足够，成果应降为适配器、测试模板或上游贡献，不继续做平台。

对求职，这两组可运行案例能展示真实依赖管理、协议排障、故障与产品错误的区分、反例控制和清晰交接，适合 AI 集成／FDE／技术客户支持类作品。创业仍需使用者实际工作流与试用反馈；论文仍需跨案例、相对强基线的独立发现。公开 issue、功能列表和本轮 23 次不同层次的观察都不能替代这些证据。

本轮没有执行上轮提出的 32 例或 64 例方案；OAuth、AWS 会话案例也仍未复现。
