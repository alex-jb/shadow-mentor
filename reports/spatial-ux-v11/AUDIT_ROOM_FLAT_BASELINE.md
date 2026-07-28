# Audit Room Flat — baseline (before this increment)

Branch `feat/shadow-spatial-ux-asset-audit-v11`, HEAD `1503760`. Verifier `c478b46f`, stable APK
`9efadf0a`, token `--check` clean. Three.js Audit Room sources: `demos/replay/3d/{app,scene,constants,labels,flat-fit}.js`, bundle `dist/audit-room.js`.

Recorded failed state (from the prior real screenshot):
- INSPECTOR_PLACEMENT_LOGIC_PASS · INSPECTOR_RUNTIME_CREATION_PASS
- INSPECTOR_READABILITY_FAIL · SELECTED_ASSOCIATION_FAIL · LEADER_VISIBILITY_INCONCLUSIVE
- FLAT_COMPOSITION_FAIL · TRUST_STATUS_HIERARCHY_FAIL

Camera was fixed (`CAMERA_POS [0,0,3]`, fov 55) → the rail sat small + distant in a black field.
Outcome of this increment: all FAILs fixed + visually accepted — see AUDIT_ROOM_FLAT_ACCEPTANCE_STATUS.md.
