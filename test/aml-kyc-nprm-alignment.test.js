// test/aml-kyc-nprm-alignment.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.25 (2026-07-08) — FinCEN NPRM 2026-04-07 alignment contract
// tests.
//
// The joint FinCEN + Fed + OCC + FDIC NPRM is the largest BSA
// update since USA PATRIOT Act. Once it finalizes (expected late
// 2026 / early 2027) Shadow's hard-coded CDD citations go stale.
// This test file pins the stage-aware citation-rewrite semantics
// so an origination decision written today stays reconstructable
// tomorrow.
//
// If any of these fail, do NOT relax them — chase the regression
// in `lib/aml-kyc-voice.js:citationForStage()`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NPRM_STAGES,
  getFinCenNprmStage,
  citationForStage,
  computeAmlKycVoiceWithStage,
  computeAmlKycVoice,
} from "../lib/aml-kyc-voice.js";


// ═════════════════════════════════════════════════════════════════
// Stage identifier canon
// ═════════════════════════════════════════════════════════════════

test("NPRM_STAGES exposes the three canonical stage strings", () => {
  assert.equal(NPRM_STAGES.PRE_NPRM, "pre-nprm");
  assert.equal(NPRM_STAGES.NPRM_PROPOSED, "nprm-proposed");
  assert.equal(NPRM_STAGES.NPRM_FINAL, "nprm-final");
});

test("getFinCenNprmStage defaults to pre-nprm when env unset", () => {
  const saved = process.env.SHADOW_FINCEN_NPRM_STAGE;
  delete process.env.SHADOW_FINCEN_NPRM_STAGE;
  try {
    assert.equal(getFinCenNprmStage(), NPRM_STAGES.PRE_NPRM);
  } finally {
    if (saved !== undefined) process.env.SHADOW_FINCEN_NPRM_STAGE = saved;
  }
});

test("getFinCenNprmStage reads nprm-proposed from env", () => {
  const saved = process.env.SHADOW_FINCEN_NPRM_STAGE;
  process.env.SHADOW_FINCEN_NPRM_STAGE = "nprm-proposed";
  try {
    assert.equal(getFinCenNprmStage(), NPRM_STAGES.NPRM_PROPOSED);
  } finally {
    if (saved === undefined) delete process.env.SHADOW_FINCEN_NPRM_STAGE;
    else process.env.SHADOW_FINCEN_NPRM_STAGE = saved;
  }
});

test("getFinCenNprmStage ignores unknown values and falls back to pre-nprm", () => {
  const saved = process.env.SHADOW_FINCEN_NPRM_STAGE;
  process.env.SHADOW_FINCEN_NPRM_STAGE = "nprm-something-else";
  try {
    assert.equal(getFinCenNprmStage(), NPRM_STAGES.PRE_NPRM);
  } finally {
    if (saved === undefined) delete process.env.SHADOW_FINCEN_NPRM_STAGE;
    else process.env.SHADOW_FINCEN_NPRM_STAGE = saved;
  }
});


// ═════════════════════════════════════════════════════════════════
// Citation-for-stage semantics
// ═════════════════════════════════════════════════════════════════

test("citationForStage pre-nprm passes CDD citation unchanged", () => {
  const c = "FinCEN CDD PEP screening (31 CFR 1010.230)";
  assert.equal(citationForStage(c, NPRM_STAGES.PRE_NPRM), c);
});

test("citationForStage nprm-proposed appends 31 CFR 1020.210 consolidation note", () => {
  const c = "FinCEN CDD beneficial-ownership rule (31 CFR 1010.230(d))";
  const out = citationForStage(c, NPRM_STAGES.NPRM_PROPOSED);
  assert.match(out, /31 CFR 1010\.230/);  // original preserved
  assert.match(out, /NPRM 2026-04-07/);
  assert.match(out, /31 CFR 1020\.210/);
});

test("citationForStage nprm-final replaces CDD with 31 CFR 1020.210 finalized", () => {
  const c = "FinCEN CDD beneficial-ownership rule (31 CFR 1010.230(d))";
  const out = citationForStage(c, NPRM_STAGES.NPRM_FINAL);
  assert.match(out, /31 CFR 1020\.210/);
  assert.match(out, /finalized/);
});

test("citationForStage does NOT rewrite BSA structuring citation (statutory, untouched by NPRM)", () => {
  const c = "BSA structuring (31 USC 5324)";
  for (const stage of Object.values(NPRM_STAGES)) {
    assert.equal(citationForStage(c, stage), c, `unchanged in stage ${stage}`);
  }
});

test("citationForStage does NOT rewrite OFAC citations (Treasury, not FinCEN)", () => {
  const c = "OFAC 50% rule (ownership aggregation)";
  for (const stage of Object.values(NPRM_STAGES)) {
    assert.equal(citationForStage(c, stage), c);
  }
});

test("citationForStage does NOT rewrite USA PATRIOT §326 CIP", () => {
  const c = "USA PATRIOT Act §326 (CIP)";
  for (const stage of Object.values(NPRM_STAGES)) {
    assert.equal(citationForStage(c, stage), c);
  }
});

test("citationForStage handles null / undefined gracefully", () => {
  assert.equal(citationForStage(null), null);
  assert.equal(citationForStage(undefined, NPRM_STAGES.NPRM_PROPOSED), undefined);
});


// ═════════════════════════════════════════════════════════════════
// End-to-end voice payload rewrite
// ═════════════════════════════════════════════════════════════════

test("computeAmlKycVoiceWithStage pre-nprm preserves original CDD citation", () => {
  const loan = {
    amount: 500000,
    aml_flags: ["pep"],
    kyc_status: "current",
  };
  const voice = computeAmlKycVoiceWithStage(loan, { stage: NPRM_STAGES.PRE_NPRM });
  const cdd = voice.metrics.findings.find((f) => f.citation && f.citation.includes("1010.230"));
  assert.ok(cdd, "should have a CDD-cited finding");
  assert.doesNotMatch(cdd.citation, /1020\.210/);
});

test("computeAmlKycVoiceWithStage nprm-proposed adds 1020.210 note to CDD findings", () => {
  const loan = {
    amount: 500000,
    aml_flags: ["pep", "beneficial_ownership_opaque"],
  };
  const voice = computeAmlKycVoiceWithStage(loan, { stage: NPRM_STAGES.NPRM_PROPOSED });
  const cddFindings = voice.metrics.findings.filter(
    (f) => f.citation && f.citation.includes("1010.230"),
  );
  assert.ok(cddFindings.length >= 2, "PEP + beneficial ownership both cite CDD");
  for (const f of cddFindings) {
    assert.match(f.citation, /NPRM 2026-04-07/);
    assert.match(f.citation, /1020\.210/);
  }
});

test("computeAmlKycVoiceWithStage rationale rebuilt with rewritten citations", () => {
  const loan = { amount: 500000, aml_flags: ["pep"] };
  const proposed = computeAmlKycVoiceWithStage(loan, { stage: NPRM_STAGES.NPRM_PROPOSED });
  assert.match(proposed.rationale, /1020\.210/);
  assert.match(proposed.rationale, /NPRM 2026-04-07/);
});

test("computeAmlKycVoiceWithStage nprm_stage exposed in metrics", () => {
  const loan = { amount: 500000, aml_flags: ["pep"] };
  const voice = computeAmlKycVoiceWithStage(loan, { stage: NPRM_STAGES.NPRM_FINAL });
  assert.equal(voice.metrics.nprm_stage, "nprm-final");
});

test("computeAmlKycVoiceWithStage default stage matches env / pre-nprm fallback", () => {
  const saved = process.env.SHADOW_FINCEN_NPRM_STAGE;
  delete process.env.SHADOW_FINCEN_NPRM_STAGE;
  try {
    const voice = computeAmlKycVoiceWithStage({ amount: 500000, aml_flags: ["pep"] });
    assert.equal(voice.metrics.nprm_stage, NPRM_STAGES.PRE_NPRM);
  } finally {
    if (saved !== undefined) process.env.SHADOW_FINCEN_NPRM_STAGE = saved;
  }
});

test("computeAmlKycVoiceWithStage preserves 100% back-compat verdict + AA codes vs computeAmlKycVoice", () => {
  const loan = { amount: 500000, aml_flags: ["sanctions_hit"], kyc_status: "stale" };
  const legacy = computeAmlKycVoice(loan);
  const staged = computeAmlKycVoiceWithStage(loan, { stage: NPRM_STAGES.PRE_NPRM });
  assert.equal(staged.verdict, legacy.verdict);
  assert.deepEqual(staged.adverse_action_codes, legacy.adverse_action_codes);
  assert.equal(staged.confidence, legacy.confidence);
});
