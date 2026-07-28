// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowActionExecutionReporter.cs
// §5/§7 — builds MATERIAL execution-confirmation events from execution results. Records only
// material actions (never continuous camera/gaze/mouse telemetry). Pure builder → EditMode
// testable; posting is a Gate-2 concern. SOURCE AUTHORED · UNITY COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;

namespace ShadowLens.SpatialAgent
{
    public class ShadowActionExecutionReporter
    {
        public string Platform = "unity";
        public System.Func<long> Now = () => 0;

        public List<ShadowExecutionEvent> Build(string sessionId, string queryId, List<ShadowActionExecutionResult> records)
        {
            var events = new List<ShadowExecutionEvent>();
            if (records == null) return events;
            foreach (var r in records)
            {
                if (string.IsNullOrEmpty(r.requested_action) || r.requested_action == "?") continue; // drop non-material
                events.Add(new ShadowExecutionEvent {
                    session_id = sessionId, query_id = queryId, requested_action = r.requested_action,
                    validation_status = r.validation_status, execution_status = r.execution_status,
                    target_object_id = r.target_object_id, visible_result = r.visible_result,
                    error_code = r.error_code, client_platform = Platform, timestamp = Now(),
                });
            }
            return events;
        }

        // Gate 1: build only (no network). Gate 2 will POST to /api/shadow-lens/execution-events.
        public List<ShadowExecutionEvent> Report(string sessionId, string queryId, List<ShadowActionExecutionResult> records)
            => Build(sessionId, queryId, records);
    }
}
#endif
