# 从“通过了几项”到“具体验证了什么”

2026-10-29，America/New_York。本轮完成研究解释器修订与第三工具族的原始模块对照；产品 Web／Core／Lens／Flow 代码未修改，没有进行论文投稿。

## 组件修复：跳过不能被旧输出覆盖

对自身代码做对抗审查时发现，策略解析器 v1 忽略了 `runner_state=SKIPPED`。只要退出码为 0 且 stdout 是合法的旧通过报告，它就返回 COMPLETE／PASS／ACCEPT。此前的发现检查器已处理 SKIPPED，但策略解析器整合时没有保留这项语义。这是我们组件的回归，不是外部工具的新缺陷。

新增 [修订版解释器](../../research/evidence-study-20261029d/policy_parser_v2.py)，显式非完成状态优先于旧输出。SKIPPED、ERROR、INCOMPLETE、UNKNOWN 和格式错误的 runner 状态均暂缓。缺少 runner 状态时仍支持旧采集格式，但不能据此证明报告属于本次运行；真实集成仍需将输出绑定到执行实例。

同时补充两类人工损坏输入的检查：

- 所支持 CLI 版本在 hash 相同时会生成空 diff；若报告却含变化，修订版返回 UNKNOWN／INCONSISTENT，避免误判为通过或产品失败。固定版本源码支持此规则，不代表所有其他工具也有同一不变量。
- 重复 JSON 键与非标准 NaN／Infinity 字面量按严格输入策略拒绝；这不是 Python 与 JavaScript 解析差异，也不是新发现的原生 CLI 故障。未使用字段中的合法数字文本 `1e999` 不在此字面量规则内。

旧解析器与旧结果文件保留不动。**8 个新增 unittest 方法通过，原有 12 条原生工具记录的输出与 v1 完全一致。** 新的 7 个人工控制单列，未混入真实工具执行分母；没有重跑原生 CLI。[边界输入和逐条结果](../../research/evidence-study-20261029d/parser-boundary-results.json) 绑定源码／驱动 SHA256。

成本也仍然存在：旧版漏报下，一次策略允许的 warning 更改仍被暂缓；诊断文本只要引用 `Failed to list tools` 也可能触发旧正则。修订版没有宣称解决这两个问题。

## 第三工具族：同一份结果对应不同执行情况

上一轮在 mcp-recorder 中没有筛到合格的已修复验收缺陷。本轮保留这一负向筛选，转而执行已经登记的适用性对照。固定源码 revision `44803e1cb47d7d4bb0b8dbd490550a3367eff674`，项目版本字段为 0.5.0。

字节未改动的 `_types.py` 与 `verifier.py` 被实际导入，调用原始 `run_verify`，使用其 API 传入本地 fake transport。11 个人工输入中，10 次进入 verifier、1 次在 Pydantic cassette 校验阶段拒绝，全部符合对照预期。原始模块、完整许可证、依赖版本、输入、日志、调用记录和异常均保留；另有 7 个路径断言，不增加独立案例数量。

| 固定 lifecycle 输入的三个变体 | 原始 VerifyResult | 本地调用记录 |
| --- | --- | --- |
| 方法被调用并返回 200 | 1 passed／0 failed | 有调用，状态 200 |
| transport 不支持该方法，合法跳过 | 完全相同的对象 | 没有 lifecycle 调用；原始日志标记 skipped |
| 方法被调用并返回 500 | 完全相同的对象 | 有调用，状态 500；原始循环未比较 cassette 中的预期状态 |

不仅计数相同，三个变体的逐项原生结果也完全相同。因此，**仅凭这个结果对象，无法区分这三个输入的执行与状态**。这是固定对照上的信息不足结论，不是估算生产失败率或证明某个新算法更强。日志和本地调用记录已经能作出区分，普通脚本同样可以使用这些信息。

消费者要求决定解释：若只要求 RPC 响应匹配，HTTP 跳过可以不属于验收范围；若明确要求 HTTP lifecycle 已执行，则跳过不能证明该要求；若要求返回指定状态，还需检查实际状态。这里没有要求 stdio 必须实现 HTTP，也未确认原生工具承诺校验 lifecycle 状态，故不把 500 对照算成已确认工具缺陷。

另外保留了 RPC 匹配、不匹配、RPC／通知传输异常、lifecycle 抛异常、空 cassette 和版本不兼容对照。内容不匹配与传输错误都可能生成失败项，但后者不证明真实产品违规；lifecycle 异常则直接抛出，没有返回结果对象。

**执行边界：原始模块＋人工 transport，未运行 CLI、实际 HTTP／stdio、服务器、SDK 或完整 MCP 协议会话。** 原始 cassette 模型通过不等于完整协议合规。运行期间连接、DNS 和子进程入口被阻断并有正向控制；它们是本地研究辅助措施，不是通用沙箱。主代理独立重跑后，原始行与路径断言全部一致；代理审查不算第二位独立人工盲标。[完整复现材料](../../research/evidence-study-20261029d/recorder/README.md)。

## 对论文和项目价值的影响

现在可以更具体地研究：原生结果对象省略了哪些执行／适用性信息，以及下游在什么明确要求下需要额外证据。不能只给工具加 PASS／SKIP／ERROR 名称就声称创新；[HarnessRouter 的 conformance 文档](https://github.com/HarnessRouter/harnessrouter/blob/main/protocol/conformance/README.md) 和 [MCP Conformance Toolkit corpus](https://mcp-conformance.com/corpus.html) 已展示覆盖与多种未验证状态。本轮复核文档，未运行这些平台。

当前证据账本应写成：**三个已公开修复的历史缺陷，来自两个工具族；另一个工具族有已执行的适用性对照。** 不写成“四个缺陷”或“三个工具族都发生假通过”，也不合并不同执行层级计算准确率。所有新控制都读过源码后编写，没有留出泛化、维护时间节省或付费需求结论。

对 Shadow 的实际工程价值是减少把旧输出、合法跳过、测试执行错误误提升成验收结论的机会，并给每项结论保留可复核证据。本轮仍是研究组件，尚未接入产品流程。英文 [论文提案](./2026-10-29-paper-proposal.md) 已同步边界，投稿准备继续按 [会场准备表](./2026-10-29-submission-readiness.md) 推进。
