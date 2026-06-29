[English](./positioning-vs-anthropic-fs.md) · [中文](./positioning-vs-anthropic-fs.zh-CN.md)

# Shadow vs Anthropic Financial Services Agents — 定位

> **市场变化(2026-05-05)。** Anthropic 发布了金融服务 agent 模板(pitchbook / KYC / 月结),Moody's 作为原生 Claude app 嵌入,加上 Goldman / Blackstone / H&F 的 $1.5B 联合基金。Claude Opus 4.7 现在被定位为"华尔街模型"。
>
> **本文为什么存在。** 30 家中型银行 pipeline 买家在签约前会 Google "Anthropic financial agents"。Shadow 需要一个"不是 Anthropic"的清晰楔点,且必须由审计员而非营销人员可辩护。

## 三行定位

| 维度 | Anthropic FS Agents | Shadow |
|---|---|---|
| **源码可见性** | 闭源模板;prompt 不可审计。模型即政策。 | MIT 许可证。`lib/run-loan-council.js` + `lib/traceability.js` 任何审计员可读。代码就是技术文件(EU AI Act Article 13)。 |
| **部署方式** | 仅云端,Anthropic API。贷款申请人数据离开你的 VPC。 | 纯计算。`enforceAnalysisOnly()` 正则在 council 输出边界运行。可以本地部署;工具体内没有 LLM 调用。 |
| **治理归因** | 单段叙事响应,没有 traceability 字典。审计员拿到散文。 | 每个 `/api/deliberate` 响应内联 `traceability` 字典,把每个阈值映射到正确的治理层(BRD / Addenda / Risk Appetite Note / Regulatory)— 这就是 Loredana C. Levitchi 命名的 **BRD vs. Addenda 来源分离原则**,IEEE VR/VIS 2027 共同第一作者论文。 |

## 我们不假装竞争的方面

- **数据深度。** Anthropic + Moody's 原生给你 600M 公司记录。Shadow 有 30 家中型银行 pipeline 目标;我们不是数据供应商。
- **品牌背书。** Anthropic 自带 Goldman / Blackstone 背书。Shadow 自带 Loredana Levitchi(14 年全球银行金融软件经验)+ 即将发表的 IEEE VR/VIS 2027 论文。不同的验证者,不同的房间。
- **Pitchbook 自动化。** 不在范围内;Shadow 做的是贷款发放合规。

## 我们赢的地方

1. **Schema-layer safety** — 见 [`principles/schema-layer-safety.md`](./principles/schema-layer-safety.md)。Anthropic 模板返回叙事文本;Shadow 返回严格 JSON 枚举判决(block / approve / escalate),带 `rationale_short < 500 字符` 限制 + 12 条正则护栏拦截 council 边界上的交易执行幻觉。Hebbia / Anthropic 无法把自己的安全性 grep 进代码库;Shadow 采购可以 grep `lib/audit-guardrail.js`。
2. **Determinism floor** — 见 [`principles/determinism-floor.md`](./principles/determinism-floor.md)。FICO < 700 是一条硬编码的 JS 条件,带 pinned test(`test/loan-policy.test.js`)。AA01–AA05 代码从 `lib/schemas/adverse-action.js` 发出,带 `AA_SOURCES` 归因。审计员读 8 行代码,而不是 80 页 MRM 文档。
3. **多 provider,Mainland-friendly** — Shadow 路由 Anthropic / OpenAI / GLM(Zhipu,服务 Mainland China 中型银行,Anthropic 在那里不可用)。Anthropic FS 模板只支持 Anthropic。
4. **采购可辩护的成本** — Anthropic 企业合同价格在 6 位数。Shadow seat 目标是 **每个合规官 $1,800 / 年**。这是中型银行(Raymond James / Stifel / LPL)在没法负担 Hebbia / Anthropic 规模的情况下的楔点。

### 多 provider 不是营销文案 — 自身狗食证据(2026-06-28)

2026-06-28 我们中午撞到自己的 Anthropic 月度使用上限。两个生产系统立刻暴露故障:

- **Shadow 的 OCR live-smoke 套件**失败,报 `400 invalid_request_error: You have reached your specified API usage limits. You will regain access on 2026-07-01 at 00:00 UTC.` ([commit `beb5602`](https://github.com/alex-jb/shadow-mentor/commit/beb5602))。
- **我们内部的 daily-brief distill cron** 产出 `[ERROR] anthropic call failed (non-billing)` stub,因为它的 envelope matcher 只认识老的 "credit balance too low" 措辞,不认识新的 "usage limits" 措辞([alex-brain commit `2d12937`](https://github.com/alex-jb/alex-brain/commit/2d12937))。

两个都在数小时内通过把 envelope 错误视为优雅 fallback 修好了。给采购的关键点:单 provider 部署同一天会撞同一堵墙,但在 Shadow 多 provider router 上运行 + 配置 GLM-5.2 fallback([`lib/glm-call.js`](../lib/glm-call.js) + [`test/glm-call.test.js`](../test/glm-call.test.js) 12 条 contract test)的银行会继续审批贷款,直到 Anthropic 重置。这不是"我们相信多 provider 重要"— 这是"我们 6/28 收到了账单,而银行不会"。

Anthropic FS 模板**按构造只支持 Anthropic**。Shadow **按构造 provider 无关**。差异在你真正需要的那天显现。

## 买方的心智模型

Anthropic FS Agents 和 Hebbia 拥有 **research seat,$10K+ / 年**。Shadow 拥有 **合规官 seat,$1,800 / 年**。pitch 是 *互补*,不是替代:

> "你的 Hebbia / Anthropic 分析师写 memo。Shadow 的 5-voice council 给出你的审计员可以审计 JSON 的绑定判决。"

## 引用

- [Anthropic Financial Services Agents(2026-05-05)](https://www.anthropic.com/news/finance-agents)
- [Anthropic + Goldman / Blackstone / H&F $1.5B 联合基金(Fortune, 2026-05-05)](https://fortune.com/2026/05/05/anthropic-wall-street-financial-services-agents-jamie-dimon/)
- [Hebbia 2026 定价 — Sacra](https://sacra.com/c/hebbia/)
- [BRD vs. Addenda 来源分离原则 — Levitchi 2026](./principles/source-separation.md) *(forthcoming)*
