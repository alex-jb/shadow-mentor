// apps/shadow-lens/unity/Assets/ShadowLens/Narrative/ShadowStageController.cs
// The guided 2-minute banking experience: one central semantic 3D map (case + 5 council voices) with
// sparse world-space UI — council status (left), decision/evidence card (right), stage controls
// (bottom: Back · Next Step · Explore in Flow · Reset Demo). Narrative: READY→CASE→COUNCIL→DECISION→
// FLOW_OR_AUDIT, one dominant voice at a time, Reset from ANY state → Banking READY. Pointer/touch
// only (no keyboard). Deterministic + offline; Flow is prepared via the OFFLINE presenter (no network).
// SOURCE AUTHORED · compiled in Unity 6. No SHADOW_XREAL_SDK; no Eye/6DoF/RGB claims.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using ShadowLens.Design;
using ShadowLens.Spatial;
using ShadowLens.Flow;

namespace ShadowLens.Narrative
{
    [DisallowMultipleComponent]
    public class ShadowStageController : MonoBehaviour
    {
        readonly ShadowNarrativeStateMachine _sm = new ShadowNarrativeStateMachine();
        readonly IShadowFlowPresenter _flow = new ShadowOfflineFlowPresenter();

        Font _font;
        Text _title, _mode, _signed, _stateLabel, _council, _decision, _flowCard, _caseCoreLabel;
        Transform _worldRoot, _nodesRoot;
        Image _caseNode;
        readonly List<GameObject> _voiceNodes = new List<GameObject>();
        readonly List<Text> _voiceLabels = new List<Text>();   // flat camera-facing perspective labels
        Transform _auditRoot;                                  // 3D provenance arc (built once in FLOW_OR_AUDIT)
        int _auditVerified;                                    // links rendered VERIFIED (before any break)
        Vector3 _camForward = Vector3.forward;                 // captured once (fixed viewpoint) for static labels
        int _dominant = 1;               // default dominant = Risk Officer (highest relevance)
        bool _built;
        ShadowFlowHandoff _handoff;
        System.Action<string> _onStateHandler;

        // ── test accessors ──
        public string State => _sm.State;
        public int DominantVoiceIndex => _dominant;
        public int VisibleVoiceNodeCount { get { int n = 0; foreach (var g in _voiceNodes) if (g && g.activeInHierarchy) n++; return n; } }
        public string CouncilText => _council ? _council.text : "";
        public string DecisionText => _decision ? _decision.text : "";
        public bool FlowHandoffPrepared => _handoff.prepared;
        public bool FlowNetworkUsed => _handoff.networkUsed;
        public bool HonestyLabelsVisible => _mode && _mode.text.Contains("FIXTURE MODEL") && _signed && _signed.text.Contains("REAL SIGNED");
        public string CaseCoreText => _caseCoreLabel ? _caseCoreLabel.text : "";
        public int VoiceLabelCount => _voiceLabels.Count;
        public string VoiceLabelText(int i) => (i >= 0 && i < _voiceLabels.Count && _voiceLabels[i]) ? _voiceLabels[i].text : "";
        public int AuditChainNodeCount => ShadowAuditChainData.Chain.Length;
        public int AuditChainVerifiedCount => _auditVerified;
        public bool AuditChainBuilt => _auditRoot != null;
        public ShadowLens.Spatial.ShadowHeadDirectedFocus Focus { get; private set; }

        void Awake() { Build(); }

        public void Build()
        {
            if (_built) return;
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var canvasGo = new GameObject("ShadowStageHUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform, false);
            canvasGo.GetComponent<Canvas>().renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.GetComponent<CanvasScaler>(); scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; scaler.referenceResolution = new Vector2(1600, 900);
            var c = canvasGo.transform;

            _title = Label(c, "SHADOW LENS — banking decision", 26, new Vector2(0, 1), new Vector2(16, -14), ShadowDesignTokens.TextPrimary, TextAnchor.UpperLeft);
            _mode = Label(c, "FIXTURE MODEL", 16, new Vector2(1, 1), new Vector2(-16, -14), ShadowDesignTokens.Warning, TextAnchor.UpperRight);
            _signed = Label(c, "REAL SIGNED", 16, new Vector2(1, 1), new Vector2(-16, -40), ShadowDesignTokens.Verified, TextAnchor.UpperRight);
            _stateLabel = Label(c, "", 14, new Vector2(0.5f, 1), new Vector2(0, -14), ShadowDesignTokens.Information, TextAnchor.UpperCenter);

            // left: council status
            var left = Panel(c, new Vector2(0.015f, 0.30f), new Vector2(0.26f, 0.80f));
            _council = Label(left.transform, "", 18, new Vector2(0, 1), new Vector2(12, -12), ShadowDesignTokens.TextPrimary, TextAnchor.UpperLeft);
            _council.rectTransform.sizeDelta = new Vector2(360, 340);
            // right: decision / evidence card
            var right = Panel(c, new Vector2(0.62f, 0.30f), new Vector2(0.985f, 0.80f));
            _decision = Label(right.transform, "", 18, new Vector2(0, 1), new Vector2(12, -12), ShadowDesignTokens.TextPrimary, TextAnchor.UpperLeft);
            _decision.rectTransform.sizeDelta = new Vector2(380, 340);
            _flowCard = Label(right.transform, "", 15, new Vector2(0, 0), new Vector2(12, 12), ShadowDesignTokens.TextSecondary, TextAnchor.LowerLeft);
            _flowCard.rectTransform.sizeDelta = new Vector2(380, 90);

            // bottom: stage controls (Next Step is primary)
            StageButton(c, "Back", 0.34f, ShadowDesignTokens.PanelSecondary, () => { _sm.Back(); Render(); });
            StageButton(c, "Next Step", 0.46f, ShadowDesignTokens.Information, () => { _sm.Next(); Render(); });
            StageButton(c, "Explore in Flow", 0.585f, ShadowDesignTokens.PanelSecondary, ExploreInFlow);
            StageButton(c, "⟲ Reset Demo", 0.74f, ShadowDesignTokens.Warning, ResetDemo);

            BuildWorld();
            // head-directed hover (NOT eye tracking); hover/highlight only, never approves
            Focus = GetComponent<ShadowHeadDirectedFocus>() ?? gameObject.AddComponent<ShadowHeadDirectedFocus>();
            _built = true;
            _onStateHandler = (_) => Render();   // stored so it registers ONCE + can be removed
            _sm.OnState += _onStateHandler;
            _sm.Reset();
            Render();
        }

        void OnDestroy() { if (_onStateHandler != null) { _sm.OnState -= _onStateHandler; _onStateHandler = null; } }

        void BuildWorld()
        {
            var cam = Camera.main;
            var camForward = cam != null ? cam.transform.forward : Vector3.forward;
            _camForward = camForward;
            var center = cam != null ? cam.transform.position + camForward * 1.9f : new Vector3(0, 1.5f, -1.9f);
            _worldRoot = new GameObject("StageWorld").transform; _worldRoot.SetParent(transform, false); _worldRoot.position = center;
            _nodesRoot = new GameObject("Nodes").transform; _nodesRoot.SetParent(_worldRoot, false);
            _caseNode = null;
            BuildCaseCore(_worldRoot, camForward);   // the semantic center: a legible banking-case core (label + ring), not a bare sphere

            var v0 = new V3(0, 0, 0);
            for (int i = 0; i < ShadowBankingNarrativeData.Voices.Length; i++)
            {
                var voice = ShadowBankingNarrativeData.Voices[i];
                var p = ShadowSemanticEncoding.VoicePosition(i, ShadowBankingNarrativeData.Voices.Length, voice.relevance, v0, 0f);
                var node = GameObject.CreatePrimitive(PrimitiveType.Sphere); node.name = "Voice_" + voice.voice; node.transform.SetParent(_nodesRoot, false);
                node.transform.localPosition = new Vector3(p.x, p.y, p.z);
                float size = ShadowSemanticEncoding.NodeSize(voice.importance);
                node.transform.localScale = Vector3.one * size * 2f;
                _voiceNodes.Add(node);

                // flat, camera-facing perspective label (voice name + vote) — so the 5 spheres are
                // readable topology, not anonymous balls. One dominant at a time is handled in Render.
                var lbl = FlatWorldLabel(node.transform, voice.voice + "\n(" + voice.vote + ")",
                    new Vector3(0f, -(size + 0.05f), 0f), camForward, 0.0009f, 26, new Vector2(300, 90));
                _voiceLabels.Add(lbl);
            }
        }

        // A small, flat, camera-facing world-space label (Perplexity-pill style). Static: oriented
        // once toward the fixed viewpoint, no per-frame billboard, no decorative motion.
        Text FlatWorldLabel(Transform parent, string text, Vector3 localPos, Vector3 camForward, float worldScale, int fontSize, Vector2 size)
        {
            var go = new GameObject("Label", typeof(Canvas)); go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.rotation = Quaternion.LookRotation(camForward);
            go.GetComponent<Canvas>().renderMode = RenderMode.WorldSpace;
            ((RectTransform)go.transform).sizeDelta = size;
            go.transform.localScale = Vector3.one * worldScale;
            var bg = new GameObject("Backing", typeof(Image)); bg.transform.SetParent(go.transform, false);
            bg.GetComponent<Image>().color = ShadowDesignTokens.PanelPrimary;
            var brt = bg.GetComponent<Image>().rectTransform; brt.anchorMin = Vector2.zero; brt.anchorMax = Vector2.one; brt.offsetMin = brt.offsetMax = Vector2.zero;
            return Label(go.transform, text, fontSize, new Vector2(0.5f, 0.5f), Vector2.zero, ShadowDesignTokens.TextPrimary, TextAnchor.MiddleCenter);
        }

        // ── the 3D provenance audit arc (Rule 15: the one thing that genuinely earns its 3D) ──
        // Built once when the stage first enters FLOW_OR_AUDIT. Walks the provenance spine
        // (ShadowAuditChainData, mirrored from the Claim-Evidence Graph): source → … → audit_record.
        // Nodes at/after a broken link render NOT VERIFIED (frozen). STATIC verification state — the
        // cascade timing is data (CascadeDelaysSec) applied on device, not a coroutine here.
        void BuildAuditChain(Vector3 camForward)
        {
            if (_auditRoot != null) return;   // idempotent: one arc only
            var chain = ShadowAuditChainData.Chain;
            _auditRoot = new GameObject("AuditChain").transform; _auditRoot.SetParent(_worldRoot, false);
            var pts = SpatialLayout.AuditArc(chain.Length, 0.9f, 120f, 0f, -0.35f); // below the council plane

            var lr = new GameObject("ChainLink", typeof(LineRenderer)).GetComponent<LineRenderer>();
            lr.transform.SetParent(_auditRoot, false);
            lr.useWorldSpace = false; lr.widthMultiplier = 0.015f; lr.numCapVertices = 2;
            lr.material = SharedLineMaterial();
            lr.positionCount = chain.Length;

            _auditVerified = 0;
            for (int i = 0; i < chain.Length; i++)
            {
                var wp = new Vector3(pts[i].x, pts[i].y, pts[i].z);
                lr.SetPosition(i, wp);
                bool verified = ShadowAuditChainData.IsVerified(i);
                if (verified) _auditVerified++;
                var pill = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                pill.name = "Link_" + chain[i].seq + "_" + chain[i].type;
                pill.transform.SetParent(_auditRoot, false); pill.transform.localPosition = wp; pill.transform.localScale = Vector3.one * 0.06f;
                var rr = pill.GetComponent<Renderer>(); if (rr) rr.material.color = verified ? ShadowDesignTokens.Verified : ShadowDesignTokens.Tampered;
                string tag = verified ? chain[i].hashPrefix : "NOT VERIFIED";
                FlatWorldLabel(pill.transform, chain[i].label + "\n" + tag, new Vector3(0f, -0.09f, 0f), camForward, 0.0007f, 22, new Vector2(260, 80));
            }
            // link color: green up to the break, red from the break onward
            lr.startColor = ShadowDesignTokens.Verified;
            lr.endColor = ShadowAuditChainData.BrokenAtSeq < 0 ? ShadowDesignTokens.Verified : ShadowDesignTokens.Tampered;
        }

        // V11: both LineRenderers (audit chain + case ring) use the same plain Sprites/Default shader and
        // get their colour from LineRenderer.startColor/endColor (never material.color), so one shared
        // material instance is safe — avoids a redundant Material + a second Shader.Find string lookup.
        Material _sharedLineMat;
        Material SharedLineMaterial() => _sharedLineMat != null ? _sharedLineMat : (_sharedLineMat = new Material(Shader.Find("Sprites/Default")));

        // The semantic center = the banking case identity, legible as a "case core": a restrained core
        // sphere + ONE static containment ring + a 3-line world-space label (title / number / amount).
        // Everything is placed once — no Update loop, no coroutine, no continuous decorative animation.
        void BuildCaseCore(Transform worldRoot, Vector3 camForward)
        {
            var caseGo = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            caseGo.name = "CaseNode"; caseGo.transform.SetParent(worldRoot, false);
            caseGo.transform.localPosition = Vector3.zero;
            caseGo.transform.localScale = Vector3.one * 0.16f;   // slightly smaller so the ring + label read as the case
            var r = caseGo.GetComponent<Renderer>(); if (r) r.material.color = ShadowDesignTokens.Information;

            // one static containment ring, face-on to the (fixed) camera — reads as a data node, not a plain ball
            var ringGo = new GameObject("CaseRing", typeof(LineRenderer)); ringGo.transform.SetParent(caseGo.transform, false);
            var lr = ringGo.GetComponent<LineRenderer>();
            lr.useWorldSpace = false; lr.loop = true; lr.widthMultiplier = 0.05f; lr.numCapVertices = 2;
            lr.material = SharedLineMaterial();
            lr.startColor = lr.endColor = ShadowDesignTokens.Border;
            var right = Vector3.Cross(camForward, Vector3.up).normalized; if (right.sqrMagnitude < 1e-4f) right = Vector3.right;
            var up = Vector3.Cross(right, camForward).normalized;
            const int seg = 48; lr.positionCount = seg;
            for (int i = 0; i < seg; i++)
            {
                float a = (i / (float)seg) * Mathf.PI * 2f;
                lr.SetPosition(i, (right * Mathf.Cos(a) + up * Mathf.Sin(a)) * 1.5f);  // local units (core scale 0.16)
            }

            // 3-line world-space label under the core: MID-MARKET LOAN / CASE #SL-2026-014 / $8.4M REQUEST
            var labelGo = new GameObject("CaseCoreLabel", typeof(Canvas)); labelGo.transform.SetParent(worldRoot, false);
            labelGo.transform.localPosition = new Vector3(0f, -0.27f, 0f);
            labelGo.transform.rotation = Quaternion.LookRotation(camForward);   // static — set once, no billboard loop
            labelGo.GetComponent<Canvas>().renderMode = RenderMode.WorldSpace;
            ((RectTransform)labelGo.transform).sizeDelta = new Vector2(440, 150);
            labelGo.transform.localScale = Vector3.one * 0.0011f;

            var bg = new GameObject("Backing", typeof(Image)); bg.transform.SetParent(labelGo.transform, false);
            bg.GetComponent<Image>().color = ShadowDesignTokens.PanelPrimary;
            var brt = bg.GetComponent<Image>().rectTransform; brt.anchorMin = Vector2.zero; brt.anchorMax = Vector2.one; brt.offsetMin = brt.offsetMax = Vector2.zero;
            bg.AddComponent<Outline>().effectColor = ShadowDesignTokens.Border;

            _caseCoreLabel = Label(labelGo.transform,
                ShadowBankingNarrativeData.CaseTitle + "\n" + ShadowBankingNarrativeData.CaseNumber + "\n" + ShadowBankingNarrativeData.CaseAmount,
                34, new Vector2(0.5f, 0.5f), Vector2.zero, ShadowDesignTokens.TextPrimary, TextAnchor.MiddleCenter);
            _caseCoreLabel.rectTransform.sizeDelta = new Vector2(420, 140);
        }

        // ── narrative rendering (idempotent — no duplicate panels, no stale dominant) ──
        void Render()
        {
            _stateLabel.text = _sm.State;
            bool showVoices = _sm.State == ShadowNarrativeState.COUNCIL || _sm.State == ShadowNarrativeState.DECISION || _sm.State == ShadowNarrativeState.FLOW_OR_AUDIT;
            for (int i = 0; i < _voiceNodes.Count; i++)
            {
                if (_voiceNodes[i]) _voiceNodes[i].SetActive(showVoices);
                var rr = _voiceNodes[i] ? _voiceNodes[i].GetComponent<Renderer>() : null;
                if (rr) rr.material.color = (i == _dominant && _sm.State == ShadowNarrativeState.COUNCIL) ? ShadowDesignTokens.Information : ShadowDesignTokens.Neutral;
                // flat perspective labels follow their node; dominant is emphasized in COUNCIL
                if (i < _voiceLabels.Count && _voiceLabels[i])
                {
                    _voiceLabels[i].transform.parent.gameObject.SetActive(showVoices);
                    _voiceLabels[i].color = (i == _dominant && _sm.State == ShadowNarrativeState.COUNCIL) ? ShadowDesignTokens.TextPrimary : ShadowDesignTokens.TextSecondary;
                }
            }
            // the 3D provenance arc lives only in FLOW_OR_AUDIT (built once, then shown/hidden)
            if (_sm.State == ShadowNarrativeState.FLOW_OR_AUDIT) BuildAuditChain(_camForward);
            if (_auditRoot) _auditRoot.gameObject.SetActive(_sm.State == ShadowNarrativeState.FLOW_OR_AUDIT);

            switch (_sm.State)
            {
                case ShadowNarrativeState.READY:
                    _council.text = "Ready."; _decision.text = "Banking decision · " + ShadowBankingNarrativeData.CaseLabel; _flowCard.text = ""; break;
                case ShadowNarrativeState.CASE:
                    _council.text = "Case: " + ShadowBankingNarrativeData.CaseLabel;
                    _decision.text = "DTI 0.41 · FICO 706 · LTV 0.83"; _flowCard.text = ""; break;
                case ShadowNarrativeState.COUNCIL:
                    var v = ShadowBankingNarrativeData.Voices[_dominant];
                    // persona prior, NOT model confidence — labeled per product-facts.json confidence_semantics
                    _council.text = $"{v.voice}\nstance: {v.stance}\nSTANCE STRENGTH: {v.confidence:0.00}\nvote: {v.vote}\n\n{v.reason}";
                    _decision.text = "Council deliberating…"; _flowCard.text = ""; break;
                case ShadowNarrativeState.DECISION:
                    _council.text = CouncilStanceChips();
                    // "Council strength" not "Confidence" — persona-prior aggregate, not a model probability
                    _decision.text = $"Recommendation: {ShadowBankingNarrativeData.Recommendation}\nRisk: {ShadowBankingNarrativeData.RiskLevel}\nCompliance: {ShadowBankingNarrativeData.ComplianceStatus}\nCouncil strength: {ShadowBankingNarrativeData.Confidence:0.00}\nDissent: {ShadowBankingNarrativeData.Dissent}/5\nEvidence: {ShadowBankingNarrativeData.EvidenceCount}\nSigned: SEALED · VERIFIED\nAudit: hash-chain";
                    _flowCard.text = ""; break;
                case ShadowNarrativeState.FLOW_OR_AUDIT:
                    _handoff = _flow.Prepare(ShadowBankingNarrativeData.CaseId, "Shadow council — " + ShadowBankingNarrativeData.CaseId);
                    _council.text = CouncilStanceChips();
                    _decision.text = _decision.text; // keep the decision
                    _flowCard.text = "FLOW: " + (_handoff.prepared ? "prepared offline — " + _handoff.explanation : "audit chain (Flow unavailable)");
                    break;
            }
        }

        string CouncilStanceChips()
        {
            var sb = new System.Text.StringBuilder("Council:\n");
            foreach (var v in ShadowBankingNarrativeData.Voices) sb.Append("• ").Append(v.voice).Append(" — ").Append(v.vote).Append('\n');
            return sb.ToString();
        }

        void ExploreInFlow()
        {
            if (_sm.State != ShadowNarrativeState.FLOW_OR_AUDIT) _sm.GoTo(ShadowNarrativeState.FLOW_OR_AUDIT);
            Render(); // prepares the offline handoff (no network)
        }

        // one-tap reset works from EVERY state → Banking READY (no duplicate panels, no stale dominant)
        public void ResetDemo()
        {
            _dominant = 1;
            _handoff = default;
            _sm.Reset();
            Render();
            Debug.Log("[stage] RESET_DEMO → banking READY");
        }

        // ── builders ──
        Image Panel(Transform parent, Vector2 anchorMin, Vector2 anchorMax)
        {
            var go = new GameObject("Panel", typeof(Image)); go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>(); img.color = ShadowDesignTokens.PanelPrimary;
            var rt = img.rectTransform; rt.anchorMin = anchorMin; rt.anchorMax = anchorMax; rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
            go.AddComponent<Outline>().effectColor = ShadowDesignTokens.Border;
            return img;
        }
        Text Label(Transform parent, string text, int size, Vector2 anchor, Vector2 pos, Color color, TextAnchor align)
        {
            var go = new GameObject("Text", typeof(Text)); go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>(); t.font = _font; t.text = text; t.fontSize = size; t.color = color; t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow;
            var rt = t.rectTransform; rt.anchorMin = rt.anchorMax = rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = new Vector2(320, 40);
            return t;
        }
        void StageButton(Transform parent, string label, float x, Color color, System.Action onClick)
        {
            var go = new GameObject("Btn_" + label, typeof(Image), typeof(Button)); go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = color;
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(x, 0); rt.anchoredPosition = new Vector2(0, 24); rt.sizeDelta = new Vector2(150, 40);
            var lbl = Label(go.transform, label, 15, new Vector2(0.5f, 0.5f), Vector2.zero, ShadowDesignTokens.Background, TextAnchor.MiddleCenter); lbl.rectTransform.sizeDelta = new Vector2(150, 40);
            var b = go.GetComponent<Button>(); b.onClick.RemoveAllListeners(); b.onClick.AddListener(() => onClick());
        }

        // test entrypoints (pointer clicks call the same handlers)
        public void InvokeNext() { _sm.Next(); Render(); }
        public void InvokeBack() { _sm.Back(); Render(); }
    }
}
#endif
