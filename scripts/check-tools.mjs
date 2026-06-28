#!/usr/bin/env node
// CI guard for installer/tools.json — Tier 2 #2 "agency-agents pattern."
//
// The catalog declares what install targets Shadow supports and what tool
// surface the MCP server exposes. This script ensures the catalog is
// consistent with the actual MCP server code so a refactor that adds /
// removes a tool can't ship with stale install docs.
//
// Checks:
//  1. tools.json is valid JSON + has required top-level shape.
//  2. Every $tool_surface.tools[] entry actually exists in mcp/server.js TOOLS.
//  3. Every TOOLS entry in mcp/server.js is listed in $tool_surface.tools[].
//     (catches the inverse drift — code added a tool, catalog forgot.)
//  4. Every install target has the required keys + no unknown install_kind.
//  5. dest_path uses ~ or %APPDATA% path tokens (no absolute leaks).
//
// CI invocation:  npm run check:tools

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../mcp/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "..", "installer", "tools.json");

const VALID_INSTALL_KINDS = new Set(["per-server", "roster", "plugin"]);
const VALID_FORMATS = new Set(["json-merge", "json-replace", "toml-merge"]);
const REQUIRED_TOOL_KEYS = [
  "id", "label", "detect_dirs", "dest_path",
  "format", "install_kind", "config_key_path",
  "platform_support", "docs",
];

function loadCatalog() {
  let raw;
  try {
    raw = readFileSync(CATALOG_PATH, "utf8");
  } catch (err) {
    throw new Error(`cannot read ${CATALOG_PATH}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`installer/tools.json is not valid JSON: ${err.message}`);
  }
}

function check(catalog) {
  const errors = [];

  // 1. Top-level shape
  if (!catalog.$schema_version) errors.push("missing $schema_version");
  if (!Array.isArray(catalog.tools)) errors.push("missing or invalid tools[]");
  if (!catalog.$tool_surface || !Array.isArray(catalog.$tool_surface.tools)) {
    errors.push("missing $tool_surface.tools[]");
  }
  if (!catalog.$server_contract) errors.push("missing $server_contract");

  // 2. + 3. Tool surface drift
  if (Array.isArray(catalog.$tool_surface?.tools)) {
    const declared = new Set(catalog.$tool_surface.tools);
    const live = new Set(TOOLS.map((t) => t.name));
    for (const name of declared) {
      if (!live.has(name)) {
        errors.push(`$tool_surface.tools lists "${name}" but mcp/server.js does not export it`);
      }
    }
    for (const name of live) {
      if (!declared.has(name)) {
        errors.push(`mcp/server.js exports "${name}" but $tool_surface.tools omits it`);
      }
    }
  }

  // 4. Install target shape
  if (Array.isArray(catalog.tools)) {
    const ids = new Set();
    for (const t of catalog.tools) {
      if (!t || typeof t !== "object") {
        errors.push(`tools[] entry is not an object: ${JSON.stringify(t)}`);
        continue;
      }
      for (const k of REQUIRED_TOOL_KEYS) {
        if (!(k in t)) {
          errors.push(`tools[${t.id ?? "?"}] missing required key "${k}"`);
        }
      }
      if (t.id) {
        if (ids.has(t.id)) errors.push(`duplicate tool id "${t.id}"`);
        ids.add(t.id);
      }
      if (t.install_kind && !VALID_INSTALL_KINDS.has(t.install_kind)) {
        errors.push(`tools[${t.id}] has unknown install_kind "${t.install_kind}" (expected: ${[...VALID_INSTALL_KINDS].join(", ")})`);
      }
      if (t.format && !VALID_FORMATS.has(t.format)) {
        errors.push(`tools[${t.id}] has unknown format "${t.format}" (expected: ${[...VALID_FORMATS].join(", ")})`);
      }
      // 5. dest_path must use path tokens, never absolute /Users/...
      if (typeof t.dest_path === "string") {
        if (t.dest_path.startsWith("/") && !t.dest_path.startsWith("/etc/")) {
          errors.push(`tools[${t.id}].dest_path "${t.dest_path}" is absolute — use ~/ or %APPDATA%`);
        }
      }
      if (!Array.isArray(t.detect_dirs) || t.detect_dirs.length === 0) {
        errors.push(`tools[${t.id}].detect_dirs must be a non-empty array`);
      }
      if (!Array.isArray(t.platform_support) || t.platform_support.length === 0) {
        errors.push(`tools[${t.id}].platform_support must list at least one of: darwin / win32 / linux`);
      }
    }
  }

  // server_contract sanity
  if (catalog.$server_contract) {
    if (catalog.$server_contract.command !== "node") {
      errors.push(`$server_contract.command should be "node" (got ${catalog.$server_contract.command})`);
    }
    if (!Array.isArray(catalog.$server_contract.args_template) ||
        !catalog.$server_contract.args_template.some((a) => a.includes("mcp/server.js"))) {
      errors.push(`$server_contract.args_template must reference mcp/server.js`);
    }
  }

  return errors;
}

function main() {
  let catalog;
  try {
    catalog = loadCatalog();
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(2);
  }

  const errors = check(catalog);
  if (errors.length === 0) {
    const n = catalog.tools?.length ?? 0;
    const surface = catalog.$tool_surface?.tools?.length ?? 0;
    console.log(`✓ installer/tools.json — ${n} install target(s), ${surface} MCP tool(s), all consistent with mcp/server.js`);
    process.exit(0);
  }

  console.error(`✖ installer/tools.json failed ${errors.length} check(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\nFix and re-run \`npm run check:tools\`.`);
  process.exit(1);
}

main();
