// test/reference-banking-bundle.test.js
// The committed reference banking-decision bundle (docs/reference/) is the
// self-demonstrating proof that a real Shadow loan-council decision produces
// evidence that verifies AND conforms to Banking Evidence Profile v1. It is also
// a regression guard: if the profile, the council, or the dictionary governance
// change in a way that breaks conformance of a real decision, CI fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { verifyBundle } from "../packages/attest-core/session.js";
import { checkBankingProfileV1 } from "../lib/enforce-banking-profile.js";
import { buildExaminerPacket, renderPacketMarkdown } from "../lib/evidence-packet.js";

const REF = resolve(dirname(fileURLToPath(import.meta.url)), "..", "docs", "reference");
const bundle = JSON.parse(readFileSync(resolve(REF, "banking-decision.bundle.json"), "utf8"));
const pub = readFileSync(resolve(REF, "banking-decision.public.pem"), "utf8");
const payloads = JSON.parse(readFileSync(resolve(REF, "banking-decision.payloads.json"), "utf8"));

test("the committed reference bundle verifies against its committed public key", () => {
  assert.equal(verifyBundle(bundle, { publicKey: pub }).ok, true);
});

test("the reference decision CONFORMS to banking-v1 (adverse path, all required present)", () => {
  const verified = verifyBundle(bundle, { publicKey: pub });
  const r = checkBankingProfileV1(bundle, { verified, payloads });
  assert.equal(r.adverse, true, "reference is an adverse (block) decision");
  assert.equal(r.pass, true, `NON-CONFORMANT: missing ${r.missing_required.join(", ")}`);
  // the governed dictionary version resolved (not just present)
  assert.match(r.fields.find((f) => f.id === "reason_code_dictionary_version").detail, /governed/);
  // principal reason codes present and within the Reg B max of 4
  assert.equal(r.fields.find((f) => f.id === "principal_reason_codes").status, "present");
});

test("the reference bundle produces a coherent examiner packet", () => {
  const verified = verifyBundle(bundle, { publicKey: pub });
  const md = renderPacketMarkdown(buildExaminerPacket(bundle, { verified, payloads }));
  assert.match(md, /# Credit-decision evidence packet/);
  assert.match(md, /adverse/);
  assert.match(md, /Reg B 12 CFR 1002\.9/);
});
