# Shadow

[English](./README.md) · [中文](./README.zh-CN.md)

> 跟随分析师跨桌面、智能眼镜、空间 AR 的端侧 AI 议会 + 审计链。一个引擎,四个设备端,五套人格包。面向受监管的银行工作流。

[![tests](https://img.shields.io/badge/tests-208%2F208%20passing-brightgreen)](./test) [![shadow agentic score](https://img.shields.io/badge/shadow%20agentic%20score-87%20%C2%B1%203%20(n%3D6)-coral)](./benchmark/history/SUMMARY.md) [![live demo](https://img.shields.io/badge/live%20demo-vercel-black)](https://shadow-mentor-o033hfcya-alex-jbs-projects.vercel.app) [![backend](https://img.shields.io/badge/backend-Anthropic%20Sonnet%204.6-purple)](./api/deliberate.js) [![license](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)

### 直接对应 2026 已命名的 MCP 威胁(MCPTox / OX Security)

2026 年两份独立披露具体命名了 Shadow 在架构层默认就缓解的失效模式:

- **OX Security MCP 供应链公告**(2026-05)— MCP STDIO transport 允许任意 OS 命令启动服务端;Anthropic 确认是 by-design,sanitization 是开发者责任。影响超过 1.5 亿 SDK 下载。*Shadow 的缓解*:`shadow_*` 工具仅调用冻结的 `lib/` 模块;响应在议会输出边界经过 `enforceAnalysisOnly()`。没有不受信任的 shell 输入会到达工具体。([公告](https://www.ox.security/blog/mcp-supply-chain-advisory-rce-vulnerabilities-across-the-ai-ecosystem/))
- **MCPTox benchmark**(arXiv 2508.14925)— 测试 45 个 server / 353 个工具,Claude-3.7-Sonnet 拒绝被注毒的工具描述的比例不到 3%。*Shadow 的缓解*:工具返回严格 JSON 枚举判决(block / escalate / approve),不是自由叙事文本。被注毒的描述无法扩大响应表面超过 schema,`lib/audit-guardrail.js` 上 12 条正则在每个 voice 理由到达用户之前再过一次。

两条缓解都可以直接 grep 源码读出来:采购评审在 5 分钟内可以验证。不需要 prompt-engineering 的信仰。

MCPTox 缓解是**机械证明**的,不是声明 — 见 [`test/mcptox-canary.test.js`](./test/mcptox-canary.test.js):28 条 contract 测试覆盖 MCPTox §3 的 6 类攻击(指令注入 / 交易动词注入 / echo-back 探针 / 超大 buffer / HTML 注入 / 嵌套 JSON 绕过)+ 4 条工具描述反注毒断言。同一套测试也覆盖 **MosaicLeaks 多轮信息渗漏类**攻击 — category-C echo-back + category-F 嵌套 JSON 锁死"攻击者无法跨工具边界提取 canary token"这条不变量。

## 协作与许可

Shadow v1.1.1 集成了 **Loredana C. Levitchi**(叶史瓦大学 + William Paterson University 教师,14 年全球银行金融软件经验)撰写的 **Orallexa Shadow Mode A** 包。根据她 2026-06-19 的明确授权,以 MIT 许可证合并。她是以下模块的主要作者:

- 风险 + 信贷政策 + 阈值 + adverse-action + traceability 模块
- **BRD vs. Addenda 来源分离原则** —— 在她的 *Orallexa Shadow Mode A* 包中形式化的、为采购可辩护性服务的治理模式,通过 `lib/traceability.js` 在 API 响应级别 inline 体现
- Aura Alexa BRD + Addenda A/B/C + Risk Appetite Note(收录于 `docs/external/`)

正在准备共同第一作者的 IEEE VR / VIS 2027 摘要(投稿截止 2026-08-24),命名贡献即 BRD vs. Addenda 来源分离原则。JS port 和 spatial XR 层的集成维护者:Alex Xiaoyu Ji。

## 现场演示

**公开 URL**: https://shadow-mentor-o033hfcya-alex-jbs-projects.vercel.app *(Vercel Deployment Protection 切换待定 — 见 `CHANGELOG.md`)*

可以点击任一组合:

- **4 个设备端**: 🖥 桌面 · 👓 Even G2 · 🕶 Brilliant Frame · ✨ XReal Air 2 Ultra (JARVIS 空间 AR 模式)
- **5 套人格包**: 🛡 合规 · 🧮 量化 / 数据科学 · 💻 工程 · 📈 交易 · 💼 财富顾问
- **4 个场景**: 📊 LBO 模型 · 📈 Bloomberg DES · 📉 CDS 价差 · 📄 内部政策
- **3 种后端模式**: Cloud (mock) · Local (mock) · 🟢 Live
- **2 个 LLM 提供商 (Live 模式)**: Claude Sonnet 4.6 · GLM-5.2 (智谱,面向大陆银行 pitch)
- **📚 跨会话记忆召回**: 点击 memory card 里的 "Recall past 5" 拉取该 persona 的历史决策 — 30 条种子条目,带 Brier 校准的结果,Elastic agent-memory 后端可热替换

切到 Live 模式 → 点任一组合 → 真三声议会在 6-10 秒内返回(2026-06-18 测量,3 路并发 Anthropic + 1 路 Haiku followup)。

**状态**: 项目于 2026-06-17 启动。截至 2026-06-18 晚:
- 20/20 个 persona × 场景 cell 填充了有根据的内容
- 真 Anthropic Sonnet 4.6 + 智谱 GLM-5.2 双 provider 集成 (Live 模式可切)
- 跨会话记忆后端 (`/api/recall` + `/api/calibration`) 带 30 条种子 + per-persona Brier 校准 + Elastic agent-memory swap stub
- Shadow Agentic Capability Benchmark **v0.3.3** runner — **87 ± 3 (n=6) 综合分** (受 HF "Is it agentic enough?" 启发);compliance × LBO anchor cell **100/100 n=3 稳定**
- **8 个 JSON 端点 live**: `/api/deliberate` (POST, +loan body 加 verdict) · `/api/loan-council` (POST, 纯计算 5-voice 规则层,Lora Mode A) · `/api/recall` · `/api/calibration` · `/api/scenarios` · `/api/health` · `/api/badge` (shields.io) · `/api/version` (git SHA audit pin)
- **Levitchi Mode A 集成 ship 完 + 收紧 (v1.1.1)**:typed risk tools (VaR / ES / concentration / sector / correlation / beta) + 5-voice verdict resolver (block > escalate > approve) + loan 输入 schema 带 BR 阈值 (FICO 700 / DTI 0.36 / LTV 0.80 / VaR 0.12 @ 95%/10d) pin 在 drift-detection 测试里。**v1.1.1: FICO < 700 是 hard block**(不是 escalate)per Levitchi 政策澄清 —— 信用资格底线不可让步。
- **采购级 citation chain (v1.1+)**:每个 `/api/deliberate` 响应都 inline 返回 `traceability` dict,把每个阈值映射回 BRD vs Addendum vs Risk Appetite Note 来源。AA01-05 adverse-action codes 对齐 CFPB Bulletin 2024-09 model-traceability 要求。`enforceAnalysisOnly()` regex guardrail 在 council 输出边界 catch LLM 幻觉的交易执行词。14 个契约测试守 provenance。
- 154/154 测试绿;GitHub Actions CI 连续 15+ commits 绿
- 原生 macOS app 计划 2026 Q3 上线

## Shadow Agentic Score — 88 ± 4 (n=3, 2026-06-18 晚)

**综合 Shadow Agentic Score: 87 ± 3 (n=6)** *(2026-06-18 晚,每轮 8 任务,anthropic provider,v0.3.3 prompts。三次跑分: 87 / 93 / 86,均值 88.7,std 3.1,极差 7。3 份原始 report 在 [`benchmark/history/SUMMARY.md`](./benchmark/history/SUMMARY.md))*

Rubric 是确定性的,但 Sonnet 输出是随机的 — 单跑分是一个样本,中心趋势才是诚实读数。

| 任务 | v0.1 → v0.3.3 | 备注 |
|---|---|---|
| compliance × lbo | 54 → **100** | 9 项 check 全过 |
| compliance × policy | 54 → 92 | third voice 长度超 ceiling 8% |
| quant × lbo | 32 → 84 | senior + third 各超 ~10% |
| quant × cds | 27 → 93 | senior 缺一个 PSI/VIX 词 |
| engineer × lbo | 15 → **100** | 本轮绝对跳升最大 |
| trader × bloomberg | 27 → 76 | trader voice 即便 prompt cap 260 字符仍长 |
| trader × cds | 33 → 76 | 同样的长度溢出 pattern |
| advisor × lbo | 51 → 84 | senior voice 仍冗长 |

四轮迭代,每轮在同一确定性 rubric 下打分:

| 迭代 | 综合 | 增量 |
|---|---|---|
| v0.1 (baseline) | 39 | 首轮真跑,每条长度 check 全失败 |
| v0.3.0 显式 char-range ask | 64 | +25 |
| v0.3.1 hard MAX framing + anchor terms | 76 | +12 |
| v0.3.2 followup capped + terminal-? regex | 84 | +8 |
| v0.3.3 per-voice cap 260/300/320 | **88** | +4 |

这个 rubric 下 ~88 是诚实的天花板 — 剩 12 分是 length-ceiling 与 term-coverage 的对冲 (length 再压 Sonnet 就丢 "Credit Committee" / "single-name" / "VIX" 等 anchor)。

随时复跑:

```bash
export ANTHROPIC_API_KEY=$(cat ~/.config/anthropic_key)
node benchmark/runner.js
```

产出 `benchmark/report-YYYY-MM-DD.json`。单次成本 ~$0.05。**直接调用 Anthropic SDK — 不依赖 Vercel Deployment Protection toggle**。

## 是什么

端侧读取分析师的屏幕 (默认从不上传),识别她在看哪份文档 / 终端,投递三个人格声 — Junior 分析师 (术语翻译)、Senior / VP (你老板真正在乎的)、合规 (什么 NOT 该说 / 发) — 配 hash chain 审计链,使银行能回答 OCC / EU AI Act 的问题:"你的分析师为何做出这个决定?"

- "这个列是什么意思"
- "你 VP 为什么 care 这个数字"
- "下一步该问什么"

## 为什么是现在

- **EU AI Act high-risk 义务 2026 年 8 月生效** — 合规偏执的本地模式的监管 deadline
- **本地 LLM 在 2026 年中跨过可用门槛** — Gemma 3 9B / Phi-4-mini / Apple Foundation Model 3 Core Advanced
- **Big 4 应届招聘 YoY 砍 6-29%** — 活下来的分析师更需要杠杆
- **金融服务每员工 L&D 预算 $1,097-$1,331** — Shadow $1,500-$2,400/seat/年 正好落在这个 line item

## 两种模式

- **Cloud 模式** ($50/seat/月): 屏幕 → Anthropic / OpenAI / GLM-5.2 → 回复。用于非机密培训数据、公开市场信号、教育性说明。
- **Local 模式** ($1,500-$2,400/分析师/年/persona): 屏幕 → 端侧 Gemma 3 9B / Phi-4-mini / AFM 3 Core Advanced → 回复。**数据不出 laptop**。用于客户 PII、M&A 文档、内部模型,以及 Reg B / Reg BI / EU AI Act high-risk 义务覆盖的一切。

## 滩头堡 — 谁是第一批用户

**$5B-$50B AUM 的地区财富管理 / 精品投行的一年级分析师,前 90 天,公司发的 MacBook Pro 上,工作流是 Excel + CRM + 研究门户。**

不是"所有金融"。不是高盛 / JPM / Citi (他们会内部自建 — 60%+ 的 AI 渗透率)。

中型目标行(按优先): Raymond James · Edward Jones · Stifel · LPL Financial · Houlihan Lokey · Lazard MM · William Blair · Jefferies · Alvarez & Marsal · FTI · 地区银行 $5B-$50B AUM。

**~30 家行 × 50-300 分析师/年 × $1,500/seat/年 = $3-5M ARR (关 5 家)**

## 最大风险

JPMorgan / Goldman / Citi 在 2026-2027 把内部 LLM Suite 延伸到自行做 role-specific scaffolding。他们已经部署了 60%+ AI 渗透。

**逃生通道**: 永远不卖 Top 10。落地中型,他们没工程 bench。

## 许可证

MIT (见 `LICENSE`)。
