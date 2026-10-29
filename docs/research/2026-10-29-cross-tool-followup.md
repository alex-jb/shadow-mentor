# 跨工具后续研究：完整记录仍不足以支持通过

2026 年 10 月 29 日，America/New_York。延续 [上一轮解释器与 IEEE 路线](./2026-10-29-ieee-paper-route.md)。本轮新增两个已知历史修复的执行证据，其中一项来自不同工具族。没有发现新漏洞，没有运行付费模型，也没有改变 Shadow 产品代码。

## 最重要的更新

之前的发现完整性检查器被一个真实的历史缺陷反例限制住了：**发现请求全部成功、记录完整、报告格式自洽，报告仍可能漏掉应该复核的合同变化。** 因而不能将“有完整收据”提升为“判断已经充分”。

当前材料覆盖三个独立历史缺陷、两个工具族，执行层次不同，不能合并计算一个准确率：

| 历史案例 | 实际执行层次 | 所显示的缺口 |
| --- | --- | --- |
| mcp-contracts 0.8.2→0.8.3，发现失败折叠为空合同 | 上轮真实发布包＋本地 stdio fixture，本轮未重复计数 | 发现过程出错，却形成合法外观的空合同和 unchanged 报告 |
| mcp-contracts 0.8.3→0.9.0，annotations 变化漏报 | 本轮真实发布包＋本地 stdio fixture | 过程完整仍可能遗漏变化，且必须解释实际失败阈值 |
| 官方 MCP conformance PR442，未触发要求却 SUCCESS | 本轮固定 Git 源码的原始检查类局部机制执行 | 没有验证要求与已证实违反要求必须分开 |

Data360 的本地／代理覆盖差异与官方空 suite 对照仍是范围和适用性例子，不增加本表独立缺陷数。

## 真实发布包反例：变化存在，摘要却没有变化

依据 [0.9.0 修复记录](https://github.com/mcp-contracts/mcp-contracts/blob/v0.9.0/CHANGELOG.md)，先固定两种消费者策略：`--fail-on warning` 要求 warning 及以上变化复核；`--fail-on breaking` 允许 warning。两种情况都用 `--severity safe` 获取未过滤报告。

同一工具 alpha 的 `annotations.readOnlyHint` 从 true 变为 false；工具名称、描述和输入 schema 均不变。两侧真实 SDK 均为 1.32.2、Zod 均为 4.6.7；CLI／core／test 则分别固定 0.8.3 与 0.9.0。只改变提示元数据，**没有执行 tools/call，不能说真实业务行为变得危险**。

| 对照 | 0.8.3 实际结果 | 0.9.0 实际结果 |
| --- | --- | --- |
| 不改变合同，warning 阈值 | hash 相同、零变化、退出 0 | 相同 |
| annotations 改变，warning 阈值 | hash 不同，changes 为空、零变化、退出 0 | annotations warning 可见，退出 1 |
| annotations 改变，breaking 阈值 | hash 不同，仍漏报变化、退出 0 | warning 可见，退出 0，符合该策略 |
| 描述改变，warning／breaking 阈值 | 都能识别 warning，分别退出 1／0 | 相同 |
| 新增必需输入字段，warning 阈值 | 报 breaking，退出 1 | 相同 |

共 2 次 baseline 捕获和 12 次 check，原生结果、报告内容、hash 关系均符合修复源码预期。不同命令和变体不是不同缺陷。旧版漏报是已公开修复的问题；新版 warning＋退出 0 在 breaking 策略下是合法行为，不算假通过。

冻结的上一版 receipt gate 接受了旧版 annotation／warning 记录；它还将新版合法 warning＋退出 1 误读为 `EXIT_REPORT_CONFLICT`，因为此前硬编码了 breaking 阈值。这暴露的是我们研究组件的策略适用范围，不能藏成原生工具的新缺陷。

新增的普通严格解析器读取 runner 实际保存的 fail-on 与显示过滤配置。未过滤报告若 hash 改变但 changes 为空，则保留 UNKNOWN 并暂缓；不会猜测变化有多严重。它不依赖模型，也不声称验证 RPC 过程完整。

| 本轮开发对照，12 次 check | 错误接受 | 本可允许却暂缓 | supported verdict 为 UNKNOWN |
| --- | ---: | ---: | ---: |
| 冻结的旧发现 gate | 1 | 0 | 3 |
| 普通策略感知解析 | 0 | 1 | 2 |

**代价不能省略：** 旧版 annotation／breaking 例本来是已知允许的 warning 变化，严格解析器因无法从漏报中确定严重程度而暂缓了一次。这里没有“更严格一定更好”的结论。两种解释器范围也不同，这不是公平证明新算法优越的基准。10 个合成 unittest 控制通过；这些测试不增加历史缺陷数量。

原始结果：[发布包执行](../../research/evidence-study-20261029b/contract-change-results.json)、[解释结果与成本](../../research/evidence-study-20261029b/policy-analysis-results.json)。

## 不同工具族：检查要求没有被实际触发

[官方 conformance PR442](https://github.com/modelcontextprotocol/conformance/pull/442) 于 9 月 6 日合并。固定 base `c321dd32035556e6769d3724a8ee97d87c3faaac` 与 fix `48561a1aeccd943f84da545d2cd29e940835f6b2`。两侧 package.json 都写 `0.2.0-alpha.11`，因此这是 Git revision 对，不是 npm 0.1.16 的版本比较。

原始检查器要验证客户端未声明的 elicitation 不会被请求。缺失或空 `inputRequests` 却曾绕过实际检查而得到 SUCCESS。修复后用 `FAILURE + details.untestable=true` 表示要求未验证，并非断定服务器违反协议。

本轮从原始源码提取检查类及真实 type guards，只去除 TypeScript／module 语法，注入 `sendRpc` stub 与报告常量。7 个人工输入分别在两份源码执行，14 次原始检查均符合预期。允许的 sampling 方法继续 SUCCESS；禁止的 elicitation 方法继续 FAILURE；未触发要求的两个变体才出现 untestable。保留执行错误、缺失结果和 fixture 不匹配的对照。

**这是局部原始检查器机制复现，不是完整 CLI、HTTP、SDK 或完整 conformance suite 复现。** 正向输入的完整协议/schema 合规性也未另行证明。源文件的 Git blob、大小与 SHA256 已核对，完整许可证随包保留。[详细边界与原始输出](../../research/evidence-study-20261029b/conformance-pr442/README.md)。

## 直接先例进一步限制新颖性

- [官方 issue451](https://github.com/modelcontextprotocol/conformance/issues/451) 已明确提出按 scenario 展示 expected-versus-emitted 检查覆盖，且要求处理版本与适用性。目前仍 open。这说明“应披露没有执行的检查”本身不是我们的新发现，也不等于已有完整实现已被我们验证。
- [HarnessRouter 的 conformance 文档](https://github.com/HarnessRouter/harnessrouter/blob/main/protocol/conformance/README.md) 已定义覆盖与 conformant 字段，并说明部分运行的退出 0 不能证明整个 class 通过。它可成为强设计基线；本轮未运行其真实 Agent 任务。
- [MCP Conformance Toolkit corpus](https://mcp-conformance.com/corpus.html) 已区分 pass、not-observed、not-applicable 等结果，并分开人工 fixture 与真实 capture。这也是相关先例，不能将单纯增加状态名称当作新方法；本轮只读文档，未运行工具。

## 论文现在能说什么

更合适的定位仍是经验短文／研究试点，报告不同的证据缺口、明确的消费者策略、成功与未验证的区别，以及严格规则的额外暂缓成本。还不支持方法论文或通用安全保证。IEEE 路线没有因案例增加而自动变得“可以投”。

下一步用 [后续队列计划](../../research/evidence-study-20261029b/study-plan.json) 固定工具族、检索范围、排除记录、独立缺陷统计单位、同信息基线和留出方式。它是未来研究计划，不是已经完成的预注册或独立留出实验。现有案例全部读过修复，标注没有由盲于方法输出的第二位人工研究者完成。第三个工具族尚未纳入执行证据；维护时间与客户价值也未测量。
