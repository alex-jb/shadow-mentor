// apps/shadow-lens/unity/Assets/ShadowLens/Tests/DeviceReady/ShadowLabelPresetsEditTests.cs
// EditMode tests for label readability presets: P0 is never dropped or abbreviated; P3 drops first
// under crowding; distance shortens non-P0 labels; and the BEAM_PRO_HYPOTHESIS preset is NOT
// device-validated. SOURCE AUTHORED.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using ShadowLens.Device;

namespace ShadowLens.Tests
{
    public class ShadowLabelPresetsEditTests
    {
        [Test] public void FourPresetsExist_AndOnlyMeasuredCanBeValidated()
        {
            int n = 0; bool anyHypothesisValidated = false;
            foreach (var p in ShadowLabelPresets.All()) { n++; if (p.Name == "BEAM_PRO_HYPOTHESIS" && p.DeviceValidated) anyHypothesisValidated = true; }
            Assert.AreEqual(4, n);
            Assert.IsFalse(anyHypothesisValidated, "the hypothesis preset must never be device-validated");
            Assert.IsFalse(ShadowLabelPresets.BeamProMeasured.DeviceValidated, "measured preset is not validated until real data fills it");
        }

        [Test] public void P0_AlwaysVisible_P3_DropsFirst()
        {
            Assert.IsTrue(ShadowLabelPresets.VisibleUnderCrowding(ShadowLabelPriority.P0, 1.0f), "P0 never drops");
            Assert.IsFalse(ShadowLabelPresets.VisibleUnderCrowding(ShadowLabelPriority.P3, 0.5f), "P3 drops under moderate crowding");
            Assert.IsTrue(ShadowLabelPresets.VisibleUnderCrowding(ShadowLabelPriority.P2, 0.5f), "P2 survives moderate crowding");
        }

        [Test] public void P0_NeverAbbreviated_OthersShortenWithDistance()
        {
            var preset = ShadowLabelPresets.Desktop1280x720;
            var longText = new string('x', 100);
            Assert.AreEqual(longText, ShadowLabelPresets.Abbreviate(longText, ShadowLabelPriority.P0, 5f, preset), "P0 stays full");
            var near = ShadowLabelPresets.Abbreviate(longText, ShadowLabelPriority.P2, 1f, preset);
            var far = ShadowLabelPresets.Abbreviate(longText, ShadowLabelPriority.P2, 4f, preset);
            Assert.Less(far.Length, near.Length, "farther labels get shorter");
            StringAssert.EndsWith("…", far);
        }
    }
}
#endif
