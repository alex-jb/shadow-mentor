// apps/shadow-lens/unity/Assets/ShadowLens/Spatial/ShadowPerfBaseline.cs
// Non-device performance evidence for the guided stage. Records init/transition durations,
// editor/android FPS where measurable, draw calls, canvas rebuilds, GC allocation on
// transition, and the StageWorld/HUD/EventSystem object counts.
//
// EVERY value produced here is labeled NOT_BEAM_PRO_DEVICE_EVIDENCE. Mac editor numbers are
// for catching gross regressions early — they are NOT Beam Pro performance and must never be
// presented as such.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;
using UnityEngine.EventSystems;

namespace ShadowLens.Spatial
{
    public struct ShadowPerfSample
    {
        public const string Provenance = "NOT_BEAM_PRO_DEVICE_EVIDENCE";
        public float initMs;
        public float transitionMs;
        public float avgFps;            // editor/android where measurable
        public int drawCalls;           // SetPass/batches where measurable
        public int canvasRebuilds;      // UI canvas rebuilds per transition
        public int stageWorldCount;
        public int hudCanvasCount;
        public int eventSystemCount;
        public long gcAllocOnTransition; // bytes (Profiler where available)

        public override string ToString() =>
            $"[{Provenance}] init={initMs:0.0}ms transition={transitionMs:0.0}ms fps={avgFps:0.0} " +
            $"drawCalls={drawCalls} canvasRebuilds={canvasRebuilds} " +
            $"stageWorld={stageWorldCount} hud={hudCanvasCount} eventSystems={eventSystemCount} gcAlloc={gcAllocOnTransition}B";
    }

    public static class ShadowPerfBaseline
    {
        // Count the invariants the perf/regression check cares about. Pure counting — safe to
        // call from an EditMode/PlayMode test.
        public static ShadowPerfSample Snapshot(float initMs, float transitionMs, float avgFps, long gcAlloc = 0, int drawCalls = 0, int canvasRebuilds = 0)
        {
            return new ShadowPerfSample
            {
                initMs = initMs,
                transitionMs = transitionMs,
                avgFps = avgFps,
                drawCalls = drawCalls,
                canvasRebuilds = canvasRebuilds,
                gcAllocOnTransition = gcAlloc,
                stageWorldCount = CountByName("StageWorld"),
                hudCanvasCount = CountByName("ShadowStageHUD"),
                eventSystemCount = Object.FindObjectsByType<EventSystem>(FindObjectsSortMode.None).Length,
            };
        }

        static int CountByName(string name)
        {
            int n = 0;
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None)) if (go.name == name) n++;
            return n;
        }
    }
}
#endif
