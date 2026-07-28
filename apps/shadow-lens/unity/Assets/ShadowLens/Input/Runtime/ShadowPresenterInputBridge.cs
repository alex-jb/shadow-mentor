// apps/shadow-lens/unity/Assets/ShadowLens/Input/Runtime/ShadowPresenterInputBridge.cs
// Connects the input router (this assembly) to the presenter (ShadowLens assembly), keeping the
// assembly dependency one-directional (InputV5.Runtime → ShadowLens). It initializes the router with
// the presenter's HandleAction as the sink. SOURCE AUTHORED · UNITY-COMPILED.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;
using ShadowLens.Presenter;

namespace ShadowLens.InputV5.Runtime
{
    [RequireComponent(typeof(ShadowInputRouterBehaviour))]
    public sealed class ShadowPresenterInputBridge : MonoBehaviour
    {
        public ShadowPresenterController Presenter;

        void Start()
        {
            var router = GetComponent<ShadowInputRouterBehaviour>();
            if (Presenter == null) Presenter = FindFirstObjectByType<ShadowPresenterController>();
            if (Presenter != null && router != null) router.Initialize(Presenter.HandleAction);
        }
    }
}
#endif
