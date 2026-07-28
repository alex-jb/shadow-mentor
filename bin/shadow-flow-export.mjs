#!/usr/bin/env node
// bin/shadow-flow-export.mjs
//
// Write a validated shadow-flow-export/1.0 artifact to disk. Thin CLI adapter
// around the existing Core producer (exportFlowContract) — it adds NO new
// schema, NO new council logic, and NO network access. The export is prepared
// entirely offline from either a supported narrative JSON file or the shipped
// canonical fixture; the resulting artifact is what the offline Flow presenter
// (and, later, the Web local runner) reference.
//
// Usage:
//   shadow-flow-export --input <narrative.json> --output <artifact.json> [--force] [--json]
//   shadow-flow-export --fixture banking        --output <artifact.json> [--force] [--json]
//
//   --input <path>    A JSON file holding one supported Shadow narrative
//                     (the shape of BANKING_NARRATIVE: case_id, fixture_timestamp,
//                     council[], metrics[], evidence[], relationships[], decision{}).
//   --fixture <name>  Use a shipped canonical fixture instead of a file.
//                     Supported names: banking
//   --output <path>   Where to write the export JSON (required, explicit).
//                     Parent directories are created if missing.
//   --force           Overwrite an existing --output file (refused otherwise).
//   --json            Emit a one-line JSON summary to stdout.
//
// Exactly one of --input / --fixture is required (neither and both are errors).
//
// Exit codes: 0 ok · 2 usage error · 3 input read/parse/shape or I/O error ·
//             4 produced export failed self-validation (nothing is written).
//
// Guarantees: deterministic byte-identical output for the same input (the
// contract's generated_at is the narrative's fixture_timestamp, never wall
// clock); the source narrative is never mutated; validation runs BEFORE any
// write and a failed run leaves no partial artifact.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { exportFlowContract, FLOW_EXPORT_VERSION, FLOW_EXPORT_COLUMNS } from "../apps/shadow-lens/flow/flow-export-contract.mjs";
import { BANKING_NARRATIVE } from "../apps/shadow-lens/fixtures/banking-narrative.mjs";

// Closed allowlist — the only fixture the contract tests pin today.
const FIXTURES = { banking: BANKING_NARRATIVE };

const ROW_TYPES = ["council", "metric", "evidence", "relationship"]; // producer emission order

function die(code, msg) { process.stderr.write(msg + "\n"); process.exit(code); }

function parseArgs(argv) {
  const o = { input: null, fixture: null, output: null, force: false, json: false };
  const r = argv.slice(2);
  for (let i = 0; i < r.length; i++) {
    const a = r[i];
    if (a === "-h" || a === "--help") return { help: true };
    else if (a === "--input") o.input = r[++i];
    else if (a === "--fixture") o.fixture = r[++i];
    else if (a === "--output") o.output = r[++i];
    else if (a === "--force") o.force = true;
    else if (a === "--json") o.json = true;
    else die(2, `shadow-flow-export: unknown argument: ${a}`);
  }
  return o;
}

// ---- input-side checks: the narrative must already be a supported shape ----
// (No new schema: these are exactly the fields exportFlowContract reads.)
function narrativeShapeErrors(n) {
  const errs = [];
  if (typeof n !== "object" || n === null || Array.isArray(n)) return ["narrative must be a JSON object"];
  if (typeof n.case_id !== "string" || !n.case_id) errs.push("case_id must be a non-empty string");
  if (typeof n.fixture_timestamp !== "string" || !n.fixture_timestamp) errs.push("fixture_timestamp must be a non-empty string (deterministic, not wall-clock)");
  for (const k of ["council", "metrics", "evidence", "relationships"])
    if (!Array.isArray(n[k])) errs.push(`${k} must be an array`);
  if (typeof n.decision !== "object" || n.decision === null) errs.push("decision must be an object");
  else for (const k of ["recommendation", "compliance_status", "signed_result_status", "audit_reference", "mode_label"])
    if (typeof n.decision[k] !== "string" || !n.decision[k]) errs.push(`decision.${k} must be a non-empty string`);
  return errs;
}

function deepFreeze(x) {
  if (x && typeof x === "object") { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); }
  return x;
}

// ---- output-side checks: the produced artifact must honour the 1.0 contract ----
const TOP_LEVEL_KEYS = ["schema_version", "case_id", "generated_at", "title", "row_count", "rows", "csv"];
// Fields the 1.0 contract does NOT carry — their absence is honest and must be preserved,
// never synthesized here or by consumers.
const FORBIDDEN_KEYS = /first_failure|downstream|approval|trust_posture|signature|physical/i;
const SECRET_PATTERN = /sk-ant-|AIza|BEGIN [A-Z ]*PRIVATE KEY|password|ssn|api[_-]?key/i;
const PRIVATE_PATH_PATTERN = /\/Users\/[a-z0-9_-]+\/|\/home\/[a-z0-9_-]+\//i;

export function validateFlowExport(ex) {
  const errs = [];
  const err = (m) => errs.push(m);

  if (typeof ex !== "object" || ex === null) return ["export is not an object"];
  if (ex.schema_version !== FLOW_EXPORT_VERSION) err(`schema_version must be ${FLOW_EXPORT_VERSION}`);
  const extraTop = Object.keys(ex).filter((k) => !TOP_LEVEL_KEYS.includes(k));
  if (extraTop.length) err(`unexpected top-level fields: ${extraTop.join(", ")}`);
  for (const k of TOP_LEVEL_KEYS) if (!(k in ex)) err(`missing top-level field: ${k}`);
  if (!Array.isArray(ex.rows) || ex.rows.length === 0) { err("rows must be a non-empty array"); return errs; }
  if (ex.row_count !== ex.rows.length) err(`row_count (${ex.row_count}) != rows.length (${ex.rows.length})`);

  // stable ordering: producer groups rows council → metric → evidence → relationship
  const typeSeq = ex.rows.map((r) => ROW_TYPES.indexOf(r.row_type));
  if (typeSeq.some((t) => t < 0)) err("row_type outside the closed vocabulary");
  for (let i = 1; i < typeSeq.length; i++)
    if (typeSeq[i] < typeSeq[i - 1]) { err("rows are not in stable grouped order"); break; }

  const councilVoices = new Set(), evidenceIds = new Set(), identities = new Set();
  for (const [i, r] of ex.rows.entries()) {
    const extra = Object.keys(r).filter((k) => !FLOW_EXPORT_COLUMNS.includes(k));
    if (extra.length) err(`row ${i}: fields outside the closed column set: ${extra.join(", ")}`);
    if (r.schema_version !== FLOW_EXPORT_VERSION) err(`row ${i}: wrong schema_version`);
    if (r.case_id !== ex.case_id) err(`row ${i}: case_id differs from export case_id`);
    for (const k of ["recommendation", "compliance_status", "signed_result_status", "mode_label"])
      if (typeof r[k] !== "string" || !r[k]) err(`row ${i}: ${k} must be a non-empty string`);
    let id;
    if (r.row_type === "council") { id = `council:${r.council_voice}`; councilVoices.add(r.council_voice); }
    else if (r.row_type === "metric") id = `metric:${r.metric_name}`;
    else if (r.row_type === "evidence") { id = `evidence:${r.evidence_id}`; evidenceIds.add(r.evidence_id); }
    else id = `rel:${r.relationship_from}→${r.relationship_to}:${r.relationship_type}`;
    if (identities.has(id)) err(`row ${i}: duplicate row identity ${id}`);
    identities.add(id);
  }
  // relationship endpoints must resolve to a council voice or an evidence item in THIS export
  for (const r of ex.rows) if (r.row_type === "relationship") {
    for (const end of [r.relationship_from, r.relationship_to])
      if (!councilVoices.has(end) && !evidenceIds.has(end))
        err(`relationship endpoint "${end}" resolves to no council voice or evidence id`);
  }

  if (typeof ex.csv !== "string" || ex.csv.split("\n")[0] !== FLOW_EXPORT_COLUMNS.join(","))
    err("csv must start with the stable closed column header");

  const s = JSON.stringify(ex);
  if (FORBIDDEN_KEYS.test(Object.keys(ex).concat(ex.rows.flatMap((r) => Object.keys(r))).join(",")))
    err("export contains fields the 1.0 contract does not define (honest absence violated)");
  if (SECRET_PATTERN.test(s)) err("export matches a secret/credential pattern");
  if (PRIVATE_PATH_PATTERN.test(s)) err("export contains a private filesystem path");
  return errs;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(2, 34).join("\n").replace(/^\/\/ ?/gm, "") + "\n");
    process.exit(0);
  }
  if (!args.output) die(2, "shadow-flow-export: --output <artifact.json> is required (see --help)");
  if (!args.input && !args.fixture) die(2, "shadow-flow-export: give exactly one of --input <narrative.json> or --fixture <name> (see --help)");
  if (args.input && args.fixture) die(2, "shadow-flow-export: --input and --fixture are mutually exclusive — give exactly one");

  let narrative, source;
  if (args.fixture) {
    narrative = FIXTURES[args.fixture];
    if (!narrative) die(2, `shadow-flow-export: unknown fixture "${args.fixture}" (supported: ${Object.keys(FIXTURES).join(", ")})`);
    source = `fixture:${args.fixture}`;
  } else {
    let raw;
    try { raw = readFileSync(args.input, "utf8"); }
    catch (e) { die(3, `shadow-flow-export: cannot read --input: ${e.message}`); }
    try { narrative = JSON.parse(raw); }
    catch (e) { die(3, `shadow-flow-export: --input is not valid JSON: ${e.message}`); }
    source = args.input;
  }

  const shapeErrs = narrativeShapeErrors(narrative);
  if (shapeErrs.length) die(3, `shadow-flow-export: unsupported narrative shape:\n  - ${shapeErrs.join("\n  - ")}`);

  // freeze the source so the producer can never mutate the operator's input
  const ex = exportFlowContract(deepFreeze(narrative));

  const validationErrs = validateFlowExport(ex);
  if (validationErrs.length)
    die(4, `shadow-flow-export: produced export failed ${FLOW_EXPORT_VERSION} validation — nothing written:\n  - ${validationErrs.join("\n  - ")}`);

  const outPath = resolve(args.output);
  if (existsSync(outPath) && !args.force)
    die(3, `shadow-flow-export: ${outPath} already exists. Refusing to overwrite (pass --force to replace it).`);

  const body = JSON.stringify(ex, null, 2) + "\n";
  const tmpPath = `${outPath}.tmp-${process.pid}`;
  try {
    const parent = dirname(outPath);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    writeFileSync(tmpPath, body, "utf8");        // validate-then-write: full artifact or nothing
    renameSync(tmpPath, outPath);
  } catch (e) {
    try { rmSync(tmpPath, { force: true }); } catch { /* best-effort cleanup */ }
    die(3, `shadow-flow-export: cannot write output: ${e.message}`);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({
      ok: true, schema_version: ex.schema_version, case_id: ex.case_id,
      source, output: outPath, row_count: ex.row_count, mode_label: ex.rows[0].mode_label,
    }) + "\n");
  } else {
    process.stdout.write(
      `wrote ${outPath}  (${ex.schema_version}, ${ex.row_count} rows, case ${ex.case_id}, ${ex.rows[0].mode_label})\n` +
      `deterministic + offline: no network, no credentials, generated_at is the narrative's fixture timestamp\n`);
  }
}

// Import-safe: tests import validateFlowExport without running the CLI.
import { fileURLToPath } from "node:url";
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
