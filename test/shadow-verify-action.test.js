// test/shadow-verify-action.test.js
// Structural tests for .github/actions/shadow-verify/action.yml.
// Verifies the composite-action YAML parses and declares the fields
// GitHub Actions expects. Can't invoke the action end-to-end from a
// unit test (that requires a runner), but we can catch schema drift.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTION_PATH = resolve(__dirname, "..", ".github", "actions", "shadow-verify", "action.yml");
const CLI_PATH = resolve(__dirname, "..", "bin", "shadow-verify.mjs");


// Minimal YAML → JS parser for the small, well-known subset we ship in
// action.yml. Keeps the test dependency-free. Supports:
//   - top-level scalars, sequences (`- foo`), and mappings
//   - two-space indent
//   - block scalars folded with `>`
//   - block scalars literal with `|`
// Does NOT support flow sequences, tags, anchors, multi-doc — none of
// which our action uses. If we need those in the future we can add
// js-yaml as a dev dep, but for now the parser mirror keeps the test
// fast and self-contained.
function parseYaml(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  function readLine() {
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*#/.test(l) || l.trim() === "") { i++; continue; }
      return l;
    }
    return null;
  }

  function indentOf(l) { return l.match(/^ */)[0].length; }

  function readBlock(indent) {
    // Read a mapping or a sequence starting at indent.
    const isSeq = readLine() && readLine().slice(indent).startsWith("- ");
    if (isSeq) return readSeq(indent);
    return readMap(indent);
  }

  function readMap(indent) {
    const out = {};
    while (true) {
      const l = readLine();
      if (l === null) return out;
      const cur = indentOf(l);
      if (cur < indent) return out;
      if (cur > indent) return out; // sub-block handled elsewhere
      const m = l.slice(indent).match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (!m) return out;
      i++;
      const key = m[1];
      let val = m[2];
      if (val === "" || val === ">" || val === "|") {
        // Block value on subsequent lines.
        if (val === "" && (i < lines.length)) {
          // Peek next non-comment line — mapping or sequence at indent+2, or another key at same indent.
          let peek = i;
          while (peek < lines.length && (/^\s*#/.test(lines[peek]) || lines[peek].trim() === "")) peek++;
          if (peek < lines.length && indentOf(lines[peek]) > indent) {
            const nextIndent = indentOf(lines[peek]);
            const nextTrim = lines[peek].slice(nextIndent);
            if (nextTrim.startsWith("- ")) {
              out[key] = readSeq(nextIndent);
            } else {
              out[key] = readMap(nextIndent);
            }
          } else {
            out[key] = null;
          }
        } else if (val === ">" || val === "|") {
          const buf = [];
          const nextIndent = indent + 2;
          while (i < lines.length) {
            const nl = lines[i];
            if (/^\s*$/.test(nl)) { buf.push(""); i++; continue; }
            if (indentOf(nl) < nextIndent) break;
            buf.push(nl.slice(nextIndent));
            i++;
          }
          out[key] = val === ">" ? buf.join(" ").trim() : buf.join("\n");
        }
      } else {
        // Inline scalar.
        val = val.trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        out[key] = val;
      }
    }
  }

  function readSeq(indent) {
    const out = [];
    while (true) {
      const l = readLine();
      if (l === null) return out;
      const cur = indentOf(l);
      if (cur < indent) return out;
      const trim = l.slice(indent);
      if (!trim.startsWith("- ")) return out;
      i++;
      // Item can be inline scalar or mapping.
      const rest = trim.slice(2);
      if (rest.includes(":")) {
        // First key on same line as the dash — reconstruct so readMap sees it.
        const insertLine = " ".repeat(indent + 2) + rest;
        lines.splice(i, 0, insertLine);
        out.push(readMap(indent + 2));
      } else {
        out.push(rest);
      }
    }
  }

  return readBlock(0);
}


test("shadow-verify action.yml parses as a composite action", () => {
  const raw = readFileSync(ACTION_PATH, "utf8");
  const doc = parseYaml(raw);
  assert.equal(typeof doc.name, "string", "name required");
  assert.match(doc.name, /Shadow evidence bundle verify/);
  assert.equal(typeof doc.description, "string");
  assert.equal(doc.runs.using, "composite");
  assert.ok(Array.isArray(doc.runs.steps));
  assert.ok(doc.runs.steps.length >= 2, "expect at least the node-version check + verify step");
});


test("shadow-verify action declares the expected inputs", () => {
  const raw = readFileSync(ACTION_PATH, "utf8");
  const doc = parseYaml(raw);
  const inputs = doc.inputs;
  assert.ok(inputs, "inputs required");
  for (const key of ["bundle", "public-key", "fail-on-mismatch"]) {
    assert.ok(inputs[key], `input.${key} missing`);
  }
  assert.equal(inputs.bundle.required, "true");
  assert.equal(inputs["public-key"].required, "true");
  assert.equal(inputs["fail-on-mismatch"].default, "true");
});


test("shadow-verify action declares the expected outputs", () => {
  const raw = readFileSync(ACTION_PATH, "utf8");
  const doc = parseYaml(raw);
  const outputs = doc.outputs;
  assert.ok(outputs);
  for (const key of ["ok", "reason", "failed_seq", "session_id", "event_count", "batch_root"]) {
    assert.ok(outputs[key], `output.${key} missing`);
  }
});


test("shadow-verify action points at bin/shadow-verify.mjs", () => {
  const raw = readFileSync(ACTION_PATH, "utf8");
  // Not parsing YAML for this — a substring check is enough and works
  // regardless of the block-scalar formatting the YAML uses.
  assert.match(raw, /bin\/shadow-verify\.mjs/);
  // Also make sure the file that path targets actually exists.
  const cli = readFileSync(CLI_PATH, "utf8");
  assert.match(cli, /^#!\/usr\/bin\/env node/);
});
