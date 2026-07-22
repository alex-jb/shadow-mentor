#!/usr/bin/env node
// Redacts a shadow-structured-events JSON before sharing: strips anything resembling evidence text,
// long hex secrets, emails, or SSNs. Keeps state/lifecycle/hash-summary fields. Usage:
//   node redact-diagnostics.mjs shadow-structured-events.json > redacted.json
import { readFileSync } from "node:fs";
const path = process.argv[2]; if (!path) { console.error("usage: redact-diagnostics.mjs <file>"); process.exit(1); }
let text = readFileSync(path, "utf8");
text = text
  .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED-SSN]")
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED-EMAIL]")
  .replace(/\b(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})\b/g, "[REDACTED-KEY]");
process.stdout.write(text);
