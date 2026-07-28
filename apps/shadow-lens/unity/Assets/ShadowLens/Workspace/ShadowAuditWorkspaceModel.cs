// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowAuditWorkspaceModel.cs
// The Audit Workspace VIEW-MODEL: derives the Current Focus card, Source card, Trust Strip (4 groups)
// and Evidence Rail (sequence) from the REAL guided-story state — it does not duplicate or invent
// story data. Integrity ≠ correctness and review ≠ approval are preserved as distinct fields. Missing
// source/OCR are explicit (NOT_PRESENT / NOT_EVALUATED), never silently omitted. Status identity comes
// from ShadowStatusGlyph (generated tokens, fail-closed). Pure C# → EditMode-testable headlessly; the
// MonoBehaviour root renders this into meshes.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using ShadowLens.GuidedStory;

namespace ShadowLens.Workspace
{
    public enum ShadowLabelPriority { P0, P1, P2, P3 }

    public struct FocusField { public string Key, Label, Value, Status; public ShadowLabelPriority Priority; }

    public struct CurrentFocusVM
    {
        public string EntityId, Title, Role;
        public string Verification;         // canonical status
        public bool IsFirstFailure;
        public int DownstreamAffectedCount;
        public string HumanReview, Approval; // DISTINCT fields — review is not approval
        public string TrustPosture;
        public string NextAction;
        public List<FocusField> Fields;
    }

    public struct SourceCardVM
    {
        public string SourceType, SourceName, Location, Excerpt;
        public string Resolution;   // PRESENT / NOT_PRESENT
        public string Ocr;          // NOT_EVALUATED unless proven
        public bool LocationAvailable;
    }

    public struct TrustGroupVM { public string Key, Label, LabelZh, RepresentativeStatus; public ShadowGlyph Glyph; }

    public struct RailItemVM
    {
        public string EntityId; public int Sequence; public string Status;
        public bool IsCurrent, IsFirstFailure, IsDownstream; public ShadowGlyph Glyph;
    }

    public static class ShadowAuditWorkspaceModel
    {
        static string StatusOf(StoryScenario sc, string entityId)
            => (sc != null && sc.EntityStatus != null && sc.EntityStatus.TryGetValue(entityId, out var s)) ? s : "NOT_EVALUATED";

        public static CurrentFocusVM BuildFocus(GuidedStorySemantic model, StoryScenario sc, string focusEntityId, bool zh)
        {
            var ent = model?.EntityById(focusEntityId);
            string status = StatusOf(sc, focusEntityId);
            bool isFF = sc != null && sc.FirstFailure == focusEntityId;
            int downstream = sc?.AffectedDownstream?.Count ?? 0;
            // review/approval are read from dimension status, kept DISTINCT + honest defaults
            string review = (sc?.DimensionStatus != null && sc.DimensionStatus.TryGetValue("HUMAN_REVIEW", out var r)) ? r : "NOT_EVALUATED";
            string approval = (sc?.DimensionStatus != null && sc.DimensionStatus.TryGetValue("HUMAN_APPROVAL", out var a)) ? a : "APPROVAL_NOT_PRESENT";
            string posture = (sc?.DimensionStatus != null && sc.DimensionStatus.TryGetValue("TRUST_POSTURE", out var p)) ? p : "SELF_SIGNED";

            var fields = new List<FocusField>
            {
                new FocusField { Key = "verification", Label = "Verification", Value = status, Status = status,
                    Priority = (isFF || status == "FAILED") ? ShadowLabelPriority.P0 : ShadowLabelPriority.P1 },
                new FocusField { Key = "human_review", Label = "Human review", Value = review, Status = review, Priority = ShadowLabelPriority.P1 },
                new FocusField { Key = "approval", Label = "Approval", Value = approval, Status = approval, Priority = ShadowLabelPriority.P1 },
                new FocusField { Key = "downstream", Label = "Downstream affected", Value = downstream.ToString(), Status = "AFFECTED_DOWNSTREAM", Priority = ShadowLabelPriority.P1 },
                new FocusField { Key = "trust_posture", Label = "Trust posture", Value = posture, Status = posture, Priority = ShadowLabelPriority.P2 },
            };
            return new CurrentFocusVM
            {
                EntityId = focusEntityId,
                Title = ent?.Label?.Pick(zh) ?? focusEntityId,
                Role = ent?.Kind ?? "record",
                Verification = status,
                IsFirstFailure = isFF,
                DownstreamAffectedCount = downstream,
                HumanReview = review,
                Approval = approval,
                TrustPosture = posture,
                NextAction = NextAction(status, review, approval, isFF),
                Fields = fields,
            };
        }

        // The correct next action, prioritized: a first failure / verification failure is P0.
        public static string NextAction(string status, string review, string approval, bool isFF)
        {
            if (isFF || status == "FAILED") return "OPEN 2D AUDIT — inspect the first failure";
            if (review == "REQUIRES_HUMAN_REVIEW") return "ROUTE FOR HUMAN REVIEW";
            if (approval == "APPROVAL_NOT_PRESENT") return "AWAIT HUMAN APPROVAL (not auto-approved)";
            return "CONTINUE REVIEW";
        }

        // Source card — missing data is EXPLICIT, never invented. SOURCE RESOLVED ≠ analytical correctness.
        public static SourceCardVM BuildSource(StoryEntity ent)
        {
            bool hasEvidence = ent != null && !string.IsNullOrEmpty(ent.EvidenceRef);
            return new SourceCardVM
            {
                SourceType = ent?.Kind ?? "unknown",
                SourceName = ent?.Label?.En ?? "SOURCE NOT PRESENT",
                Location = hasEvidence ? ent.EvidenceRef : "LOCATION NOT AVAILABLE",
                Excerpt = hasEvidence ? "" : "",
                Resolution = hasEvidence ? "PRESENT" : "NOT_PRESENT",
                Ocr = "NOT_EVALUATED", // never claim OCR VERIFIED without proof
                LocationAvailable = hasEvidence,
            };
        }

        // Trust Strip — four overview groups, each a representative canonical status (generated glyph).
        public static List<TrustGroupVM> BuildTrustStrip(CurrentFocusVM focus)
        {
            var groups = new List<TrustGroupVM>
            {
                Grp("integrity", "Integrity", "完整性", focus.IsFirstFailure ? "FIRST_FAILURE" : focus.Verification),
                Grp("provenance", "Provenance", "溯源", focus.TrustPosture),
                Grp("decision_support", "Decision Support", "决策支持", "NOT_EVALUATED"),
                Grp("human_policy", "Human / Policy Boundary", "人工/政策边界", focus.Approval),
            };
            return groups;
        }

        static TrustGroupVM Grp(string key, string label, string labelZh, string status)
            => new TrustGroupVM { Key = key, Label = label, LabelZh = labelZh, RepresentativeStatus = status, Glyph = ShadowStatusGlyph.Resolve(status) };

        // Evidence Rail — deterministic sequence order; first failure breaks the rail; downstream is
        // distinct (dashed), never a second independent first failure.
        public static List<RailItemVM> BuildRail(GuidedStorySemantic model, StoryScenario sc, string currentEntityId)
        {
            var items = new List<RailItemVM>();
            if (model?.Entities == null) return items;
            var entities = new List<StoryEntity>(model.Entities);
            entities.Sort((x, y) => x.Sequence.CompareTo(y.Sequence));
            var downstreamSet = new HashSet<string>(sc?.AffectedDownstream ?? new List<string>());
            foreach (var e in entities)
            {
                string status = StatusOf(sc, e.Id);
                bool isFF = sc != null && sc.FirstFailure == e.Id;
                bool isDown = downstreamSet.Contains(e.Id) && !isFF; // downstream is NOT the first failure
                items.Add(new RailItemVM
                {
                    EntityId = e.Id, Sequence = e.Sequence, Status = status,
                    IsCurrent = e.Id == currentEntityId, IsFirstFailure = isFF, IsDownstream = isDown,
                    Glyph = ShadowStatusGlyph.Resolve(isFF ? "FIRST_FAILURE" : isDown ? "AFFECTED_DOWNSTREAM" : status),
                });
            }
            return items;
        }
    }
}
#endif
