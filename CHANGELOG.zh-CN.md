# Shadow — 更新日志

[English](./CHANGELOG.md) · [中文](./CHANGELOG.zh-CN.md)

所有 Shadow 产品的重要变更。日期为 NY 本地时间。

本日志同时作为银行采购尽职调查的执行速度证据。

格式参考 [Keep a Changelog](https://keepachangelog.com/)。

> **注:** 历史版本(v1.0.0 → v1.1.1)的完整中文翻译参见英文版 [`CHANGELOG.md`](./CHANGELOG.md)。本文从 v1.2.0 起提供同步的中文版本。

---

## [Unreleased]

下一步规划:
- macOS 原生应用 POC(ScreenCaptureKit + 本地 Phi-4-mini + AppKit overlay)
- 5 分钟 Loom 录制(按彩排脚本)
- 30-目标冷邮件轮次(7 月)— 需要 Loom URL 替换
- SOC 2 Type 1 准备 checklist
- shadow.io 域名采购(相比备选)
- IEEE VR 2027 abstract v1(与 Loredana C. Levitchi 共同第一作者)
- 完整版 bin/install.mjs,消费 installer/tools.json + 根据检测到的 MCP host 自动写配置

---

## v1.2.0 — 采购可辩护性硬化(2026-06-28 NY)

单日集群:把"我们安全 / 多 provider / OAuth-ready"这些定位 bullet 从声明变成机械可验证的测试 + 可选的生产 gate。**15 commits · +112 测试(196 → 308)· 0 fail**

### 新增

- **Per-cell benchmark 回归 gate**(`lib/benchmark-stats.js` + `test/benchmark-stats.test.js`)。`CELL_HISTORICAL_FLOORS` 从 n=6 历史冻结,5 点容差。87 ± 3 aggregate 能掩盖单个 persona 的崩盘 — 这个 gate 在任何 persona × scenario cell 跌出历史最低分 5 点以上时触发 `process.exitCode=2`。+12 条测试 pin floor map ↔ 历史最低值。
- **README MCPTox / OX Security 2026 已命名威胁 callout**(EN + 中文)。两份已命名 2026 披露(arXiv 2508.14925 + OX Security STDIO advisory)被引用,带每个 Shadow 控制的精确缓解。评审员 5 分钟内可以 grep 源码验证。
- **MCPTox canary contract suite**(`test/mcptox-canary.test.js`)。+28 条测试覆盖 MCPTox §3 的 6 类攻击(指令注入 / 交易动词注入 / echo-back 探针 / 超大 buffer / HTML 注入 / 嵌套 JSON 绕过)× 4 条不变量(verdict 在枚举内 OR 干净拒绝 · enforceAnalysisOnly 通过 · canary token 不泄漏 · 响应形状 pinned)+ 4 条工具描述反注毒断言。同一套测试也覆盖 **MosaicLeaks 多轮信息渗漏类**攻击。
- **GLM-5.2 contract 测试**(`lib/glm-call.js` + `test/glm-call.test.js`)。+12 条测试,mock-fetch ($0 GLM credits): Bearer header,snake_case `max_tokens`(catches camelCase regression),system-then-user 消息顺序,默认 220-token 预算,带 status 标签的错误路径,rate-limit 429,空内容路径,base-URL pin。
- **Audit-guardrail 边界 case pin**(`test/traceability-and-guardrail.test.js` 加 5 条): 12 条禁止动词逐条(不能 sweeping disarm),大小写不敏感,word-boundary 反误报(`submit a memo` / `buyer profile` / `trader voice` 不能 fire),AnalysisOnlyViolationError 形状,通过 JSON.stringify 扫描嵌套对象。
- **MCP Enterprise OAuth (EMA) scope scaffold**(`lib/auth/oauth-scaffold.js` + `test/oauth-scaffold.test.js`)。冻结的 `SCOPE_TO_TOOLS` 目录,3 个 scope(`shadow:read` / `shadow:council` / `shadow:admin`),`validateToolScope()` 同步验证器,OAuth2 RFC 6749 + Azure AD `scp[]` + `scopes[]` claim 形状容错,`parseBearer()` RFC 6750 + shell-injection 拒绝,RFC 8414 discovery URL helper。+26 条 contract 测试。
- **EMA 接入 `/api/loan-council`** 作为可选 middleware(`SHADOW_REQUIRE_BEARER=1`)。开启后: 缺 claims 返 401 + `WWW-Authenticate: Bearer realm="shadow", scope="shadow:council"`;scope 不够返 403 + 详细原因;scope 匹配返 200 verdict(支持 Azure AD `scp[]` 和 OAuth2 `scope` 字符串两种形状)。+9 条 wiring 测试。默认关闭 — 向后兼容所有已有 demo。
- **GLM vs Sonnet A/B benchmark 工具**(`eval/glm-vs-sonnet-ab.mjs`)。5 个 voice prompt × 2 provider × N 次运行(默认 3),deterministic 结构化打分(长度 100-600 + 期望词汇覆盖 + 以句号结尾),与 `benchmark/runner.js` 一致,内置 envelope-skip,写 `benchmark/provider-ab/SUMMARY.md` append-only 日志。Close 2026-06-26 daily-brief distill action #6。
- **Catalog-as-code 安装目标注册表**(`installer/tools.json` + `scripts/check-tools.mjs` + `test/tools-catalog.test.js`)。模式来自 msitarzewski/agency-agents(117k stars)。5 个 MCP host × 6 个工具 × 冻结的 `$server_contract` 声明在一个 JSON 文件里。`npm run check:tools` 验证器 + 7 条 contract 测试 pin catalog ↔ `mcp/server.js` `TOOLS` 一致性(双向 — 同时捕捉"添加工具但忘记 catalog"和"catalog 添加但代码没有")、ID 唯一、合法 `install_kind` / `format`、不泄漏绝对路径。
- **`bin/install.mjs` 一行 MCP installer**。读取 `installer/tools.json`,检测哪些 MCP host 装在本机,JSON-merge 写正确配置(保留同级 MCP server)。`--dry-run` 显示精确字节,`--all` 装所有检测到的 host。
- **OCR live-smoke envelope-skip**(`test/ocr-live-smoke.test.js`)。把 Anthropic / Mistral usage-cap / quota / credit-balance / insufficient-quota 错误视为 `t.skip()` 而不是 fail。Pin 2026-06-28 verbatim Anthropic 措辞,这样未来 upstream 改措辞被 CI 捕捉。Auth + 网络错误仍然 surface。

### 变更

- **README hero**(EN + 中文): test badge 154 → 208 → 308;agentic score 从 "86 ± 1 (n=3) post-BR" 到 "87 ± 3 (n=6)" 通过自动计算的 `benchmark-stats.js`。
- **`docs/positioning-vs-anthropic-fs.md`** 加入 "多 provider 不是营销文案 — 自身狗食证据(2026-06-28)" 段落。引用两个真实同日修复(本 repo `beb5602` + alex-brain `2d12937`),回应撞到自己 Anthropic quota cap。采购评审员可以验证 GLM-5.2 fallback 路径有测试,不是嘴上说说。

### 分发

- 已开 PR: [punkpeye/awesome-mcp-servers#8878](https://github.com/punkpeye/awesome-mcp-servers/pull/8878) — Finance & Fintech 分类
- 已开 PR: [tolkonepiu/best-of-mcp-servers#278](https://github.com/tolkonepiu/best-of-mcp-servers/pull/278) — finance-and-fintech 分类
- 分支推送到 `appcypher/awesome-mcp-servers` fork — 1-click PR ready

### 采购合同

银行采购团队想验证 Shadow 对 2026 已命名威胁覆盖,可以在 10 分钟内 grep 以下文件:

1. `lib/audit-guardrail.js` — 12-pattern 正则输出 gate(Schema-Layer Safety)
2. `lib/run-loan-council.js` — `if (loan.fico < CREDIT_THRESHOLDS.FICO_FLOOR) return { verdict: "block", ... }`(Determinism Floor)
3. `installer/tools.json` — 冻结的安装目标 × scope 目录(EMA-ready 表面)

加上对应机械证明的 4 个测试文件:

- `test/mcptox-canary.test.js`(MCPTox / MosaicLeaks)
- `test/oauth-scaffold.test.js` + `test/oauth-loan-council-wiring.test.js`(EMA)
- `test/glm-call.test.js`(多 provider)
- `test/tools-catalog.test.js`(catalog 漂移)

---

## 早期版本

v1.1.1 及更早版本的完整变更记录见 [`CHANGELOG.md`](./CHANGELOG.md) 英文版。重要里程碑:

- **v1.1.1**(2026-06-19): License 澄清 + FICO 硬阻断 + 作者归因(Loredana C. Levitchi 加入为主要作者)
- **v1.1.0**(2026-06-19): Mode A 集成 — `lib/risk-tools/` JS 端口 + `lib/run-loan-council.js` 5-voice 仲裁器 + traceability dict
- **v1.0.0**(2026-06-18): Shadow Agentic Capability Benchmark + 8 endpoints + MCP server v1
- **v0.x**(2026-06-17 → 2026-06-18): 项目初始化 + 5 personas × 4 scenarios × 4 devices 矩阵 + 实时 Anthropic + GLM 集成
