// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowSessionStateInfo.cs
// Bilingual, honest description of every runtime session state: a short label, an explanation, what
// the user CAN and CANNOT do, and the recovery action. This is the single copy source for the
// capability banner + diagnostics, so no surface can describe a state differently or overclaim.
// Pure C#. SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.Device
{
    public sealed class ShadowStateInfo
    {
        public string LabelEn, LabelZh, ExplainEn, ExplainZh, RecoveryEn, RecoveryZh;
        public string[] AvailableEn, UnavailableEn;
        public string Label(bool zh) => zh ? LabelZh : LabelEn;
        public string Explain(bool zh) => zh ? ExplainZh : ExplainEn;
        public string Recovery(bool zh) => zh ? RecoveryZh : RecoveryEn;
    }

    public static class ShadowSessionStateInfo
    {
        static readonly Dictionary<ShadowSessionState, ShadowStateInfo> Map = new Dictionary<ShadowSessionState, ShadowStateInfo>
        {
            { ShadowSessionState.DesktopMock, new ShadowStateInfo {
                LabelEn = "DESKTOP MOCK", LabelZh = "桌面模拟",
                ExplainEn = "Running on desktop with mouse/keyboard. No device tracking is claimed.",
                ExplainZh = "在桌面用鼠标/键盘运行。不声称任何设备追踪。",
                AvailableEn = new[] { "mouse", "keyboard", "XR simulator", "guided stories", "2D audit" },
                UnavailableEn = new[] { "head tracking", "6DoF", "RGB camera", "controller" },
                RecoveryEn = "None needed — this is the baseline.", RecoveryZh = "无需恢复——这是基线。" } },
            { ShadowSessionState.AndroidMock, new ShadowStateInfo {
                LabelEn = "ANDROID MOCK", LabelZh = "安卓模拟",
                ExplainEn = "Running on Android touch. Guided stories and Verify/Tamper/Reset work. No XREAL tracking is claimed.",
                ExplainZh = "在安卓触屏运行。引导故事与验证/篡改/重置可用。不声称 XREAL 追踪。",
                AvailableEn = new[] { "touch", "guided stories", "Verify/Tamper/Reset", "2D audit" },
                UnavailableEn = new[] { "head tracking", "6DoF", "controller", "camera path" },
                RecoveryEn = "None needed — touch fallback.", RecoveryZh = "无需恢复——触屏回退。" } },
            { ShadowSessionState.Xreal3DofSession, new ShadowStateInfo {
                LabelEn = "XREAL 3DOF SESSION", LabelZh = "XREAL 3DoF 会话",
                ExplainEn = "Head rotation in a session-relative fixed workspace. 3DoF controller. No positional movement or anchors.",
                ExplainZh = "在会话相对的固定工作区内进行头部旋转。3DoF 控制器。无位置移动或锚点。",
                AvailableEn = new[] { "head rotation", "3DoF controller", "Recenter", "guided stories" },
                UnavailableEn = new[] { "positional movement (6DoF)", "spatial anchors", "plane/image/hand tracking", "depth mesh" },
                RecoveryEn = "Use Recenter to reset the workspace in front of you.", RecoveryZh = "用 Recenter 把工作区重置到面前。" } },
            { ShadowSessionState.XrealEye6DofSession, new ShadowStateInfo {
                LabelEn = "XREAL EYE 6DOF SESSION", LabelZh = "XREAL Eye 6DoF 会话",
                ExplainEn = "Positional + rotational tracking with the Eye add-on, in a session-relative workspace. RGB camera only when detected.",
                ExplainZh = "配合 Eye 附件的位置 + 旋转追踪,处于会话相对工作区。RGB 相机仅在检测到时可用。",
                AvailableEn = new[] { "6DoF head", "session workspace", "Recenter", "camera path (when frame valid)" },
                UnavailableEn = new[] { "spatial anchors", "plane/image/hand tracking", "depth mesh" },
                RecoveryEn = "If tracking drifts, Recenter; if it is lost, follow the tracking-lost recovery.", RecoveryZh = "若追踪漂移,Recenter;若丢失,按追踪丢失恢复流程。" } },
            { ShadowSessionState.TrackingLimited, new ShadowStateInfo {
                LabelEn = "TRACKING LIMITED", LabelZh = "追踪受限",
                ExplainEn = "Tracking quality is degraded (low light or fast motion). The workspace may drift.",
                ExplainZh = "追踪质量下降(弱光或快速移动)。工作区可能漂移。",
                AvailableEn = new[] { "head rotation (approx.)", "Recenter", "2D audit fallback" },
                UnavailableEn = new[] { "reliable positional tracking", "camera capture" },
                RecoveryEn = "Improve lighting, slow down, then Recenter; or drop to 2D audit.", RecoveryZh = "改善光照、放慢动作,然后 Recenter;或切到 2D 审计。" } },
            { ShadowSessionState.TrackingLost, new ShadowStateInfo {
                LabelEn = "TRACKING LOST", LabelZh = "追踪丢失",
                ExplainEn = "Tracking is not available. The guided-story state is preserved and shown flat.",
                ExplainZh = "追踪不可用。引导故事状态被保留并以平面显示。",
                AvailableEn = new[] { "2D audit fallback", "Reset", "Recenter (retry)" },
                UnavailableEn = new[] { "spatial view", "controller ray", "camera" },
                RecoveryEn = "Recenter to retry; if it does not recover, use the 2D audit fallback.", RecoveryZh = "Recenter 重试;若无法恢复,使用 2D 审计回退。" } },
            { ShadowSessionState.CameraUnavailable, new ShadowStateInfo {
                LabelEn = "CAMERA UNAVAILABLE", LabelZh = "相机不可用",
                ExplainEn = "The RGB camera path is present but no valid (non-black) frame was produced. No capture is claimed.",
                ExplainZh = "RGB 相机通路存在但未产生有效(非全黑)帧。不声称任何采集。",
                AvailableEn = new[] { "guided stories", "2D audit", "Recenter" },
                UnavailableEn = new[] { "frame capture", "OCR from camera" },
                RecoveryEn = "Check camera permission and lighting; capture stays disabled until a valid frame.", RecoveryZh = "检查相机权限与光照;在获得有效帧前采集保持禁用。" } },
            { ShadowSessionState.DeviceValidationPending, new ShadowStateInfo {
                LabelEn = "DEVICE VALIDATION PENDING", LabelZh = "设备验证待完成",
                ExplainEn = "Running toward a device path, but no on-device validation evidence exists yet. Positions and legibility are hypotheses.",
                ExplainZh = "正朝设备路径运行,但尚无设备验证证据。位置与可读性仍为假设。",
                AvailableEn = new[] { "guided stories", "Recenter", "2D audit" },
                UnavailableEn = new[] { "any validated-on-device claim" },
                RecoveryEn = "Run the device acceptance checklist on hardware to move past this state.", RecoveryZh = "在硬件上跑设备验收清单以脱离该状态。" } },
        };

        public static ShadowStateInfo Get(ShadowSessionState s) => Map.TryGetValue(s, out var v) ? v : Map[ShadowSessionState.DesktopMock];
    }
}
