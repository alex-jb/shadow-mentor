// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowDeviceDiag.cs
// Process-specific device diagnostics. Every line is prefixed SHADOW_DEVICE_DIAG and carries this
// process's package + PID, so a device log can NEVER again confuse Shadow's Unity process with Nebula's
// Unity space (the candidate-03/04 mis-attribution). Logs once at Start and whenever the XR display/
// input subsystem running-state changes. Core UnityEngine.XR only (no XR Management reference). Logs no
// serials/accounts/secrets.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.XR;

namespace ShadowLens.Workspace
{
    public sealed class ShadowDeviceDiag : MonoBehaviour
    {
        const string P = "SHADOW_DEVICE_DIAG";
        readonly List<XRDisplaySubsystem> _disp = new List<XRDisplaySubsystem>();
        readonly List<XRInputSubsystem> _input = new List<XRInputSubsystem>();
        string _last = "";

        void Start() { Emit("start"); }
        void Update() { var s = State(); if (s != _last) { _last = s; Emit("change"); } }

        string State()
        {
            SubsystemManager.GetSubsystems(_disp);
            SubsystemManager.GetSubsystems(_input);
            int dispRun = 0; foreach (var d in _disp) if (d != null && d.running) dispRun++;
            int inRun = 0; foreach (var i in _input) if (i != null && i.running) inRun++;
            return $"disp={_disp.Count}/{dispRun} in={_input.Count}/{inRun} dev={XRSettings.isDeviceActive}:{XRSettings.loadedDeviceName}";
        }

        void Emit(string why)
        {
            int pid = 0; try { pid = System.Diagnostics.Process.GetCurrentProcess().Id; } catch { }
            var ws = FindObjectsByType<ShadowAuditWorkspace>(FindObjectsSortMode.None);
            var sb = new StringBuilder();
            sb.Append(P).Append(" [").Append(why).Append("] ");
            sb.Append("pkg=").Append(Application.identifier).Append(" pid=").Append(pid);
            sb.Append(" proc=").Append(Application.productName);
            sb.Append(" ver=").Append(Application.version);
            sb.Append(" screen=").Append(Screen.width).Append('x').Append(Screen.height).Append('@').Append(Screen.orientation);
            sb.Append(" displays=").Append(Display.displays.Length);
            sb.Append(" cameras=").Append(Camera.allCamerasCount).Append(" main=").Append(Camera.main != null ? Camera.main.name : "null");
            sb.Append(" workspaceRoots=").Append(ws.Length);
            sb.Append(" | ").Append(State());
            Debug.Log(sb.ToString());
        }
    }
}
#endif
