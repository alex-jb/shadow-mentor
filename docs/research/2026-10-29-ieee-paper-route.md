# IEEE 投稿路线与本轮研究升级

核验日期：2026 年 10 月 29 日，America/New_York。

有匹配的 IEEE／IEEE-ACM 软件测试与软件工程路线。建议把 IEEE ICST 2027 NIER 作为较充裕的研究目标，AGENT 2027 短文作为较近的条件性窗口。当前成果适合发展为经验研究或工具研究；没有证明新的通用验证方法。

## 已核验的可选路线

| 路线 | 截止与格式 | 本项目如何契合 |
| --- | --- | --- |
| [AGENT 2027，ICSE workshop](https://conf.researchr.org/track/icse-2027/agent-2027-papers) | 2026-11-13 AoE；短文最多 5 页含引用，全文 8 页含引用；single-anonymous；官方明确 IEEE 出版 | 接收经验、工具和早期研究，主题含验收、AgentOps、可观察性。近期可规划，但须形成独立问题与充分相关工作比较；这是 workshop，不是 ICSE 主会研究论文 |
| [IEEE ICST 2027 NIER](https://conf.researchr.org/track/icst-2027/icst-2027-nier) | 2027-01-13 AoE；4 页正文/图表/附录＋最多 2 页仅引用；double-blind，artifact 也须匿名 | 软件测试问题最直接，时间更适合补跨工具案例。可投新想法或 reflection，但不是已有工作的摘要；当前投稿入口仍标为待更新 |
| [IEEE COMPSAC 2027](https://ieeecompsac.computer.org/2027/information-for-authors/) | 全文截止 2027-01-31；10 页含引用；short 为 6 页，但官方未另列其截止；时区未注明 | 适合后续较完整的软件／Agent 可靠性经验研究。workshop 论文日期为 4/15，具体 workshop 后续再选 |
| [AGENTVERIFY 2027](https://agentverify2027.github.io/cfp.html) | 独立 CFP 写 11/13 AoE；但 [ICSE 日期表](https://conf.researchr.org/dates/icse-2027) 写摘要 11/1、全文 11/6。short/demo 4 页、extended abstract 2 页、full 8 页，均含引用；double-blind | 主题非常贴近 harness、弱 oracle 与可重复验收；在日期冲突解决前，内部按较早日期准备，不能认定延期生效。独立 CFP 说明进入 ICSE workshop proceedings；[ICSE 总页](https://conf.researchr.org/track/icse-2027/icse-2027-workshops) 明确 workshop 论文由 IEEE 出版 |

AoE 在这些日期对应：11/13 截止为纽约 11/14 上午 06:59:59；1/13 截止为纽约 1/14 上午 06:59:59。建议内部仍按标注的前一天日期交稿，不依赖最后几个小时。

排除的误读：ICST 主研究 track 的 11/2 截止只剩数日，当前不适合赶完整稿；1/31 是 major revision，不是新稿第二次机会。SE4AgenticAI 2026 是 BigData 相关 workshop，10/10 已截止，不是 ICSE 2027 workshop。arXiv 写 submitted to IEEE 也不构成接收或发表证据。

本轮没有注册、投稿、支付或联系组委会。以上列的是匹配与准备路线，不是接收预测。实际提交前需复核选定 track 的最终规则、匿名材料和 AI 使用披露；现有公开 GitHub 包不是匿名投稿包。

## 这轮实际升级

新增 [独立研究组件](../../research/evidence-acceptance-20261029/README.md)，不改产品代码。输出将工具报告的 PASS/FAIL 与检查执行状态分开，保留 ERROR、SKIPPED、INCOMPLETE 和 UNKNOWN；带原始证据定位。当前只实现 mcpdiff 与 initialize/tools-list 的窄范围证据义务。

对 10/26 记录进行重新分析，只纳入 7 次 check，不把 6 次 snapshot 混入验收分母。它们来自一个已知历史缺陷，有 2 个健康完整检查和 5 个 discovery error。

| 解释方式 | 错误接受 | 健康通过被阻止 | 检查故障误称产品 FAIL |
| --- | ---: | ---: | ---: |
| 只看退出码 | 2 | 0 | 1 |
| 普通严格输出解析 | 0 | 0 | 0 |
| 严格解析＋原始发现记录 | 0 | 0 | 0 |

**候选没有超越普通严格解析。** 这说明应先把工程接口做清楚，而非立即包装成更强的新算法。计数来自开发重放，不是生产率或独立留出评测。解释器没有读取 fixture_mode、expected_exit、matched_expectation 或 gold 标签。

另外运行了官方发布包 conformance 0.1.16 的真实空覆盖对照：draft suite 经 2025-11-25 版本过滤后为 0 个场景，输出 0 passed / 0 failed / 0 warnings，退出 0；sentinel 客户端未执行，独立 positive control 证实 sentinel 本身有效。这是合法空选择，不是原生工具缺陷，也不是显式 SKIP。它只说明：如果下游要求实际执行检查，就不能仅凭退出 0 接受结果。本条不并入上表分母。

解释器的 22 个合成 unittest 控制全部通过，覆盖缺失响应、分页、null/absent、合法空列表、错误 RPC、无效报告、顺序和跳过。这些是实现回归测试，不增加独立真实故障数量。原始 JSON、源码摘要和依赖锁均保留。

## 为什么能和 IEEE 研究对话，但还不是新颖性结论

- [Barr 等，IEEE TSE 2015，The Oracle Problem in Software Testing](https://discovery.ucl.ac.uk/id/eprint/1471263/) 已系统研究测试 oracle；执行后还需判断正确性是成熟问题，不能因加入 MCP 就宣称首次发现。
- [Schuler 与 Zeller，IEEE ICST 2011，Checked Coverage](https://www.st.cs.uni-saarland.de/publications/details/schuler-icst-2011/) 研究执行内容是否真正影响断言。本轮检索到作者资料，未成功取得全文，不采用其具体实验数值。
- [Herzig 与 Nagappan，ICSE 2015 Companion／IEEE](https://www.microsoft.com/en-us/research/publication/empirically-detecting-false-test-alarms-using-association-rules/) 已区分产品缺陷与测试／基础设施故障，其目标主要是减少错误告警，不能与错误接受混为同一指标。
- [Doc2Harness，10/14 arXiv 预印本](https://arxiv.org/html/2610.20344v1) 已使用多通道观察与 positive controls 防止功能未运行却通过。多通道、mock model 与正向对照不能作为我们的独有方法；未据此认定其 IEEE 接收状态。
- [Self-Report Leakage，10/21 预印本](https://arxiv.org/html/2610.29609v1) 已研究声明影响判定及 claim-blind 轨迹检查。声明与证据分离本身已有直接先例。

因此，拟写的贡献应是“原生结果进入下游验收时发生何种语义提升，如何用预定义义务识别，并与当前工具和普通脚本比较”的实证发现。Data360 的本地 200 本身未必错误；将其升级成代理部署已验收才是范围误用。mcp-contracts 的发现失败折叠为空合同则是工具缺陷。合法空 suite／SKIP 也不能直接标成工具 bug。

## 研究目标与下一道门槛

拟题：**Beyond Exit Code Zero: Evidence Gaps in MCP Acceptance Pipelines**。

先固定检查义务和适用范围，再选三个工具族、约十个独立历史案例做可行性试点。这只是工作规模建议，不是发表门槛。逐例区分原生工具错误、消费者误解释、合法不适用、环境故障和未知；保留无法安装或无法复现的记录。已读过修复的例子用于开发；跨工具泛化需独立留出，并由另一位标注者在看不到方法判定时核对。

强基线必须含当前修复版原生报告、退出码、普通严格解析、能看到同样轨迹的普通脚本。不能多给候选信息后把收益称为算法优势。测量错误接受、健康检查被阻止、UNKNOWN、适配规则与维护时间；没有时间对照就不宣称节约成本。

如果只能重述一个已修复 bug，或普通脚本解决全部问题，保留组件与复现经验，不提交为新算法论文。若能形成跨工具可重复的误解释类型和有价值的边界分析，再按 AGENT emerging/experience 短文或 ICST NIER 的论证要求组织稿件。完整研究问题与英文摘要见 [论文提案](./2026-10-29-paper-proposal.md)。
