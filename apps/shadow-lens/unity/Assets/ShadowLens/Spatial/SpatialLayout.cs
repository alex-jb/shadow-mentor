// apps/shadow-lens/unity/Assets/ShadowLens/Spatial/SpatialLayout.cs
// PURE spatial geometry for the Shadow Lens XR UX — no UnityEngine dependency, so it runs
// in the Unity Test Runner (EditMode) AND plain .NET. The MonoBehaviours are thin wrappers
// that feed these results into Transforms; all the math that could be WRONG lives here and
// is unit-tested. This is what lets the spatial UX be "real + tested" without a headset.
//
// SOFTWARE IMPLEMENTED · covered by SpatialLayoutTests (EditMode). The MonoBehaviour wiring
// on top is LOCAL UNITY COMPILE NOT EXECUTED (no Unity on the build host) and stays
// DEVICE-VALIDATION-PENDING until it runs on XREAL One Pro + Eye.
using System;
using System.Collections.Generic;

namespace ShadowLens.Spatial
{
    // UnityEngine-free 3-vector so this file is testable anywhere. Meters.
    public readonly struct V3
    {
        public readonly float x, y, z;
        public V3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
        public static V3 operator +(V3 a, V3 b) => new V3(a.x + b.x, a.y + b.y, a.z + b.z);
        public float Length => (float)Math.Sqrt(x * x + y * y + z * z);
    }

    public readonly struct NormalizedBox
    {
        public readonly float x, y, w, h; // top-left origin, 0..1
        public NormalizedBox(float x, float y, float w, float h) { this.x = x; this.y = y; this.w = w; this.h = h; }
        public float CenterX => x + w / 2f;
        public float CenterY => y + h / 2f;
    }

    public static class SpatialLayout
    {
        // ── source overlay: map a normalized OCR box on a document plane to a WORLD point ──
        // The document plane is a rectangle of (planeWidth × planeHeight) meters, centered at
        // `origin`, lying in the plane's local X (right) / Y (up). Normalized y is top-down,
        // so we flip it. The overlay sits slightly proud of the page (zLift) to avoid z-fight.
        public static V3 SourceOverlayWorld(NormalizedBox box, V3 origin, float planeWidth, float planeHeight, float zLift = 0.005f)
        {
            float localX = (box.CenterX - 0.5f) * planeWidth;   // -W/2 .. +W/2
            float localY = (0.5f - box.CenterY) * planeHeight;  // flip: normalized-top → world-up
            return origin + new V3(localX, localY, zLift);
        }

        // ── audit arc: distribute N hash-chain events along an arc in front of the viewer ──
        // Events fan left→right across `spanDeg`, at `radius` meters, centered on `centerYaw`.
        // Returns world offsets from the arc center (viewer-relative). One event → straight ahead.
        public static V3[] AuditArc(int count, float radius, float spanDeg = 120f, float centerYawDeg = 0f, float height = 0f)
        {
            if (count <= 0) return Array.Empty<V3>();
            var pts = new V3[count];
            float start = centerYawDeg - spanDeg / 2f;
            float step = count == 1 ? 0f : spanDeg / (count - 1);
            float first = count == 1 ? centerYawDeg : start;
            for (int i = 0; i < count; i++)
            {
                float yaw = (first + step * i) * (float)Math.PI / 180f;
                pts[i] = new V3((float)Math.Sin(yaw) * radius, height, -(float)Math.Cos(yaw) * radius); // -Z = forward
            }
            return pts;
        }

        // ── glance strip: a row of status chips pinned to the bottom of the field of view ──
        public static V3[] GlanceStrip(int count, float spacing, V3 rowOrigin)
        {
            if (count <= 0) return Array.Empty<V3>();
            var pts = new V3[count];
            float totalW = spacing * (count - 1);
            float x0 = -totalW / 2f;
            for (int i = 0; i < count; i++) pts[i] = rowOrigin + new V3(x0 + spacing * i, 0f, 0f);
            return pts;
        }

        // ── verification cascade: stagger the chain links vertically so integrity reads top→down ──
        // Returns a per-link reveal delay (seconds) plus its y offset, so a broken link can be
        // frozen at its seq. Deterministic (no animation RNG).
        public static (float delaySec, float y)[] VerificationCascade(int links, float perLinkDelay = 0.08f, float linkGap = 0.06f)
        {
            if (links <= 0) return Array.Empty<(float, float)>();
            var outp = new (float, float)[links];
            for (int i = 0; i < links; i++) outp[i] = (perLinkDelay * i, -linkGap * i);
            return outp;
        }

        // ── risk landscape: map severities (0..1) to bar heights, clamped, with a floor so
        // zero-risk still shows a base tile (never an invisible "all clear" that reads as absent).
        public static float[] RiskHeights(IReadOnlyList<float> severities, float maxHeight = 0.4f, float floor = 0.02f)
        {
            if (severities == null || severities.Count == 0) return Array.Empty<float>();
            var outp = new float[severities.Count];
            for (int i = 0; i < severities.Count; i++)
            {
                float s = severities[i]; if (s < 0f) s = 0f; if (s > 1f) s = 1f;
                outp[i] = floor + s * (maxHeight - floor);
            }
            return outp;
        }
    }
}
