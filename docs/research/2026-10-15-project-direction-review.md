# Agent project direction review

2026 年 10 月 15 日。结论是优先验证“Agent 集成诊断与升级验收”这个工程场景，继续保留科研交付检查为小模块；暂不扩大为通用安全、交接或目标契约平台。该排序是基于公开故障、已有实现及验证成本的判断，不是已确认的市场需求或方法创新。

## 三个候选的优先级

| 候选 | 可交付的具体结果 | 现有竞争与证据 | 本轮决定 |
| --- | --- | --- | --- |
| Agent 集成诊断与升级验收 | 版本、协议、配置与多步任务的兼容矩阵；最小复现；失败位置与验收报告 | 有官方仓库故障与已合并修复；schema diff 和自动测试产品已存在 | 优先做窄范围验证，目标是减少排障和维护测试的工作量 |
| 科研或开发成果交付检查 | 检查产物、运行条件与指定结果是否具备接手条件 | ReproZip、Code Ocean、Renku、Handoff Debt、AgentActionBench 已覆盖相邻流程 | 保留为组件，先比较普通 CI 和重新运行检查的效果 |
| 用户目标与验收标准一致性 | 将用户明确要求、可查事实和未确认推断分开，避免完成错误目标后验收通过 | GoalFlow、Contractual Skills、澄清策略及 hyper-tau-bench 已有直接先例 | 作为待验证的窄问题，不以“目标转契约”另起平台 |

这些方向不要求先获得长期私有销量数据或训练基础模型。它们需要可运行任务、版本信息、可观察结果和独立验收标签。合成故障可以检查实现是否正确，真实历史案例和实际使用反馈分别用于判断外部适用性与商业价值。

## 集成方向的新证据

将公开来源整理为[四项案例目录](./2026-10-15-integration-case-catalog.json)。本轮查阅了原始 issue、修复 PR 和发布说明，尚未在 Shadow 环境执行这些上游复现。目录不是已运行的 benchmark。

| 案例 | 原始记录与状态 | 说明什么 | 不足以说明什么 |
| --- | --- | --- | --- |
| MCP TypeScript quickstart 与指定协议不兼容 | [#3422](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/3422) 于 10 月 8 日提出；[#3427](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3427) 于 10 月 12 日合并 main | 编译及默认 legacy Inspector 检查通过，指定 modern 协议却失败。需要显式协议矩阵 | 该问题已修复；不能当仍未解决的市场需求，也不是业务语义变化 |
| World Bank data360 的部署 Host 回归 | [PR #146](https://github.com/worldbank/data360-mcp/pull/146) 于 9 月 22 日合并 dev；记录 FastMCP 升级后默认 Host/Origin guard 改变 | localhost 测试可掩盖代理部署的失败；修复加入 Host、Origin、入口与子进程回归 | 普通集成测试能解决，不支持“必须有新 AI 验证模型”；合并 dev 也不自动等于发布上线 |
| TypeScript SDK OAuth 发现回退 | [#1946](https://github.com/modelcontextprotocol/typescript-sdk/issues/1946) 对比 1.17.5 与 1.29.0；[PR #1951](https://github.com/modelcontextprotocol/typescript-sdk/pull/1951) 仍 open | 版本、challenge 序列与 metadata 发现需要单独验证 | issue 有 needs-repro 标签；PR 的候选解释与修复尚未确认，不能写成维护者已证实的根因 |
| AWS proxy 第二次工具调用失败 | [#299](https://github.com/aws/mcp-proxy-for-aws/issues/299) 有版本与多步调用对比；[v1.6.2](https://github.com/aws/mcp-proxy-for-aws/releases/tag/v1.6.2) 列 assume-role credentials 修复 | 单次冒烟检查可能漏掉会话和凭据生命周期问题 | issue 标题中的 FastMCP 归因并未确立；发布说明不证明所有相似错误都已修复 |

这批证据主要落在协议、部署和凭据生命周期。目前没有从中建立“schema 仍合法但业务语义在升级后改变”的自然案例集合。因此下一步应限定为集成验收，不能直接推广成通用业务语义漂移检测。

## 能复用的开源与产品

| 项目 | 已有功能 | 采用边界 |
| --- | --- | --- |
| [mcp-contracts](https://github.com/mcp-contracts/mcp-contracts)，MIT | 接口快照、差异分类、边界输入测试、签名 baseline 和 CI | 可作现成结构比较基线；签名接口快照本身不构成差异化 |
| [samlader/mcpdiff](https://github.com/samlader/mcpdiff)，MIT | live server、文件与 Git revision 比较；描述和 instructions 改动报告 | README 的 semantic drift 类别包含文案变化；不能据此认定已经检测实际模型行为或业务结果变化 |
| [Specmatic MCP Auto Test](https://docs.specmatic.io/getting_started/mcp_auto_test.html) | 测试字典、正反输入、边界组合、回归及 CI 报告 | 已有产品覆盖自动测试。未核实该 MCP 分发物全部适用核心仓库许可；不能直接复制整个分发物 |

本轮没有安装或执行这些工具；功能和许可证范围依据官方文档核验。后续应优先采用现有测试和 diff，再衡量测试场景推荐、最小复现或诊断报告能否节约时间。只生成更多检查项可能增加维护负担。

## 最新论文带来的约束

[Which Metadata Matters for LLM Tool Selection in MCP](https://arxiv.org/html/2610.14334v1) 于 10 月 9 日提交。作者的控制干预显示，参数 schema 也会影响工具选择；这支持在模型层面比较工具接口变更。其局限是五模型、五任务、单轮英文请求，且不执行工具。选择变化、执行兼容性和实际任务结果应分别计分，不能把论文的选择率结果写成业务失败率。

[Handoff Debt v2](https://arxiv.org/abs/2606.02875v2) 于 8 月 30 日修订，已经比较仓库、轨迹、摘要和结构化交接。[Do Not Restart v4](https://arxiv.org/abs/2609.13800v4) 于 9 月 26 日修订，已讨论保持已接受选择、已实现效果和剩余义务，使用 live receipts 支持完成。因此“结构化交接加收据”已有直接研究先例。

[AgentActionBench](https://arxiv.org/abs/2609.11117v1) 于 9 月 10 日提交，已经通过 MCP recorder 记录论文复现过程并按 paper-specific rubric 评测。[Code Ocean 官方核验流程](https://docs.codeocean.com/osl-guide/publishing-on-code-ocean/the-verification-process/code-oceans-verification-process-for-computational-reproducibility-and-quality) 明确区分机械可重复运行和结果是否对应论文；后一个边界不能通过检查器自己的期望值自动解决。[Renku 7 月发布](https://blog.renkulab.io/release-2026-07/)已有相同代码、环境、数据的 job，以及 coding-agent 配置携带。环境打包与迁移也不能当新方法。

[GoalFlow](https://github.com/zulinliu/GoalFlow/blob/main/README.md) 已把目标澄清、规划、验收和交付组织成 coding-agent skill，区分 user-reviewed intent 与自动模式记录的假设。[Contractual Skills v2](https://arxiv.org/abs/2605.22634v2) 已将目标、权限、证据和验收写入技能契约。[IG-clarifier](https://arxiv.org/html/2606.03135v1) 已研究澄清的信息增益与交互成本；[hyper-tau-bench](https://arxiv.org/abs/2609.04611v1) 又将获取客户需求并交付完整 Agent 纳入任务。因此“先澄清再验收”也不是空白。

这里的论文结论是作者报告，本轮未复现其模型实验。仓库与产品文档按 10 月 15 日可见内容核验；未固定所有依赖或测量工具性能。

## 最值得先验证的流程

目标用户暂定为维护 connector 的开发者和企业 AI 集成工程师。输入为旧、新版本、运行配置与可脱敏的失败记录；输出为有出处的版本矩阵、最小复现、首次分叉点、已检验范围和仍未知的原因。这是待验证的用户假设。

模型可以辅助整理错误记录、提出候选原因和生成测试草案。最终通过与否由隔离执行及预先确定的断言判断。模型猜测、issue 报告和实际复现结果必须分开显示；不能只根据 issue 标题生成确定根因。

第一阶段先固定三个公开、许可可用的项目及十个真实历史版本对。分别标注协议、结构、业务行为、配置和基础设施；保留未复现与不适用案例。上表只有两个已合并且证据较强的修复案例，不能把四项目录都算成四个独立复现成功。

第一阶段若确有现成检查漏掉且可重现的差异，再做受控补充：八个工作流各配不变、文案变化、结构变化和效果变化，共 32 个设计用例。它与此前的 64 例通用效果验证提案是不同方案，二者都未在本轮执行。固定调用回放只能验证工具执行兼容性；声称影响 Agent 选择需要另跑固定模型并平衡候选顺序。

比较基线应包括现成 schema diff、普通 pytest/Jest 集成测试、带最终状态断言的回放。新增方案要报告额外发现、正常升级误报、断言编写和维护时间、定位耗时及无法判断比例。测试设计和隐藏真值应在运行前固定，不能让同一模型既生成期望又证明自己正确。

“现成测试漏掉”使用固定时点：保留升级前随项目发布的测试，另在试验前固定通用 schema 与集成测试模板、工具版本及配置。修复后新增的专项断言作为可解决性证据与参考答案，不回填到历史覆盖率。比较当前可用方案时则须另列包含这些断言的强基线。已读过修复的案例只用于复现和开发，后续发现能力需在独立留出案例检验。

## 继续与停止门槛

- 十个真实版本对中仍找不到现成测试漏掉的可重复差异：暂停独立产品开发，把成果保留为测试模板或集成作品。
- 可以多找错误，但每个用例都需重写完整 oracle，维护成本不降：缩小到已有系统的插件或报告功能。
- 优势只出现在人为注入故障：保留为工程验证，不当作真实市场或论文证据。
- 论文方向需要一个独立、可重复优于强基线的机制或经验发现；仅加模型、签名或仪表盘不满足该门槛。
- 商业方向还需实际使用者提供工作流、试用并反馈节省的工作量；公开 issue 和开源 stars 不能代替付费意愿。

对工程作品而言，集成验收能展示问题复现、接口与权限分析、兼容性验证、根因定位和清楚的客户交接。可以复用 Shadow 的证据能力，但不应据此宣称已完成新的通用平台或确定了论文贡献。
