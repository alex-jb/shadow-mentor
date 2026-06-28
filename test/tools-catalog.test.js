// Catalog drift gate — Tier 2 #2.
//
// Pins `installer/tools.json` consistency with `mcp/server.js` at the
// test layer so a PR that adds a new MCP tool without updating the
// catalog (or vice versa) fails CI loudly. Pattern adapted from
// msitarzewski/agency-agents 117k-star catalog-as-code workflow.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../mcp/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "..", "installer", "tools.json");

function loadCatalog() {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
}

describe("installer/tools.json catalog drift gate", () => {
  test("catalog is valid JSON and has required top-level shape", () => {
    const c = loadCatalog();
    assert.ok(c.$schema_version, "missing $schema_version");
    assert.ok(Array.isArray(c.tools), "tools[] missing or not an array");
    assert.ok(c.$tool_surface && Array.isArray(c.$tool_surface.tools),
      "$tool_surface.tools[] missing");
    assert.ok(c.$server_contract, "$server_contract missing");
  });

  test("$tool_surface.tools exactly matches mcp/server.js TOOLS", () => {
    const declared = new Set(loadCatalog().$tool_surface.tools);
    const live = new Set(TOOLS.map((t) => t.name));
    // Same size — catches both directions of drift in one assertion.
    assert.equal(declared.size, live.size,
      `tool count drift: catalog declares ${declared.size}, server exports ${live.size}`);
    for (const name of live) {
      assert.ok(declared.has(name),
        `mcp/server.js exports "${name}" but installer/tools.json omits it`);
    }
    for (const name of declared) {
      assert.ok(live.has(name),
        `installer/tools.json declares "${name}" but mcp/server.js does not export it`);
    }
  });

  test("every install target has required keys + valid install_kind / format", () => {
    const c = loadCatalog();
    const REQUIRED = ["id", "label", "detect_dirs", "dest_path", "format",
                      "install_kind", "config_key_path", "platform_support", "docs"];
    const KINDS = new Set(["per-server", "roster", "plugin"]);
    const FORMATS = new Set(["json-merge", "json-replace", "toml-merge"]);
    for (const t of c.tools) {
      for (const k of REQUIRED) {
        assert.ok(k in t, `tool ${t.id || "?"} missing required key "${k}"`);
      }
      assert.ok(KINDS.has(t.install_kind),
        `tool ${t.id} has unknown install_kind: ${t.install_kind}`);
      assert.ok(FORMATS.has(t.format),
        `tool ${t.id} has unknown format: ${t.format}`);
    }
  });

  test("install target ids are unique", () => {
    const c = loadCatalog();
    const ids = c.tools.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate install target id");
  });

  test("no absolute paths leaked into dest_path (procurement-grade hygiene)", () => {
    // A reviewer running `grep "/Users/" installer/` must find nothing.
    // Use ~/ or %APPDATA% so the catalog is portable across reviewers.
    const c = loadCatalog();
    for (const t of c.tools) {
      const dp = t.dest_path;
      if (typeof dp !== "string") continue;
      assert.equal(dp.includes("/Users/"), false,
        `tool ${t.id} dest_path leaks an absolute /Users/ path`);
      if (dp.startsWith("/") && !dp.startsWith("/etc/")) {
        assert.fail(`tool ${t.id} dest_path "${dp}" is absolute — use ~/ or %APPDATA%`);
      }
    }
  });

  test("$server_contract points at mcp/server.js (single source of truth)", () => {
    const c = loadCatalog();
    assert.equal(c.$server_contract.command, "node");
    const args = c.$server_contract.args_template;
    assert.ok(Array.isArray(args));
    assert.ok(args.some((a) => a.includes("mcp/server.js")),
      "args_template does not reference mcp/server.js");
  });

  test("every install target supports at least one OS", () => {
    const c = loadCatalog();
    const VALID_PLATFORMS = new Set(["darwin", "win32", "linux"]);
    for (const t of c.tools) {
      assert.ok(Array.isArray(t.platform_support) && t.platform_support.length > 0,
        `tool ${t.id} has no platform_support`);
      for (const p of t.platform_support) {
        assert.ok(VALID_PLATFORMS.has(p),
          `tool ${t.id} has unknown platform "${p}"`);
      }
    }
  });
});
