#!/usr/bin/env node
// scripts/gen-flow-presentation-package.mjs
// Regenerates the sanitized, deterministic Shadow → Flow demo package under reports/flow-v11/.
// Offline only: no network, no credentials, no wall-clock timestamps (generated_at is the fixture
// timestamp). With --check, verifies the committed files match a fresh build (drift gate).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFlowDemoPackage } from "../apps/shadow-lens/flow/flow-presentation-mapping.mjs";
import { buildFlowVendorGraph } from "../apps/shadow-lens/flow/flow-vendor-csv.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "reports", "flow-v11");
const PKG = join(OUT, "demo-package");

const { mapping, rowExport, nodesCsv, edgesCsv, manifest } = buildFlowDemoPackage();
// Vendor-compatible graph CSV (Bill Morton guidance 2026-07-27): one row per node + idList.
const vendor = buildFlowVendorGraph();

const files = {
  [join(OUT, "shadow-flow-presentation-mapping.json")]: JSON.stringify(mapping, null, 2) + "\n",
  [join(OUT, "shadow-flow-demo-manifest.json")]: JSON.stringify(manifest, null, 2) + "\n",
  [join(PKG, "shadow-flow-demo-export.json")]: JSON.stringify(rowExport, null, 2) + "\n",
  [join(PKG, "shadow-flow-demo-export.csv")]: rowExport.csv,
  [join(PKG, "shadow-flow-presentation-nodes.csv")]: nodesCsv,
  [join(PKG, "shadow-flow-presentation-edges.csv")]: edgesCsv,
  [join(PKG, "shadow-flow-vendor-graph.csv")]: vendor.csv,
  [join(OUT, "shadow-flow-vendor-graph-stats.json")]: JSON.stringify(
    { version: vendor.version, presentation_version: vendor.presentation_version,
      presented_scenario: vendor.presented_scenario, case_id: vendor.case_id,
      generated_at: vendor.generated_at, columns: vendor.columns, stats: vendor.stats,
      vendor_guidance: "Bill Morton, VP Customer Success, Flow Immersive — 2026-07-27",
      import_tested: false, device_validated: false }, null, 2) + "\n",
};

const check = process.argv.includes("--check");
let drift = 0;
for (const [path, content] of Object.entries(files)) {
  if (check) {
    const rel = path.slice(ROOT.length + 1);
    if (!existsSync(path)) { console.error(`MISSING  ${rel}`); drift++; continue; }
    if (readFileSync(path, "utf8") !== content) { console.error(`DRIFT    ${rel}`); drift++; continue; }
    console.log(`ok       ${rel}`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`wrote    ${path.slice(ROOT.length + 1)}`);
  }
}
if (check && drift) { console.error(`\n${drift} file(s) drifted — run: node scripts/gen-flow-presentation-package.mjs`); process.exit(1); }
