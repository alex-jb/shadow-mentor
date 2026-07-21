// apps/shadow-lens/unity/Assets/ShadowLens/Narrative/ShadowBankingNarrativeData.cs
// The deterministic banking narrative the stage tells, mirrored from fixtures/banking-narrative.mjs.
// Non-secret demo data. FIXTURE MODEL — a fixed narrative, not live production AI. Pure C#.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.Narrative
{
    public struct ShadowVoice
    {
        public string voice, stance, reason, vote;
        public float confidence, relevance, importance;
        public ShadowVoice(string voice, string stance, float confidence, string reason, string vote, float relevance, float importance)
        { this.voice = voice; this.stance = stance; this.confidence = confidence; this.reason = reason; this.vote = vote; this.relevance = relevance; this.importance = importance; }
    }

    public static class ShadowBankingNarrativeData
    {
        public const string CaseId = "case-2026-Q3-0042";
        public const string CaseLabel = "Mid-market loan applicant";
        public const string ModeLabel = "FIXTURE MODEL";
        public const string SignedStatus = "REAL SIGNED";   // the Node acceptance package proves the Ed25519

        // relevance = how close to center; importance = node size. Deterministic, from the .mjs fixture.
        public static readonly ShadowVoice[] Voices = {
            new ShadowVoice("Credit Fundamentals", "approve-with-conditions", 0.72f, "FICO 706 clears the 700 floor; DTI over ceiling needs a compensating factor.", "challenge", 0.85f, 0.80f),
            new ShadowVoice("Risk Officer",        "caution",                 0.68f, "DTI 0.41 and LTV 0.83 stack — concentration risk is elevated.",                 "challenge", 0.90f, 0.85f),
            new ShadowVoice("Fair Lending Compliance", "no-disparate-impact", 0.80f, "Drivers are DTI/LTV, not protected-class proxies.",                            "agree",     0.70f, 0.70f),
            new ShadowVoice("Customer Advocate",   "support-with-structure",  0.61f, "Restructure the term to bring DTI under 0.36.",                               "challenge", 0.60f, 0.60f),
            new ShadowVoice("Macro Contrarian",    "abstain",                 0.50f, "Rate-path uncertainty; defer to the compensating-factor review.",             "abstain",   0.45f, 0.50f),
        };

        // decision summary (right card)
        public const string Recommendation = "REVIEW";
        public const string RiskLevel = "elevated";
        public const string ComplianceStatus = "clear";
        public const float Confidence = 0.67f;
        public const int Dissent = 3;
        public const int EvidenceCount = 3;
    }
}
#endif
