// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialModels.cs
// Serializable data models for the Unity spatial agent (JsonUtility-friendly: named fields, no
// arbitrary dictionaries). Mirrors the tested web client's response shape. SOURCE AUTHORED ·
// UNITY COMPILE PENDING · VISUAL WIRING PENDING (no scene changes at Gate 1).
#if UNITY_2020_1_OR_NEWER
using System;

namespace ShadowLens.SpatialAgent
{
    [Serializable] public class ShadowCitationModel { public string source_id; public int evidence_sequence = -1; public string quote; }

    // args is a fixed, closed shape (never an arbitrary dictionary) so JsonUtility can parse it
    // AND arbitrary props can never smuggle in.
    [Serializable] public class ShadowActionArgs { public string object_id; public string source_id; public string claim_id; }
    [Serializable] public class ShadowActionModel { public string name; public ShadowActionArgs args = new ShadowActionArgs(); }

    [Serializable] public class ShadowVerificationSummary { public string record_integrity; public int failed_seq = -1; public string reason; }

    [Serializable] public class ShadowGroundedAnswerModel
    {
        public string text;
        public ShadowCitationModel[] citations = Array.Empty<ShadowCitationModel>();
        public ShadowActionModel[] actions = Array.Empty<ShadowActionModel>();
        public ShadowVerificationSummary verification_summary;
        public bool grounded;
        public string model;
        public float latency_ms;
    }

    // The five honest execution statuses (mirrors ShadowSpatialContract.ExecStatuses).
    public static class ShadowExecStatus
    {
        public const string EXECUTED = "EXECUTED", REJECTED = "REJECTED", TARGET_NOT_FOUND = "TARGET_NOT_FOUND",
            UNSUPPORTED_BY_CLIENT = "UNSUPPORTED_BY_CLIENT", RENDER_FAILED = "RENDER_FAILED";
    }

    // The flow states (mirrors ShadowSpatialContract.States).
    public static class ShadowFlowState
    {
        public const string READY = "READY", QUERYING = "QUERYING", ANSWER_RECEIVED = "ANSWER RECEIVED",
            VALIDATING_ACTION = "VALIDATING ACTION", EXECUTING_ACTION = "EXECUTING ACTION",
            DONE = "DONE", PARTIAL = "PARTIAL", FAILED = "FAILED", UNGROUNDED = "UNGROUNDED";
    }

    [Serializable] public class ShadowActionExecutionResult
    {
        public string requested_action;
        public string target_object_id;
        public string validation_status;
        public string execution_status = ShadowExecStatus.REJECTED;
        public bool visible_result;
        public string error_code;
    }

    // Execution confirmation payload (§5.execution confirmation / §7). Material events only.
    [Serializable] public class ShadowExecutionEvent
    {
        public string session_id, query_id, requested_action, validation_status, execution_status;
        public string target_object_id, error_code, client_platform;
        public bool visible_result;
        public long timestamp;
    }
}
#endif
