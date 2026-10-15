# Agent decision workflows beyond trading

2026 年 10 月 15 日研究记录。建议继续发展 Shadow 的通用 Agent 执行证据能力；行情工作台是已有演示场景。最值得迁移的模式是有限动作候选、结构化判断、确定性权限约束、明确交接以及结果核验。现阶段工程价值明确，论文贡献仍需实验与进一步先例核验。

## 开源应用与模型的区别

Jev 相关应用、适配器和评测代码可以开源，同时默认模型仍通过 TypeSafe API 使用。此次查阅的仓库不提供可下载的 Jev 训练权重。浏览器动作选择与文本填写也可能使用不同模型；切换文本后端不能自动使整个流程本地化。

| 来源与查看版本 | 可以借鉴 | 会改变采用方式的限制 |
| --- | --- | --- |
| [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast/tree/1231850a0bf1a0c0341fe408ef1668dbbfdfac46)，MIT，9 月 18 日提交 | 将页面可见目标变成有限动作空间，执行前检查页面与目标是否仍有效 | [DONE 分支](https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/jev_ultrafast/agent.py)检查页面新鲜度后标记 done，不包含通用业务效果证明 |
| [System One Adapter](https://github.com/typesafe-ai/system-one-adapter-python/tree/e1d4cc938204b22fc5a3c3aca7044072fe3f712d)，MIT，9 月 22 日提交 | 用相同 typed questions 比较不同 LLM；记录重试、原始响应、延迟和概率归一化 | 是其他 LLM 的适配层，不是 Jev 权重；归一化不能保证概率校准 |
| [WorkflowEvals](https://github.com/typesafe-ai/WorkflowEvals/tree/0ac3b8ad845429f0d8e064ecfb2430a47c5a25cb)，Apache-2.0 代码，9 月 29 日提交 | 已有发票、客服、Agent trace、安全事件任务；支持固定数据 revision | 数据另有许可证；指标是参考模型答案一致性，且假设 workflow 代码正确，不能当授权安全率或实际执行成功率 |

[TypeSafe confidence 文档](https://docs.typesafe.ai/confidence)中的 Choice confidence 为

\[
c=\frac{p_{\max}-1/n}{1-1/n}.
\]

三选项分布 `(0.6, 0.3, 0.1)` 的 confidence 是 `0.4`。它描述选项分布的集中程度，不能解释为现实动作的安全概率。原先设想的 80/50 分段只能保留为未验证设计参数。正式阈值需要在与测试任务隔离的校准集上选择，同时检查误放、误拦、交接率与覆盖率；硬性权限条件不应由模型自信程度覆盖。

## 三个非交易场景

以下为采用建议，尚未接入这些业务系统。

| 场景 | 模型适合承担的判断 | 代码约束与效果观察 |
| --- | --- | --- |
| 企业客服与工单 | 识别诉求、缺失信息、处理队列 | 绑定客户与工单；核对权限、对象、版本；区分请求已接收与状态已改变 |
| 采购与发票复核 | 提取异常、分类、选择复核流程 | 金额、供应商、账户受确定性规则约束；审批建议与支付授权分开；先使用模拟状态机 |
| 研究资料与报告 | 相关性判断、证据与结论匹配、指出需人工复核的段落 | 保留来源版本及时间；区分引用存在、支持结论和有权发布；保存后按确切内容核验 |

优先做本地报告与模拟工单：状态可观察，容易设计已知答案，也更容易演示参数变化、重试和错误回执。采购场景可作为后续扩展；本轮没有实际支付或外部业务变更。

## 已有先例决定了什么不能当创新

| 已有工作 | 与 Shadow 直接相关的范围 | 采用决定 |
| --- | --- | --- |
| [OPA Agent Tool Calling](https://www.openpolicyagent.org/docs/agent-tool-calling) | 执行前按工具名和参数作 Rego 决策，由 harness 实施拦截；已有 decision logs | 用作参数授权基线，不重新发明通用策略语言 |
| [Agentgateway MCP authorization](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/security/mcp-authz/) | MCP 工具过滤和 CEL 授权；`mcpAuthorization` 不读取工具参数，参数约束应使用 route-level `authorization` | 作为协议及身份入口候选，不能把两种规则配置混为一谈 |
| [Invariant](https://github.com/invariantlabs-ai/invariant)，Apache-2.0 | 规则可分析历史、工具参数和 ToolOutput 到 ToolCall 的信息流；支持请求前后检查 | 用作上下文规则基线；规则看到的 trace 与外部系统效果分别核验 |
| [AgentSpec v3](https://arxiv.org/abs/2503.18666v3)，ICSE 2026 | 已有 trigger、predicate、enforcement 结构及停止、人工检查、替代动作等策略 | 重要学术先例；本轮未核验到明确代码许可证，先引用论文，不复制实现 |
| [OpenTelemetry GenAI execute_tool](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md) | 已有工具名、call ID 与可选参数、结果等观测约定；规范仍在发展 | 作为导出格式候选；span 是观测声明，不自动构成独立效果证明 |
| [Sigstore Rekor](https://github.com/sigstore/rekor) | 签名元数据、透明日志及包含与一致性验证 | 透明记录不能单独证明被记录的现实动作发生；hash chain 本身不构成创新 |

上述动态文档按 10 月 15 日可见版本核验；除首表三个仓库外，未固定其代码版本，也未执行这些项目。

## 最近论文对路线的具体影响

以下结论为论文作者报告，本轮未复现其模型实验。

| 论文与已发布版本 | 需要保留的边界 | 对下一步的影响 |
| --- | --- | --- |
| [OverAct 2610.01508v1](https://arxiv.org/html/2610.01508v1)，10 月 1 日 | 第 3.3 节的 TCR 是最小工具集合召回，不检查参数正确、执行成功或请求是否真正满足 | 工具选择、授权与任务完成分别计分 |
| [ActionGuard 2609.39450v1](https://arxiv.org/html/2609.39450v1)，9 月 30 日 | 已有基于可信用户意图的执行前审查；攻击成功要求实际安全效果；研究排除执行后检测与恢复 | 不能说已有守卫都只检查调用；不能把逐调用审查本身称为创新 |
| [Passing the Test You Trained On 2610.03448v1](https://arxiv.org/html/2610.03448v1)，10 月 2 日 | 作者发现检测器排名跨数据集迁移较差；静态攻击与模拟工具限制了结论范围 | 在本项目的正常工具输出上测误报，再评估低误报率下的攻击检出 |
| [Do Agent Benchmarks Do What They Say 2609.37315v1](https://arxiv.org/html/2609.37315v1)，9 月 29 日 | 已有 Phantom Effect、Partial Effect、Ignored Argument 等效果契约检查；探针也有漏检与不可观察限制 | 成功回执与真实状态不一致是已知问题，应该复现，不能当新发现 |
| [When Agent Evaluation Becomes Unreliable 2610.16067v1](https://arxiv.org/html/2610.16067v1)，10 月 12 日 | 评分器可能改变待评分状态；方法在另一框架受终态不可重建限制 | 评测器需只读、可重复；证据不足保留 UNKNOWN，不用成功字符串补真值 |
| [Runtime Authorization for Resources Acquired by AI Agents 2609.14744v2](https://arxiv.org/abs/2609.14744v2)，9 月 18 日 | 已讨论资源隔离、激活、单次 effect permit、重试及撤销，保证依赖明确假设 | 一次性许可和来源绑定已有近邻先例，不能单独作为贡献 |

[Agent-Diff](https://github.com/agent-diff-bench/agent-diff) 已有复制企业 API 并比较状态差异的评测路线。[tool-contract-conformance](https://github.com/rohithreddybc/tool-contract-conformance) 是契约审计论文的代码线索；离线重算表格与重新检验上游工具是两种不同验证范围。

## 继续投入的依据

**工程 GO。** 将精确批准、调用参数、原始返回、后续效果观察和最终完成声明串起来，形成可读、可复核的产品。当前 Shadow 已有的受控写入是本地文件创建演示：密钥由同一主机生成，读回也是本地观察；它还不是独立授权服务或外部提供方效果证明。

**经验研究 CONDITIONAL。** 值得测试在权限有限、异步、重试和旧证据条件下，不同证据策略的错误验证率、覆盖率与成本是否有实际差异。先用[64 例工程验收方案](./2026-10-15-effect-verification-protocol.md)检查已知原则能否正确实现，再决定是否扩大到独立任务和真实提供方沙盒。方案尚未执行，也不是已建立的新 benchmark。

**方法创新 NO-GO。** 不能仅凭评分、调用前授权、hash chain、独立读回或这 64 个案例主张论文创新。若结果只验证已有原则，应交付工程组件和复现报告；只有观察到可信、稳定且先例未覆盖的差异，才继续发展论文主张。

求职展示可以围绕一段可核对的失败案例展开：批准了什么、实际发出了什么、系统返回了什么、我们据此能确认到哪一步。它能够展示 API 集成、权限设计、故障处理与可观测性；不需要依赖未经验证的模型收益或安全承诺。
