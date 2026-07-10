// lib/ambient-manager.js
// ──────────────────────────────────────────────────────────────────
// v1.5.47 (2026-07-09). Ambient Council Manager v0.1 —
// deterministic layout-descriptor primitive for XREAL One Pro / WebXR
// spatial rendering of Shadow council output.
//
// Ports the shape from xiaotianfotos/homerail (MIT, 276⭐, 2026-07-07)
// manager-agent-widget-tools.ts sink-based UI emission pattern. The
// port strips homerail's TOML wire format, DAG worker fleet, and
// shell-primitive tools — none of which fit banking-procurement scope.
// What survives:
//
//   1. Sink-based layout emission — Manager decides WHICH personas
//      to convene + WHERE they sit in space + WHAT context nodes to
//      anchor. Rendering client (WebXR / Chrome fullscreen on XREAL)
//      subscribes to the descriptor and paints.
//
//   2. "System prompt is a builder, not a static string" — the same
//      Manager can serve chat-mode Cursor callers vs ambient-mode
//      XREAL callers by branching on response_mode. For v0.1 we ship
//      the ambient-mode branch only.
//
//   3. "Never claim X unless tool result proves X" — every persona
//      placement carries a persona_id that must exist in PERSONA_
//      CATALOG. Unknown persona_ids throw. Prevents renderer hallu-
//      cinating personas that Shadow does not actually ship.
//
// v0.1 scope: deterministic — takes explicit persona_ids + loan
// context + decision, returns the layout descriptor. NO LLM
// roundtrip yet. v0.2+ adds the natural-language "voice → tool call
// → sink" loop with Claude tool-use.
//
// Rationale for deterministic-first: the WebXR renderer for the
// 2026-07-16 Yeshiva demo needs a stable JSON contract to build
// against. Ship the contract now; layer the LLM loop later.
//
// Refs:
//   - docs/product-design/xr-visual-paradigm-2026-07-06-v3-AMBIENT-COUNCIL.md
//   - docs/xreal-one-pro-test-protocol/README.md
//   - homerail Manager Agent source read (2026-07-09 agent-scan)
//
// ──────────────────────────────────────────────────────────────────


/**
 * The 6 canonical Shadow persona ids. Renderer allocates a slot per
 * persona; unknown ids throw. Kept as a frozen catalog so a future
 * persona addition is a one-line append + one contract-test update.
 */
export const PERSONA_CATALOG = Object.freeze({
  credit_fundamentals: {
    id: "credit_fundamentals",
    display_name: "Credit Fundamentals",
    domain: "credit_scoring",
    accent_color: "#3B82F6", // blue
  },
  risk_officer: {
    id: "risk_officer",
    display_name: "Risk Officer",
    domain: "portfolio_var",
    accent_color: "#EF4444", // red
  },
  fair_lending: {
    id: "fair_lending",
    display_name: "Fair Lending Compliance",
    domain: "ecoa_reg_b",
    accent_color: "#8B5CF6", // purple
  },
  customer_advocate: {
    id: "customer_advocate",
    display_name: "Customer Advocate",
    domain: "aa_notice_quality",
    accent_color: "#10B981", // green
  },
  macro_contrarian: {
    id: "macro_contrarian",
    display_name: "Macro Contrarian",
    domain: "sector_regime",
    accent_color: "#F59E0B", // amber
  },
  aml_kyc: {
    id: "aml_kyc",
    display_name: "AML/KYC Investigator",
    domain: "bsa_ofac",
    accent_color: "#6B7280", // gray
  },
});


/**
 * Spatial layout preset for N personas in an arc facing the reviewer.
 * Positions are in meters relative to the reviewer's head. Renderer
 * translates these into WebXR local space or CSS 3D transforms
 * depending on transport (immersive-ar vs fullscreen 2D).
 *
 * Semicircle centered at (0, 0, -1.4m). Arc spans 120° for N ≤ 3,
 * widens up to 160° for N = 6. Vertical y anchored 0.2m below eye
 * line so cards don't crowd the reviewer's PDF workspace.
 *
 * @param {number} n number of personas (1..6)
 * @returns {Array<{x:number,y:number,z:number,rotation_y:number}>}
 */
export function computeSemicircleLayout(n) {
  if (!Number.isInteger(n) || n < 1 || n > 6) {
    throw new RangeError(`computeSemicircleLayout: n must be 1..6, got ${n}`);
  }
  const RADIUS = 1.4;
  const Y = -0.2;
  const arcDeg = n === 1 ? 0 : Math.min(120 + (n - 3) * 10, 160);
  const arcRad = (arcDeg * Math.PI) / 180;
  const centerZ = -RADIUS;
  const positions = [];
  const denorm = (v) => (v === 0 ? 0 : v); // strip negative-zero
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) - 0.5;
    const angle = t * arcRad;
    positions.push({
      x: denorm(RADIUS * Math.sin(angle)),
      y: Y,
      z: denorm(centerZ + RADIUS * (1 - Math.cos(angle))),
      rotation_y: denorm(-angle),
    });
  }
  return positions;
}


/**
 * The layout descriptor consumed by the WebXR renderer. Every field
 * is JSON-serializable; the renderer needs no LLM to paint the scene.
 *
 * @typedef {Object} LayoutDescriptor
 * @property {string} descriptor_version
 * @property {string} response_mode - "ambient" | "chat"
 * @property {string} question
 * @property {Array} personas - {id, display_name, position, rotation_y, accent_color, verdict?, rationale?}
 * @property {Array} context_nodes - {id, label, value, anchor: "borrower"|"policy"|"market"}
 * @property {string|null} verdict - "approve"|"escalate"|"block"|"refuse_to_serve"|null
 * @property {string|null} attestation_hash
 */


/**
 * runAmbientTurn — deterministic Manager turn.
 *
 * Given a decision question + selected personas + loan context +
 * (optional) council output, produce the LayoutDescriptor the WebXR
 * client renders.
 *
 * v0.1: no LLM. Explicit persona_ids and explicit context nodes.
 * v0.2+: swap the deterministic pipeline for a Claude tool-use loop
 *        that emits the same descriptor shape via a sink.
 *
 * @param {object} params
 * @param {string} params.question - natural-language framing shown at top
 * @param {string[]} params.persona_ids - subset of PERSONA_CATALOG keys
 * @param {object} [params.loan_context] - {fico, dti, ltv, var, sector, ...}
 * @param {object} [params.council_output] - runLoanCouncil() return value
 * @param {string} [params.response_mode] - "ambient" | "chat"
 * @returns {LayoutDescriptor}
 */
export function runAmbientTurn({
  question,
  persona_ids,
  loan_context = null,
  council_output = null,
  response_mode = "ambient",
} = {}) {
  if (typeof question !== "string" || !question.trim()) {
    throw new TypeError("runAmbientTurn: question is required");
  }
  if (!Array.isArray(persona_ids) || persona_ids.length === 0) {
    throw new TypeError("runAmbientTurn: persona_ids must be a non-empty array");
  }
  if (persona_ids.length > 6) {
    throw new RangeError("runAmbientTurn: at most 6 personas per turn");
  }
  for (const id of persona_ids) {
    if (!Object.prototype.hasOwnProperty.call(PERSONA_CATALOG, id)) {
      throw new Error(
        `runAmbientTurn: unknown persona_id "${id}". ` +
        `Must be one of: ${Object.keys(PERSONA_CATALOG).join(", ")}`,
      );
    }
  }
  if (response_mode !== "ambient" && response_mode !== "chat") {
    throw new Error(
      `runAmbientTurn: response_mode must be "ambient" or "chat"`,
    );
  }

  const positions = computeSemicircleLayout(persona_ids.length);
  const voiceMap = council_output && Array.isArray(council_output.voices)
    ? Object.fromEntries(
        council_output.voices.map((v) => [
          normalizeVoiceName(v.voice),
          v,
        ]),
      )
    : {};

  const personas = persona_ids.map((id, i) => {
    const catalog = PERSONA_CATALOG[id];
    const voice = voiceMap[id] || null;
    return {
      id,
      display_name: catalog.display_name,
      position: positions[i],
      rotation_y: positions[i].rotation_y,
      accent_color: catalog.accent_color,
      domain: catalog.domain,
      ...(voice ? {
        verdict: voice.verdict,
        confidence: voice.confidence,
        rationale: voice.rationale,
      } : {}),
    };
  });

  const context_nodes = buildContextNodes(loan_context);

  return {
    descriptor_version: "1.0",
    response_mode,
    question,
    personas,
    context_nodes,
    verdict: council_output ? council_output.final_verdict : null,
    attestation_hash: council_output ? (council_output.attestation_hash || null) : null,
  };
}


/**
 * Normalize a persona voice name (from runLoanCouncil output) into
 * the PERSONA_CATALOG id key. runLoanCouncil emits pretty names like
 * "Credit Fundamentals"; the catalog uses "credit_fundamentals".
 *
 * @param {string} voiceName
 * @returns {string}
 */
function normalizeVoiceName(voiceName) {
  if (typeof voiceName !== "string") return "";
  const s = voiceName.toLowerCase().trim();
  if (s.startsWith("credit")) return "credit_fundamentals";
  if (s.startsWith("risk")) return "risk_officer";
  if (s.startsWith("fair")) return "fair_lending";
  if (s.startsWith("customer")) return "customer_advocate";
  if (s.startsWith("macro")) return "macro_contrarian";
  if (s.startsWith("aml") || s.includes("kyc")) return "aml_kyc";
  return s.replace(/\s+/g, "_");
}


/**
 * Build context nodes from a loan context. Each node is a small
 * factoid the renderer paints next to the appropriate anchor
 * (borrower / policy / market). Skips any field whose value is
 * absent so the renderer never draws a "N/A" pill.
 *
 * @param {object|null} loan_context
 * @returns {Array}
 */
function buildContextNodes(loan_context) {
  if (!loan_context || typeof loan_context !== "object") return [];
  const nodes = [];
  if (typeof loan_context.credit_score === "number") {
    nodes.push({
      id: "fico",
      label: "FICO",
      value: String(loan_context.credit_score),
      anchor: "borrower",
    });
  }
  if (typeof loan_context.debt_to_income === "number") {
    nodes.push({
      id: "dti",
      label: "DTI",
      value: loan_context.debt_to_income.toFixed(2),
      anchor: "borrower",
    });
  }
  if (typeof loan_context.loan_to_value === "number") {
    nodes.push({
      id: "ltv",
      label: "LTV",
      value: loan_context.loan_to_value.toFixed(2),
      anchor: "borrower",
    });
  }
  if (typeof loan_context.amount === "number") {
    nodes.push({
      id: "amount",
      label: "Loan amount",
      value: `$${loan_context.amount.toLocaleString()}`,
      anchor: "borrower",
    });
  }
  if (typeof loan_context.sector === "string") {
    nodes.push({
      id: "sector",
      label: "Sector",
      value: loan_context.sector.replace(/_/g, " "),
      anchor: "market",
    });
  }
  if (typeof loan_context.borrower_rating === "string") {
    nodes.push({
      id: "rating",
      label: "Rating",
      value: loan_context.borrower_rating,
      anchor: "borrower",
    });
  }
  return nodes;
}


/**
 * The 5 tool schemas the future LLM-driven variant will expose to
 * Claude tool-use. v0.1 does not use these; ship the schemas now so
 * downstream contract tests can pin them.
 *
 * @returns {Array<{name:string, description:string, input_schema:object}>}
 */
export function ambientToolCatalog() {
  return [
    {
      name: "select_personas",
      description:
        "Pick 2-5 personas from the Shadow catalog to convene. Returns the persona_ids that will render in the ambient scene.",
      input_schema: {
        type: "object",
        properties: {
          persona_ids: {
            type: "array",
            items: {
              type: "string",
              enum: Object.keys(PERSONA_CATALOG),
            },
            minItems: 1,
            maxItems: 6,
          },
          rationale: {
            type: "string",
            description: "One-sentence reason for this persona subset.",
          },
        },
        required: ["persona_ids", "rationale"],
      },
    },
    {
      name: "stage_loan_question",
      description:
        "Normalize a spoken loan inquiry into Shadow's loan schema. Extract FICO / DTI / LTV / VaR / sector where mentioned.",
      input_schema: {
        type: "object",
        properties: {
          fico: { type: "number", minimum: 300, maximum: 850 },
          dti: { type: "number", minimum: 0, maximum: 2 },
          ltv: { type: "number", minimum: 0, maximum: 2 },
          var: { type: "number", minimum: 0, maximum: 1 },
          amount: { type: "number", minimum: 0 },
          sector: { type: "string" },
          narrative: {
            type: "string",
            description: "The reviewer's spoken question, verbatim.",
          },
        },
        required: ["narrative"],
      },
    },
    {
      name: "place_context_node",
      description:
        "Anchor one factoid pill in the ambient scene. anchor determines where the pill floats (borrower = above the PDF, policy = right column, market = bottom row).",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          value: { type: "string" },
          anchor: { type: "string", enum: ["borrower", "policy", "market"] },
        },
        required: ["id", "label", "value", "anchor"],
      },
    },
    {
      name: "finalize_layout",
      description:
        "Terminal tool. Emits the layout descriptor to the render sink and (in v0.2+) invokes runLoanCouncil with the staged loan.",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "finish",
      description:
        "Short spoken reply (≤80 chars) that the ambient voice reads back to the reviewer. Long detail goes into the layout, not the speech.",
      input_schema: {
        type: "object",
        properties: {
          spoken_text: {
            type: "string",
            maxLength: 80,
          },
        },
        required: ["spoken_text"],
      },
    },
  ];
}


/**
 * The system prompt template. v0.1 exposes it as a function so
 * v0.2+ can close over per-session loan context + dictionary_hash +
 * provider/model without changing the caller signature. Prompt bytes
 * are procurement-audit-visible: the attestation binds the prompt
 * hash so a future silent rewrite breaks Ed25519 verify.
 *
 * @param {object} params
 * @param {string} [params.response_mode]
 * @param {object} [params.loan_context]
 * @returns {string}
 */
export function buildAmbientSystemPrompt({
  response_mode = "ambient",
  loan_context = null,
} = {}) {
  const lines = [
    "You are the Shadow Ambient Council Manager.",
    "Your job is to convert a spoken loan inquiry into a spatial",
    "council layout on XREAL One Pro / WebXR + a short spoken reply.",
    "",
    "Rules:",
    " - Never render 3D UI for chat / small-talk.",
    " - Use select_personas to pick 2-5 personas.",
    " - Use stage_loan_question to normalize into Shadow's loan schema.",
    " - Use place_context_node for FICO / DTI / LTV / VaR / sector facts.",
    " - Use finalize_layout exactly once at the end.",
    " - Never claim a council verdict unless runLoanCouncil returned a verdict_id.",
    " - Reg B adverse-action codes come from the signed reason-code dictionary only.",
    " - Never invent an AA code.",
    "",
    `Response mode: ${response_mode}.`,
  ];
  if (loan_context) {
    lines.push("");
    lines.push(`Loan context (pre-normalized): ${JSON.stringify(loan_context)}`);
  }
  return lines.join("\n");
}
