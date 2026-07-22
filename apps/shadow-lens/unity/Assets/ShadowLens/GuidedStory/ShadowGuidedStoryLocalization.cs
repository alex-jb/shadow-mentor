// apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryLocalization.cs
// Bilingual (EN / zh) selection for the guided-story UI chrome. Story content itself is already
// bilingual in the model; this only covers the player's own labels. Pure C#. SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.GuidedStory
{
    public sealed class ShadowGuidedStoryLocalization
    {
        public bool Zh;

        static readonly Dictionary<string, (string en, string zh)> S = new Dictionary<string, (string, string)>
        {
            { "next", ("Step ▶", "下一步 ▶") },
            { "back", ("◄ Step", "◄ 上一步") },
            { "restart", ("Restart", "重来") },
            { "dims", ("Trust dimensions (independent — never one green)", "信任维度（相互独立——绝不合并为一个绿）") },
            { "nodes", ("Nodes", "节点") },
            { "fixture", ("FIXTURE · DESKTOP MOCK · DEVICE VALIDATION PENDING", "测试数据 · 桌面模拟 · 设备验证待完成") },
            { "hoverhint", ("Hover reveals; it does not select. Selecting does not approve.", "悬停仅显示，不选择。选择不等于批准。") },
        };

        public string T(string key) => S.TryGetValue(key, out var v) ? (Zh ? v.zh : v.en) : key;
        public string Pick(Bilingual b) => b == null ? "" : (Zh ? b.Zh : b.En);
    }
}
