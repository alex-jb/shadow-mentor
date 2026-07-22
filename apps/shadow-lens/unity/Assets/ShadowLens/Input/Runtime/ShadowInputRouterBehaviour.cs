// apps/shadow-lens/unity/Assets/ShadowLens/Input/Runtime/ShadowInputRouterBehaviour.cs
// The MonoBehaviour that drives the pure ShadowInputRouter each frame from the active input sources.
// It picks the source set by platform (desktop keyboard in Editor/standalone, touch on Android, Beam
// Pro placeholder on device) and forwards canonical actions to an injected sink. All safety gating
// lives in the pure router. SOURCE AUTHORED · UNITY-COMPILED.
#if UNITY_2020_1_OR_NEWER
using System;
using System.Collections.Generic;
using UnityEngine;
using ShadowLens.InputV5;

namespace ShadowLens.InputV5.Runtime
{
    public sealed class ShadowInputRouterBehaviour : MonoBehaviour
    {
        readonly List<IShadowInputSource> _sources = new List<IShadowInputSource>();
        ShadowInputRouter _router;
        DelegateSink _sink;

        sealed class DelegateSink : IShadowInputSink
        {
            public Action<ShadowInputAction> OnAction;
            public void Dispatch(ShadowInputAction a) => OnAction?.Invoke(a);
        }

        public ShadowInputRouter Router => _router;

        public void Initialize(Action<ShadowInputAction> onAction)
        {
            _sink = new DelegateSink { OnAction = onAction };
            _router = new ShadowInputRouter(_sink);
            _sources.Clear();
            _sources.Add(new ShadowDesktopInputSource());
            _sources.Add(new ShadowTouchInputSource());
            _sources.Add(new ShadowBeamProInputSource());
        }

        void Update()
        {
            if (_router == null) return;
            foreach (var src in _sources)
            {
                foreach (var action in src.PollActive()) _router.Submit(action);
                if (src.PollPassiveFocus()) _router.SubmitPassive(ShadowInputAction.Focus);
            }
        }
    }
}
#endif
