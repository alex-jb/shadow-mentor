// apps/shadow-lens/unity/Assets/ShadowLens/Editor/ShadowXrealDefineSetup.cs
// Sets/clears the SHADOW_XREAL_SDK scripting define for the XREAL candidate build. The define is a
// LOCAL, operator-side toggle (like the com.xreal.xr file: reference) — it must NOT be committed,
// because the base candidate must build WITHOUT the SDK. CI: -executeMethod
// ShadowLens.EditorTools.ShadowXrealDefineSetup.Set / .Clear. SOURCE AUTHORED.
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace ShadowLens.EditorTools
{
    public static class ShadowXrealDefineSetup
    {
        const string Sym = "SHADOW_XREAL_SDK";

        public static void Set() { Apply(NamedBuildTarget.Android, true); Apply(NamedBuildTarget.Standalone, true); Debug.Log("[XrealDefine] SET (local only, do not commit)"); }
        public static void Clear() { Apply(NamedBuildTarget.Android, false); Apply(NamedBuildTarget.Standalone, false); Debug.Log("[XrealDefine] CLEARED"); }

        static void Apply(NamedBuildTarget t, bool on)
        {
            var cur = PlayerSettings.GetScriptingDefineSymbols(t);
            var parts = new System.Collections.Generic.List<string>(cur.Split(new[] { ';' }, System.StringSplitOptions.RemoveEmptyEntries));
            bool has = parts.Contains(Sym);
            if (on && !has) parts.Add(Sym);
            if (!on && has) parts.Remove(Sym);
            PlayerSettings.SetScriptingDefineSymbols(t, string.Join(";", parts));
        }
    }
}
#endif
