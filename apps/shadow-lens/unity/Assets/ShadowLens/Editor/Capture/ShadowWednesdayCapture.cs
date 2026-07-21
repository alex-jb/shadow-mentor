// apps/shadow-lens/unity/Assets/ShadowLens/Editor/Capture/ShadowWednesdayCapture.cs
// Editor-only Wednesday demo capture utility. AUTHORED on the operational capture branch —
// NOT run on the build host (no Unity here). Screenshots use the built-in ScreenCapture (no
// package). VIDEO capture requires the official Unity Recorder package (com.unity.recorder),
// which is NOT installed; add it only on this capture branch if video is wanted, then this
// menu will detect it. Never modifies the frozen APK, runtime behavior, or signed fixtures;
// restores scene/editor state after capture.
#if UNITY_EDITOR
using System.Collections;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using ShadowLens.Bootstrap;
using ShadowLens.Narrative;

namespace ShadowLens.EditorTools.Capture
{
    public static class ShadowWednesdayCapture
    {
        const int W = 1280, H = 720;
        static readonly string OutDir = Path.GetFullPath(Path.Combine(Application.dataPath, "../../../../media/wednesday/unity"));
        static readonly string ShotDir = Path.Combine(OutDir, "screenshots");

        // Deterministic capture boundaries — one screenshot per named state.
        static readonly (string name, string action)[] BOUNDARIES = {
            ("01-banking-ready", "reset"),
            ("07-audit-arc-verified", "to-flow"),
            ("09-council-labels", "council"),
            ("10-head-directed-hover", "council"),
            ("11-reset-ready", "reset"),
        };

        [MenuItem("Shadow Lens/Capture Wednesday Demo Media")]
        public static void Capture()
        {
            Directory.CreateDirectory(ShotDir);
            bool recorderPresent = System.Type.GetType("UnityEditor.Recorder.RecorderWindow, Unity.Recorder.Editor") != null;
            var report = new CaptureReport { chromium_na = true, recorder_present = recorderPresent, resolution = W + "x" + H, out_dir = OutDir };

            if (!recorderPresent)
                Debug.LogWarning("[capture] Unity Recorder not installed — will capture SCREENSHOTS only. For video, add com.unity.recorder on this branch and re-run.");

            // set Game View size to 1280x720 (best-effort; Alex confirms the aspect in the editor)
            GameViewSize.Set(W, H);

            EditorApplication.EnterPlaymode();
            EditorApplication.update += Pump;
            _step = 0; _frames = 0; _report = report;
        }

        static int _step, _frames;
        static CaptureReport _report;

        static void Pump()
        {
            if (!EditorApplication.isPlaying) return;         // wait until play mode is live
            if (_frames++ < 30) return;                        // let the scene settle
            _frames = 0;

            var stage = Object.FindFirstObjectByType<ShadowStageController>();
            var boot = Object.FindFirstObjectByType<ShadowLensRuntimeBootstrap>();
            if (stage == null && boot != null) { boot.BuildHierarchy(); stage = boot.Stage; }
            if (stage == null) { Finish("no ShadowStageController found in play mode"); return; }

            if (_step >= BOUNDARIES.Length) { Finish(null); return; }

            var (name, action) = BOUNDARIES[_step];
            switch (action)
            {
                case "reset": stage.ResetDemo(); break;
                case "to-flow": stage.ResetDemo(); stage.InvokeNext(); stage.InvokeNext(); stage.InvokeNext(); stage.InvokeNext(); break;
                case "council": stage.ResetDemo(); stage.InvokeNext(); stage.InvokeNext(); break;
            }
            var path = Path.Combine(ShotDir, name + ".png");
            ScreenCapture.CaptureScreenshot(path);
            _report.screenshots.Add(name + ".png");
            Debug.Log("[capture] " + name + " → " + path + " (honest labels: FIXTURE MODEL · REAL SIGNED · DESKTOP MOCK · DEVICE VALIDATION PENDING)");
            _step++;
        }

        static void Finish(string error)
        {
            EditorApplication.update -= Pump;
            _report.error = error;
            File.WriteAllText(Path.Combine(OutDir, "capture-report.json"), JsonUtility.ToJson(_report, true));
            EditorApplication.ExitPlaymode();
            if (error != null) Debug.LogError("[capture] " + error);
            else Debug.Log("[capture] done — screenshots in " + ShotDir + " · report written. Video: add Unity Recorder for .mp4/.mov.");
        }

        [System.Serializable]
        class CaptureReport { public bool chromium_na, recorder_present; public string resolution, out_dir, error; public System.Collections.Generic.List<string> screenshots = new System.Collections.Generic.List<string>(); }
    }

    // best-effort Game View resolution setter (reflection into GameViewSizes)
    static class GameViewSize
    {
        public static void Set(int w, int h)
        {
            try
            {
                var t = System.Type.GetType("UnityEditor.PlayModeView, UnityEditor") ?? System.Type.GetType("UnityEditor.GameView, UnityEditor");
                if (t == null) return;
                var win = EditorWindow.GetWindow(t);
                var m = t.GetMethod("SetCustomResolution", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                m?.Invoke(win, new object[] { new Vector2(w, h), "ShadowWednesday" });
            }
            catch (System.Exception e) { Debug.LogWarning("[capture] could not force 1280x720 Game View: " + e.Message + " — set it manually."); }
        }
    }
}
#endif
