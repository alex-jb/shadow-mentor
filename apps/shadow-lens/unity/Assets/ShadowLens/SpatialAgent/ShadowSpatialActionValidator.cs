// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialActionValidator.cs
// Validates a requested action against the SHARED generated contract (ShadowSpatialContract) +
// the real scene index. Returns a code the router maps to an execution status. No second schema
// definition — the action set/arg keys come from the generated file. Pure → EditMode testable.
// SOURCE AUTHORED · UNITY COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.SpatialAgent
{
    public struct ShadowValidation { public bool ok; public string code; public string error; public string targetId; }

    public static class ShadowSpatialActionValidator
    {
        // codes: "ok" | "unknown_action" | "bad_args" | "target_not_found"
        public static ShadowValidation Validate(ShadowActionModel action, IShadowSceneObjectResolver scene)
        {
            var v = new ShadowValidation { ok = false, code = "unknown_action", targetId = null };
            if (action == null || string.IsNullOrEmpty(action.name)) { v.error = "action.name required"; return v; }
            if (!ShadowSpatialContract.ActionArg.TryGetValue(action.name, out var argKey)) { v.error = "unknown action " + action.name; return v; }

            if (argKey == null) { v.ok = true; v.code = "ok"; return v; } // mode/reset actions take no id

            string id = ArgValue(action.args, argKey);
            if (string.IsNullOrEmpty(id)) { v.code = "bad_args"; v.error = action.name + ": " + argKey + " required"; return v; }
            v.targetId = id;
            if (scene == null || !scene.Has(id)) { v.code = "target_not_found"; v.error = action.name + ": \"" + id + "\" not in the scene"; return v; }
            v.ok = true; v.code = "ok"; return v;
        }

        static string ArgValue(ShadowActionArgs args, string key)
        {
            if (args == null) return null;
            switch (key) { case "object_id": return args.object_id; case "source_id": return args.source_id; case "claim_id": return args.claim_id; default: return null; }
        }
    }
}
#endif
