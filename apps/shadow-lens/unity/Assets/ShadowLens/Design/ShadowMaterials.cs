// apps/shadow-lens/unity/Assets/ShadowLens/Design/ShadowMaterials.cs
// Panel construction helpers: a filled panel + a subtle 10%-white border (via Outline), so
// panels stay legible against changing passthrough backgrounds WITHOUT post-processing blur.
// Authored for Unity 6.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;
using UnityEngine.UI;

namespace ShadowLens.Design
{
    public static class ShadowMaterials
    {
        // Build a panel Image (fill + border) under `parent`. Caller sets RectTransform.
        public static Image Panel(Transform parent, string name, bool secondary = false, bool passthrough = false)
        {
            var go = new GameObject(name, typeof(Image));
            go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>();
            img.color = secondary ? ShadowDesignTokens.PanelFillSecondary(passthrough) : ShadowDesignTokens.PanelFill(passthrough);
            var outline = go.AddComponent<Outline>();
            outline.effectColor = ShadowDesignTokens.Border;
            outline.effectDistance = new Vector2(ShadowSpacing.BorderWidth, ShadowSpacing.BorderWidth);
            return img;
        }
    }
}
#endif
