// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowCodingWorkspace.cs
// Coding Agent artifact: issue / files / diff / tests / commit. Shows NO banking or model-selection
// content. Focus highlights the diff node + the test-evidence node. SOURCE AUTHORED · Unity 6.
#if UNITY_2020_1_OR_NEWER
using ShadowLens.Design;

namespace ShadowLens.Mock
{
    public class ShadowCodingWorkspace : ShadowArtifactWorkspaceBase
    {
        public override string ProfileId => "coding-agent-v1";
        public ShadowCodingWorkspace() { ArtifactTitle = "AGENT RUN — CODE REPLAY"; }

        protected override void BuildContent()
        {
            Node("issue", "Issue: duplicate EventSystem in the mock scene");
            Line("Files read: ShadowLensRuntimeBootstrap.cs", ShadowDesignTokens.TextSecondary);
            Node("diff1", "Diff: EnsureEventSystem() collapses duplicates (idempotent)");
            Node("cmd_test", "Tests: EditMode 18 passed · PlayMode 16 passed");
            Line("Security/lint: 0 high", ShadowDesignTokens.TextSecondary);
            Node("commit", "Final commit: 5aa09da");
        }
    }
}
#endif
