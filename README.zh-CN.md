# Shadow

[English](./README.md) · [中文](./README.zh-CN.md)

> 跟随分析师跨桌面、智能眼镜、空间 AR 的端侧 AI 议会 + 审计链。一个引擎,四个设备端,五套人格包。面向受监管的银行工作流。

[![tests](https://img.shields.io/badge/tests-73%2F73%20passing-brightgreen)](./test) [![shadow agentic score](https://img.shields.io/badge/shadow%20agentic%20score-89%20%C2%B1%203%20(n%3D3)-brightgreen)](./benchmark/history/SUMMARY.md) [![live demo](https://img.shields.io/badge/live%20demo-vercel-black)](https://shadow-mentor-q0lg7uwz4-alex-jbs-projects.vercel.app) [![backend](https://img.shields.io/badge/backend-Anthropic%20Sonnet%204.6-purple)](./api/deliberate.js) [![license](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)

## 现场演示

**公开 URL**: https://shadow-mentor-q0lg7uwz4-alex-jbs-projects.vercel.app *(Vercel Deployment Protection 切换待定 — 见 `CHANGELOG.md`)*

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
- 真 Anthropic Sonnet 4.6 后端部署到 Vercel
- GLM-5.2 (智谱) provider 集成 (Live 模式可切)
- 跨会话记忆后端 (`api/recall`) 带 30 条种子 + Brier 校准统计端点
- Shadow Agentic Capability Benchmark **v0.3.3** runner — **88/100 综合分** (受 HF "Is it agentic enough?" 启发)
- `/api/health` + `/api/badge` 健康检查 + shields.io 端点
- 37/37 测试绿 (data-model + API contract + endpoint contract)
- 原生 macOS app 计划 2026 Q3 上线

## Shadow Agentic Score — 88 ± 4 (n=3, 2026-06-18 晚)

**综合 Shadow Agentic Score: 89 ± 3 (n=3)** *(2026-06-18 晚,每轮 8 任务,anthropic provider,v0.3.3 prompts。三次跑分: 87 / 93 / 86,均值 88.7,std 3.1,极差 7。3 份原始 report 在 [`benchmark/history/SUMMARY.md`](./benchmark/history/SUMMARY.md))*

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
