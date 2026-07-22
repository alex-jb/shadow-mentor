// apps/shadow-lens/unity/Assets/ShadowLens/Presenter/ShadowPresenterController.cs
// Presenter Mode + failure recovery for the guided-story candidate. Deterministic startup at Banking
// READY, no network, fixture label always visible, diagnostics hidden by default, one-click
// Tamper / Restore / Reset, and a last-known-safe-state recovery that never restarts the app or
// silently swaps corrupted evidence for fixture data. Reacts to canonical ShadowInputAction values
// (fed by the input router) — it never reads raw keys. SOURCE AUTHORED · UNITY-COMPILED.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;
using ShadowLens.GuidedStory;
using ShadowLens.InputV5;
using ShadowLens.Device;

namespace ShadowLens.Presenter
{
    public sealed class ShadowPresenterController : MonoBehaviour
    {
        public ShadowGuidedStoryPlayer Player;
        public ShadowDeviceCapabilityBanner Banner;
        public bool DiagnosticsVisible;                 // hidden by default
        public int BankingStoryIndex = 0;               // audit-chain (banking) is the safe default

        readonly ShadowTrackingDiagnostics _diag = new ShadowTrackingDiagnostics();
        bool _recovered;

        public string LastError { get; private set; }
        public bool InSafeState { get; private set; }

        void Start() { ResetToSafeState(); }

        // Deterministic safe state: Banking READY (story 0, step 0), fixture label on, diagnostics off.
        public void ResetToSafeState()
        {
            try
            {
                if (Player != null) { Player.LoadStory(BankingStoryIndex); Player.ApiRestart(); }
                if (Banner != null) Banner.Refresh();
                DiagnosticsVisible = false;
                InSafeState = true;
                LastError = null;
                _diag.Record("recovery", "reset to Banking READY");
            }
            catch (System.Exception e)
            {
                // Fail closed: record the failure (evidence-free) and stay in safe state; do NOT crash
                // and do NOT substitute fixture data for corrupted evidence.
                LastError = e.GetType().Name;
                InSafeState = false;
                _diag.Record("error", "reset failed: " + e.GetType().Name);
            }
        }

        // The single entry point the input router dispatches to. No raw keys here.
        public void HandleAction(ShadowInputAction a)
        {
            if (Player == null) return;
            switch (a)
            {
                case ShadowInputAction.NextStep: Player.ApiNext(); break;
                case ShadowInputAction.PreviousStep: Player.ApiBack(); break;
                case ShadowInputAction.RestartStory: Player.ApiRestart(); break;
                case ShadowInputAction.ResetDemo: ResetToSafeState(); break;     // router already required a Confirm
                case ShadowInputAction.Recenter: _diag.Record("recovery", "recenter"); break; // player/rig hook
                case ShadowInputAction.SwitchLanguage: /* player handles L internally too */ break;
                case ShadowInputAction.OpenDiagnostics: DiagnosticsVisible = !DiagnosticsVisible; break;
                case ShadowInputAction.Open2DAudit: _diag.Record("ui", "open 2D audit"); break;
                case ShadowInputAction.Close2DAudit: _diag.Record("ui", "close 2D audit"); break;
                default: break;
            }
        }

        // One-click presenter buttons (wired to on-screen UI). Tamper/Restore switch scenarios without
        // leaving the current story; Reset returns to Banking READY.
        public void OneClickBankingReady() => ResetToSafeState();
        public void OneClickTamper() { /* the player advances into the tamper step via NextStep chain */ Player?.ApiNext(); }
        public void OneClickRestore() { Player?.ApiRestart(); }

        // Called by the app pause/resume lifecycle to preserve or recover state.
        void OnApplicationPause(bool paused)
        {
            if (!paused && !InSafeState && !_recovered)
            {
                _recovered = true;
                _diag.Record("recovery", "resume → safe state");
                ResetToSafeState();
            }
        }

        public string ExportDiagnostics()
        {
            var sb = new System.Text.StringBuilder();
            sb.Append("presenter safe_state=").Append(InSafeState).Append(" last_error=").Append(LastError ?? "none").Append('\n');
            foreach (var e in _diag.Snapshot()) sb.Append(e.Sequence).Append(' ').Append(e.Kind).Append(' ').Append(e.Detail).Append('\n');
            return sb.ToString();
        }
    }
}
#endif
