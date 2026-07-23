// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowWorkspaceLabels.cs
// ONE bounded workspace-local bilingual resource for UI labels that are NOT semantic-token entries
// (region titles, field labels, actions). Semantic STATUS values keep coming from the generated
// tokens (ShadowStatusGlyph gives Text/TextZh) — this file does not duplicate those. No runtime
// machine translation. Pure C# → EditMode-testable.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;

namespace ShadowLens.Workspace
{
    public static class ShadowWorkspaceLabels
    {
        // key → (en, zh). Keep keys stable; tests assert every key has a non-empty EN + Chinese value.
        static readonly Dictionary<string, (string en, string zh)> L = new Dictionary<string, (string, string)>
        {
            { "current_focus", ("Current Focus", "当前焦点") },
            { "source", ("SOURCE", "来源") },
            { "trust", ("TRUST", "信任") },
            { "integrity", ("Integrity", "完整性") },
            { "provenance", ("Provenance", "溯源") },
            { "decision_support", ("Decision Support", "决策支持") },
            { "human_policy", ("Human / Policy", "人工/政策") },
            { "verification", ("Verification", "验证") },
            { "analytical_correctness", ("Correctness", "分析正确性") },
            { "human_review", ("Human review", "人工审核") },
            { "approval", ("Approval", "审批") },
            { "trust_posture", ("Trust posture", "信任姿态") },
            { "first_failure", ("FIRST FAILURE", "首个失败") },
            { "first_short", ("FIRST", "首失") },
            { "downstream", ("Downstream affected", "受影响的后续") },
            { "dep_short", ("dep", "下游") },
            { "TRACKED_3DOF", ("3DoF tracked", "3DoF 追踪") },
            { "TRACKED_6DOF", ("6DoF tracked", "6DoF 追踪") },
            { "SCANNING", ("scanning", "扫描中") },
            { "LIMITED", ("limited", "受限") },
            { "LOST", ("lost", "丢失") },
            { "RECOVERING", ("recovering", "恢复中") },
            { "INITIALIZING", ("initializing", "初始化中") },
            { "open_2d_audit", ("OPEN 2D AUDIT", "打开 2D 审计") },
            { "prev", ("Prev", "上一步") },
            { "next", ("Next", "下一步") },
            { "reset", ("Reset", "重置") },
            { "recenter", ("Recenter", "重新居中") },
            { "role", ("role", "角色") },
            { "tracking", ("tracking", "追踪") },
            { "simulated", ("SIMULATED — NOT DEVICE VALIDATED", "模拟——未经真机验证") },
            { "loc", ("loc", "位置") },
            { "resolution", ("resolution", "解析") },
            { "ocr", ("OCR", "OCR") },
            { "location_not_available", ("LOCATION NOT AVAILABLE", "位置不可用") },
            { "source_not_present", ("SOURCE NOT PRESENT", "来源不存在") },
            { "route_for_review", ("ROUTE FOR HUMAN REVIEW", "转交人工审核") },
            { "await_approval", ("AWAIT HUMAN APPROVAL", "等待人工审批") },
            { "inspect_first_failure", ("inspect the first failure", "检查首个失败") },
            { "continue_review", ("CONTINUE REVIEW", "继续审阅") },
        };

        public static readonly string[] Keys = new List<string>(L.Keys).ToArray();

        public static string Get(string key, bool zh)
        {
            if (L.TryGetValue(key, out var v)) return zh ? v.zh : v.en;
            return key; // never throw in a renderer; unknown key renders its raw key (test catches gaps)
        }

        public static bool Has(string key) => L.ContainsKey(key);
    }
}
#endif
