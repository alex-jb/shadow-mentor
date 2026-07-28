// apps/shadow-lens/unity/Assets/ShadowLens/Design/ShadowTrustCapsule.cs
// Unity model for the Shadow Trust Capsule. Mirrors the tested JS model (lib/trust-capsule.js +
// test/trust-capsule.test.js) — that JS test is the source of truth for the honest-distinction
// contract. This is the semantic DATA model only (a renderer maps it to meshes/labels); it carries
// NO hardcoded status table — every dimension resolves through the GENERATED semantic token table
// (ShadowLens.Generated.ShadowSemanticTokens). Plain C# (no UnityEngine dependency) so it stays
// portable + compile-light. AUTHORED — not compiled in this environment; Unity EditMode not claimed
// passing by this increment.
#if UNITY_2020_1_OR_NEWER
using ShadowLens.Generated;

namespace ShadowLens.Design
{
    public struct TrustDimension
    {
        public string Key, Label, LabelZh, Status, Text, TextZh, Icon, Shape, ColorHex, A11y, A11yZh;
    }

    // The eight independent trust dimensions. Integrity VERIFIED must never imply correctness,
    // approval, or external anchoring — each dimension carries its OWN generated token.
    public static class ShadowTrustCapsule
    {
        static TrustDimension Dim(string key, string label, string labelZh, string category, string statusKey, string status)
        {
            var t = ShadowSemanticTokens.Get(category, statusKey);
            return new TrustDimension {
                Key = key, Label = label, LabelZh = labelZh, Status = status,
                Text = t.Text, TextZh = t.TextZh, Icon = t.Icon, Shape = t.Shape, ColorHex = t.ColorHex,
                A11y = t.A11y, A11yZh = t.A11yZh,
            };
        }

        // status value → (category, key) in the generated table
        static (string, string) Map(string status)
        {
            switch (status)
            {
                case "VERIFIED": return ("status", "VERIFIED");
                case "FAILED": return ("status", "FAILED");
                case "FIRST_FAILURE": return ("status", "FIRST_FAILURE");
                case "AFFECTED_DOWNSTREAM": return ("status", "DOWNSTREAM_AFFECTED");
                case "WARNING": return ("status", "WARNING");
                case "NOT_EVALUATED": return ("status", "NOT_EVALUATED");
                case "NOT_PRESENT": return ("status", "NOT_PRESENT");
                case "PRESENT": return ("status", "VERIFIED");
                case "REQUIRES_HUMAN_REVIEW": return ("governance", "REQUIRES_HUMAN_REVIEW");
                case "HUMAN_REVIEW_RECORDED": return ("governance", "HUMAN_REVIEW_RECORDED");
                case "APPROVAL_NOT_PRESENT": return ("governance", "APPROVAL_NOT_PRESENT");
                case "APPROVAL_PRESENT": return ("governance", "APPROVAL_PRESENT");
                case "ABSTAINED": return ("governance", "ABSTAINED");
                case "SELF_SIGNED": return ("trust_posture", "SELF_SIGNED");
                case "TIME_ANCHORED_STRUCTURAL": return ("trust_posture", "TIME_ANCHORED_STRUCTURAL");
                case "TIME_ANCHORED": return ("trust_posture", "TIME_ANCHORED");
                default: return ("status", "NOT_EVALUATED"); // fail closed to NOT_EVALUATED, never VERIFIED
            }
        }

        static TrustDimension Resolve(string key, string label, string labelZh, string status)
        {
            var (cat, k) = Map(status);
            return Dim(key, label, labelZh, cat, k, status);
        }

        // Honest conservative defaults: correctness NOT_EVALUATED, approval APPROVAL_NOT_PRESENT,
        // posture SELF_SIGNED, external anchor NOT_EVALUATED.
        public static TrustDimension[] Build(
            string integrity = "VERIFIED",
            string sourceResolution = "PRESENT",
            string analyticalCorrectness = "NOT_EVALUATED",
            string humanReview = "HUMAN_REVIEW_RECORDED",
            string approval = "APPROVAL_NOT_PRESENT",
            string trustPosture = "SELF_SIGNED",
            string externalAnchor = "NOT_EVALUATED")
        {
            return new TrustDimension[]
            {
                Resolve("evidence_integrity", "Evidence integrity", "证据完整性", integrity),
                Resolve("source_links", "Source links", "来源链接", sourceResolution),
                Resolve("analytical_correctness", "Analytical correctness", "分析正确性", analyticalCorrectness),
                Resolve("human_review", "Human review", "人工审核", humanReview),
                Resolve("human_approval", "Human approval", "人工审批", approval),
                Resolve("trust_posture", "Trust posture", "信任姿态", trustPosture),
                Resolve("external_anchoring", "External anchoring", "外部锚定", externalAnchor),
                // open verifier is an ACTION, not a status — blue pill, resolves to the offline verifier
                new TrustDimension { Key = "open_verifier", Label = "Open independent verifier", LabelZh = "开放独立验证器",
                    Status = "ACTION", Text = "OPEN VERIFIER", TextZh = "打开验证器", Icon = "external-link", Shape = "pill",
                    ColorHex = "#3b82f6", A11y = "open the offline independent verifier", A11yZh = "打开离线独立验证器" },
            };
        }

        // Collapsed line reflects integrity only.
        public static string CollapsedLabel(string integrity = "VERIFIED")
        {
            var t = ShadowSemanticTokens.Get("status", integrity == "VERIFIED" ? "VERIFIED" : "NOT_EVALUATED");
            return "SHADOW · INTEGRITY " + t.Text;
        }
    }
}
#endif
