// AUTO-GENERATED — DO NOT EDIT.
// Source: design/shadow-spatial-tokens.json (shadow-spatial-tokens/2)
// Generator: scripts/generate-tokens.mjs — run it to regenerate. Deterministic; no timestamp/path.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.Generated
{
    // Semantic identity table generated from the canonical token source. VISUAL PROFILE overrides
    // (ShadowDesignTokens.Resolve) may re-shade a state, but text/icon/shape/meaning are fixed here.
    public static class ShadowSemanticTokens
    {
        public struct Token { public string Category, Key, Text, TextZh, Icon, Shape, ColorHex, A11y, A11yZh; }
        public static readonly Token[] All = new Token[]
        {
            new Token { Category="status", Key="DOWNSTREAM_AFFECTED", Text="AFFECTED DOWNSTREAM", TextZh="受影响的后续", Icon="chain-arrow-dashed", Shape="box", ColorHex="#8a92a0", A11y="affected by an upstream failure — NOT an independent first failure", A11yZh="受上游失败影响——非独立首个失败" },
            new Token { Category="status", Key="FAILED", Text="FAILED", TextZh="验证失败", Icon="cross", Shape="octahedron", ColorHex="#ef4444", A11y="verification failed at this record", A11yZh="此记录验证失败" },
            new Token { Category="status", Key="FIRST_FAILURE", Text="FIRST FAILURE", TextZh="首个失败", Icon="broken-seal-first", Shape="octahedron", ColorHex="#ef4444", A11y="the FIRST point where verification fails", A11yZh="验证首次失败的点" },
            new Token { Category="status", Key="NOT_CHECKED", Text="NOT CHECKED", TextZh="未检查", Icon="question", Shape="box", ColorHex="#fbbf24", A11y="not checked in this pass", A11yZh="本次未检查" },
            new Token { Category="status", Key="NOT_EVALUATED", Text="NOT EVALUATED", TextZh="未评估", Icon="dash", Shape="ring", ColorHex="#8a92a0", A11y="not evaluated — distinct from failed", A11yZh="未评估——不等于失败" },
            new Token { Category="status", Key="NOT_PRESENT", Text="NOT PRESENT", TextZh="不存在", Icon="empty", Shape="ring", ColorHex="#8a92a0", A11y="not present in the bundle", A11yZh="证据包中不存在" },
            new Token { Category="status", Key="NOT_VERIFIED", Text="NOT VERIFIED", TextZh="未验证", Icon="dash", Shape="box", ColorHex="#8a92a0", A11y="not verified — downstream of a tamper; frozen", A11yZh="未验证——位于篡改点的下游;已冻结" },
            new Token { Category="status", Key="TAMPERED", Text="TAMPERED", TextZh="已篡改", Icon="alert", Shape="octahedron", ColorHex="#ef4444", A11y="tampered — the mutated node; verification fails here", A11yZh="已篡改——被改动的节点;验证在此失败" },
            new Token { Category="status", Key="UNSUPPORTED", Text="UNSUPPORTED", TextZh="不支持", Icon="block", Shape="box", ColorHex="#fbbf24", A11y="unsupported by this verifier", A11yZh="本验证器不支持" },
            new Token { Category="status", Key="VERIFIED", Text="VERIFIED", TextZh="已验证", Icon="check", Shape="icosahedron", ColorHex="#4ade80", A11y="verified — record matches the sealed evidence", A11yZh="已验证——该记录与封存证据一致;不代表决策正确" },
            new Token { Category="status", Key="WARNING", Text="WARNING", TextZh="警告", Icon="warning", Shape="tetrahedron", ColorHex="#fbbf24", A11y="a caution/quality flag — not a chain break", A11yZh="警示/质量标记——非链断裂" },
            new Token { Category="governance", Key="ABSTAINED", Text="ABSTAINED", TextZh="弃权", Icon="pause", Shape="ring", ColorHex="#8a92a0", A11y="abstained from a stance", A11yZh="对该立场弃权" },
            new Token { Category="governance", Key="APPROVAL_NOT_PRESENT", Text="APPROVAL ABSENT", TextZh="无审批", Icon="stamp-empty", Shape="ring", ColorHex="#8a92a0", A11y="no human approval is present", A11yZh="无人工审批" },
            new Token { Category="governance", Key="APPROVAL_PRESENT", Text="APPROVAL PRESENT", TextZh="已审批", Icon="stamp-signed", Shape="pill", ColorHex="#3b82f6", A11y="explicit human approval (brand/stamp, NEVER verification green)", A11yZh="已获人工审批(品牌/印章色,绝不用验证绿)" },
            new Token { Category="governance", Key="HUMAN_REVIEW_RECORDED", Text="REVIEW RECORDED", TextZh="已记录审核", Icon="review-doc", Shape="box", ColorHex="#6b7280", A11y="a human review was recorded — NOT the same as approval", A11yZh="已记录人工审核——不等于审批" },
            new Token { Category="governance", Key="REQUIRES_HUMAN_REVIEW", Text="REQUIRES REVIEW", TextZh="需人工审核", Icon="human-diamond", Shape="diamond", ColorHex="#3b82f6", A11y="human review required (action)", A11yZh="需要人工审核(待处理)" },
            new Token { Category="trust_posture", Key="SELF_SIGNED", Text="SELF-SIGNED", TextZh="自签名", Icon="key", Shape="box", ColorHex="#fbbf24", A11y="verifies against the supplied key; an operator holding it could re-sign altered history without an external anchor", A11yZh="对提供的密钥可验证;持钥运营者在无外部锚定时理论上可重签改动的历史" },
            new Token { Category="trust_posture", Key="TIME_ANCHORED", Text="TIME-ANCHORED", TextZh="时间锚定", Icon="anchor-check", Shape="box", ColorHex="#4ade80", A11y="verified external time anchor (e.g. RFC 3161 / Rekor)", A11yZh="已验证的外部时间锚定(如 RFC 3161 / Rekor)" },
            new Token { Category="trust_posture", Key="TIME_ANCHORED_STRUCTURAL", Text="TIME-ANCHORED (STRUCTURAL)", TextZh="结构化时间锚定", Icon="clock-outline", Shape="box", ColorHex="#3b82f6", A11y="structural timestamp present; not an external transparency anchor", A11yZh="存在结构化时间戳;非外部透明日志锚定" },
            new Token { Category="tracking", Key="INITIALIZING", Text="INITIALIZING", TextZh="初始化中", Icon="spinner", Shape="ring", ColorHex="#8a92a0", A11y="tracking initializing", A11yZh="追踪初始化中" },
            new Token { Category="tracking", Key="LIMITED", Text="TRACKING LIMITED", TextZh="追踪受限", Icon="warning", Shape="tetrahedron", ColorHex="#fbbf24", A11y="tracking limited — safe session-relative layout", A11yZh="追踪受限——安全的会话相对布局" },
            new Token { Category="tracking", Key="LOST", Text="TRACKING LOST", TextZh="追踪丢失", Icon="lost", Shape="octahedron", ColorHex="#ef4444", A11y="tracking lost — story/selection/audit preserved; Recenter + 2D audit available", A11yZh="追踪丢失——故事/选择/审计保留;Recenter 与 2D 审计可用" },
            new Token { Category="tracking", Key="RECOVERING", Text="RECOVERING", TextZh="恢复中", Icon="recover", Shape="tetrahedron", ColorHex="#fbbf24", A11y="recovering — do not rebuild or replay stale voice", A11yZh="恢复中——不重建、不重放过期语音" },
            new Token { Category="tracking", Key="SCANNING", Text="SCANNING FOR POSITION", TextZh="定位扫描中", Icon="scan", Shape="tetrahedron", ColorHex="#fbbf24", A11y="scanning — hold still and slowly look around; core 3DoF review remains available. NOT lost.", A11yZh="扫描中——请稳住并缓慢环视;核心 3DoF 审阅仍可用。非丢失。" },
            new Token { Category="tracking", Key="TRACKED_3DOF", Text="3DOF", TextZh="3DoF 追踪", Icon="3dof", Shape="icosahedron", ColorHex="#4ade80", A11y="3DoF tracking active (orientation)", A11yZh="3DoF 追踪(姿态)" },
            new Token { Category="tracking", Key="TRACKED_6DOF", Text="6DOF", TextZh="6DoF 追踪", Icon="6dof", Shape="icosahedron", ColorHex="#4ade80", A11y="6DoF tracking active (position)", A11yZh="6DoF 追踪(位置)" },
            new Token { Category="interaction", Key="CONFIRM_REQUIRED", Text="CONFIRM REQUIRED", TextZh="需确认", Icon="confirm", Shape="diamond", ColorHex="#fbbf24", A11y="confirmation required (regulated/destructive)", A11yZh="需确认(受监管/破坏性操作)" },
            new Token { Category="interaction", Key="DEFAULT", Text="DEFAULT", TextZh="默认", Icon="none", Shape="box", ColorHex="#8a92a0", A11y="default state", A11yZh="默认状态" },
            new Token { Category="interaction", Key="DISABLED", Text="DISABLED", TextZh="禁用", Icon="disabled", Shape="box", ColorHex="#8a92a0", A11y="disabled/inactive", A11yZh="禁用/未激活" },
            new Token { Category="interaction", Key="FOCUSED", Text="FOCUSED", TextZh="聚焦", Icon="focus-ring", Shape="box", ColorHex="#3b82f6", A11y="focused (hover/gaze) — highlight only, never selects or authorizes", A11yZh="聚焦(悬停/注视)——仅高亮,不选择、不授权" },
            new Token { Category="interaction", Key="SELECTED", Text="SELECTED", TextZh="已选择", Icon="selected", Shape="box", ColorHex="#3b82f6", A11y="selected — moved to current focus", A11yZh="已选择——进入当前焦点" },
            new Token { Category="capability", Key="AUTHORED", Text="AUTHORED", TextZh="已编写", Icon="code", Shape="box", ColorHex="#8a92a0", A11y="source authored — not compiled", A11yZh="源代码已编写——未编译" },
            new Token { Category="capability", Key="BUILT", Text="BUILT", TextZh="已构建", Icon="package", Shape="box", ColorHex="#3b82f6", A11y="artifact built — not installed on a device", A11yZh="产物已构建——未安装到设备" },
            new Token { Category="capability", Key="COMPILED", Text="COMPILED", TextZh="已编译", Icon="gear", Shape="box", ColorHex="#8a92a0", A11y="compiles — not built to an artifact", A11yZh="可编译——未构建产物" },
            new Token { Category="capability", Key="DEVICE_VALIDATED", Text="DEVICE VALIDATED", TextZh="真机已验证", Icon="device-check", Shape="box", ColorHex="#4ade80", A11y="validated on the physical device (only true with hardware evidence)", A11yZh="已在真机验证(仅在有硬件证据时为真)" },
            new Token { Category="capability", Key="INSTALLED", Text="INSTALLED", TextZh="已安装", Icon="download", Shape="box", ColorHex="#fbbf24", A11y="installed on a device — not device-validated", A11yZh="已安装到设备——未真机验证" },
            new Token { Category="capability", Key="PRODUCTION_READY", Text="PRODUCTION READY", TextZh="可生产", Icon="shield-check", Shape="box", ColorHex="#4ade80", A11y="production-ready (independent audit + device validation required)", A11yZh="可生产(需独立审计 + 真机验证)" },
        };
        public static Token Get(string category, string key)
        {
            foreach (var t in All) if (t.Category == category && t.Key == key) return t;
            throw new System.ArgumentException("unknown semantic token " + category + "." + key);
        }
    }
}
#endif
