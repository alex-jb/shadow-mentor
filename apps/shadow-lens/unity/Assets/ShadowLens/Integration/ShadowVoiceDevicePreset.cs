// apps/shadow-lens/unity/Assets/ShadowLens/Integration/ShadowVoiceDevicePreset.cs
// Per-locale, per-device voice presets. English and Chinese are tuned SEPARATELY (never one global
// rate/pitch). A preset's `Measured` flag + `Device` are false/"(pending)" until it is actually
// measured on that device — a preset is NEVER called "Beam Pro" (measured) until measured there.
// Pure C#. SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.Integration
{
    public sealed class ShadowVoiceDevicePreset
    {
        public string Name, Engine, Voice, Locale, Device, KnownLimitations, MeasuredDate;
        public float Rate = 1f, Pitch = 1f;
        public int ClausePauseAdjustMs, TransitionPauseAdjustMs;
        public bool Measured;   // true ONLY after real device measurement fills this preset
    }

    public static class ShadowVoiceDevicePresets
    {
        // Starting hypotheses (NOT measured). Android values are conservative defaults; Beam Pro presets
        // exist only as placeholders and stay Measured=false / Device="(pending)" until the device day.
        public static readonly ShadowVoiceDevicePreset AndroidEnUsV1 = new ShadowVoiceDevicePreset {
            Name = "ANDROID_EN_US_V1", Engine = "(runtime-detected)", Voice = "(runtime-detected)", Locale = "en-US",
            Rate = 0.98f, Pitch = 1.0f, ClausePauseAdjustMs = 0, TransitionPauseAdjustMs = 0,
            Device = "(any Android)", Measured = false, MeasuredDate = "(pending)", KnownLimitations = "hypothesis; engine/voice vary per device" };

        public static readonly ShadowVoiceDevicePreset AndroidZhCnV1 = new ShadowVoiceDevicePreset {
            Name = "ANDROID_ZH_CN_V1", Engine = "(runtime-detected)", Voice = "(runtime-detected)", Locale = "zh-CN",
            Rate = 0.96f, Pitch = 1.0f, ClausePauseAdjustMs = 20, TransitionPauseAdjustMs = 20,
            Device = "(any Android)", Measured = false, MeasuredDate = "(pending)", KnownLimitations = "hypothesis; English IDs inside Chinese need char-by-char reading; do NOT pause between every character" };

        public static readonly ShadowVoiceDevicePreset BeamProEnUsV1 = new ShadowVoiceDevicePreset {
            Name = "BEAM_PRO_EN_US_V1", Engine = "(pending)", Voice = "(pending)", Locale = "en-US",
            Rate = 0.98f, Pitch = 1.0f, Device = "(pending)", Measured = false, MeasuredDate = "(pending)",
            KnownLimitations = "NOT measured on Beam Pro; do not treat as validated" };

        public static readonly ShadowVoiceDevicePreset BeamProZhCnV1 = new ShadowVoiceDevicePreset {
            Name = "BEAM_PRO_ZH_CN_V1", Engine = "(pending)", Voice = "(pending)", Locale = "zh-CN",
            Rate = 0.96f, Pitch = 1.0f, Device = "(pending)", Measured = false, MeasuredDate = "(pending)",
            KnownLimitations = "NOT measured on Beam Pro; do not treat as validated" };

        public static IEnumerable<ShadowVoiceDevicePreset> All()
        { yield return AndroidEnUsV1; yield return AndroidZhCnV1; yield return BeamProEnUsV1; yield return BeamProZhCnV1; }

        public static ShadowVoiceDevicePreset ForLocale(string locale, bool beamPro = false)
        {
            if (beamPro) return locale == "zh-CN" ? BeamProZhCnV1 : BeamProEnUsV1;
            return locale == "zh-CN" ? AndroidZhCnV1 : AndroidEnUsV1;
        }
    }

    // Two operating modes. TTS_ONLY needs no microphone; VOICE_COMMANDS_ENABLED may request the mic
    // only after explicit user action, and recognized speech may navigate but never authorize.
    public enum ShadowVoiceMode { TTS_ONLY, VOICE_COMMANDS_ENABLED }

    public static class ShadowVoiceModePolicy
    {
        public static bool RequiresMicrophone(ShadowVoiceMode mode) => mode == ShadowVoiceMode.VOICE_COMMANDS_ENABLED;
        // The mic permission request is only allowed after an explicit user opt-in, never at launch.
        public static bool MayRequestMicNow(ShadowVoiceMode mode, bool userExplicitlyEnabled) => mode == ShadowVoiceMode.VOICE_COMMANDS_ENABLED && userExplicitlyEnabled;
    }
}
