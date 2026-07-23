// apps/shadow-lens/unity/Assets/ShadowLens/Editor/ShadowXrealManifestInjector.cs
// Deterministic post-build manifest injection for the XREAL device candidate. candidate-02 shipped the
// XREAL native libs + providers/services (from the AAR merge) but was MISSING the two meta-data the
// XREAL SDK 3.1 FAQ requires for MyGlasses MR registration — `nreal_sdk` and `com.nreal.supportDevices`
// — because the SDK's IAndroidManifestRequirementProvider did not fire in this build. This processor
// replicates EXACTLY what Unity.XR.XREAL.Editor.XREALManifestProvider would add (values derived from
// XREALSettings.SupportDevices = [REALITY(1), VISION(2)] → "1|XrealLight|2|XrealAir", matching the FAQ),
// idempotently, into the launcher module manifest so gradle merges it into the final APK. Gated by
// SHADOW_XREAL_SDK so the base (non-XREAL) build never includes it. Does NOT touch the launcher
// activity / MAIN / LAUNCHER / exported (the candidate-02 launcher fix is preserved).
#if SHADOW_XREAL_SDK
using System.IO;
using System.Xml;
using UnityEditor.Android;
using UnityEngine;

namespace ShadowLens.EditorTools
{
    public class ShadowXrealManifestInjector : IPostGenerateGradleAndroidProject
    {
        public int callbackOrder => 100; // run after Unity's own manifest generation

        // (name, value) — mirrors XREALManifestProvider. supportDevices value is the SDK-3.1 default
        // [REALITY, VISION] formatted per the provider; matches the official FAQ example.
        static readonly (string name, string value)[] Meta =
        {
            ("nreal_sdk", "true"),
            ("com.nreal.supportDevices", "1|XrealLight|2|XrealAir"),
            ("autoLog", "0"),
        };

        public void OnPostGenerateGradleAndroidProject(string unityLibraryPath)
        {
            // the launchable app manifest is the launcher module's, a sibling of unityLibrary
            var launcher = Path.Combine(Path.GetDirectoryName(unityLibraryPath), "launcher", "src", "main", "AndroidManifest.xml");
            var target = File.Exists(launcher) ? launcher : Path.Combine(unityLibraryPath, "src", "main", "AndroidManifest.xml");
            if (!File.Exists(target)) { Debug.LogError("[XrealManifestInjector] no manifest at " + target); return; }

            var doc = new XmlDocument { PreserveWhitespace = true };
            doc.Load(target);
            var app = doc.SelectSingleNode("/manifest/application");
            if (app == null) { Debug.LogError("[XrealManifestInjector] no <application> in " + target); return; }
            const string ANDROID = "http://schemas.android.com/apk/res/android";

            int added = 0;
            foreach (var (name, value) in Meta)
            {
                // idempotent: skip if a meta-data with this android:name already exists anywhere
                bool exists = false;
                foreach (XmlNode md in doc.GetElementsByTagName("meta-data"))
                {
                    var a = md.Attributes?["android:name"];
                    if (a != null && a.Value == name) { exists = true; break; }
                }
                if (exists) continue;
                var el = doc.CreateElement("meta-data");
                var an = doc.CreateAttribute("android", "name", ANDROID); an.Value = name; el.Attributes.Append(an);
                var av = doc.CreateAttribute("android", "value", ANDROID); av.Value = value; el.Attributes.Append(av);
                app.AppendChild(el);
                added++;
            }
            if (added > 0) { doc.Save(target); Debug.Log($"[XrealManifestInjector] added {added} XREAL meta-data (nreal_sdk / com.nreal.supportDevices / autoLog) to {Path.GetFileName(target)}"); }
            else Debug.Log("[XrealManifestInjector] XREAL meta-data already present — nothing to add");
        }
    }
}
#endif
