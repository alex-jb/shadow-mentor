#!/usr/bin/env node
// Shadow MCP installer — reads installer/tools.json + writes the
// correct MCP host config for the requested target.
//
// Usage:
//   node bin/install.mjs                       # interactive — lists supported hosts
//   node bin/install.mjs --host cursor         # install for one host
//   node bin/install.mjs --host claude-desktop --dry-run  # show diff, don't write
//   node bin/install.mjs --all                 # install for every detected host
//
// Pattern adapted from msitarzewski/agency-agents (117k stars) catalog-
// as-code. Catalog ↔ behavior consistency is pinned by
// scripts/check-tools.mjs + test/tools-catalog.test.js so a refactor
// can't quietly break this installer.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const CATALOG_PATH = join(REPO_ROOT, "installer", "tools.json");

function parseArgs(argv) {
  const out = { host: null, all: false, dryRun: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--all") out.all = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--host") out.host = argv[++i];
    else if (a.startsWith("--host=")) out.host = a.slice("--host=".length);
  }
  return out;
}

function loadCatalog() {
  try {
    return JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  } catch (err) {
    console.error(`✖ cannot read ${CATALOG_PATH}: ${err.message}`);
    process.exit(2);
  }
}

// Expand ~, $HOME, %APPDATA% — keep tokens platform-neutral.
function expandPath(p) {
  if (!p) return p;
  let out = p;
  if (out.startsWith("~/")) out = join(homedir(), out.slice(2));
  out = out.replace("$HOME", homedir());
  out = out.replace("%APPDATA%", process.env.APPDATA || join(homedir(), "AppData", "Roaming"));
  return out;
}

function dirExists(dirPath) {
  try { return statSync(expandPath(dirPath)).isDirectory(); }
  catch { return false; }
}

function detectHost(tool) {
  // detect_dirs is an OR — if any candidate dir exists, the host is
  // probably installed on this machine.
  return tool.detect_dirs.some((d) => dirExists(d));
}

function platformSupported(tool) {
  const p = platform(); // "darwin" | "win32" | "linux"
  return Array.isArray(tool.platform_support) && tool.platform_support.includes(p);
}

// Set a nested key path like "mcpServers.shadow-mentor" on an object,
// creating intermediate objects as needed.
function setNestedKey(obj, keyPath, value) {
  const parts = keyPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

function buildServerEntry(catalog) {
  const c = catalog.$server_contract;
  return {
    command: c.command,
    args: c.args_template.map((a) => a.replace("{repo_root}", REPO_ROOT)),
    env: Object.fromEntries((c.env_passthrough || []).map((k) => [k, `\${${k}}`])),
  };
}

function jsonMerge(existing, keyPath, value) {
  // existing: parsed JSON object (or null/undefined if file absent)
  // keyPath: dot path like "mcpServers.shadow-mentor"
  // returns the merged object
  const base = (existing && typeof existing === "object") ? existing : {};
  return setNestedKey(base, keyPath, value);
}

function readExistingConfig(destPath) {
  if (!existsSync(destPath)) return null;
  try {
    return JSON.parse(readFileSync(destPath, "utf8"));
  } catch (err) {
    return { _parse_error: err.message, _raw_path: destPath };
  }
}

function installToOne(tool, catalog, { dryRun }) {
  const dest = expandPath(tool.dest_path);
  const serverEntry = buildServerEntry(catalog);
  const existing = readExistingConfig(dest);

  if (existing && existing._parse_error) {
    console.error(`✖ [${tool.id}] cannot parse existing ${dest}: ${existing._parse_error}`);
    console.error(`  Fix the file manually or rename it, then re-run.`);
    return { status: "skipped", reason: "parse-error" };
  }

  const merged = jsonMerge(existing, tool.config_key_path, serverEntry);
  const rendered = JSON.stringify(merged, null, 2);

  if (dryRun) {
    console.log(`--- [${tool.id}] DRY RUN — would write to ${dest} ---`);
    console.log(`config_key_path: ${tool.config_key_path}`);
    console.log(rendered.length > 800 ? rendered.slice(0, 800) + "\n... (truncated)" : rendered);
    return { status: "dry-run", dest };
  }

  // Real write — create parent dir if missing
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, rendered + "\n");
  console.log(`✓ [${tool.id}] wrote ${dest}`);
  return { status: "installed", dest };
}

function printHostList(catalog) {
  console.log("Supported MCP hosts:\n");
  for (const t of catalog.tools) {
    const detected = detectHost(t) ? "✓ detected" : "✗ not detected";
    const supported = platformSupported(t) ? "" : ` (platform ${platform()} not in ${t.platform_support.join(",")})`;
    console.log(`  ${t.id.padEnd(18)} ${t.label.padEnd(30)} ${detected}${supported}`);
  }
  console.log("\nRun with --host <id> to install for one, or --all for every detected host.");
}

function printHelp() {
  console.log(`shadow-mentor install — write MCP server config for a supported host.

USAGE
  node bin/install.mjs                       List supported hosts + detection status
  node bin/install.mjs --host <id>           Install for one host
  node bin/install.mjs --host <id> --dry-run Show what would be written, no file changes
  node bin/install.mjs --all                 Install for every detected + supported host
  node bin/install.mjs --help                Show this help

HOSTS  (from installer/tools.json)
${loadCatalog().tools.map((t) => `  ${t.id} — ${t.label}`).join("\n")}

ENV VARS the server expects at runtime (passed through):
${(loadCatalog().$server_contract.env_passthrough || []).map((k) => `  ${k}`).join("\n")}
`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) return printHelp();

  const catalog = loadCatalog();

  if (!args.host && !args.all) {
    printHostList(catalog);
    return;
  }

  let targets;
  if (args.all) {
    targets = catalog.tools.filter((t) => detectHost(t) && platformSupported(t));
    if (targets.length === 0) {
      console.error("✖ --all selected but no supported host was detected on this machine.");
      console.error("  Run without args to see detection status.");
      process.exit(1);
    }
  } else {
    const tool = catalog.tools.find((t) => t.id === args.host);
    if (!tool) {
      console.error(`✖ unknown host "${args.host}". Available:`);
      for (const t of catalog.tools) console.error(`  ${t.id}`);
      process.exit(1);
    }
    if (!platformSupported(tool)) {
      console.error(`✖ host "${tool.id}" does not support ${platform()} (declared: ${tool.platform_support.join(", ")})`);
      process.exit(1);
    }
    targets = [tool];
  }

  let installed = 0, skipped = 0;
  for (const t of targets) {
    const r = installToOne(t, catalog, { dryRun: args.dryRun });
    if (r.status === "installed" || r.status === "dry-run") installed++;
    else skipped++;
  }

  console.log(`\n${args.dryRun ? "dry-run summary" : "summary"}: ${installed} ok, ${skipped} skipped`);
  if (!args.dryRun && installed > 0) {
    console.log(`Restart the MCP host to pick up the new server config.`);
  }
}

main();
