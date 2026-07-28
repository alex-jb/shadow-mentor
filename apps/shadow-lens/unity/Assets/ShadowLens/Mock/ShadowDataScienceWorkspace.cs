// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowDataScienceWorkspace.cs
// Data Science artifact: dataset / candidate models / metrics / selected model. Shows NO loan/DTI
// content. Focus highlights the GBM model node + the cited AUC metric. SOURCE AUTHORED · Unity 6.
#if UNITY_2020_1_OR_NEWER
using ShadowLens.Design;

namespace ShadowLens.Mock
{
    public class ShadowDataScienceWorkspace : ShadowArtifactWorkspaceBase
    {
        public override string ProfileId => "data-science-v1";
        public ShadowDataScienceWorkspace() { ArtifactTitle = "EXPERIMENT — MODEL SELECTION"; }

        protected override void BuildContent()
        {
            Node("dataset", "Dataset: fraud-detection-v1  ·  sha256:1a2b…");
            Line("Train/Test split: 0.8 / 0.2  (seed 42)", ShadowDesignTokens.TextSecondary);
            Line("Candidates:  Logistic Regression · Random Forest · GBM", ShadowDesignTokens.TextSecondary);
            Node("metric_auc", "AUC = 0.912   (Recall 0.87 · Calibration Error 0.03)");
            Node("selection", "Selected model: GBM  ▶ highest test AUC");
            Line("env: python 3.12 · scikit-learn 1.5.0   commit abc123", ShadowDesignTokens.TextSecondary);
        }
    }
}
#endif
