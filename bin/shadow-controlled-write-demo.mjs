#!/usr/bin/env node
// Real local file operations, fixture grants, no model/provider/API calls.
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GRANT_SCHEMA, describeWrite, signWriteGrant, createControlledWriter,
  reviewControlledWrite } from '../lib/controlled-execution-evidence.js';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--output-dir') {
  console.error('Usage: node bin/shadow-controlled-write-demo.mjs --output-dir NEW_DIRECTORY');
  process.exit(2);
}
const destination = resolve(args[1]);
// Refuse overwrite, including an existing symlink. Do not create ancestors.
mkdirSync(destination, { mode: 0o700 });
const outputDir = join(destination, 'tool-files');
const ledgerDir = join(destination, 'grant-ledger');
mkdirSync(outputDir, { mode: 0o700 });
mkdirSync(ledgerDir, { mode: 0o700 });
const authorization = generateKeyPairSync('ed25519');
const capture = generateKeyPairSync('ed25519');
const publicPem = (key) => key.export({ type: 'spki', format: 'pem' });
writeFileSync(join(destination, 'authorization-public.pem'), publicPem(authorization.publicKey));
writeFileSync(join(destination, 'capture-public.pem'), publicPem(capture.publicKey));
const host = { roots: { demo: outputDir }, ledgerDir, runId: 'controlled-local-demo', actorId: 'fixture-subject',
  authorizationPublicKey: authorization.publicKey, capturePrivateKey: capture.privateKey };
const makeGrant = (id, filename, content) => signWriteGrant({ schema: GRANT_SCHEMA,
  grant_id: id, run_id: host.runId, actor_id: host.actorId, invocation_id: id,
  action: describeWrite({ rootId: 'demo', filename, content }),
  not_before_ms: Date.now() - 1000, expires_at_ms: Date.now() + 60000, max_attempts: 1 }, authorization.privateKey);
const results = [];
function run(name, { filename, content, grant, writer = createControlledWriter(host), invocationId }) {
  const executed = writer({ root_id: 'demo', filename, content, invocation_id: invocationId, grant_envelope: grant });
  const review = reviewControlledWrite(executed.bundle, { capturePublicKey: capture.publicKey,
    authorizationPublicKey: authorization.publicKey });
  const result = { name, gate_status: executed.gate_status, tool_status: executed.tool_status, review };
  writeFileSync(join(destination, name + '.bundle.json'), JSON.stringify(executed.bundle, null, 2) + '\n');
  results.push(result);
}
const allowed = makeGrant('allowed', 'allowed.txt', 'Approved local contents.\n');
run('valid-write', { filename: 'allowed.txt', content: 'Approved local contents.\n', grant: allowed, invocationId: 'allowed' });
run('replay-blocked', { filename: 'allowed.txt', content: 'Approved local contents.\n', grant: allowed, invocationId: 'allowed' });
run('changed-path-blocked', { filename: 'unapproved.txt', content: 'Approved local contents.\n', grant: allowed, invocationId: 'allowed' });
run('changed-content-blocked', { filename: 'allowed.txt', content: 'Unapproved content.', grant: allowed, invocationId: 'allowed' });
const transformed = makeGrant('transformed', 'transformed.txt', 'Original contents.');
run('visible-return-changed', { filename: 'transformed.txt', content: 'Original contents.', grant: transformed,
  invocationId: 'transformed', writer: createControlledWriter({ ...host, transformationId: 'CONTROLLED_RETURN_CHANGE',
    renderForModel: (raw) => ({ ...raw, bytes_written: 99999 }) }) });
const perturbed = makeGrant('perturbed', 'perturbed.txt', 'Before perturbation.');
run('readback-mismatch', { filename: 'perturbed.txt', content: 'Before perturbation.', grant: perturbed,
  invocationId: 'perturbed', writer: createControlledWriter({ ...host, transformationId: 'HARNESS_FILESYSTEM_PERTURBATION',
    renderForModel: (raw) => { writeFileSync(join(outputDir, 'perturbed.txt'), 'Changed by controlled test harness.'); return raw; } }) });
const summary = { schema: 'shadow-controlled-write-demo/1',
  boundary: 'Real local file operations under fixture-issued grants. No model calls, provider acceptance, authenticated human approval, independent effect confirmation, or capture-completeness proof.',
  results };
writeFileSync(join(destination, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
