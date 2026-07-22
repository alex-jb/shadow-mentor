// apps/shadow-lens/unity/Assets/ShadowLens/Input/ShadowInputRouter.cs
// Routes canonical actions from any number of sources to the app, enforcing interaction safety:
//   - hover / head-direction / dwell can only produce Focus (never Select/Confirm/approve);
//   - destructive actions (Reset) require a SEPARATE explicit Confirm — a single click/dwell cannot
//     trigger them; Back/Cancel clear a pending confirmation; Back/Cancel/Recenter are always allowed.
// Pure C# so it is EditMode-testable without input hardware; concrete sources feed it actions. SOURCE AUTHORED.
using System;
using System.Collections.Generic;

namespace ShadowLens.InputV5
{
    public interface IShadowInputSink
    {
        void Dispatch(ShadowInputAction action);
    }

    public sealed class ShadowInputRouter
    {
        readonly IShadowInputSink _sink;
        readonly ShadowInputDiagnostics _diag;
        ShadowInputAction? _pendingConfirm;

        public ShadowInputRouter(IShadowInputSink sink, ShadowInputDiagnostics diag = null)
        {
            _sink = sink ?? throw new ArgumentNullException(nameof(sink));
            _diag = diag ?? new ShadowInputDiagnostics();
        }

        public ShadowInputAction? PendingConfirmation => _pendingConfirm;

        // A passive channel (hover/head/dwell) may only submit Focus. Anything else is dropped + logged.
        public void SubmitPassive(ShadowInputAction produced)
        {
            if (!ShadowInputSafety.IsPassiveFocusOnly(produced))
            {
                _diag.Record("blocked", "passive channel tried " + produced);
                return;
            }
            _diag.Record("focus", "passive Focus");
            _sink.Dispatch(ShadowInputAction.Focus);
        }

        // An active channel (explicit click / button / key). Applies confirmation gating.
        public void Submit(ShadowInputAction action)
        {
            // A pending destructive confirmation is resolved only by Confirm; Back/Cancel abort it.
            if (_pendingConfirm.HasValue)
            {
                if (action == ShadowInputAction.Confirm)
                {
                    var pending = _pendingConfirm.Value;
                    _pendingConfirm = null;
                    _diag.Record("confirm", "confirmed " + pending);
                    _sink.Dispatch(pending);
                    return;
                }
                if (action == ShadowInputAction.Back || action == ShadowInputAction.Cancel)
                {
                    _diag.Record("cancel", "aborted pending " + _pendingConfirm.Value);
                    _pendingConfirm = null;
                    _sink.Dispatch(action);   // Back/Cancel are always reachable
                    return;
                }
                // Any other action while a confirmation is pending is ignored (prevents accidental approval).
                _diag.Record("ignored", "action " + action + " while confirmation pending");
                return;
            }

            if (ShadowInputSafety.RequiresConfirmation(action))
            {
                _pendingConfirm = action;
                _diag.Record("request-confirm", "armed " + action);
                return;   // do NOT dispatch yet — wait for explicit Confirm
            }

            // A bare Confirm with nothing pending is a no-op (confirmation is meaningful only after a request).
            if (action == ShadowInputAction.Confirm)
            {
                _diag.Record("noop", "Confirm with nothing pending");
                return;
            }

            _diag.Record("action", action.ToString());
            _sink.Dispatch(action);
        }

        public IReadOnlyList<ShadowDiagnosticInputEvent> Diagnostics() => _diag.Snapshot();
    }
}
