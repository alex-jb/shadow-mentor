// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowDeviceCapabilityReport.cs
// A serializable, evidence-free capability report for diagnostics export. Lists the resolved flags,
// level, session state, the officially-unsupported set, and (honestly) whether the profile is
// device-validated. Deterministic given a profile + injected timestamp (no Date.now). SOURCE AUTHORED.
using System;
using System.Collections.Generic;
using System.Text;

namespace ShadowLens.Device
{
    public static class ShadowDeviceCapabilityReport
    {
        public static string ToText(ShadowDeviceCapabilityProfile p, string isoTimestamp, string unityVersion = null)
        {
            var sb = new StringBuilder();
            sb.Append("SHADOW DEVICE CAPABILITY REPORT\n");
            sb.Append("timestamp: ").Append(isoTimestamp ?? "(injected)").Append('\n');
            if (unityVersion != null) sb.Append("unity: ").Append(unityVersion).Append('\n');
            sb.Append("level: ").Append(p.Level).Append('\n');
            sb.Append("state: ").Append(p.State).Append('\n');
            sb.Append("device_validated: ").Append(p.Has(ShadowCapability.DEVICE_VALIDATED) ? "yes" : "NO").Append('\n');
            sb.Append("flags:\n");
            foreach (ShadowCapability c in Enum.GetValues(typeof(ShadowCapability)))
            {
                if (c == ShadowCapability.None) continue;
                bool on = p.Has(c);
                bool unsupported = (ShadowOfficialLimits.AlwaysUnsupported & c) == c;
                sb.Append("  ").Append(on ? "[x] " : "[ ] ").Append(c);
                if (unsupported) sb.Append("  (OFFICIALLY UNSUPPORTED — never available)");
                sb.Append('\n');
            }
            var info = ShadowSessionStateInfo.Get(p.State);
            sb.Append("state_label: ").Append(info.LabelEn).Append('\n');
            sb.Append("recovery: ").Append(info.RecoveryEn).Append('\n');
            return sb.ToString();
        }

        // Minimal JSON (hand-built, no dependency) for machine consumption.
        public static string ToJson(ShadowDeviceCapabilityProfile p, string isoTimestamp)
        {
            var on = new List<string>();
            foreach (ShadowCapability c in Enum.GetValues(typeof(ShadowCapability)))
                if (c != ShadowCapability.None && p.Has(c)) on.Add("\"" + c + "\"");
            return "{\"timestamp\":\"" + (isoTimestamp ?? "") + "\",\"level\":\"" + p.Level +
                   "\",\"state\":\"" + p.State + "\",\"device_validated\":" + (p.Has(ShadowCapability.DEVICE_VALIDATED) ? "true" : "false") +
                   ",\"flags\":[" + string.Join(",", on) + "]}";
        }
    }
}
