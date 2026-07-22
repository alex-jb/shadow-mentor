// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowLabelPresets.cs
// Measurable label-readability presets. Each preset carries text scale, max line length, and plate
// padding; labels also encode a P0–P3 priority (P0 = the first failure / final record, always shown;
// P3 = decorative, dropped first under crowding). The BEAM_PRO_HYPOTHESIS preset is explicitly a
// hypothesis — it is NOT a device-validated measurement; only BEAM_PRO_MEASURED (filled from real
// device data) may be treated as measured. Pure C#, EditMode-testable. SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.Device
{
    public enum ShadowLabelPriority { P0, P1, P2, P3 }

    public sealed class ShadowLabelPreset
    {
        public string Name;
        public float TextScale;        // relative text size multiplier
        public int MaxLineChars;       // wrap threshold (bilingual-aware caller trims CJK differently)
        public float PlatePadding;     // background plate padding (world units)
        public bool DeviceValidated;   // ONLY true for BEAM_PRO_MEASURED filled from real data
    }

    public static class ShadowLabelPresets
    {
        public static readonly ShadowLabelPreset Desktop1280x720 = new ShadowLabelPreset { Name = "DESKTOP_1280_720", TextScale = 1.0f, MaxLineChars = 42, PlatePadding = 0.02f, DeviceValidated = false };
        public static readonly ShadowLabelPreset AndroidPhone = new ShadowLabelPreset { Name = "ANDROID_PHONE", TextScale = 1.15f, MaxLineChars = 32, PlatePadding = 0.03f, DeviceValidated = false };
        // HYPOTHESIS — larger text + shorter lines are a guess for headset legibility, NOT measured.
        public static readonly ShadowLabelPreset BeamProHypothesis = new ShadowLabelPreset { Name = "BEAM_PRO_HYPOTHESIS", TextScale = 1.6f, MaxLineChars = 24, PlatePadding = 0.05f, DeviceValidated = false };
        // MEASURED — starts equal to the hypothesis; a real device session overwrites these values and
        // sets DeviceValidated = true. Until then it is NOT device-validated.
        public static readonly ShadowLabelPreset BeamProMeasured = new ShadowLabelPreset { Name = "BEAM_PRO_MEASURED", TextScale = 1.6f, MaxLineChars = 24, PlatePadding = 0.05f, DeviceValidated = false };

        public static IEnumerable<ShadowLabelPreset> All()
        {
            yield return Desktop1280x720; yield return AndroidPhone; yield return BeamProHypothesis; yield return BeamProMeasured;
        }

        // Whether a label of this priority stays visible given how many labels are currently crowding.
        // P0 is never dropped; P3 drops first. `crowding` is a 0..1 pressure value.
        public static bool VisibleUnderCrowding(ShadowLabelPriority p, float crowding)
        {
            switch (p)
            {
                case ShadowLabelPriority.P0: return true;
                case ShadowLabelPriority.P1: return crowding < 0.9f;
                case ShadowLabelPriority.P2: return crowding < 0.6f;
                default: return crowding < 0.3f; // P3
            }
        }

        // Distance abbreviation: long text is shortened (never for P0) beyond a distance threshold.
        public static string Abbreviate(string text, ShadowLabelPriority p, float distanceM, ShadowLabelPreset preset)
        {
            if (string.IsNullOrEmpty(text)) return text;
            if (p == ShadowLabelPriority.P0) return text;             // P0 is always full
            int max = preset.MaxLineChars;
            if (distanceM > 2.5f) max = System.Math.Max(8, max / 2);  // farther → shorter
            if (text.Length <= max) return text;
            return text.Substring(0, System.Math.Max(1, max - 1)) + "…";
        }
    }
}
