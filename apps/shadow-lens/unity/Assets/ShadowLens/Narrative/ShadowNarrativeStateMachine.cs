// apps/shadow-lens/unity/Assets/ShadowLens/Narrative/ShadowNarrativeStateMachine.cs
// The 2-minute banking decision narrative: READY → CASE → COUNCIL → DECISION → FLOW_OR_AUDIT.
// Next steps forward; Back steps toward READY (never below); Reset returns to READY (Banking) from
// ANY state. Pure (no UnityEngine) → EditMode testable. SOURCE AUTHORED · compiled in Unity 6.
#if UNITY_2020_1_OR_NEWER
using System;

namespace ShadowLens.Narrative
{
    public static class ShadowNarrativeState
    {
        public const string READY = "READY", CASE = "CASE", COUNCIL = "COUNCIL",
            DECISION = "DECISION", FLOW_OR_AUDIT = "FLOW_OR_AUDIT";
        public static readonly string[] Order = { READY, CASE, COUNCIL, DECISION, FLOW_OR_AUDIT };
    }

    public class ShadowNarrativeStateMachine
    {
        int _i = 0; // index into ShadowNarrativeState.Order
        public string State => ShadowNarrativeState.Order[_i];
        public event Action<string> OnState;

        public bool CanNext => _i < ShadowNarrativeState.Order.Length - 1;
        public bool CanBack => _i > 0;
        public bool IsFlowOrAudit => State == ShadowNarrativeState.FLOW_OR_AUDIT;

        public void Next() { if (CanNext) { _i++; OnState?.Invoke(State); } }
        public void Back() { if (CanBack) { _i--; OnState?.Invoke(State); } }

        // Reset returns to Banking READY from ANY state — the one-tap presenter reset.
        public void Reset() { _i = 0; OnState?.Invoke(State); }

        // Jump to a named state (for tests / deep-linking). Throws on an unknown state.
        public void GoTo(string state)
        {
            int idx = Array.IndexOf(ShadowNarrativeState.Order, state);
            if (idx < 0) throw new ArgumentException("unknown narrative state " + state);
            _i = idx; OnState?.Invoke(State);
        }
    }
}
#endif
