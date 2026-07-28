// apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryStatus.cs
// The shared semantic vocabulary, mirrored on the Unity side. This MUST stay in lockstep with
// lib/shadow-semantic-vocabulary.mjs — the EditMode test cross-checks the status + dimension sets
// and the display mapping against the Node vocabulary so the two can never silently diverge.
// Status is carried by TEXT + SHAPE + colour token — never colour alone. Pure C# (no UnityEngine).
// SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.GuidedStory
{
    public static class ShadowGuidedStoryStatus
    {
        // 13 semantic statuses (identical set + order to SEMANTIC_STATUS_IDS on the Node side).
        public static readonly string[] Statuses =
        {
            "VERIFIED", "FAILED", "PRESENT", "NOT_PRESENT", "NOT_CHECKED",
            "NOT_EVALUATED", "WARNING", "UNSUPPORTED", "MALFORMED", "ABSTAINED",
            "REQUIRES_HUMAN_REVIEW", "AFFECTED_DOWNSTREAM", "FIRST_FAILURE",
        };

        // 15 trust dimensions (identical set + order to TRUST_DIMENSION_IDS on the Node side).
        public static readonly string[] TrustDimensions =
        {
            "RECORD_INTEGRITY", "DIGITAL_SIGNATURE", "HASH_CHAIN", "PROFILE",
            "SOURCE_RESOLUTION", "EXTERNAL_ANCHOR", "CLAIM_EVIDENCE_BINDING",
            "DICTIONARY_HASH", "DICTIONARY_VERSION", "PERSONA_OUTPUT_INTEGRITY",
            "SYNTHESIS_PROVENANCE", "ANALYTICAL_CORRECTNESS", "POLICY_ADEQUACY",
            "LEGAL_FAIRNESS_REVIEW", "HUMAN_APPROVAL",
        };

        static readonly HashSet<string> StatusSet = new HashSet<string>(Statuses);
        static readonly HashSet<string> DimensionSet = new HashSet<string>(TrustDimensions);

        public static bool IsStatus(string s) => s != null && StatusSet.Contains(s);
        public static bool IsTrustDimension(string d) => d != null && DimensionSet.Contains(d);

        public enum Severity { Pass, Fail, Warn, Neutral, Abstain, Info }

        // status → severity (mirrors the .mjs severity buckets).
        public static Severity SeverityOf(string status)
        {
            switch (status)
            {
                case "VERIFIED": return Severity.Pass;
                case "FAILED": case "MALFORMED": case "AFFECTED_DOWNSTREAM": case "FIRST_FAILURE": return Severity.Fail;
                case "WARNING": case "UNSUPPORTED": case "REQUIRES_HUMAN_REVIEW": return Severity.Warn;
                case "ABSTAINED": return Severity.Abstain;
                case "NOT_EVALUATED": return Severity.Info;
                default: return Severity.Neutral; // PRESENT / NOT_PRESENT / NOT_CHECKED
            }
        }

        // status → design-token colour KEY (resolved by ShadowMaterials at render time). Colour is a
        // redundant channel; callers must also show ShapeOf + the status text.
        public static string ColorKeyOf(string status)
        {
            switch (SeverityOf(status))
            {
                case Severity.Pass: return "verified";
                case Severity.Fail: return "tampered";
                case Severity.Warn: return "warning";
                case Severity.Abstain: return "information";
                default: return "neutral";
            }
        }

        // status → shape name (icosahedron / octahedron / box / ring / disc / pill / tetrahedron).
        // Mirrors SEMANTIC_STATUS[...].shape on the Node side.
        public static string ShapeOf(string status)
        {
            switch (status)
            {
                case "VERIFIED": return "icosahedron";
                case "FAILED": case "MALFORMED": case "FIRST_FAILURE": return "octahedron";
                case "WARNING": return "tetrahedron";
                case "PRESENT": return "disc";
                case "NOT_PRESENT": case "ABSTAINED": return "ring";
                case "REQUIRES_HUMAN_REVIEW": return "pill";
                default: return "box"; // NOT_CHECKED / NOT_EVALUATED / UNSUPPORTED / AFFECTED_DOWNSTREAM
            }
        }
    }
}
