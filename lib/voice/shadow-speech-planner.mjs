// The Shadow speech planner: canonical guided-story `semantic` + scenario → a provider-independent
// spoken utterance. It speaks the MEANING (statuses, first-failure, downstream, limitations, IDs,
// verbatim quotes), never scrapes UI text, and never bends semantics for naturalness. Progressive
// disclosure (level 1/2/3), bilingual phrasing (not literal translation), deterministic prosody.
// Pure + deterministic.
import { validateUtterance, normalizeSpokenText, findForbiddenFiller, assertPlainSpeech } from "./shadow-spoken-utterance.mjs";
import { profileForSituation, prosodyForSegment } from "./shadow-prosody-planner.mjs";
import { applyPronunciation } from "./shadow-pronunciation.mjs";

// Locale phrase bank — natural, evidence-first, no filler. {en, zh} builders.
const PH = {
  pristine_result: { en: "All links verify.", zh: "所有环节都通过验证。" },
  first_failure: { en: (n) => `The first failure is sequence ${en(n)}.`, zh: (n) => `第一个失败点是序号${cn(n)}。` },
  downstream: { en: (a, b) => `Steps ${en(a)} through ${en(b)} are affected.`, zh: (a, b) => `序号${cn(a)}到${cn(b)}受到影响。` },
  integrity_not_correctness: { en: "This verifies integrity, not correctness.", zh: "这验证的是完整性,不代表结论正确。" },
  not_evaluated: { en: "Analytical correctness is not evaluated.", zh: "分析正确性不作评估。" },
  human_not_present: { en: "Human approval is not present.", zh: "人工批准尚未完成。" },
  unsupported: { en: (id) => `The claim ${id} has no supporting evidence.`, zh: (id) => `主张 ${id} 没有支撑证据。` },
  abstain: { en: (id) => `${id} abstained — insufficient evidence.`, zh: (id) => `${id} 选择弃权——证据不足。` },
  contradiction: { en: "A claim cites evidence that opposes it.", zh: "有一个主张引用了与其相反的证据。" },
  majority_weak: { en: "A majority agrees, but the evidence binding is weak.", zh: "多数意见一致,但证据绑定较弱。" },
  majority_note: { en: "Majority agreement does not set correctness.", zh: "多数一致并不决定正确性。" },
  prompt_details: { en: "Say 'details' to inspect it.", zh: "说'详细信息'可以查看。" },
  quote_intro: { en: "The source reads:", zh: "来源原文:" },
};
function cn(n) { return ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][n] ?? String(n); }
function en(n) { return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] ?? String(n); }
const P = (k, loc, ...a) => { const v = PH[k][loc === "zh-CN" ? "zh" : "en"]; return typeof v === "function" ? v(...a) : v; };

const seqOf = (semantic, id) => semantic.entities.find((e) => e.id === id)?.sequence ?? null;

// Determine the situation + a stable intent from the scenario's canonical fields.
export function situation(semantic, scenario) {
  const es = scenario.entity_status || {}, ds = scenario.dimension_status || {};
  const ff = scenario.first_failure;
  const firstFailureSeq = ff ? seqOf(semantic, ff) : null;
  const downstreamSeqs = (scenario.affected_downstream || []).map((id) => seqOf(semantic, id)).filter((n) => n != null).sort((a, b) => a - b);
  const unsupported = Object.entries(es).filter(([, v]) => v === "UNSUPPORTED").map(([k]) => k);
  const abstained = Object.entries(es).filter(([, v]) => v === "ABSTAINED").map(([k]) => k);
  const warnings = Object.entries(es).filter(([, v]) => v === "WARNING").map(([k]) => k);
  const analyticalNotEvaluated = ds.ANALYTICAL_CORRECTNESS === "NOT_EVALUATED";
  const humanNotPresent = ds.HUMAN_APPROVAL === "NOT_PRESENT";
  const hasHashFailure = ff != null && (firstFailureSeq != null || ff === scenario.first_failure);
  let intent = "REPORT_PRISTINE";
  if (unsupported.length) intent = "REPORT_UNSUPPORTED";
  else if (abstained.length) intent = "REPORT_ABSTENTION";
  else if (ff === "CLAIM_EVIDENCE_BINDING" || (warnings.length && ff)) intent = "REPORT_MAJORITY_WEAK";
  else if (firstFailureSeq != null) intent = "REPORT_FIRST_FAILURE";
  else if (ff && firstFailureSeq == null) intent = "REPORT_FIRST_FAILURE";
  return { ff, firstFailureSeq, downstreamSeqs, unsupported, abstained, warnings, analyticalNotEvaluated, humanNotPresent, intent, hasHashFailure };
}

let _n = 0;
function seg(id, text, role, locale, prosodyProfile, opts = {}) {
  const cleaned = normalizeSpokenText(assertPlainSpeech(text), locale);
  const filler = findForbiddenFiller(cleaned);
  if (filler.length && !opts.allowFiller) throw new Error(`planner emitted forbidden filler: ${filler.join(",")}`);
  const pr = prosodyForSegment(prosodyProfile, role, { isFirstFailure: opts.isFirstFailure });
  const { text: spoken, tokens } = opts.verbatim ? { text: cleaned, tokens: [] } : applyPronunciation(cleaned, locale);
  return {
    segment_id: id, text: spoken, semantic_role: role, source_reference: opts.source || null,
    emphasis: pr.emphasis, pause_before_ms: pr.pause_before_ms, pause_after_ms: pr.pause_after_ms,
    rate_multiplier: pr.rate_multiplier, pitch_offset: pr.pitch_offset, volume_multiplier: pr.volume_multiplier,
    pronunciation_tokens: tokens, can_interrupt_after: pr.can_interrupt_after,
    accessibility_text: opts.accessibility || null, is_verbatim_quote: !!opts.verbatim,
  };
}

// Build the utterance. level: 1 (result) | 2 (+source+limitation) | 3 (+detail/quote).
export function planUtterance(semantic, scenarioId, { level = 2, locale = "en-US", perspective = null, accessibility = false, quote = null, statusOverride = "FIXTURE" } = {}) {
  const scenario = semantic.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`unknown scenario ${scenarioId}`);
  const sit = situation(semantic, scenario);
  const hasFailure = sit.firstFailureSeq != null || sit.intent !== "REPORT_PRISTINE";
  const profile = accessibility ? "ACCESSIBILITY_CLEAR" : profileForSituation({ hasFailure, isPerspective: !!perspective, isLimitation: false });
  const segs = [];
  const idp = `${scenarioId}-${locale === "zh-CN" ? "zh" : "en"}`.toLowerCase().replace(/[^a-z0-9:_-]/g, "-");

  // optional perspective label (subtle, only when a perspective is set)
  if (perspective) {
    const label = perspective.label?.[locale === "zh-CN" ? "zh" : "en"] || perspective.id;
    segs.push(seg(`${idp}-label`, label + (locale === "zh-CN" ? "。" : "."), "label", locale, "PERSPECTIVE"));
  }

  // LEVEL 1 — result
  if (sit.intent === "REPORT_PRISTINE") {
    segs.push(seg(`${idp}-r`, P("pristine_result", locale), "result", locale, profile));
  } else if (sit.intent === "REPORT_FIRST_FAILURE") {
    const n = sit.firstFailureSeq;
    segs.push(seg(`${idp}-r`, n != null ? P("first_failure", locale, n) : "The verification did not pass.", "result", locale, "VERIFICATION_FAILURE", { isFirstFailure: true, source: sit.ff }));
  } else if (sit.intent === "REPORT_UNSUPPORTED") {
    segs.push(seg(`${idp}-r`, P("unsupported", locale, shortId(sit.unsupported[0])), "result", locale, "VERIFICATION_FAILURE", { source: sit.unsupported[0] }));
  } else if (sit.intent === "REPORT_ABSTENTION") {
    segs.push(seg(`${idp}-r`, P("abstain", locale, shortId(sit.abstained[0])), "result", locale, "LIMITATION", { source: sit.abstained[0] }));
  } else if (sit.intent === "REPORT_MAJORITY_WEAK") {
    segs.push(seg(`${idp}-r`, P("majority_weak", locale), "result", locale, "LIMITATION"));
  }

  // LEVEL 2 — source + limitation
  if (level >= 2) {
    if (sit.downstreamSeqs.length >= 1) {
      const a = sit.downstreamSeqs[0], b = sit.downstreamSeqs[sit.downstreamSeqs.length - 1];
      segs.push(seg(`${idp}-src`, P("downstream", locale, a, b), "source", locale, profile));
    }
    if (sit.intent === "REPORT_MAJORITY_WEAK") segs.push(seg(`${idp}-maj`, P("majority_note", locale), "limitation", locale, "LIMITATION"));
    if (sit.intent === "REPORT_ABSTENTION" || sit.intent === "REPORT_UNSUPPORTED") { /* abstention/unsupported already the headline; nothing added */ }
    if (sit.analyticalNotEvaluated) {
      const line = (sit.firstFailureSeq != null) ? P("integrity_not_correctness", locale) : P("not_evaluated", locale);
      segs.push(seg(`${idp}-lim`, line, "limitation", locale, "LIMITATION"));
    }
    if (sit.humanNotPresent) segs.push(seg(`${idp}-hum`, P("human_not_present", locale), "limitation", locale, "LIMITATION"));
  }

  // LEVEL 3 — detail / verbatim quote + prompt
  if (level >= 3) {
    if (quote && typeof quote === "string") {
      segs.push(seg(`${idp}-qi`, P("quote_intro", locale), "prompt", locale, "EVIDENCE_READER"));
      segs.push(seg(`${idp}-q`, quote, "quote", locale, "EVIDENCE_READER", { verbatim: true, source: sit.ff || null }));
    }
  } else {
    segs.push(seg(`${idp}-p`, P("prompt_details", locale), "prompt", locale, profile));
  }

  const limitations = [];
  if (sit.analyticalNotEvaluated) limitations.push("ANALYTICAL_CORRECTNESS is NOT_EVALUATED");
  if (sit.humanNotPresent) limitations.push("HUMAN_APPROVAL is NOT_PRESENT");

  const utt = {
    contract_version: "shadow-spoken-utterance-v1",
    utterance_id: `${semantic.story_id}-${scenarioId}-l${level}-${locale === "zh-CN" ? "zh" : "en"}`.toLowerCase().replace(/[^a-z0-9:_-]/g, "-"),
    locale, role: perspective ? "PERSPECTIVE" : "SYSTEM_NARRATOR", intent: sit.intent,
    semantic_source_ids: [scenario.id, ...(sit.ff ? [sit.ff] : [])].filter(Boolean),
    spoken_segments: segs,
    prosody_profile: accessibility ? "ACCESSIBILITY_CLEAR" : (sit.firstFailureSeq != null ? "VERIFICATION_FAILURE" : "SYSTEM_NEUTRAL"),
    interruptibility: "INTERRUPTIBLE",
    priority: sit.firstFailureSeq != null ? "P2" : "P3",
    confirmation_required: false,
    fixture_live_device_status: statusOverride,
    limitations,
  };
  validateUtterance(utt);
  return utt;
}

function shortId(id) { return String(id).split(":").pop(); }
