# Token source inventory (semantic + visual)

| Source | Kind | Semantic keys | Notes |
|---|---|---|---|
| **design/shadow-spatial-tokens.json** | canonical (JSON) | status ×11, governance ×5, trust_posture ×3, tracking ×7, interaction ×5, capability ×6 + verification_checks/analytical_correctness/node_type_shape/edge_type/provenance_mode/surface/text_hierarchy/depth/animation | **THE source of truth (v2)**. colour + icon + shape + EN/ZH text + a11y(EN/ZH). |
| lib/shadow-semantic-vocabulary.mjs | runtime (JS) | SEMANTIC_STATUS (VERIFIED/TAMPERED/…) | mirrors the JSON by hand (comment-linked); severity/shape/icon/text_en/text_zh/a11y. |
| prototypes/shadow-3d-v2/src/shadow-status-materials.mjs | prototype (JS) | severity→colour | mirrors the JSON families. |
| apps/shadow-lens/…/Design/ShadowDesignTokens.cs | Unity (C#) | Verified/Tampered/Warning/Information/Neutral × 5 visual profiles | own exact shades per profile; hues asserted against canonical. |
| apps/shadow-lens/…/GuidedStory/ShadowGuidedStoryStatus.cs | Unity (C#) | ColorKeyOf/ShapeOf/SeverityOf | maps status → canonical colour-key + shape. |
| demos/replay/3d/constants.js | Three.js (JS) | intact(gray)/error(amber)/tampered(red)/healed(green-transient) | Audit Room uses GRAY for verified by design (bright-on-black); healed green is TRANSIENT. |
| demo/xreal.html | browser (CSS) | verdict approve/escalate/block/refuse_to_serve/pending | approve now BLUE (was verification-green) — fixed. |
| demos/spatial-finance/index.html | browser (CSS/JS) | RECORD: VERIFIED / ANALYSIS confidence | analysis confidence not coloured verification-green. |
| verify.html (FROZEN) | browser | VERIFIED/FAILED/NOT_PRESENT/NOT_CHECKED trust matrix | not modified; distinct statuses. |

Full machine-readable rows: `TOKEN_SOURCE_INVENTORY.csv`.
