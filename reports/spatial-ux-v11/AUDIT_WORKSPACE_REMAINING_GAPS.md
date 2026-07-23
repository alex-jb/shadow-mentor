# Audit Workspace — remaining gaps (honest)

Core V1 logic is implemented + EditMode-verified. NOT yet done in this environment/increment:

1. **Visual PlayMode captures** — the 14 Workspace state screenshots + contact sheets need a
   graphics-mode Unity run and a capture entry that instantiates `ShadowAuditWorkspace` and drives it
   through the states. The env-gated `ShadowLensV11CaptureHarness` is the hook; a Workspace capture
   method is not yet added. So RENDER-HARNESS-CAPTURES-COMPLETE stays false.
2. **MonoBehaviour visual correctness** — the renderer compiles and the logic is tested, but pixel
   layout (occlusion, clipping, hierarchy readability, OST legibility) is not visually validated here.
3. **Live tracking-health wiring** — the workspace reads a `Tracking` field; binding it to the real
   tracking-health provider (not a debug field) is pending.
4. **Real story-fixture binding at runtime** — `Bind()` accepts the real `ShadowGuidedStoryState`;
   the scene wiring that constructs the workspace from the shipped Banking fixture in a live scene is
   the next step.
5. **Pooling** — cards use shared materials and per-region incremental rebuild, but full pooled
   context-card/glyph/connector reuse (vs destroy+recreate children) is not yet implemented.
6. **PlayMode/graphical lane** — not run for this increment; EditMode is.
7. **Device validation** — none. No Beam Pro / XREAL / OST claim.

None of these are claimed as done. AUDIT-WORKSPACE-IMPLEMENTED is true at the logic + runtime-component
level; the visual acceptance flags remain false until the captures exist.
