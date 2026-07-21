# Shadow Lens — UX / Flow research conclusions

## Product separation (the load-bearing decision)
- **Shadow** = the governed reasoning + decision engine. It owns the council, the evidence binding,
  the signed record, and verification. Everything visible is *derived from* a Shadow session — the
  UI never invents ids, coordinates, or verification state.
- **Unity 3D** = the **semantic cognitive map** of one decision. It is not a dashboard; it is a
  single scene where every visual property *means* something (below). It runs deterministic + offline.
- **Flow** = the **spatial data-story / presentation** layer. It is a *separate* experience, launched
  on its own. Flow must **not** be a runtime dependency of the Wednesday Mock APK.

## XR interaction constraints (why the UX is sparse + pointer-driven)
- The Wednesday device (XREAL One Pro tethered to a Beam Pro) is a **display + host**. World-space UI
  must be legible against changing passthrough and readable at ~1.5–2 m. Sparse panels beat many
  floating desktop windows.
- **No keyboard dependency** on device — interaction is pointer/touch (the Beam Pro/phone) and, later,
  controller/gaze via Unity XR Interaction Toolkit world-space UI patterns.
- Continuous floating/parallax hurts legibility and reads as "tech demo." Animation is reserved for
  **narrative transitions**, not decoration.
- Eye / 6DoF / RGB capture are **not claimed** until the Beam Pro produces real evidence (the XREAL
  SDK candidate build is labeled COMPILED / DEVICE VALIDATION PENDING).

## What the research rules out
- A generic floating BI dashboard (fails the day-30 utility test that every bank AR demo since 2014
  has failed).
- Embedding a browser/Flow web view inside Unity for the deterministic demo (network + fragility).
- Restyling that discards the already-working 3D geometry (`SpatialLayout`, `ShadowLensSceneController`).

## References (official docs)
- XREAL developer docs — One Pro / Beam Pro, NRSDK/XREAL SDK: https://docs.xreal.com/
- Unity XR Interaction Toolkit (world-space UI, XR Origin): https://docs.unity3d.com/Packages/com.unity.xr.interaction.toolkit@3.0/manual/index.html
- Unity XR Core Utils (XR Origin): https://docs.unity3d.com/Packages/com.unity.xr.core-utils@2.3/manual/index.html
- Flow Immersive (spatial data storytelling): https://flow.gl/
