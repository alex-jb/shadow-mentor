// apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryState.cs
// Step/scenario state machine for a guided story. Next/Back/Restart never run off the ends; the
// active scenario is the current step's scenario_ref (or the first scenario). Pure C#, EditMode-
// tested, mirrors the Three.js player's stepping. SOURCE AUTHORED.
namespace ShadowLens.GuidedStory
{
    public sealed class ShadowGuidedStoryState
    {
        readonly GuidedStorySemantic _m;
        public int StepIndex { get; private set; }

        public ShadowGuidedStoryState(GuidedStorySemantic model) { _m = model; StepIndex = 0; }

        public int StepCount => _m.Steps.Count;
        public bool CanNext => StepIndex < _m.Steps.Count - 1;
        public bool CanBack => StepIndex > 0;
        public StoryStep CurrentStep => _m.Steps[StepIndex];

        public string CurrentScenarioId
        {
            get
            {
                var s = CurrentStep.ScenarioRef;
                return !string.IsNullOrEmpty(s) ? s : (_m.Scenarios.Count > 0 ? _m.Scenarios[0].Id : null);
            }
        }
        public StoryScenario CurrentScenario => _m.ScenarioById(CurrentScenarioId);

        public void Next() { if (CanNext) StepIndex++; }
        public void Back() { if (CanBack) StepIndex--; }
        public void Restart() { StepIndex = 0; }
    }
}
