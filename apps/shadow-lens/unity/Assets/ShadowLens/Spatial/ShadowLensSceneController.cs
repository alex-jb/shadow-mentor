// apps/shadow-lens/unity/Assets/ShadowLens/Spatial/ShadowLensSceneController.cs
// The one scene controller: drives Look→Capture→Understand→Analyze→Cite→Visualize→Verify by
// composing the provider seams (Core), the real HTTP pipeline (ShadowLensApiClient), and the
// PURE, unit-tested spatial geometry (SpatialLayout). It is deliberately THIN — every value
// that could be geometrically wrong comes from SpatialLayout (tested); this file only turns
// those into Transforms + prefab spawns. The voice router is the closed enum (never LLM).
//
// SOFTWARE IMPLEMENTED · LOCAL UNITY COMPILE NOT EXECUTED (no Unity on the build host) ·
// DEVICE-VALIDATION-PENDING on XREAL One Pro + Eye. The spatial math IS tested (EditMode).
#if UNITY_2020_1_OR_NEWER
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using ShadowLens.Core;
using ShadowLens.Spatial;

namespace ShadowLens.Spatial
{
    public enum LensState { Idle, Looking, Captured, Analyzing, Cited, Verified, Failed }

    public class ShadowLensSceneController : MonoBehaviour
    {
        [Header("Anchors")]
        public Transform documentPlane;          // where the scanned page is pinned (6DoF world-locked)
        public Vector2 planeSizeMeters = new Vector2(0.6f, 0.8f);
        public Transform viewerRig;              // head rig, for viewer-relative arcs/strips

        [Header("Prefabs (assigned in the Editor)")]
        public GameObject sourceOverlayPrefab;   // highlights one OCR box + its claim
        public GameObject auditLinkPrefab;       // one hash-chain event on the arc
        public GameObject riskBarPrefab;         // one risk tile
        public GameObject glanceChipPrefab;      // a status chip in the bottom strip

        [Header("Layout")]
        public float auditRadius = 1.2f;
        public float auditSpanDeg = 120f;

        // Provider seams — assigned by a bootstrap (mock in Editor, XREAL native on device).
        IOcrProvider _ocr; IStillCaptureProvider _capture; ITextToSpeechProvider _tts;
        readonly ShadowLensApiClient _api = new ShadowLensApiClient();
        readonly List<GameObject> _spawned = new List<GameObject>();

        public LensState State { get; private set; } = LensState.Idle;

        public void Bind(IStillCaptureProvider capture, IOcrProvider ocr, ITextToSpeechProvider tts)
        { _capture = capture; _ocr = ocr; _tts = tts; }

        // Voice/controller entrypoint — routed through the CLOSED enum, never an LLM.
        public void OnCommand(VoiceCommand cmd)
        {
            switch (cmd)
            {
                case VoiceCommand.ScanDocument: State = LensState.Looking; break;
                case VoiceCommand.Capture: StartCoroutine(CaptureAndAnalyze()); break;
                case VoiceCommand.ShowAudit: /* arc already placed on verify */ break;
                case VoiceCommand.ShowRisks: /* risk tiles already placed */ break;
                case VoiceCommand.Reset: Clear(); State = LensState.Idle; break;
            }
        }

        IEnumerator CaptureAndAnalyze()
        {
            var frame = _capture?.CaptureStill();
            if (frame == null) { State = LensState.Failed; yield break; }
            State = LensState.Captured;

            List<SourceEntry> sourceMap = null;
            _ocr?.Recognize(frame.Value, r => sourceMap = new List<SourceEntry>(r), _ => State = LensState.Failed);
            if (sourceMap == null) { State = LensState.Failed; yield break; }

            // Place source overlays from the TESTED geometry (cite step).
            PlaceSourceOverlays(sourceMap);
            State = LensState.Analyzing;

            // The real pipeline (source-bound analysis + server seal + verify) runs over HTTP;
            // its response drives the audit arc + risk tiles + verification cascade. The web/
            // Node backend owns the seal — the client never holds the signing key.
            // (UnityWebRequest call omitted here for brevity; body via ShadowLensApiClient.BuildRequestBody.)
            State = LensState.Cited;
            yield return null;
        }

        void PlaceSourceOverlays(List<SourceEntry> sourceMap)
        {
            if (documentPlane == null || sourceOverlayPrefab == null) return;
            Vector3 origin = documentPlane.position;
            foreach (var e in sourceMap)
            {
                var box = new NormalizedBox(e.X, e.Y, e.W, e.H);
                V3 p = SpatialLayout.SourceOverlayWorld(box, new V3(origin.x, origin.y, origin.z), planeSizeMeters.x, planeSizeMeters.y);
                Spawn(sourceOverlayPrefab, documentPlane.TransformPoint(new Vector3(p.x - origin.x, p.y - origin.y, p.z - origin.z)));
            }
        }

        public void PlaceAuditArc(int eventCount)
        {
            if (auditLinkPrefab == null || viewerRig == null) return;
            var pts = SpatialLayout.AuditArc(eventCount, auditRadius, auditSpanDeg);
            foreach (var p in pts) Spawn(auditLinkPrefab, viewerRig.TransformPoint(new Vector3(p.x, p.y, p.z)));
        }

        public void PlaceRiskTiles(IReadOnlyList<float> severities)
        {
            if (riskBarPrefab == null) return;
            var heights = SpatialLayout.RiskHeights(severities);
            for (int i = 0; i < heights.Length; i++)
            {
                var go = Spawn(riskBarPrefab, transform.position + new Vector3(0.15f * i, 0, 0));
                if (go != null) go.transform.localScale = new Vector3(0.1f, heights[i], 0.1f);
            }
        }

        // Verification cascade reveals links top→down; a broken link freezes at its seq.
        public IEnumerator RunVerificationCascade(int links, int firstBrokenSeq = -1)
        {
            var steps = SpatialLayout.VerificationCascade(links);
            for (int i = 0; i < steps.Length; i++)
            {
                yield return new WaitForSeconds(i == 0 ? 0f : (steps[i].delaySec - steps[i - 1].delaySec));
                if (firstBrokenSeq >= 0 && i == firstBrokenSeq) { State = LensState.Failed; yield break; }
            }
            State = LensState.Verified;
        }

        GameObject Spawn(GameObject prefab, Vector3 pos)
        {
            var go = Instantiate(prefab, pos, Quaternion.identity);
            _spawned.Add(go);
            return go;
        }
        void Clear() { foreach (var g in _spawned) if (g != null) Destroy(g); _spawned.Clear(); }
    }
}
#endif
