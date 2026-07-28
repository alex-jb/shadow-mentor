// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowTrackingBanner.cs
// Tracking banner copy + degraded-tracking state preservation. SCANNING is a distinct, user-visible
// state (not LIMITED). When tracking degrades, the workspace switches to a safe session-relative
// layout WITHOUT resetting the story, selection, language, verification, or review/approval state,
// and keeps Recenter + Open 2D Audit reachable. Pure C# → EditMode-testable.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.Workspace
{
    public static class ShadowTrackingBanner
    {
        public static readonly string[] States =
            { "INITIALIZING", "SCANNING", "TRACKED_3DOF", "TRACKED_6DOF", "LIMITED", "LOST", "RECOVERING" };

        // exact required SCANNING copy
        public const string ScanningEn = "SCANNING FOR POSITION\nHold still and slowly look around.\nCore 3DoF review remains available.";
        public const string ScanningZh = "正在扫描空间位置\n请保持稳定并缓慢环视。\n核心 3DoF 审查仍可继续。";

        public static string Copy(string state, bool zh)
        {
            switch (state)
            {
                case "SCANNING": return zh ? ScanningZh : ScanningEn;
                case "LOST": return zh ? "追踪丢失——切换到会话相对布局;审计状态保留" : "TRACKING LOST — switched to session-relative layout; audit state preserved";
                case "LIMITED": return zh ? "追踪受限——安全布局" : "TRACKING LIMITED — safe layout";
                case "RECOVERING": return zh ? "恢复中——不重放过期语音" : "RECOVERING — no stale voice replay";
                case "TRACKED_6DOF": return zh ? "6DoF 追踪" : "6DOF TRACKED";
                case "TRACKED_3DOF": return zh ? "3DoF 追踪" : "3DOF TRACKED";
                case "INITIALIZING": return zh ? "初始化中" : "INITIALIZING";
                default: return zh ? "未知追踪状态" : "UNKNOWN TRACKING STATE";
            }
        }

        // SCANNING must be distinct from LIMITED (different copy, different meaning).
        public static bool ScanningIsDistinctFromLimited()
            => Copy("SCANNING", false) != Copy("LIMITED", false);

        // Degraded tracking → whether the workspace should use a safe session-relative layout while
        // keeping the full workspace + Recenter + Open 2D Audit. Story is never reset.
        public static bool IsDegraded(string state) => state == "LOST" || state == "LIMITED" || state == "RECOVERING";
        public static bool KeepsRecenter(string state) => true;
        public static bool KeepsOpen2DAudit(string state) => true;

        // Apply degraded tracking: preserve ALL semantic state, only change layout mode. Returns the
        // same state value-copy (nothing reset).
        public static ShadowWorkspaceState ApplyDegraded(ShadowWorkspaceState s, string newTracking)
        {
            s.Tracking = newTracking; // only the tracking field changes; story/selection/etc preserved
            return s;
        }
    }
}
#endif
