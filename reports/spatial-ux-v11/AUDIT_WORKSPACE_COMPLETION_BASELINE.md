# Audit Workspace graphical-completion — baseline

Baseline before the graphical-completion pass.

| Item | Value |
|---|---|
| Branch | `feat/shadow-spatial-ux-asset-audit-v11` |
| HEAD (at start) | `ec46e23` |
| Frozen verifier | `verify.html` = `c478b46f` (unchanged) |
| Stable APK | `shadow-lens-xreal-voice-v10-core.apk` = `9efadf0a` (unchanged) |
| token `--check` | clean |
| Unity | 6000.0.23f1 (exact Hub path), Android module present |
| EditMode (start) | 133 pass / 0 fail |
| Capture harness | `Tests/PlayMode/ShadowAuditWorkspaceCaptureHarness.cs` (SHADOW_CAPTURE=1) |
| Generated token adapter | `Generated/ShadowSemanticTokens.Generated.cs` (from `scripts/generate-tokens.mjs`) |
| Contact-sheet tooling | PIL 11.3.0 (Python), sips; no ImageMagick |

## Known defects to fix (from the previous increment)
1. header title / tracking line touch;
2. Source Card vertical crowding;
3. Trust Strip 4th group near/over right edge;
4. Chinese field labels partly English;
5. only 7 states, DesktopDark only.

## Outcome of this pass
All 5 addressed — see AUDIT_WORKSPACE_GRAPHICAL_ACCEPTANCE.md / AUDIT_WORKSPACE_BEFORE_AFTER.md /
AUDIT_WORKSPACE_LOCALIZATION.md / AUDIT_WORKSPACE_PROFILE_REVIEW.md. EditMode → 136/136; graphics
PlayMode 1/1; 32 captures + 6 contact sheets; frozen verifier + APK unchanged.
