// apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryLoader.cs
// Builds a typed GuidedStorySemantic from the parsed JSON of a compiled snapshot, treating the JSON
// as UNTRUSTED: it rejects duplicate ids, dangling status/relation references, unknown statuses or
// dimensions, and undeclared dimension keys — the same fail-closed contract as the Node compiler.
// This is what makes the Unity side render the SAME meaning the parity anchor pins. Pure C#.
// SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.GuidedStory
{
    public sealed class ShadowStoryLoadException : System.Exception
    {
        public ShadowStoryLoadException(string m) : base(m) {}
    }

    public static class ShadowGuidedStoryLoader
    {
        public static GuidedStorySemantic Load(string json)
        {
            JsonValue root = ShadowGuidedStoryJson.Parse(json);
            if (root.Kind != JsonKind.Object) throw new ShadowStoryLoadException("semantic root must be an object");

            var m = new GuidedStorySemantic
            {
                StoryVersion = Str(root, "story_version"),
                StoryId = Str(root, "story_id"),
                ProvenanceMode = Str(root, "provenance_mode"),
                VocabularyVersion = root.Get("vocabulary_version")?.AsString,
                Title = Bi(root.Get("title")),
            };
            if (m.StoryVersion != "shadow-guided-story-v1")
                throw new ShadowStoryLoadException("unexpected story_version: " + m.StoryVersion);

            // trust dimensions (declared subset)
            var declaredDims = new HashSet<string>();
            foreach (var d in Arr(root, "trust_dimensions"))
            {
                string dim = d.AsString;
                if (!ShadowGuidedStoryStatus.IsTrustDimension(dim)) throw new ShadowStoryLoadException("unknown trust dimension " + dim);
                if (!declaredDims.Add(dim)) throw new ShadowStoryLoadException("duplicate trust dimension " + dim);
                m.TrustDimensions.Add(dim);
            }

            // entities
            var entityIds = new HashSet<string>();
            foreach (var e in Arr(root, "entities"))
            {
                var ent = new StoryEntity
                {
                    Id = Str(e, "id"),
                    Kind = Str(e, "kind"),
                    Sequence = e.Get("sequence").AsInt,
                    Label = Bi(e.Get("label")),
                    A11y = Bi(e.Get("a11y")),
                    TrustDimension = NullableStr(e.Get("trust_dimension")),
                    EvidenceRef = NullableStr(e.Get("evidence_ref")),
                };
                if (!entityIds.Add(ent.Id)) throw new ShadowStoryLoadException("duplicate entity id " + ent.Id);
                if (ent.TrustDimension != null && !ShadowGuidedStoryStatus.IsTrustDimension(ent.TrustDimension))
                    throw new ShadowStoryLoadException("entity " + ent.Id + ": unknown trust_dimension " + ent.TrustDimension);
                m.Entities.Add(ent);
            }

            // relations
            var relIds = new HashSet<string>();
            foreach (var r in Arr(root, "relations"))
            {
                var rel = new StoryRelation { Id = Str(r, "id"), Type = Str(r, "type"), From = Str(r, "from"), To = Str(r, "to") };
                if (!relIds.Add(rel.Id)) throw new ShadowStoryLoadException("duplicate relation id " + rel.Id);
                if (!entityIds.Contains(rel.From)) throw new ShadowStoryLoadException("relation " + rel.Id + ": from unknown entity " + rel.From);
                if (!entityIds.Contains(rel.To)) throw new ShadowStoryLoadException("relation " + rel.Id + ": to unknown entity " + rel.To);
                m.Relations.Add(rel);
            }

            // scenarios
            var scenarioIds = new HashSet<string>();
            foreach (var s in Arr(root, "scenarios"))
            {
                var sc = new StoryScenario { Id = Str(s, "id"), Label = Bi(s.Get("label")), Note = Bi(s.Get("note")) };
                if (!scenarioIds.Add(sc.Id)) throw new ShadowStoryLoadException("duplicate scenario id " + sc.Id);
                foreach (var kv in ObjPairs(s.Get("entity_status")))
                {
                    if (!entityIds.Contains(kv.Key)) throw new ShadowStoryLoadException("scenario " + sc.Id + ": entity_status references unknown entity " + kv.Key);
                    if (!ShadowGuidedStoryStatus.IsStatus(kv.Value)) throw new ShadowStoryLoadException("scenario " + sc.Id + ": unknown status " + kv.Value);
                    sc.EntityStatus[kv.Key] = kv.Value;
                }
                foreach (var kv in ObjPairs(s.Get("dimension_status")))
                {
                    if (!declaredDims.Contains(kv.Key)) throw new ShadowStoryLoadException("scenario " + sc.Id + ": undeclared dimension " + kv.Key);
                    if (!ShadowGuidedStoryStatus.IsStatus(kv.Value)) throw new ShadowStoryLoadException("scenario " + sc.Id + ": unknown status " + kv.Value);
                    if (kv.Key == "ANALYTICAL_CORRECTNESS" && kv.Value != "NOT_EVALUATED")
                        throw new ShadowStoryLoadException("scenario " + sc.Id + ": ANALYTICAL_CORRECTNESS must be NOT_EVALUATED");
                    sc.DimensionStatus[kv.Key] = kv.Value;
                }
                var ff = NullableStr(s.Get("first_failure"));
                if (ff != null && !entityIds.Contains(ff) && !declaredDims.Contains(ff))
                    throw new ShadowStoryLoadException("scenario " + sc.Id + ": first_failure " + ff + " is neither entity nor dimension");
                sc.FirstFailure = ff;
                foreach (var id in Arr(s, "affected_downstream"))
                {
                    string did = id.AsString;
                    if (!entityIds.Contains(did)) throw new ShadowStoryLoadException("scenario " + sc.Id + ": affected_downstream unknown entity " + did);
                    sc.AffectedDownstream.Add(did);
                }
                m.Scenarios.Add(sc);
            }

            // steps
            var stepIds = new HashSet<string>();
            var stepIndices = new HashSet<int>();
            foreach (var st in Arr(root, "steps"))
            {
                var step = new StoryStep
                {
                    Id = Str(st, "id"),
                    Index = st.Get("index").AsInt,
                    Kind = Str(st, "kind"),
                    ScenarioRef = NullableStr(st.Get("scenario_ref")),
                    Narration = Bi(st.Get("narration")),
                    LayoutIntent = NullableStr(st.Get("layout_intent")),
                    RevealUptoSequence = st.Get("reveal_upto_sequence") != null && st.Get("reveal_upto_sequence").Kind == JsonKind.Number ? st.Get("reveal_upto_sequence").AsInt : -1,
                };
                if (!stepIds.Add(step.Id)) throw new ShadowStoryLoadException("duplicate step id " + step.Id);
                if (!stepIndices.Add(step.Index)) throw new ShadowStoryLoadException("duplicate step index " + step.Index);
                if (step.ScenarioRef != null && !scenarioIds.Contains(step.ScenarioRef)) throw new ShadowStoryLoadException("step " + step.Id + ": unknown scenario_ref " + step.ScenarioRef);
                foreach (var f in Arr(st, "focus_entities"))
                {
                    string fid = f.AsString;
                    if (!entityIds.Contains(fid)) throw new ShadowStoryLoadException("step " + step.Id + ": focus unknown entity " + fid);
                    step.FocusEntities.Add(fid);
                }
                m.Steps.Add(step);
            }

            m.Steps.Sort((a, b) => a.Index.CompareTo(b.Index));
            return m;
        }

        // ── helpers ──
        static JsonValue Req(JsonValue o, string k)
        {
            var v = o?.Get(k);
            if (v == null) throw new ShadowStoryLoadException("missing field " + k);
            return v;
        }
        static string Str(JsonValue o, string k)
        {
            var v = Req(o, k);
            if (v.Kind != JsonKind.String) throw new ShadowStoryLoadException("field " + k + " must be a string");
            return v.Str;
        }
        static string NullableStr(JsonValue v) => (v == null || v.IsNull) ? null : v.AsString;
        static List<JsonValue> Arr(JsonValue o, string k)
        {
            var v = o?.Get(k);
            if (v == null) return new List<JsonValue>();
            if (v.Kind != JsonKind.Array) throw new ShadowStoryLoadException("field " + k + " must be an array");
            return v.Arr;
        }
        static Bilingual Bi(JsonValue v)
        {
            if (v == null || v.IsNull) return null;
            return new Bilingual { En = v.Get("en")?.AsString, Zh = v.Get("zh")?.AsString };
        }
        static IEnumerable<KeyValuePair<string, string>> ObjPairs(JsonValue v)
        {
            if (v == null || v.Obj == null) yield break;
            foreach (var kv in v.Obj) yield return new KeyValuePair<string, string>(kv.Key, kv.Value.AsString);
        }
    }
}
