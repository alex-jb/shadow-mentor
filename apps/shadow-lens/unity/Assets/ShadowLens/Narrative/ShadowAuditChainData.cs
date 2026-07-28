// apps/shadow-lens/unity/Assets/ShadowLens/Narrative/ShadowAuditChainData.cs
// The provenance spine the 3D audit arc renders — mirrored 1:1 from the Claim-Evidence
// Graph's provenanceChain() (lib/claim-evidence-graph.mjs → PROVENANCE_ORDER):
// source → snapshot → evidence → claim → recommendation → signature → audit_record.
// Deterministic, non-secret demo hashes (prefixes only — the real bundle carries full
// SHA-256s). This is the ONE fact source: the same chain the offline verifier walks.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.Narrative
{
    public struct ShadowAuditLink
    {
        public int seq;
        public string type;      // node type from PROVENANCE_ORDER
        public string label;     // human label
        public string hashPrefix; // first 8 of the node's sha256 (demo)
        public ShadowAuditLink(int seq, string type, string label, string hashPrefix)
        { this.seq = seq; this.type = type; this.label = label; this.hashPrefix = hashPrefix; }
    }

    public static class ShadowAuditChainData
    {
        // Happy path: fully verified (BrokenAtSeq < 0). Tamper demo sets a break seq and every
        // link at/after it renders NOT VERIFIED (frozen). No timed coroutine here — the cascade
        // ordering/timing is data (see CascadeDelaysSec) applied at device-validation time.
        public static readonly ShadowAuditLink[] Chain = {
            new ShadowAuditLink(0, "source",         "Loan file",       "a1b2c3d4"),
            new ShadowAuditLink(1, "snapshot",       "Intake snapshot", "e5f6a7b8"),
            new ShadowAuditLink(2, "evidence",       "DTI / FICO / LTV","c9d0e1f2"),
            new ShadowAuditLink(3, "claim",          "Council claims",  "13243546"),
            new ShadowAuditLink(4, "recommendation", "REVIEW",          "5768798a"),
            new ShadowAuditLink(5, "signature",      "Ed25519 seal",    "9bacbdce"),
            new ShadowAuditLink(6, "audit_record",   "Audit record",    "dfe0f102"),
        };

        // -1 = no break (all verified). Set to a seq to demo a broken chain (that link + all
        // downstream become NOT VERIFIED).
        public const int BrokenAtSeq = -1;

        // Per-link reveal delays (seconds) mirrored from VerificationCascade — DATA only,
        // for a device-side one-shot reveal. Not animated in the Mock build.
        public static readonly float[] CascadeDelaysSec = { 0.00f, 0.08f, 0.16f, 0.24f, 0.32f, 0.40f, 0.48f };

        public static bool IsVerified(int seq) => BrokenAtSeq < 0 || seq < BrokenAtSeq;
    }
}
#endif
