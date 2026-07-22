// apps/shadow-lens/unity/Assets/ShadowLens/Integration/ShadowVoiceStablePhrases.cs
// Bilingual stable-phrase utterances for status/safety lines that don't depend on evidence content
// (Shadow ready, tracking lost/limited, camera unavailable, returning to banking, device validation
// pending, recenter complete). These are the high-frequency lines the runtime bridge speaks in
// response to device events. Every phrase goes through the same validated SpokenUtterance contract;
// none ever claims "device validated". Pure C#. SOURCE AUTHORED.
using ShadowLens.VoiceV2;

namespace ShadowLens.Integration
{
    public static class ShadowVoiceStablePhrases
    {
        static SpokenUtterance One(string id, string locale, string role, string profile, VoicePriority pri, string en, string zh, string semanticRole = "warning")
        {
            var u = new SpokenUtterance { UtteranceId = id, Locale = locale, Role = role, Intent = "STATUS", ProsodyProfile = profile, Priority = pri, FixtureLiveDeviceStatus = "DEVICE" };
            u.Segments.Add(new SpokenSegment { SegmentId = id + "-s", Text = locale == "zh-CN" ? zh : en, SemanticRole = semanticRole });
            ShadowVoiceContract.Validate(u);
            return u;
        }

        public static SpokenUtterance TrackingLost(string locale) =>
            One("tracking-lost", locale, "SAFETY", "VERIFICATION_FAILURE", VoicePriority.P0,
                "Tracking lost. The guided story is preserved and shown flat. Say recenter to retry.",
                "追踪丢失。引导故事已保留并以平面显示。说重新居中可以重试。");

        public static SpokenUtterance TrackingLimited(string locale) =>
            One("tracking-limited", locale, "SAFETY", "LIMITATION", VoicePriority.P1,
                "Tracking is limited. The workspace may drift. Improve lighting, then recenter.",
                "追踪受限。工作区可能漂移。改善光照,然后重新居中。");

        public static SpokenUtterance CameraUnavailable(string locale) =>
            One("camera-unavailable", locale, "SAFETY", "LIMITATION", VoicePriority.P1,
                "The camera path is present but no valid frame yet. No capture is claimed.",
                "相机通路存在但尚无有效帧。不声称任何采集。");

        public static SpokenUtterance ReturningToBanking(string locale) =>
            One("returning-to-banking", locale, "SYSTEM_NARRATOR", "SYSTEM_NEUTRAL", VoicePriority.P3,
                "Returning to Banking.", "返回银行。", "prompt");

        public static SpokenUtterance DeviceValidationPending(string locale) =>
            One("device-validation-pending", locale, "SYSTEM_NARRATOR", "LIMITATION", VoicePriority.P3,
                "Running toward a device path. No on-device validation yet.",
                "正朝设备路径运行。尚无设备验证。", "limitation");

        public static SpokenUtterance ShadowReady(string locale) =>
            One("shadow-ready", locale, "SYSTEM_NARRATOR", "SYSTEM_NEUTRAL", VoicePriority.P3,
                "Shadow ready.", "Shadow 就绪。", "prompt");

        public static SpokenUtterance RecenterComplete(string locale) =>
            One("recenter-complete", locale, "SYSTEM_NARRATOR", "SYSTEM_NEUTRAL", VoicePriority.P3,
                "Recenter complete.", "重新居中完成。", "prompt");
    }
}
