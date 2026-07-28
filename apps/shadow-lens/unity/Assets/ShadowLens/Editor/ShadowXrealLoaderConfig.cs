// apps/shadow-lens/unity/Assets/ShadowLens/Editor/ShadowXrealLoaderConfig.cs
// Reproducibly assigns the REAL XREAL loader (Unity.XR.XREAL.XREALXRLoader) to the ANDROID XR settings
// and enables Initialize-XR-on-Startup for Android — via the official XR Management editor APIs
// (XRPackageMetadataStore.AssignLoader + XRGeneralSettingsPerBuildTarget), NOT a hand-edited asset.
// It does NOT assign the loader to Standalone/macOS (that target needs no XREAL loader). It never
// enables plane/image/hand/depth/anchor. Gated by SHADOW_XREAL_SDK (the whole file compiles only with
// the SDK). CI: -executeMethod ShadowLens.EditorTools.ShadowXrealLoaderConfig.ConfigureAndroid.
// SOURCE AUTHORED.
#if UNITY_EDITOR && SHADOW_XREAL_SDK
using System.Reflection;
using UnityEditor;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEngine;
using UnityEngine.XR.Management;

namespace ShadowLens.EditorTools
{
    public static class ShadowXrealLoaderConfig
    {
        const string LoaderType = "Unity.XR.XREAL.XREALXRLoader";

        public static void ConfigureAndroid()
        {
            // Ensure the per-build-target XR settings exist.
            var buildTargetSettings = GetOrCreatePerBuildTarget();
            var android = GetOrCreateSettingsForGroup(buildTargetSettings, BuildTargetGroup.Android);
            if (android == null || android.Manager == null) { Debug.LogError("[XrealLoaderConfig] no XR manager for Android"); EditorApplication.Exit(1); return; }

            // Assign the XREAL loader to Android via the official metadata store (idempotent).
            bool ok = XRPackageMetadataStore.AssignLoader(android.Manager, LoaderType, BuildTargetGroup.Android);
            if (!ok) { Debug.LogError("[XrealLoaderConfig] AssignLoader failed for " + LoaderType); EditorApplication.Exit(1); return; }

            android.InitManagerOnStart = true;   // Initialize XR on Startup (Android)

            // Do NOT assign the loader to Standalone — desktop needs no XREAL loader.
            var standalone = GetOrCreateSettingsForGroup(buildTargetSettings, BuildTargetGroup.Standalone);
            if (standalone != null) XRPackageMetadataStore.RemoveLoader(standalone.Manager, LoaderType, BuildTargetGroup.Standalone);

            EditorUtility.SetDirty(android);
            AssetDatabase.SaveAssets();
            Debug.Log("[XrealLoaderConfig] XREAL loader assigned to Android; InitOnStart=true; Standalone left without XREAL.");
        }

        static UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget GetOrCreatePerBuildTarget()
        {
            EditorBuildSettings.TryGetConfigObject(XRGeneralSettings.k_SettingsKey, out UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget obj);
            if (obj == null)
            {
                obj = ScriptableObject.CreateInstance<UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget>();
                const string dir = "Assets/XR"; if (!AssetDatabase.IsValidFolder(dir)) AssetDatabase.CreateFolder("Assets", "XR");
                AssetDatabase.CreateAsset(obj, dir + "/XRGeneralSettingsPerBuildTarget.asset");
                EditorBuildSettings.AddConfigObject(XRGeneralSettings.k_SettingsKey, obj, true);
            }
            return obj;
        }

        static XRGeneralSettings GetOrCreateSettingsForGroup(UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget perTarget, BuildTargetGroup group)
        {
            var s = perTarget.SettingsForBuildTarget(group);
            if (s == null)
            {
                s = ScriptableObject.CreateInstance<XRGeneralSettings>();
                s.name = group + " Settings";
                var mgr = ScriptableObject.CreateInstance<XRManagerSettings>();
                mgr.name = group + " Providers";
                // wire the manager into the settings via the serialized field (m_LoaderManagerInstance)
                var f = typeof(XRGeneralSettings).GetField("m_LoaderManagerInstance", BindingFlags.NonPublic | BindingFlags.Instance);
                if (f != null) f.SetValue(s, mgr);
                AssetDatabase.AddObjectToAsset(s, perTarget);
                AssetDatabase.AddObjectToAsset(mgr, perTarget);
                perTarget.SetSettingsForBuildTarget(group, s);
                EditorUtility.SetDirty(perTarget);
            }
            return s;
        }
    }
}
#endif
