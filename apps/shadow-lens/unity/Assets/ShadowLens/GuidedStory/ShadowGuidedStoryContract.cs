// apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryContract.cs
// Typed model for a compiled shadow-guided-story `semantic` block. Mirrors
// schemas/shadow-guided-story-v1.schema.json. Plain C# (no UnityEngine) so it is EditMode-testable
// and reusable off the main thread. Positions are NOT here — meaning only; the adapter computes
// advisory positions. SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.GuidedStory
{
    public sealed class Bilingual
    {
        public string En, Zh;
        public string Pick(bool zh) => zh ? Zh : En;
    }

    public sealed class StoryEntity
    {
        public string Id, Kind;
        public int Sequence;
        public Bilingual Label, A11y;
        public string TrustDimension;   // may be null
        public string EvidenceRef;      // may be null
    }

    public sealed class StoryRelation { public string Id, Type, From, To; }

    public sealed class StoryScenario
    {
        public string Id;
        public Bilingual Label, Note;
        public string FirstFailure;                     // entity id or trust dimension, or null
        public List<string> AffectedDownstream = new List<string>();
        public Dictionary<string, string> EntityStatus = new Dictionary<string, string>();
        public Dictionary<string, string> DimensionStatus = new Dictionary<string, string>();
    }

    public sealed class StoryStep
    {
        public string Id, Kind, ScenarioRef, LayoutIntent;
        public int Index;
        public Bilingual Narration;
        public List<string> FocusEntities = new List<string>();
        public int RevealUptoSequence = -1;             // -1 == null
    }

    public sealed class GuidedStorySemantic
    {
        public string StoryId, StoryVersion, ProvenanceMode, VocabularyVersion;
        public Bilingual Title;
        public List<string> TrustDimensions = new List<string>();
        public List<StoryEntity> Entities = new List<StoryEntity>();
        public List<StoryRelation> Relations = new List<StoryRelation>();
        public List<StoryScenario> Scenarios = new List<StoryScenario>();
        public List<StoryStep> Steps = new List<StoryStep>();

        public StoryScenario ScenarioById(string id) => Scenarios.Find(s => s.Id == id);
        public StoryEntity EntityById(string id) => Entities.Find(e => e.Id == id);
    }
}
