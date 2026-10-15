#!/usr/bin/env node
// Public-key-only review. Exit 0 means the capture was reviewed coherently,
// not that the invocation was authorized, safe, complete or successful.
import { readFileSync } from 'node:fs';
import { reviewControlledWrite } from '../lib/controlled-execution-evidence.js';

const args = process.argv.slice(2);
const values = {};
const allowed = new Set(['--bundle', '--capture-public-key', '--authorization-public-key']);
for (let i = 0; i < args.length; i += 2) {
  if (!allowed.has(args[i]) || !args[i + 1] || Object.hasOwn(values, args[i])) {
    console.error('Usage: --bundle BUNDLE_JSON --capture-public-key PEM --authorization-public-key PEM');
    process.exit(2);
  }
  values[args[i]] = args[i + 1];
}
if (Object.keys(values).length !== 3) {
  console.error('Usage: --bundle BUNDLE_JSON --capture-public-key PEM --authorization-public-key PEM');
  process.exit(2);
}
try {
  const result = reviewControlledWrite(JSON.parse(readFileSync(values['--bundle'], 'utf8')), {
    capturePublicKey: readFileSync(values['--capture-public-key']),
    authorizationPublicKey: readFileSync(values['--authorization-public-key']),
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.integrity === 'INVALID' || result.capture_shape !== 'CONSISTENT' ? 1 : 0;
} catch {
  console.error('Review failed: invalid or unreadable input.');
  process.exitCode = 2;
}
