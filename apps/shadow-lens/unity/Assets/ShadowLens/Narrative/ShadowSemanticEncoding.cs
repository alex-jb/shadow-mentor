// apps/shadow-lens/unity/Assets/ShadowLens/Narrative/ShadowSemanticEncoding.cs
// The EXACT 3D semantic encoding for the banking cognitive map (documented in UX_FLOW_SPEC.md).
// Every visual property maps to a meaning; the mappings are pure so they're EditMode-tested and can
// be cross-checked. Reuses the tested SpatialLayout.V3. SOURCE AUTHORED · compiled in Unity 6.
#if UNITY_2020_1_OR_NEWER
using System;
using ShadowLens.Spatial; // V3

namespace ShadowLens.Narrative
{
    public static class ShadowSemanticEncoding
    {
        // node size = importance/exposure (0..1) → radius in metres. Clamped, with a floor so a
        // low-importance node is still visible (never an invisible "absent" node).
        public static float NodeSize(float importance)
        {
            importance = Clamp01(importance);
            return 0.06f + importance * (0.18f - 0.06f);
        }

        // distance from center = relevance (0..1). Higher relevance ⇒ CLOSER (near..far metres).
        public static float DistanceFromCenter(float relevance)
        {
            relevance = Clamp01(relevance);
            return 1.2f - relevance * (1.2f - 0.55f); // relevance 1 → 0.55 m, relevance 0 → 1.2 m
        }

        // height/depth = risk severity (0..1) → y offset. Applied consistently to metric nodes only.
        public static float RiskHeight(float severity) => Clamp01(severity) * 0.4f;

        // edge semantics → a token the renderer maps to a design token color.
        // "cites"/"supported_by" → information ; "disagrees"/"contradicts" → tampered ; else neutral.
        public static string EdgeColorKey(string relationshipType)
        {
            switch ((relationshipType ?? "").ToLowerInvariant())
            {
                case "cites": case "supported_by": case "derived_from": return "information";
                case "disagrees": case "contradicts": return "tampered";
                default: return "neutral";
            }
        }

        // Place the i-th council voice on a ring around the center; distance encodes relevance.
        // Voices stay on ONE plane (y = centerY) — only metric nodes use height, so height stays a
        // consistent risk signal.
        public static V3 VoicePosition(int i, int count, float relevance, V3 center, float centerY)
        {
            if (count <= 0) count = 1;
            float ang = (2f * (float)Math.PI * i) / count - (float)Math.PI / 2f; // start at top
            float r = DistanceFromCenter(relevance);
            return new V3(center.x + (float)Math.Cos(ang) * r, centerY, center.z + (float)Math.Sin(ang) * r);
        }

        static float Clamp01(float v) { if (v < 0f) return 0f; if (v > 1f) return 1f; return v; }
    }
}
#endif
