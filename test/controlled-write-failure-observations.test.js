import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Faults stay in a child process: changing a Node built-in export must not
// affect concurrently running tests or require a test-only production hook.
const childProgram = String.raw`
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { generateKeyPairSync } from 'node:crypto';
import { join } from 'node:path';

const [moduleUrl, base, mode] = process.argv.slice(1);
const { GRANT_SCHEMA, describeWrite, signWriteGrant, executeControlledWrite,
  reviewControlledWrite } = await import(moduleUrl);
const outputDir = join(base, 'output');
const ledgerDir = join(base, 'ledger');
fs.mkdirSync(outputDir);
fs.mkdirSync(ledgerDir);
const target = join(outputDir, 'evidence.txt');
const authorization = generateKeyPairSync('ed25519');
const capture = generateKeyPairSync('ed25519');
const config = { outputDir, ledgerDir, rootId: 'local-output', filename: 'evidence.txt',
  content: 'approved bytes\n', runId: 'failure-run', actorId: 'failure-actor',
  invocationId: 'failure-call', authorizationPublicKey: authorization.publicKey,
  capturePrivateKey: capture.privateKey };
const now = Date.now();
const grantEnvelope = signWriteGrant({ schema: GRANT_SCHEMA, grant_id: 'failure-grant',
  run_id: config.runId, actor_id: config.actorId, invocation_id: config.invocationId,
  action: describeWrite(config), not_before_ms: now - 1000, expires_at_ms: now + 60_000,
  max_attempts: 1 }, authorization.privateKey);
const realFsync = fs.fsyncSync;
const realOpen = fs.openSync;
const realClose = fs.closeSync;
const targetDescriptors = new Set();
let injectedFailures = 0;
if (mode === 'fsync') {
  fs.openSync = function (...args) {
    const fd = realOpen(...args);
    if (args[0] === target) targetDescriptors.add(fd);
    return fd;
  };
  fs.closeSync = function (fd) {
    try { return realClose(fd); }
    finally { targetDescriptors.delete(fd); }
  };
  fs.fsyncSync = function (fd) {
    if (targetDescriptors.has(fd)) {
      injectedFailures += 1;
      const error = new Error('Injected output fsync failure after write');
      error.code = 'EIO';
      throw error;
    }
    return realFsync(fd);
  };
  syncBuiltinESMExports();
} else if (mode === 'fifo') {
  config.transformationId = 'replace-target-with-fifo';
  config.renderForModel = (raw) => {
    fs.unlinkSync(target);
    execFileSync('mkfifo', [target]);
    return raw;
  };
} else {
  throw new Error('Unknown failure mode');
}

let result;
try {
  result = executeControlledWrite({ ...config, grantEnvelope });
} finally {
  fs.fsyncSync = realFsync;
  fs.openSync = realOpen;
  fs.closeSync = realClose;
  syncBuiltinESMExports();
}
const rows = result.bundle.events.map((event) => event.extensions?.controlled_execution)
  .filter(Boolean);
const records = fs.readFileSync(result.capture_store_path, 'utf8').trimEnd().split('\n')
  .map(JSON.parse);
const retry = executeControlledWrite({ ...config, grantEnvelope });
process.stdout.write(JSON.stringify({ injectedFailures,
  targetExists: fs.existsSync(target),
  targetIsFifo: fs.lstatSync(target).isFIFO(),
  actualContent: mode === 'fsync' ? fs.readFileSync(target, 'utf8') : null,
  gateStatus: result.gate_status, toolStatus: result.tool_status,
  rawReturns: rows.filter((row) => row.kind === 'RAW_RETURN'),
  preparedReturns: rows.filter((row) => ['MODEL_VISIBLE_RETURN', 'MODEL_INPUT_PREPARED'].includes(row.kind)),
  readbacks: rows.filter((row) => row.kind === 'LOCAL_READBACK'),
  readbackFailures: rows.filter((row) => row.kind === 'READBACK_UNAVAILABLE'),
  review: reviewControlledWrite(result.bundle, { capturePublicKey: capture.publicKey,
    authorizationPublicKey: authorization.publicKey }),
  retry: { gateStatus: retry.gate_status, toolStatus: retry.tool_status },
  sealedCapture: records.at(-1).kind === 'seal' }));
`;

function runIsolatedFailure(t, mode) {
  const base = mkdtempSync(join(tmpdir(), 'shadow-failure-observation-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const moduleUrl = new URL('../lib/controlled-execution-evidence.js', import.meta.url).href;
  const child = spawnSync(process.execPath,
    ['--input-type=module', '-e', childProgram, moduleUrl, base, mode],
    { encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 });
  assert.equal(child.error?.code, undefined,
    `The isolated ${mode} child must return within 3 seconds: ${child.error?.message ?? ''}\n${child.stderr}`);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.signal, null);
  return JSON.parse(child.stdout);
}

test('an output fsync error can leave real bytes while its sealed effect stays unconfirmed', { timeout: 5000 }, (t) => {
  const observed = runIsolatedFailure(t, 'fsync');
  assert.equal(observed.injectedFailures, 1, 'inject only the target file fsync failure');
  assert.equal(observed.targetExists, true);
  assert.equal(observed.actualContent, 'approved bytes\n');
  assert.equal(observed.gateStatus, 'GRANT_MATCH');
  assert.equal(observed.toolStatus, 'FAILED');
  assert.equal(observed.rawReturns.length, 1);
  assert.deepEqual(observed.rawReturns[0].value, { status: 'FAILED', error_code: 'EIO' });
  assert.equal(observed.preparedReturns.length, 1);
  assert.deepEqual(observed.preparedReturns[0].value, { status: 'FAILED', error_code: 'EIO' });
  assert.equal(observed.readbacks.length, 0);
  assert.equal(observed.review.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(observed.review.capture_shape, 'CONSISTENT');
  assert.equal(observed.review.return_relation, 'IDENTICAL');
  assert.equal(observed.review.effect, 'UNCONFIRMED', 'FAILED does not establish absence of a filesystem effect');
  assert.deepEqual(observed.retry, { gateStatus: 'GRANT_ALREADY_CONSUMED', toolStatus: 'NOT_DISPATCHED' });
  assert.equal(observed.sealedCapture, true);
});

test('replacing the target with a FIFO cannot block readback or produce a confirmed effect', { timeout: 5000 }, (t) => {
  const observed = runIsolatedFailure(t, 'fifo');
  assert.equal(observed.targetExists, true);
  assert.equal(observed.targetIsFifo, true);
  assert.equal(observed.gateStatus, 'GRANT_MATCH');
  assert.equal(observed.toolStatus, 'CREATED');
  assert.equal(observed.rawReturns.length, 1);
  assert.equal(observed.rawReturns[0].value.status, 'CREATED');
  assert.equal(observed.readbacks.length, 0);
  assert.equal(observed.readbackFailures.length, 1);
  assert.equal(observed.review.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(observed.review.capture_shape, 'CONSISTENT');
  assert.equal(observed.review.effect, 'UNCONFIRMED');
  assert.equal(observed.sealedCapture, true);
});
