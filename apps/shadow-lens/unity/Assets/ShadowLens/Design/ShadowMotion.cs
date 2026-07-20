// apps/shadow-lens/unity/Assets/ShadowLens/Design/ShadowMotion.cs
// Restrained motion tokens. Panel mode transitions ~180–250 ms; source connector draw ~200 ms;
// audit nodes reveal sequentially. No continuous floating / spinning / excessive parallax.
// Respects a reduced-motion flag. Authored for Unity 6.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;

namespace ShadowLens.Design
{
    public static class ShadowMotion
    {
        public static bool ReducedMotion = false;

        public const float PanelTransition   = 0.22f;  // 220 ms
        public const float ConnectorDraw     = 0.20f;
        public const float AuditNodeStagger  = 0.08f;

        public static float Dur(float seconds) => ReducedMotion ? 0f : seconds;
        // ease-out cubic — calm, no overshoot
        public static float EaseOut(float t) { t = Mathf.Clamp01(t); float u = 1f - t; return 1f - u * u * u; }
    }
}
#endif
