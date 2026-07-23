// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowStatusGlyph.cs
// Maps a canonical status to (a) its GENERATED semantic token (text/icon/shape/colour/a11y, EN+ZH)
// and (b) a procedural glyph name a renderer builds geometry for. NO hardcoded status table lives
// here — identity comes from ShadowLens.Generated.ShadowSemanticTokens. Unknown status/glyph fails
// CLOSED to "UNKNOWN STATUS", never to VERIFIED. Pure C# (no UnityEngine) → EditMode-testable.
#if UNITY_2020_1_OR_NEWER
using ShadowLens.Generated;

namespace ShadowLens.Workspace
{
    public struct ShadowGlyph
    {
        public string Status, Text, TextZh, Icon, Shape, ColorHex, A11y, A11yZh, ProceduralGlyph;
        public bool Known;
    }

    public static class ShadowStatusGlyph
    {
        // canonical status → (category, key) in the generated table
        static bool Map(string status, out string cat, out string key)
        {
            cat = "status"; key = null;
            switch (status)
            {
                case "VERIFIED": key = "VERIFIED"; break;
                case "FAILED": key = "FAILED"; break;
                case "WARNING": key = "WARNING"; break;
                case "NOT_EVALUATED": key = "NOT_EVALUATED"; break;
                case "NOT_CHECKED": key = "NOT_CHECKED"; break;
                case "NOT_PRESENT": key = "NOT_PRESENT"; break;
                case "UNSUPPORTED": key = "UNSUPPORTED"; break;
                case "FIRST_FAILURE": key = "FIRST_FAILURE"; break;
                case "AFFECTED_DOWNSTREAM": case "DOWNSTREAM_AFFECTED": key = "DOWNSTREAM_AFFECTED"; break;
                case "REQUIRES_HUMAN_REVIEW": cat = "governance"; key = "REQUIRES_HUMAN_REVIEW"; break;
                case "HUMAN_REVIEW_RECORDED": cat = "governance"; key = "HUMAN_REVIEW_RECORDED"; break;
                case "APPROVAL_NOT_PRESENT": cat = "governance"; key = "APPROVAL_NOT_PRESENT"; break;
                case "APPROVAL_PRESENT": cat = "governance"; key = "APPROVAL_PRESENT"; break;
                case "ABSTAINED": cat = "governance"; key = "ABSTAINED"; break;
                case "SELF_SIGNED": cat = "trust_posture"; key = "SELF_SIGNED"; break;
                case "TIME_ANCHORED_STRUCTURAL": cat = "trust_posture"; key = "TIME_ANCHORED_STRUCTURAL"; break;
                case "TIME_ANCHORED": cat = "trust_posture"; key = "TIME_ANCHORED"; break;
                default: return false;
            }
            return true;
        }

        // icon name → coarse procedural shape the renderer builds (a renderer responsibility; the
        // semantic identity still comes from the generated token). Unknown → "unknown".
        static string Procedural(string icon)
        {
            switch (icon)
            {
                case "shield-check": case "check": return "shield_ring";
                case "cross": return "cross";
                case "warning": return "wedge";
                case "dash": return "hollow_ring";
                case "broken-seal-first": return "broken_seal_first";
                case "chain-arrow-dashed": return "chain_arrow_dashed";
                case "human-diamond": return "diamond";
                case "review-doc": return "document";
                case "stamp-empty": return "stamp_outline";
                case "stamp-signed": return "stamp_signed";
                case "pause": return "pause";
                case "key": return "key";
                case "clock-outline": return "clock_outline";
                case "anchor-check": return "anchor_verified";
                default: return "box";
            }
        }

        public static ShadowGlyph Resolve(string status)
        {
            if (!Map(status, out var cat, out var key))
            {
                // FAIL CLOSED — never VERIFIED
                return new ShadowGlyph {
                    Status = status, Text = "UNKNOWN STATUS", TextZh = "未知状态", Icon = "question",
                    Shape = "box", ColorHex = "#8a92a0", A11y = "unknown status — fails closed, not verified",
                    A11yZh = "未知状态——安全失败,非已验证", ProceduralGlyph = "unknown", Known = false,
                };
            }
            var t = ShadowSemanticTokens.Get(cat, key);
            return new ShadowGlyph {
                Status = status, Text = t.Text, TextZh = t.TextZh, Icon = t.Icon, Shape = t.Shape,
                ColorHex = t.ColorHex, A11y = t.A11y, A11yZh = t.A11yZh,
                ProceduralGlyph = Procedural(t.Icon), Known = true,
            };
        }
    }
}
#endif
