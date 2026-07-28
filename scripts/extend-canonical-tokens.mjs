// Deterministically EXTEND the canonical design-token source (design/shadow-spatial-tokens.json) with the
// cross-surface semantic model: governance, trust posture, tracking, interaction, capability — plus the
// verification aliases (FAILED/WARNING/NOT_EVALUATED/FIRST_FAILURE/DOWNSTREAM_AFFECTED). One source of
// truth; every state carries colour + icon + shape + EN/ZH text + a11y. Colours follow the permanent
// meaning: green=verification, red=fail, amber=warning/scanning/caution, blue=focus/selection/human-action,
// neutral=not-evaluated/inactive. Idempotent + deterministic (sorted keys, no timestamps).
//   node scripts/extend-canonical-tokens.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "design", "shadow-spatial-tokens.json");
const d = JSON.parse(readFileSync(FILE, "utf8"));

const GREEN = "#4ade80", RED = "#ef4444", AMBER = "#fbbf24", BLUE = "#3b82f6", NEUTRAL = "#8a92a0";
const s = (text, text_zh, icon, color, a11y, a11y_zh, shape = "box") => ({ text, text_zh, shape, icon, color, a11y, a11y_zh });

// ── backfill a11y_zh on the pre-existing status entries (EN/ZH parity for every semantic state) ──
const A11Y_ZH = {
  VERIFIED: "已验证——该记录与封存证据一致;不代表决策正确",
  TAMPERED: "已篡改——被改动的节点;验证在此失败",
  NOT_VERIFIED: "未验证——位于篡改点的下游;已冻结",
  NOT_CHECKED: "本次未检查",
  NOT_PRESENT: "证据包中不存在",
  UNSUPPORTED: "本验证器不支持",
};
for (const [k, zh] of Object.entries(A11Y_ZH)) if (d.status[k] && !d.status[k].a11y_zh) d.status[k].a11y_zh = zh;

// ── A. verification aliases (extend existing `status`; keep the historical keys) ──
Object.assign(d.status, {
  FAILED: s("FAILED", "验证失败", "cross", RED, "verification failed at this record", "此记录验证失败", "octahedron"),
  WARNING: s("WARNING", "警告", "warning", AMBER, "a caution/quality flag — not a chain break", "警示/质量标记——非链断裂", "tetrahedron"),
  NOT_EVALUATED: s("NOT EVALUATED", "未评估", "dash", NEUTRAL, "not evaluated — distinct from failed", "未评估——不等于失败", "ring"),
  FIRST_FAILURE: s("FIRST FAILURE", "首个失败", "broken-seal-first", RED, "the FIRST point where verification fails", "验证首次失败的点", "octahedron"),
  DOWNSTREAM_AFFECTED: s("AFFECTED DOWNSTREAM", "受影响的后续", "chain-arrow-dashed", NEUTRAL, "affected by an upstream failure — NOT an independent first failure", "受上游失败影响——非独立首个失败", "box"),
});

// ── B. human-governance (approval is NOT verification green) ──
d.governance = {
  REQUIRES_HUMAN_REVIEW: s("REQUIRES REVIEW", "需人工审核", "human-diamond", BLUE, "human review required (action)", "需要人工审核(待处理)", "diamond"),
  HUMAN_REVIEW_RECORDED: s("REVIEW RECORDED", "已记录审核", "review-doc", "#6b7280", "a human review was recorded — NOT the same as approval", "已记录人工审核——不等于审批", "box"),
  APPROVAL_NOT_PRESENT: s("APPROVAL ABSENT", "无审批", "stamp-empty", NEUTRAL, "no human approval is present", "无人工审批", "ring"),
  APPROVAL_PRESENT: s("APPROVAL PRESENT", "已审批", "stamp-signed", BLUE, "explicit human approval (brand/stamp, NEVER verification green)", "已获人工审批(品牌/印章色,绝不用验证绿)", "pill"),
  ABSTAINED: s("ABSTAINED", "弃权", "pause", NEUTRAL, "abstained from a stance", "对该立场弃权", "ring"),
};

// ── C. trust posture ──
d.trust_posture = {
  SELF_SIGNED: s("SELF-SIGNED", "自签名", "key", AMBER, "verifies against the supplied key; an operator holding it could re-sign altered history without an external anchor", "对提供的密钥可验证;持钥运营者在无外部锚定时理论上可重签改动的历史", "box"),
  TIME_ANCHORED_STRUCTURAL: s("TIME-ANCHORED (STRUCTURAL)", "结构化时间锚定", "clock-outline", BLUE, "structural timestamp present; not an external transparency anchor", "存在结构化时间戳;非外部透明日志锚定", "box"),
  TIME_ANCHORED: s("TIME-ANCHORED", "时间锚定", "anchor-check", GREEN, "verified external time anchor (e.g. RFC 3161 / Rekor)", "已验证的外部时间锚定(如 RFC 3161 / Rekor)", "box"),
};

// ── D. tracking (SCANNING is amber caution — never green, never red/lost) ──
d.tracking = {
  INITIALIZING: s("INITIALIZING", "初始化中", "spinner", NEUTRAL, "tracking initializing", "追踪初始化中", "ring"),
  SCANNING: s("SCANNING FOR POSITION", "定位扫描中", "scan", AMBER, "scanning — hold still and slowly look around; core 3DoF review remains available. NOT lost.", "扫描中——请稳住并缓慢环视;核心 3DoF 审阅仍可用。非丢失。", "tetrahedron"),
  TRACKED_3DOF: s("3DOF", "3DoF 追踪", "3dof", GREEN, "3DoF tracking active (orientation)", "3DoF 追踪(姿态)", "icosahedron"),
  TRACKED_6DOF: s("6DOF", "6DoF 追踪", "6dof", GREEN, "6DoF tracking active (position)", "6DoF 追踪(位置)", "icosahedron"),
  LIMITED: s("TRACKING LIMITED", "追踪受限", "warning", AMBER, "tracking limited — safe session-relative layout", "追踪受限——安全的会话相对布局", "tetrahedron"),
  LOST: s("TRACKING LOST", "追踪丢失", "lost", RED, "tracking lost — story/selection/audit preserved; Recenter + 2D audit available", "追踪丢失——故事/选择/审计保留;Recenter 与 2D 审计可用", "octahedron"),
  RECOVERING: s("RECOVERING", "恢复中", "recover", AMBER, "recovering — do not rebuild or replay stale voice", "恢复中——不重建、不重放过期语音", "tetrahedron"),
};

// ── E. interaction ──
d.interaction = {
  DEFAULT: s("DEFAULT", "默认", "none", NEUTRAL, "default state", "默认状态", "box"),
  FOCUSED: s("FOCUSED", "聚焦", "focus-ring", BLUE, "focused (hover/gaze) — highlight only, never selects or authorizes", "聚焦(悬停/注视)——仅高亮,不选择、不授权", "box"),
  SELECTED: s("SELECTED", "已选择", "selected", BLUE, "selected — moved to current focus", "已选择——进入当前焦点", "box"),
  CONFIRM_REQUIRED: s("CONFIRM REQUIRED", "需确认", "confirm", AMBER, "confirmation required (regulated/destructive)", "需确认(受监管/破坏性操作)", "diamond"),
  DISABLED: s("DISABLED", "禁用", "disabled", NEUTRAL, "disabled/inactive", "禁用/未激活", "box"),
};

// ── F. capability / readiness ladder (device flags stay false until hardware) ──
d.capability = {
  AUTHORED: s("AUTHORED", "已编写", "code", NEUTRAL, "source authored — not compiled", "源代码已编写——未编译", "box"),
  COMPILED: s("COMPILED", "已编译", "gear", NEUTRAL, "compiles — not built to an artifact", "可编译——未构建产物", "box"),
  BUILT: s("BUILT", "已构建", "package", BLUE, "artifact built — not installed on a device", "产物已构建——未安装到设备", "box"),
  INSTALLED: s("INSTALLED", "已安装", "download", AMBER, "installed on a device — not device-validated", "已安装到设备——未真机验证", "box"),
  DEVICE_VALIDATED: s("DEVICE VALIDATED", "真机已验证", "device-check", GREEN, "validated on the physical device (only true with hardware evidence)", "已在真机验证(仅在有硬件证据时为真)", "box"),
  PRODUCTION_READY: s("PRODUCTION READY", "可生产", "shield-check", GREEN, "production-ready (independent audit + device validation required)", "可生产(需独立审计 + 真机验证)", "box"),
};

// Preserve the existing content + order (consumers mirror it by hand); only bump the version and append the
// new categories. Deterministic: stable insertion order, fixed indent, trailing newline, no timestamps.
d.version = "shadow-spatial-tokens/2";
writeFileSync(FILE, JSON.stringify(d, null, 1) + "\n");
console.log("extended", FILE, "→", d.version, "; top-level categories:", Object.keys(d).length,
  "; status keys:", Object.keys(d.status).length);
