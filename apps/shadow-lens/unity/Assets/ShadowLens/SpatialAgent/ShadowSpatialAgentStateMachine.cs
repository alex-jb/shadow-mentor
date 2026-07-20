// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialAgentStateMachine.cs
// The flow states + legal transitions, mirroring the tested web ShadowSpatialApp:
// READY → QUERYING → ANSWER_RECEIVED → VALIDATING_ACTION → EXECUTING_ACTION → DONE/PARTIAL/FAILED,
// plus UNGROUNDED and FAILED. Pure → EditMode testable. SOURCE AUTHORED · UNITY COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
using System;
using System.Collections.Generic;

namespace ShadowLens.SpatialAgent
{
    public class ShadowSpatialAgentStateMachine
    {
        public string State { get; private set; } = ShadowFlowState.READY;
        public event Action<string> OnState;

        static readonly Dictionary<string, string[]> Allowed = new Dictionary<string, string[]> {
            { ShadowFlowState.READY, new[] { ShadowFlowState.QUERYING } },
            { ShadowFlowState.QUERYING, new[] { ShadowFlowState.ANSWER_RECEIVED, ShadowFlowState.FAILED } },
            { ShadowFlowState.ANSWER_RECEIVED, new[] { ShadowFlowState.VALIDATING_ACTION, ShadowFlowState.UNGROUNDED } },
            { ShadowFlowState.VALIDATING_ACTION, new[] { ShadowFlowState.EXECUTING_ACTION } },
            { ShadowFlowState.EXECUTING_ACTION, new[] { ShadowFlowState.DONE, ShadowFlowState.PARTIAL, ShadowFlowState.FAILED } },
            { ShadowFlowState.DONE, new[] { ShadowFlowState.READY } },
            { ShadowFlowState.PARTIAL, new[] { ShadowFlowState.READY } },
            { ShadowFlowState.FAILED, new[] { ShadowFlowState.READY } },
            { ShadowFlowState.UNGROUNDED, new[] { ShadowFlowState.READY } },
        };

        public bool CanGo(string to) => Allowed.TryGetValue(State, out var outs) && Array.IndexOf(outs, to) >= 0;

        public void Go(string to)
        {
            if (!CanGo(to)) throw new InvalidOperationException($"illegal transition {State} -> {to}");
            State = to; OnState?.Invoke(to);
        }
        public void Reset() { State = ShadowFlowState.READY; OnState?.Invoke(State); }
    }
}
#endif
