# Shadow：市场对照与 CI 验收证据导入

2026-11-11，纽约。这个方向值得做成一个轻量复核工具，**优先解决证据归属和收集成本**。同类产品已经能做策略判定、轨迹打分和审计；再造一个规则语言或让大模型打分，不会自动带来优势。

## 市场和 GitHub

| 工具 | 已核实的能力 | 对 Shadow 的取舍 |
| --- | --- | --- |
| [Kosli Control Center](https://www.kosli.com/control-center/) / [Ergo](https://github.com/kosli-dev/ergo) | 面向平台和审计团队的发布证据与逐项决策。Ergo 10 月 22 日公布；[Rego 0.6.0](https://github.com/kosli-dev/ergo/releases/tag/rego-v0.6.0) 的发布记录为 11 月 11 日。 | 最接近的竞品。实际跑了 5 个离线例子，已能区分 `absent`、`value`、`unusable` 和适用性。直接复用同类策略引擎有意义；缺证解释不能当 Shadow 独有功能。 |
| [Datadog Deployment Gates](https://www.datadoghq.com/blog/deployment-gates/) | 11 月 9 日宣布正式可用，在分阶段发布中根据监控及 APM 判断是否继续。文档的 dry run 保留真实判定而不阻断。 | SRE 和发布团队的现成选择。Shadow 的实验从上线前、只读的 CI 报告复核切入；不替代生产遥测。 |
| [Promptfoo](https://www.promptfoo.dev/docs/tracing/) | OpenTelemetry 轨迹、用例关联、工具调用和路径断言。 | 适合提供 AI 应用的观察数据。验收仍需要约定哪些结果必须观测，以及结果对应哪个版本和执行。 |
| [LangSmith](https://docs.langchain.com/langsmith/evaluation-types) / [AgentEvals](https://github.com/langchain-ai/agentevals) | 离线与在线评测、代码规则和模型判断；AgentEvals 支持严格、无序和子集等轨迹匹配。 | 可复用测试及轨迹评分，具体业务值和 CI 收据另行核对。不能从其文档推断自定义规则无法实现等价检查。 |
| [OPA 1.22.3](https://github.com/open-policy-agent/opa/releases/tag/v1.22.3) / [Conftest](https://www.conftest.dev/) | Rego 可以直接检查结构化输入，OPA 该版 11 月 10 日发布。 | 实际用已核对的 OPA 版本比较同一份准入后的数据；Conftest 提供了一个真实的公开 CI 元数据样本。 |

这些资料说明相邻需求确实有人做，不证明 Shadow 有付费需求。优先找会审查 AI 工作流验收报告的开发者或 QA；观察他们能否更快定位“上一轮结果被拿来当这轮结果”“跳过被当成通过”，并用普通脚本或现有工具在相同输入下对照。应记录核查时间、误接受和不必要的暂缓，再决定是否做平台化。

## 新 AI 研究怎样改变实现

- 11 月 2 日的 [Input Assurance for LLM Agent Evaluation](https://arxiv.org/html/2611.02676v1) 在一个评测流程中发现：30 条轨迹的 60 个目标步骤有 53 个在渲染后为空，文件哈希仍能匹配；新增控制在 19 个人工故障中阻止了 18 个到达记录 stub，余下脚本未运行。它区分了**字段是否保留**与**被判断的字节是否正是检查过的字节**。本轮据此用同一份内存字节校验并解析报告，另测缺观测和重复 JSON 字段。
- 11 月 3 日的 [PersonaCodeBench](https://arxiv.org/abs/2611.05739) 把原任务正确性和用户约束分开验收。对 Shadow 的启发是保留“确实不符合”和“证据不足”两种结论；不能把未完成或评测出错都当作已证实的能力失败。
- 10 月 15 日的 [AgentEval](https://arxiv.org/abs/2610.21177) 已经研究把契约、运行和证据绑定。其 48 个刻意编辑的证据视图中有 36 个问题未被纯哈希检查发现；这是人工干预，不是现场故障率。既有论文不能将绑定、暂缓判定或分层检查写成首创。

## 本轮工作的可复现结果

[本地导入器](../../research/ci-intake-20261111/README.md)先核对计划、attempt、job、步骤映射、测试 checkout 和报告字节，再读取业务值。步骤原始失败但最终结论为绿色，输出暂缓；本次已核对的整数结果明确不符，输出拒绝。它不会自动合并、阻断或部署。[离线案例册](../../research/ci-intake-20261111/casebook.html)可以逐项查看结果与原因；将 HTML 下载后用浏览器打开。

| 对照 | 与人工预期一致 | 没有足够证据却接受 |
| --- | ---: | ---: |
| 只看 job 结论 | 4/22 | 17 |
| 只看报告与计划 | 10/22 | 12 |
| 绑定后判定（Python） | 22/22 | 0 |
| 相同准入数据，改用 OPA 判定 | 22/22 | 0 |

OPA 实际执行 9 个准入案例，另 13 个由同一个准入层暂缓。这证明此组案例中决策可以交给现成规则引擎，并不比较 OPA 和 Python 的普遍正确性。另跑了 3 个不计入主结果的数值对照：要求整数 `1` 时，两者都接受 `1`、暂缓 `1.25`；收到字节和收据均一致的 `1.0` 时，Rego 规则接受，Python 暂缓。这是数值类型约定不同，跨引擎接入前需要明确约定。

公开的 [Conftest 运行记录](https://github.com/open-policy-agent/conftest/actions/runs/43092281393) 返回 5 个 job 的 attempt 和步骤结论，样本里没有可信采集收据或原始 outcome。本地演示因此暂缓。另以每页 2 条重新读取，三页合并与单页结果一致；[故意省去末页](../../research/ci-intake-20261111/public-pagination-check.json) 后，工具识别出缺 1 个 job 并暂缓。两项都未计入 22 个构造条件，也没有启动 CI。导入和分页共 47 项本地自动测试通过。

用项目现有的 `shadow-attest-core` 对四个本地案例的文件清单签名，[四份签名都通过](../../research/ci-intake-20261111/portable-review-results.json)，导入器仍分别判为通过、拒绝、暂缓、暂缓。给报告加一个换行后，原清单的签名依然有效，文件校验不再匹配，导入器也暂缓。可以复用现有签名组件，但这些临时密钥未验证真实 GitHub 采集者。

稿件适合改成**有边界的经验报告**：将 GitHub 重跑、步骤结论和报告字节的三个具体例子加入实验。严格要求整份分页结果和报告原字节可能增加暂缓，真实接入成本及不必要暂缓率还未测。下一轮按[采集试验方案](../../research/ci-intake-20261111/collector-pilot.md)冻结独立预期，验证一次隔离、仅报告的真实 workflow；该 workflow 目前尚未配置。
