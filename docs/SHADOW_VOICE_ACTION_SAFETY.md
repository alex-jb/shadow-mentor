# Shadow voice action safety

Voice may: next · previous · play · pause · open/close details · select profile · request source ·
request quote · request recenter · switch language.

Voice ALONE may NOT: approve a decision · confirm a regulated action · sign a bundle · delete evidence
· grant permissions · retain a camera frame · accept an OCR correction · confirm destructive tampering.

A recognized phrase is NOT authorization. `ShadowVoiceRouter` routes only a closed action set (no LLM
in the routing path). Regulated/destructive actions (e.g. Reset) enter `ACTION_PENDING` and require an
explicit NON-VOICE confirmation (`confirmByNonVoice()`); `canVoiceAuthorize()` is always false.
Enforced by `test/shadow-voice-core.test.js` + the Unity EditMode voice safety tests.
