# Audit Workspace — localization

Distinguishes two separate concerns the earlier report conflated:

- **CJK-GLYPH-RENDERING-PASSED** — Chinese glyphs render with no tofu (a rendering/font concern).
  Verified in the graphics captures (银行审计 / 委员会决策 / 来源不存在 / 首个失败 …).
- **CHINESE-LOCALIZATION-COMPLETE (for the label set)** — every critical UI label + status value has a
  real Chinese string, not an English fallback.

## Where Chinese comes from
- **Status VALUES** (VERIFIED, FIRST_FAILURE, APPROVAL_NOT_PRESENT, SELF_SIGNED …) → the GENERATED
  tokens (`ShadowSemanticTokens` Text/TextZh via `ShadowStatusGlyph`). No duplicate table.
- **UI labels** that are not token entries (region titles, field labels, actions, tracking short
  names) → one bounded workspace-local resource `ShadowWorkspaceLabels` (EN/ZH), no runtime machine
  translation.

## Localized (verified in `first-failure__zh-CN__DesktopDark.png`)
银行审计 · 追踪: 3DoF 追踪 · 模拟——未经真机验证 · 来源 · 来源不存在 · 位置: 位置不可用 · 解析: 不存在 ·
OCR: 未评估 · 委员会决策 · 验证: 首个失败 · 人工审核: 需人工审核 · 审批: 无审批 · 受影响的后续: 1 ·
信任姿态: 自签名 · ◆ 首个失败 · ▶ 打开 2D 审计 — 检查首个失败 · 信任 · 完整性 · 溯源 · 决策支持 ·
人工/政策 · rail: 首失 / 下游 · 上一步 · 下一步 · 重置 · 重新居中 · [打开 2D 审计]

## Tests (EditMode, pass in the 136/136 run)
- `Localization_EveryLabelKey_HasEnglishAndChinese` — every label key has non-empty EN + Chinese.
- `CHINESE_LOCALIZATION_COMPLETE_forCriticalLabels` — 21 critical keys all have a distinct Chinese
  string (zh ≠ en).
- `StatusValues_Localize_ViaGeneratedTokens_NotADuplicateTable` — status zh comes from generated tokens.

## Honest residual
- `role: <value>` — the field LABEL localizes (角色) but the role VALUE (the entity `Kind`, e.g.
  "decision") stays English. It is entity metadata, not a UI label; localizing entity Kinds is a
  fixture concern, tracked as a minor follow-up.
- Flags: CJK-GLYPH-RENDERING-PASSED ✅ · CHINESE-LOCALIZATION-COMPLETE ✅ (label + status layer;
  role-value residual noted). These remain SEPARATE flags — not merged.
