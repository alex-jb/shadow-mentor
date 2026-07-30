# 审计室:从 demo 到产品(2026-07-30 spec)

隔离原则:这些**不碰 demo 的稳定路径**。① 已实现(本分支);②③ 是带 fixture 设计的 L 级,demo 后做。

## ① 加载你自己的签名包 —— ✅ 已实现(feat/audit-room-bundle-loader)
- `bundle-loader.js`:拖入/选文件 → 结构校验 → sessionStorage → reload → boot 读出传 `createAuditRoom({C,bundle})`,复用整条已验证启动路径
- 诚实:非 JSON / 非证据包 **明确报错、不改场景**(anti-silent-failure);未签名包拒收。按 `O` 回 canned demo
- 测试:validateBundle 3/3(坏输入全带 reason 不抛)。「电影 → 工具」的第一块砖
- **待接**:index.html 加一个可见 drop 提示(现在整窗可拖但无视觉引导);从房内一键「open as 2D table」(接 demos/replay 的 2D inspector)

## ② tamper 之外的案例状态(M/L,需新 fixture)
3D 房现在只演「完整链→篡改→愈合」一种叙事。缺(全没设计):
- **APPROVED 静息态**:一条干净、已授权的决策链(绿 Verified + 明确 approval present),作为「正常长这样」的对照
- **REJECTED/blocked**:FICO<700 硬拦那种,顶部 verdict=block,展示为何拒
- **多 reviewer 冲突**:approved vs rejected 并存 → 派生 pending(接 build-session 的 FINDING-C1 语义,界面强制不静默解决)
- **AML flag**:opt-in 第 6 voice 命中,红旗锚定到具体事件
做法:每种一个签名 fixture bundle(引擎侧 run-loan-council 真跑生成)+ 房内状态渲染。与 ① 协同——加载器让这些能被 drop 进来看

## ③ 把 council 审议带进房(L,交付 Ambient Council 规格)
最大产品-设计缺口:3D 房演的是 *agent session 的密码学链*(tool_call/tool_result),不是 *贷款 council 审议*。真产品(5-6 voice verdict + reason-code→Reg-B pill + per-class 概率)只活在 web/JSON 路径 + 设计 PDF(`docs/product-design/xr-visual-paradigm-2026-07-06-v3-AMBIENT-COUNCIL`)。
交付:把 `run-loan-council` 的 voices[](verdict/rationale/probabilities)并进房数据模型 → 每 voice 空间音频位 + 单色 pill(Severance 克制);reason-code pill 锚定到贷款文档数字。这才让它是 *Shadow 的* 审计室而非通用 hash-chain viewer。
依赖决策:bundle schema 是否携带 council 段,还是房加载时旁挂 council JSON。

## 基础(防三面 drift)
- 统一设计 token:现在 `constants.js`(3D)/`design-tokens.ts`(web)/Unity 各自硬编;需一个 token 包三面共用 + parity test
- 2D fallback 从房内可达:现在 demos/replay 是独立 app,不是房的 fallback;≥20 节点应能退 2D 表
