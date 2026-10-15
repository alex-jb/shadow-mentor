import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GRANT_SCHEMA, describeWrite, signWriteGrant, executeControlledWrite,
  createControlledWriter, keyFingerprint, reviewControlledWrite } from '../lib/controlled-execution-evidence.js';
import { createSession, appendEvent, sealSession, recoverSession, verifyBundle } from '../packages/attest-core/session.js';
import { createFileStore } from '../packages/attest-core/store-file.js';
import { canonicalize } from '../packages/attest-core/attestation.js';

// Exercise a real, bounded filesystem tool with independently pinned issuer
// and capture keys. These tests do not establish provider-hook completeness,
// organizational authority, or an independent filesystem observer.
function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'shadow-controlled-write-'));
  const outputDir = join(base, 'output');
  const ledgerDir = join(base, 'ledger');
  mkdirSync(outputDir);
  mkdirSync(ledgerDir);
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const authorization = generateKeyPairSync('ed25519');
  const capture = generateKeyPairSync('ed25519');
  const defaults = { outputDir, ledgerDir, rootId: 'test-output', filename: 'evidence.txt',
    content: 'Approval-bound local evidence.\n', runId: 'run-test', actorId: 'actor-test',
    invocationId: 'call-test', authorizationPublicKey: authorization.publicKey,
    capturePrivateKey: capture.privateKey };
  const atMs = Date.now();
  function envelope(grantOverrides = {}, issuer = authorization.privateKey) {
    return signWriteGrant({ schema: GRANT_SCHEMA, grant_id: 'grant-test',
      run_id: defaults.runId, actor_id: defaults.actorId, invocation_id: defaults.invocationId,
      action: describeWrite(defaults), not_before_ms: atMs - 60_000,
      expires_at_ms: atMs + 60_000, max_attempts: 1, ...grantOverrides }, issuer);
  }
  function execute(overrides = {}) {
    return executeControlledWrite({ ...defaults, grantEnvelope: envelope(), ...overrides });
  }
  function review(bundle, overrides = {}) {
    return reviewControlledWrite(bundle, { capturePublicKey: capture.publicKey,
      authorizationPublicKey: authorization.publicKey, ...overrides });
  }
  return { base, defaults, outputDir, ledgerDir, authorization, capture,
    envelope, execute, review, target: join(outputDir, defaults.filename) };
}

function rows(bundle, kind) {
  return bundle.events.map((event) => event.extensions?.controlled_execution)
    .filter((data) => data?.kind === kind);
}

function assertBlocked(f, result, expected) {
  assert.equal(result.gate_status, expected);
  assert.equal(result.tool_status, 'NOT_DISPATCHED');
  assert.equal(existsSync(f.target), false, 'a rejected invocation must not create the target');
  assert.equal(rows(result.bundle, 'RAW_RETURN').length, 0);
  assert.equal(rows(result.bundle, 'LOCAL_READBACK').length, 0);
  const reviewed = f.review(result.bundle);
  assert.equal(reviewed.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(reviewed.effect, 'UNCONFIRMED');
  return reviewed;
}

// A holder of the trusted capture key can produce a new signed story. The
// reviewer must independently recheck its grant rather than trust gate labels.
function reseal(f, bundle, { mutate = () => {}, omitKind = null, incoherentKind = null, extraRows = [], reorder = (events) => events } = {}) {
  const session = createSession({ agent: bundle.header.agent, models: bundle.header.models,
    environmentFingerprint: bundle.header.environment_fingerprint, keyId: 'test-capture',
    privateKey: f.capture.privateKey, startedAtUtc: bundle.header.session_started_at_utc });
  let addedExtras = false;
  function appendExtras() {
    if (addedExtras) return;
    addedExtras = true;
    for (const { event_type, data } of extraRows) {
      appendEvent(session, { event_type, actor: 'system',
        ts_utc: bundle.header.session_ended_at_utc,
        payload: Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'kind')),
        extensions: { controlled_execution: data } });
    }
  }
  for (const original of reorder([...bundle.events])) {
    const event = structuredClone(original);
    const data = event.extensions?.controlled_execution;
    if (data?.kind === omitKind) continue;
    if (event.event_type === 'session_end') appendExtras();
    mutate(data, event);
    const payload = data ? Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'kind')) : {};
    appendEvent(session, { event_type: event.event_type, actor: event.actor,
      ts_utc: event.ts_utc, extensions: event.extensions,
      payload: data?.kind === incoherentKind ? { deliberately_different: true } : payload });
  }
  appendExtras();
  return sealSession(session, { omitSessionEnd: true });
}

test('controlled write creates the approved bytes and captures a real local readback', (t) => {
  const f = fixture(t);
  const result = f.execute();
  assert.equal(result.gate_status, 'GRANT_MATCH');
  assert.equal(result.tool_status, 'CREATED');
  assert.equal(readFileSync(f.target, 'utf8'), f.defaults.content);
  assert.equal(rows(result.bundle, 'RAW_RETURN')[0].value.bytes_written,
    Buffer.byteLength(f.defaults.content, 'utf8'));
  assert.equal(rows(result.bundle, 'LOCAL_READBACK')[0].status, 'LOCAL_READBACK_MATCH');
  const reviewed = f.review(result.bundle);
  assert.equal(reviewed.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(reviewed.capture_shape, 'CONSISTENT');
  assert.equal(reviewed.grant_binding, 'GRANT_MATCH');
  assert.equal(reviewed.return_relation, 'IDENTICAL');
  assert.equal(reviewed.effect, 'LOCAL_READBACK_MATCH');
  assert.equal(reviewed.capture_completeness, 'UNVERIFIED');
  assert.equal(reviewed.independent_effect, 'UNVERIFIED');
});

test('approval for a different path cannot dispatch the actual path', (t) => {
  const f = fixture(t);
  const grantEnvelope = f.envelope({ action: describeWrite({ ...f.defaults, filename: 'different.txt' }) });
  const reviewed = assertBlocked(f, f.execute({ grantEnvelope }), 'ACTION_MISMATCH');
  assert.equal(reviewed.grant_binding, 'ACTION_MISMATCH');
  assert.equal(existsSync(join(f.outputDir, 'different.txt')), false);
});

test('approval for different content cannot dispatch the actual bytes', (t) => {
  const f = fixture(t);
  const grantEnvelope = f.envelope({ action: describeWrite({ ...f.defaults, content: 'other content' }) });
  assert.equal(assertBlocked(f, f.execute({ grantEnvelope }), 'ACTION_MISMATCH').grant_binding,
    'ACTION_MISMATCH');
});

test('an unpinned issuer cannot authorize a write', (t) => {
  const f = fixture(t);
  const wrongIssuer = generateKeyPairSync('ed25519');
  const grantEnvelope = f.envelope({}, wrongIssuer.privateKey);
  assert.equal(assertBlocked(f, f.execute({ grantEnvelope }), 'SIGNATURE_MISMATCH').grant_binding,
    'SIGNATURE_MISMATCH');
});

test('a grant cannot be transferred to a different actor', (t) => {
  const f = fixture(t);
  assert.equal(assertBlocked(f, f.execute({ actorId: 'different-actor' }),
    'SUBJECT_OR_RUN_MISMATCH').grant_binding, 'SUBJECT_OR_RUN_MISMATCH');
});

test('a grant cannot be transferred to a different run', (t) => {
  const f = fixture(t);
  assertBlocked(f, f.execute({ runId: 'different-run' }), 'SUBJECT_OR_RUN_MISMATCH');
});

test('a grant cannot be transferred to a different invocation', (t) => {
  const f = fixture(t);
  assertBlocked(f, f.execute({ invocationId: 'different-call' }), 'SUBJECT_OR_RUN_MISMATCH');
});

test('an expired approval cannot dispatch a write', (t) => {
  const f = fixture(t);
  const now = Date.now();
  const grantEnvelope = f.envelope({ not_before_ms: now - 20_000, expires_at_ms: now - 10_000 });
  assert.equal(assertBlocked(f, f.execute({ grantEnvelope }), 'OUTSIDE_VALIDITY_WINDOW').grant_binding,
    'OUTSIDE_VALIDITY_WINDOW');
});

test('the local ledger rejects replay of a consumed grant', (t) => {
  const f = fixture(t);
  const grantEnvelope = f.envelope();
  assert.equal(f.execute({ grantEnvelope }).tool_status, 'CREATED');
  const original = readFileSync(f.target, 'utf8');
  const replay = f.execute({ grantEnvelope });
  assert.equal(replay.gate_status, 'GRANT_ALREADY_CONSUMED');
  assert.equal(replay.tool_status, 'NOT_DISPATCHED');
  assert.equal(readFileSync(f.target, 'utf8'), original);
  assert.equal(rows(replay.bundle, 'RAW_RETURN').length, 0);
  const reviewed = f.review(replay.bundle);
  assert.equal(reviewed.grant_binding, 'GRANT_MATCH', 'grant validity differs from replay admission');
  assert.equal(reviewed.recorded_gate, 'GRANT_ALREADY_CONSUMED');
  assert.equal(reviewed.effect, 'UNCONFIRMED');
});

test('a pre-existing target is not overwritten and the failed attempt consumes its grant', (t) => {
  const f = fixture(t);
  writeFileSync(f.target, 'existing bytes');
  const grantEnvelope = f.envelope();
  const first = f.execute({ grantEnvelope });
  assert.equal(first.gate_status, 'GRANT_MATCH');
  assert.equal(first.tool_status, 'FAILED');
  assert.equal(readFileSync(f.target, 'utf8'), 'existing bytes');
  assert.equal(rows(first.bundle, 'RAW_RETURN')[0].value.error_code, 'EEXIST');
  assert.equal(f.review(first.bundle).effect, 'UNCONFIRMED');
  rmSync(f.target);
  const retry = f.execute({ grantEnvelope });
  assertBlocked(f, retry, 'GRANT_ALREADY_CONSUMED');
});

test('symlink targets are not followed and symlink host roots are rejected', (t) => {
  const f = fixture(t);
  const outside = join(f.base, 'outside.txt');
  writeFileSync(outside, 'do not replace');
  symlinkSync(outside, f.target);
  const result = f.execute();
  assert.equal(result.tool_status, 'FAILED');
  assert.equal(readFileSync(outside, 'utf8'), 'do not replace');
  assert.equal(f.review(result.bundle).effect, 'UNCONFIRMED');
  const rootLink = join(f.base, 'output-link');
  symlinkSync(f.outputDir, rootLink);
  assert.throws(() => f.execute({ outputDir: rootLink }), /Host directory must be real/);
});

test('raw output is retained separately from a named model-visible transformation', (t) => {
  const f = fixture(t);
  const result = f.execute({ transformationId: 'host-redaction-v1',
    renderForModel: (raw) => ({ summary: 'Created locally', bytes_written: raw.bytes_written }) });
  const raw = rows(result.bundle, 'RAW_RETURN')[0];
  const visible = rows(result.bundle, 'MODEL_VISIBLE_RETURN')[0];
  assert.equal(raw.value.status, 'CREATED');
  assert.equal(raw.value.path, f.defaults.filename);
  assert.equal(visible.value.path, undefined);
  assert.equal(visible.transformation_id, 'host-redaction-v1');
  assert.notEqual(raw.sha256, visible.sha256);
  const reviewed = f.review(result.bundle);
  assert.equal(reviewed.return_relation, 'TRANSFORM_RECORDED_UNASSESSED');
  assert.equal(reviewed.effect, 'LOCAL_READBACK_MATCH');
});

test('a failed presentation callback does not erase the earlier raw tool return', (t) => {
  const f = fixture(t);
  const result = f.execute({ transformationId: 'throwing-view-v1',
    renderForModel: () => { throw new Error('presentation failed'); } });
  assert.equal(result.tool_status, 'CREATED');
  assert.equal(readFileSync(f.target, 'utf8'), f.defaults.content);
  assert.equal(rows(result.bundle, 'RAW_RETURN')[0].value.status, 'CREATED');
  assert.equal(rows(result.bundle, 'PRESENTATION_FAILED').length, 1);
  assert.equal(rows(result.bundle, 'MODEL_VISIBLE_RETURN').length, 0);
  const reviewed = f.review(result.bundle);
  assert.equal(reviewed.return_relation, 'MISSING');
  assert.equal(reviewed.effect, 'LOCAL_READBACK_MATCH');
});

test('post-write file mutation produces a readback mismatch despite a CREATED raw return', (t) => {
  const f = fixture(t);
  const result = f.execute({ transformationId: 'mutating-view-v1', renderForModel: (raw) => {
    writeFileSync(f.target, 'bytes changed after tool return');
    return raw;
  } });
  assert.equal(result.tool_status, 'CREATED');
  assert.equal(rows(result.bundle, 'RAW_RETURN')[0].value.status, 'CREATED');
  assert.equal(rows(result.bundle, 'LOCAL_READBACK')[0].status, 'LOCAL_READBACK_MISMATCH');
  assert.equal(f.review(result.bundle).effect, 'LOCAL_READBACK_MISMATCH');
});

test('editing an already signed bundle fails integrity review', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const tampered = structuredClone(bundle);
  const raw = tampered.events.find((event) => event.extensions?.controlled_execution?.kind === 'RAW_RETURN');
  raw.extensions.controlled_execution.value.bytes_written += 1;
  const reviewed = f.review(tampered);
  assert.equal(reviewed.integrity, 'INVALID');
  assert.equal(reviewed.grant_binding, 'NOT_EVALUATED');
  assert.equal(reviewed.effect, 'NOT_EVALUATED');
});

test('a different capture public key cannot verify the execution bundle', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const wrongCapture = generateKeyPairSync('ed25519');
  const reviewed = f.review(bundle, { capturePublicKey: wrongCapture.publicKey });
  assert.equal(reviewed.integrity, 'INVALID');
  assert.equal(reviewed.effect, 'NOT_EVALUATED');
});

test('a freshly signed GRANT_MATCH label cannot override the signed approval action', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const dishonest = reseal(f, bundle, { mutate: (data) => {
    if (data?.kind === 'ATTEMPT') {
      data.action = describeWrite({ ...f.defaults, filename: 'unapproved.txt' });
      data.gate_status = 'GRANT_MATCH';
    }
  } });
  const reviewed = f.review(dishonest);
  assert.equal(reviewed.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(reviewed.capture_shape, 'INCONSISTENT');
  assert.equal(reviewed.effect, 'NOT_EVALUATED');
  assert.equal(reviewed.recorded_gate, 'GRANT_MATCH');
  assert.equal(reviewed.grant_binding, 'ACTION_MISMATCH');
  // A local observation is distinct from proof of authorized execution.
  assert.notEqual(reviewed.grant_binding, reviewed.recorded_gate);
});

test('a signed success return without a readback remains unconfirmed', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const missingReadback = reseal(f, bundle, { omitKind: 'LOCAL_READBACK' });
  assert.equal(rows(missingReadback, 'RAW_RETURN')[0].value.status, 'CREATED');
  const reviewed = f.review(missingReadback);
  assert.equal(reviewed.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(reviewed.grant_binding, 'GRANT_MATCH');
  assert.equal(reviewed.effect, 'UNCONFIRMED');
});

test('re-signed matching action and readback claims cannot contradict the independent grant', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const fakeHash = 'a'.repeat(64);
  const dishonest = reseal(f, bundle, { mutate: (data) => {
    if (data?.kind === 'ATTEMPT') data.action.content_sha256 = fakeHash;
    if (data?.kind === 'LOCAL_READBACK') data.content_sha256 = fakeHash;
  } });
  const reviewed = f.review(dishonest);
  assert.equal(reviewed.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(reviewed.recorded_gate, 'GRANT_MATCH');
  assert.equal(reviewed.grant_binding, 'ACTION_MISMATCH');
  assert.equal(reviewed.capture_shape, 'INCONSISTENT');
  assert.equal(reviewed.effect, 'NOT_EVALUATED');
});

test('historical review evaluates approval validity at recorded admission time', (t) => {
  const f = fixture(t);
  const realNow = Date.now();
  const admissionAt = realNow - 20_000;
  const grantEnvelope = f.envelope({ not_before_ms: admissionAt - 1_000,
    expires_at_ms: admissionAt + 1_000 });
  const clock = t.mock.method(Date, 'now', () => admissionAt);
  const result = f.execute({ grantEnvelope });
  clock.mock.restore();
  assert.ok(Date.now() > grantEnvelope.grant.expires_at_ms, 'the grant is expired at review time');
  assert.equal(rows(result.bundle, 'ATTEMPT')[0].at_ms, admissionAt);
  const reviewed = f.review(result.bundle);
  assert.equal(reviewed.grant_binding, 'GRANT_MATCH');
  assert.equal(reviewed.effect, 'LOCAL_READBACK_MATCH');
});

test('a valid signature over inconsistent payload and capture extension cannot confirm the effect', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const inconsistent = reseal(f, bundle, { incoherentKind: 'LOCAL_READBACK' });
  const reviewed = f.review(inconsistent);
  assert.equal(reviewed.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(reviewed.capture_shape, 'INCONSISTENT');
  assert.equal(reviewed.effect, 'NOT_EVALUATED');
});

function factoryFor(f, roots = { [f.defaults.rootId]: f.outputDir }) {
  return createControlledWriter({ roots, ledgerDir: f.ledgerDir, runId: f.defaults.runId,
    actorId: f.defaults.actorId, authorizationPublicKey: f.authorization.publicKey,
    capturePrivateKey: f.capture.privateKey });
}

function requestFor(f, overrides = {}) {
  return { root_id: f.defaults.rootId, filename: f.defaults.filename, content: f.defaults.content,
    invocation_id: f.defaults.invocationId, grant_envelope: f.envelope(), ...overrides };
}

test('the host factory rejects a changing root accessor without evaluating it or writing files', (t) => {
  const f = fixture(t);
  const alternateDir = join(f.base, 'alternate-output');
  mkdirSync(alternateDir);
  const writer = factoryFor(f, { [f.defaults.rootId]: f.outputDir, alternate: alternateDir });
  const request = requestFor(f);
  let reads = 0;
  Object.defineProperty(request, 'root_id', { enumerable: true, get() {
    return [f.defaults.rootId, 'alternate', f.defaults.rootId][reads++ % 3];
  } });
  assert.throws(() => writer(request), /Data properties required/);
  assert.equal(reads, 0, 'request normalization must not run the accessor');
  assert.equal(existsSync(f.target), false);
  assert.equal(existsSync(join(alternateDir, f.defaults.filename)), false);
});

test('extra outputDir and unknown-root requests cannot replace host configuration', (t) => {
  const f = fixture(t);
  const alternateDir = join(f.base, 'alternate-output');
  mkdirSync(alternateDir);
  const writer = factoryFor(f);
  assert.throws(() => writer(requestFor(f, { outputDir: alternateDir })), /Invalid tool request/);
  assert.throws(() => writer(requestFor(f, { root_id: 'unknown-root' })), /Invalid tool request/);
  assert.equal(existsSync(f.target), false);
  assert.equal(existsSync(join(alternateDir, f.defaults.filename)), false);
  const accepted = writer(requestFor(f));
  assert.equal(accepted.tool_status, 'CREATED');
  assert.equal(readFileSync(f.target, 'utf8'), f.defaults.content);
  assert.equal(existsSync(join(alternateDir, f.defaults.filename)), false);
});

test('a re-signed raw return with a false value digest is still an inconsistent capture', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const falseDigest = reseal(f, bundle, { mutate: (data) => {
    if (data?.kind === 'RAW_RETURN') data.sha256 = '0'.repeat(64);
  } });
  const reviewed = f.review(falseDigest);
  assert.equal(reviewed.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(reviewed.capture_shape, 'INCONSISTENT');
  assert.equal(reviewed.return_relation, 'NOT_EVALUATED');
  assert.equal(reviewed.effect, 'NOT_EVALUATED');
});

test('independent Node processes sharing a grant and ledger admit only one execution', { timeout: 10_000 }, async (t) => {
  const f = fixture(t);
  const authorizationPath = join(f.base, 'authorization-public.pem');
  const capturePath = join(f.base, 'capture-private.pem');
  writeFileSync(authorizationPath, f.authorization.publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o600 });
  writeFileSync(capturePath, f.capture.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const config = { outputDir: f.outputDir, ledgerDir: f.ledgerDir,
    rootId: f.defaults.rootId, filename: f.defaults.filename, content: f.defaults.content,
    runId: f.defaults.runId, actorId: f.defaults.actorId, invocationId: f.defaults.invocationId,
    grantEnvelope: f.envelope(), authorizationPath, capturePath };
  const moduleUrl = new URL('../lib/controlled-execution-evidence.js', import.meta.url).href;
  const childCode = `
    import { readFileSync } from 'node:fs';
    const { executeControlledWrite } = await import(${JSON.stringify(moduleUrl)});
    const config = JSON.parse(process.argv[1]);
    const authorizationPublicKey = readFileSync(config.authorizationPath, 'utf8');
    const capturePrivateKey = readFileSync(config.capturePath, 'utf8');
    process.stdout.write('READY\\n');
    await new Promise((resolve) => process.stdin.once('data', resolve));
    const result = executeControlledWrite({ ...config, authorizationPublicKey, capturePrivateKey });
    process.stdout.write(JSON.stringify({ gate_status: result.gate_status, tool_status: result.tool_status }) + '\\n');
  `;
  function startProcess() {
    const child = spawn(process.execPath, ['--input-type=module', '-e', childCode, JSON.stringify(config)],
      { stdio: ['pipe', 'pipe', 'pipe'] });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let stdout = '';
    let stderr = '';
    let readyResolve;
    let readyReject;
    const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.startsWith('READY\n')) readyResolve();
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const result = new Promise((resolve, reject) => {
      child.on('error', (error) => { readyReject(error); reject(error); });
      child.on('close', (code) => {
        if (code !== 0) {
          const error = new Error(`controlled-write child failed (${code}): ${stderr}`);
          readyReject(error);
          reject(error);
          return;
        }
        try { resolve(JSON.parse(stdout.trim().split('\n').at(-1))); }
        catch (error) { readyReject(error); reject(error); }
      });
    });
    // Keep startup errors observed while the parent waits at the readiness barrier.
    result.catch(() => {});
    return { child, ready, result };
  }
  const first = startProcess();
  const second = startProcess();
  await Promise.all([first.ready, second.ready]);
  first.child.stdin.end('EXECUTE\n');
  second.child.stdin.end('EXECUTE\n');
  const results = await Promise.all([first.result, second.result]);
  assert.deepEqual(results.map((result) => result.gate_status).sort(),
    ['GRANT_ALREADY_CONSUMED', 'GRANT_MATCH']);
  assert.deepEqual(results.map((result) => result.tool_status).sort(), ['CREATED', 'NOT_DISPATCHED']);
  assert.equal(readFileSync(f.target, 'utf8'), f.defaults.content);
});

test('pre-existing reservation directories or symlinks block dispatch before a file effect', (t) => {
  for (const obstacle of ['directory', 'symlink']) {
    const f = fixture(t);
    const markerName = createHash('sha256').update(canonicalize({
      issuer: keyFingerprint(f.authorization.publicKey), grant_id: 'grant-test',
    })).digest('hex') + '.json';
    const marker = join(f.ledgerDir, markerName);
    const externalMarker = join(f.base, 'external-marker.txt');
    if (obstacle === 'directory') mkdirSync(marker);
    else {
      writeFileSync(externalMarker, 'reservation must not overwrite this');
      symlinkSync(externalMarker, marker);
    }
    const result = f.execute();
    assertBlocked(f, result, 'GRANT_ALREADY_CONSUMED');
    assert.equal(f.review(result.bundle).grant_binding, 'GRANT_MATCH');
    if (obstacle === 'symlink') assert.equal(readFileSync(externalMarker, 'utf8'),
      'reservation must not overwrite this');
  }
});

function assertInconsistentSignedStream(f, bundle) {
  const reviewed = f.review(bundle);
  assert.equal(reviewed.integrity, 'VALID_CAPTURE_SIGNATURE');
  assert.equal(reviewed.grant_binding, 'GRANT_MATCH');
  assert.equal(reviewed.capture_shape, 'INCONSISTENT');
  assert.equal(reviewed.effect, 'NOT_EVALUATED');
  assert.equal(reviewed.return_relation, 'NOT_EVALUATED');
}

function swapCapturedKinds(first, second) {
  return (events) => {
    const a = events.findIndex((event) => event.extensions?.controlled_execution?.kind === first);
    const b = events.findIndex((event) => event.extensions?.controlled_execution?.kind === second);
    assert.ok(a >= 0 && b >= 0, 'both captured rows must exist before reordering');
    [events[a], events[b]] = [events[b], events[a]];
    return events;
  };
}

test('a presentation failure requires a preceding raw return even when readback is missing', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute({ transformationId: 'throwing-view', renderForModel: () => { throw new Error('failed'); } });
  const noReadback = reseal(f, bundle, { omitKind: 'LOCAL_READBACK' });
  assertInconsistentSignedStream(f, reseal(f, noReadback, { omitKind: 'RAW_RETURN' }));
});

test('a presentation failure before the raw return cannot leave a matching readback confirmed', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute({ transformationId: 'throwing-view', renderForModel: () => { throw new Error('failed'); } });
  assertInconsistentSignedStream(f, reseal(f, bundle, { reorder: swapCapturedKinds('PRESENTATION_FAILED', 'RAW_RETURN') }));
});

test('a local readback before the raw return is an inconsistent stream', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  assertInconsistentSignedStream(f, reseal(f, bundle, { reorder: swapCapturedKinds('LOCAL_READBACK', 'RAW_RETURN') }));
});

test('a readback failure before the raw return is an inconsistent stream', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute({ transformationId: 'remove-before-readback', renderForModel: (raw) => { rmSync(f.target); return raw; } });
  assert.equal(f.review(bundle).capture_shape, 'CONSISTENT');
  assert.equal(f.review(bundle).effect, 'UNCONFIRMED');
  assertInconsistentSignedStream(f, reseal(f, bundle, { reorder: swapCapturedKinds('READBACK_UNAVAILABLE', 'RAW_RETURN') }));
});

test('a local readback cannot precede the captured model response preparation', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  assertInconsistentSignedStream(f, reseal(f, bundle, { reorder: swapCapturedKinds('LOCAL_READBACK', 'MODEL_VISIBLE_RETURN') }));
});

test('a local readback cannot precede the captured presentation failure', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute({ transformationId: 'throwing-view', renderForModel: () => { throw new Error('failed'); } });
  assertInconsistentSignedStream(f, reseal(f, bundle, { reorder: swapCapturedKinds('LOCAL_READBACK', 'PRESENTATION_FAILED') }));
});

test('a file grown beyond the write limit leaves readback unavailable and consumes its grant', (t) => {
  const f = fixture(t);
  const grantEnvelope = f.envelope();
  const result = f.execute({ grantEnvelope, transformationId: 'grow-before-readback', renderForModel: (raw) => {
    writeFileSync(f.target, Buffer.alloc(65537, 97));
    return raw;
  } });
  assert.equal(result.tool_status, 'CREATED');
  assert.equal(statSync(f.target).size, 65537);
  assert.equal(rows(result.bundle, 'LOCAL_READBACK').length, 0);
  assert.equal(rows(result.bundle, 'READBACK_UNAVAILABLE').length, 1);
  const review = f.review(result.bundle);
  assert.equal(review.capture_shape, 'CONSISTENT');
  assert.equal(review.effect, 'UNCONFIRMED');
  assert.equal(f.execute({ grantEnvelope }).gate_status, 'GRANT_ALREADY_CONSUMED');
});

test('readback accepts the full 65536-byte content limit and empty content', (t) => {
  for (const content of ['', 'é'.repeat(32768)]) {
    const f = fixture(t);
    const grantEnvelope = f.envelope({ action: describeWrite({ ...f.defaults, content }) });
    const result = f.execute({ content, grantEnvelope });
    assert.equal(result.tool_status, 'CREATED');
    assert.equal(readFileSync(f.target, 'utf8'), content);
    assert.equal(f.review(result.bundle).effect, 'LOCAL_READBACK_MATCH');
  }
});

test('a signed stream cannot claim both BLOCKED and CREATED for the same invocation', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const contradictory = reseal(f, bundle, { extraRows: [{ event_type: 'tool_error', data: {
    kind: 'BLOCKED', invocation_id: f.defaults.invocationId, reason: 'GRANT_ALREADY_CONSUMED',
  } }] });
  assert.equal(rows(contradictory, 'RAW_RETURN')[0].value.status, 'CREATED');
  assert.equal(rows(contradictory, 'BLOCKED').length, 1);
  assertInconsistentSignedStream(f, contradictory);
});

test('a signed stream cannot claim both a model-visible return and presentation failure', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const contradictory = reseal(f, bundle, { extraRows: [{ event_type: 'error', data: {
    kind: 'PRESENTATION_FAILED', invocation_id: f.defaults.invocationId,
  } }] });
  assert.equal(rows(contradictory, 'MODEL_VISIBLE_RETURN').length, 1);
  assert.equal(rows(contradictory, 'PRESENTATION_FAILED').length, 1);
  assertInconsistentSignedStream(f, contradictory);
});

test('a signed stream cannot claim both local readback and readback unavailability', (t) => {
  const f = fixture(t);
  const { bundle } = f.execute();
  const contradictory = reseal(f, bundle, { extraRows: [{ event_type: 'error', data: {
    kind: 'READBACK_UNAVAILABLE', invocation_id: f.defaults.invocationId,
  } }] });
  assert.equal(rows(contradictory, 'LOCAL_READBACK').length, 1);
  assert.equal(rows(contradictory, 'READBACK_UNAVAILABLE').length, 1);
  assertInconsistentSignedStream(f, contradictory);
});

test('a public-only capture key fails before creating a target, capture store or reservation', (t) => {
  const f = fixture(t);
  assert.throws(() => f.execute({ capturePrivateKey: f.capture.publicKey }));
  assert.equal(existsSync(f.target), false);
  assert.deepEqual(readdirSync(f.ledgerDir), [], 'preflight failure must precede every ledger mutation');
});

test('the durable JSONL capture recovers the exact sealed bundle and verifies its signature', (t) => {
  const f = fixture(t);
  const result = f.execute();
  assert.equal(typeof result.capture_store_path, 'string');
  assert.ok(result.capture_store_path.startsWith(f.ledgerDir + '/'));
  assert.equal(statSync(result.capture_store_path).mode & 0o777, 0o600);
  const records = readFileSync(result.capture_store_path, 'utf8').trimEnd().split('\n').map(JSON.parse);
  assert.equal(records[0].kind, 'header');
  assert.equal(records.at(-1).kind, 'seal');
  assert.equal(records.filter((record) => record.kind === 'event').length, result.bundle.events.length);
  const recovered = recoverSession({ store: createFileStore({ path: result.capture_store_path }),
    privateKey: f.capture.privateKey });
  assert.equal(recovered._sealed, true);
  assert.throws(() => sealSession(recovered), /already sealed/);
  const restoredBundle = { bundle_version: 1, spec_version: 'shadow-evidence/v1',
    header: { ...recovered.header, session_ended_at_utc: recovered._recoveredSeal.session_ended_at_utc },
    events: recovered.events, batch_root: recovered._recoveredSeal.batch_root,
    signatures: recovered._recoveredSeal.signatures };
  assert.deepEqual(restoredBundle, result.bundle);
  assert.equal(verifyBundle(restoredBundle, { publicKey: f.capture.publicKey }).ok, true);
  const reviewed = f.review(restoredBundle);
  assert.equal(reviewed.capture_shape, 'CONSISTENT');
  assert.equal(reviewed.effect, 'LOCAL_READBACK_MATCH');
});
