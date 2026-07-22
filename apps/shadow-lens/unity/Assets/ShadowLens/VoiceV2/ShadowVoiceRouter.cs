// apps/shadow-lens/unity/Assets/ShadowLens/VoiceV2/ShadowVoiceRouter.cs
// Safe voice-command router (mirror of lib/voice/shadow-voice-router.mjs). A recognized phrase maps to
// a CLOSED action set — no LLM in the routing path. Regulated/destructive actions (Reset) enter
// ACTION_PENDING and require an explicit NON-VOICE confirmation. A recognized phrase is never
// authorization; CanVoiceAuthorize is always false. Pure C#. SOURCE AUTHORED.
using System.Text.RegularExpressions;

namespace ShadowLens.VoiceV2
{
    public enum VoiceAction { None, Next, Previous, Play, Pause, OpenDetails, CloseDetails, SelectProfile, RequestSource, RequestQuote, RequestReset, RequestRecenter, SwitchLanguage }
    public enum VoiceRouterState { Idle, ActionPending }

    public struct VoiceRouteResult { public VoiceAction Action; public bool Dispatched; public VoiceRouterState State; public bool RequiresConfirmation; }

    public sealed class ShadowVoiceRouter
    {
        VoiceAction _pending = VoiceAction.None;
        public VoiceRouterState State => _pending == VoiceAction.None ? VoiceRouterState.Idle : VoiceRouterState.ActionPending;

        static readonly (Regex re, VoiceAction a)[] Phrases = {
            (new Regex(@"\b(next|forward|continue|下一步|继续)\b", RegexOptions.IgnoreCase), VoiceAction.Next),
            (new Regex(@"\b(back|previous|上一步|返回)\b", RegexOptions.IgnoreCase), VoiceAction.Previous),
            (new Regex(@"\b(play|resume|播放)\b", RegexOptions.IgnoreCase), VoiceAction.Play),
            (new Regex(@"\b(pause|暂停)\b", RegexOptions.IgnoreCase), VoiceAction.Pause),
            (new Regex(@"\b(details?|详细|详情|展开)\b", RegexOptions.IgnoreCase), VoiceAction.OpenDetails),
            (new Regex(@"\b(close|collapse|收起)\b", RegexOptions.IgnoreCase), VoiceAction.CloseDetails),
            (new Regex(@"\b(profile|persona|视角|角色)\b", RegexOptions.IgnoreCase), VoiceAction.SelectProfile),
            (new Regex(@"\b(source|来源|依据)\b", RegexOptions.IgnoreCase), VoiceAction.RequestSource),
            (new Regex(@"\b(quote|原文|引用)\b", RegexOptions.IgnoreCase), VoiceAction.RequestQuote),
            (new Regex(@"\b(reset|重置|重来|返回银行)\b", RegexOptions.IgnoreCase), VoiceAction.RequestReset),
            (new Regex(@"\b(recenter|重新居中)\b", RegexOptions.IgnoreCase), VoiceAction.RequestRecenter),
            (new Regex(@"\b(language|中文|english|切换语言)\b", RegexOptions.IgnoreCase), VoiceAction.SwitchLanguage),
        };

        public VoiceRouteResult Route(string phrase)
        {
            var text = phrase ?? "";
            var action = VoiceAction.None;
            foreach (var (re, a) in Phrases) if (re.IsMatch(text)) { action = a; break; }
            if (action == VoiceAction.None) return new VoiceRouteResult { Action = VoiceAction.None, Dispatched = false, State = State, RequiresConfirmation = false };
            if (action == VoiceAction.RequestRecenter) return new VoiceRouteResult { Action = action, Dispatched = true, State = VoiceRouterState.Idle, RequiresConfirmation = false };
            if (action == VoiceAction.RequestReset) { _pending = action; return new VoiceRouteResult { Action = action, Dispatched = false, State = VoiceRouterState.ActionPending, RequiresConfirmation = true }; }
            return new VoiceRouteResult { Action = action, Dispatched = true, State = State, RequiresConfirmation = false };
        }

        public VoiceAction ConfirmByNonVoice() { var a = _pending; _pending = VoiceAction.None; return a; }
        public void CancelPending() { _pending = VoiceAction.None; }
        public static bool CanVoiceAuthorize() => false;   // voice never authorizes a regulated action
    }
}
