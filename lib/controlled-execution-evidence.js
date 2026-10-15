// Controlled local tool prototype. Configure createControlledWriter in the
// host, outside the agent channel; executeControlledWrite is a host-only lower
// level API. The agent never supplies keys, directories, subject or run.
//
// Trust assumptions: the host controls its keys, clock, output/ledger dirs and
// ALL parent directories. O_EXCL/O_NOFOLLOW do not defeat parent-dir rename
// races, a compromised host, ledger deletion or a holder of the capture key.
// The issuer's private key must be isolated from the executing host in a real
// deployment. Fixture tests/demo generate both keypairs in one process.
//
// Reservations and JSONL capture writes are synced before dispatch. A crash
// after dispatch can still leave intent with unknown effect. Keep the consumed
// grant and reconcile manually; there is no automatic/idempotent retry here.
// Filesystem sync support is required; unsupported reservation sync blocks.
//
// MODEL_VISIBLE_RETURN is the host-prepared response, not proof of delivery
// to a model. Local readback is a second local observation, not an independent
// third-party effect attestation or proof of causality/completeness. Signatures
// are checked against caller-pinned keys, without validating real identities.
import { createHash, createPublicKey, createPrivateKey, randomUUID, sign, verify } from 'node:crypto';
import { constants, openSync, closeSync, writeFileSync, readFileSync, readSync, fstatSync,
  lstatSync, realpathSync, fsyncSync } from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { canonicalize } from '../packages/attest-core/attestation.js';
import { createSession, appendEvent, sealSession, verifyBundle } from '../packages/attest-core/session.js';

export const GRANT_SCHEMA = 'shadow-controlled-write-grant/1';
const DOMAIN = 'SHADOW_CONTROLLED_WRITE_GRANT_V1\n';
const GRANT_FIELDS = ['schema', 'grant_id', 'run_id', 'actor_id', 'invocation_id',
  'action', 'not_before_ms', 'expires_at_ms', 'max_attempts'];
const ACTION_FIELDS = ['tool', 'root_id', 'path', 'content_sha256', 'encoding', 'create_only'];
const MAX_WRITE_BYTES = 65536;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonDigest = (value) => digest(canonicalize(value));
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128;
const sameFields = (value, fields) => value && Object.getPrototypeOf(value) === Object.prototype
  && Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const leaf = (name) => typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name);
const validAction = (action) => sameFields(action, ACTION_FIELDS)
  && action.tool === 'write_text_create' && text(action.root_id) && leaf(action.path)
  && /^[a-f0-9]{64}$/.test(action.content_sha256)
  && action.encoding === 'utf8' && action.create_only === true;
const validGrant = (grant) => sameFields(grant, GRANT_FIELDS)
  && grant.schema === GRANT_SCHEMA && validAction(grant.action)
  && ['grant_id', 'run_id', 'actor_id', 'invocation_id'].every((key) => text(grant[key]))
  && Number.isSafeInteger(grant.not_before_ms) && grant.not_before_ms >= 0
  && Number.isSafeInteger(grant.expires_at_ms) && grant.expires_at_ms > grant.not_before_ms
  && grant.max_attempts === 1;

// Accept JSON data, never accessors/toJSON callbacks in the request channel.
// Read descriptor values once so validation and dispatch share one snapshot.
function copyJsonData(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || seen.has(value)) throw new Error('JSON data required');
  const array = Array.isArray(value);
  if (!array && Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Plain JSON object required');
  if (Object.getOwnPropertySymbols(value).length) throw new Error('JSON data required');
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = array ? [] : {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (array && key === 'length') continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || key === '__proto__') throw new Error('Data properties required');
    result[key] = copyJsonData(descriptor.value, seen);
  }
  if (array && (Object.keys(result).length !== descriptors.length.value || result.length !== descriptors.length.value
      || Object.keys(result).some((key) => !/^(0|[1-9][0-9]*)$/.test(key)))) throw new Error('Dense JSON array required');
  seen.delete(value);
  return result;
}

function publicKeyOf(key) {
  const result = key?.type === 'public' ? key : createPublicKey(key);
  if (result.asymmetricKeyType !== 'ed25519') throw new Error('Ed25519 key required');
  return result;
}
export function keyFingerprint(key) {
  return digest(publicKeyOf(key).export({ type: 'spki', format: 'der' }));
}

export function describeWrite({ rootId, filename, content }) {
  if (!text(rootId) || !leaf(filename) || typeof content !== 'string'
      || Buffer.byteLength(content, 'utf8') > MAX_WRITE_BYTES) throw new Error('Invalid bounded write input');
  return { tool: 'write_text_create', root_id: rootId, path: filename,
    content_sha256: digest(Buffer.from(content, 'utf8')), encoding: 'utf8', create_only: true };
}

// A key pin establishes the caller-configured issuer, not human identity or
// organizational authority. The issuer must approve the effective action.
export function signWriteGrant(grant, privateKey) {
  const copy = copyJsonData(grant);
  if (!validGrant(copy)) throw new Error('Invalid grant');
  publicKeyOf(privateKey);
  return { grant: copy, signature: sign(null, Buffer.from(DOMAIN + canonicalize(copy)), privateKey).toString('base64') };
}

export function checkWriteGrant(envelope, { authorizationPublicKey, action, runId, actorId, invocationId, atMs }) {
  try { envelope = copyJsonData(envelope); action = copyJsonData(action); }
  catch { return { status: 'INVALID_GRANT' }; }
  if (!sameFields(envelope, ['grant', 'signature']) || !validGrant(envelope.grant)
      || typeof envelope.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)
      || !validAction(action) || !Number.isSafeInteger(atMs)) return { status: 'INVALID_GRANT' };
  try {
    if (!verify(null, Buffer.from(DOMAIN + canonicalize(envelope.grant)),
      publicKeyOf(authorizationPublicKey), Buffer.from(envelope.signature, 'base64'))) return { status: 'SIGNATURE_MISMATCH' };
  } catch { return { status: 'SIGNATURE_MISMATCH' }; }
  const grant = envelope.grant;
  if (grant.run_id !== runId || grant.actor_id !== actorId || grant.invocation_id !== invocationId) return { status: 'SUBJECT_OR_RUN_MISMATCH' };
  if (canonicalize(grant.action) !== canonicalize(action)) return { status: 'ACTION_MISMATCH' };
  if (atMs < grant.not_before_ms || atMs >= grant.expires_at_ms) return { status: 'OUTSIDE_VALIDITY_WINDOW' };
  return { status: 'GRANT_MATCH', issuer_fingerprint: keyFingerprint(authorizationPublicKey) };
}

function hostDirectory(path) {
  const absolute = resolve(path);
  if (!lstatSync(absolute).isDirectory() || lstatSync(absolute).isSymbolicLink()
      || realpathSync(absolute) !== absolute) throw new Error('Host directory must be real and contain no symlink components');
  return absolute;
}
function isWithin(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// Opening must not block on a replacement FIFO before its type can be checked.
// Read at most one byte beyond the write limit even if the file grows after
// fstat. These checks are best-effort local observations, not an atomic snapshot.
function boundedReadback(fd) {
  const before = fstatSync(fd);
  if (!before.isFile() || before.size > MAX_WRITE_BYTES) throw new Error('Unsupported readback resource');
  const bytes = Buffer.alloc(MAX_WRITE_BYTES + 1);
  let length = 0;
  while (length < bytes.length) {
    const count = readSync(fd, bytes, length, bytes.length - length, null);
    if (count === 0) break;
    length += count;
  }
  const after = fstatSync(fd);
  if (length > MAX_WRITE_BYTES || after.size !== length || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error('Unstable or oversized readback');
  return { stat: after, contentSha256: digest(bytes.subarray(0, length)) };
}

export function executeControlledWrite({ outputDir, ledgerDir, rootId, filename, content,
  runId, actorId, invocationId, grantEnvelope, authorizationPublicKey, capturePrivateKey,
  renderForModel = null, transformationId = null }) {
  // Snapshot all untrusted input before any callback. Only this normalized
  // effective action is used by both the gate and the actual tool.
  const action = describeWrite({ rootId, filename, content });
  if (![runId, actorId, invocationId].every(text)) throw new Error('Invalid invocation identity');
  if (renderForModel !== null && (typeof renderForModel !== 'function' || !text(transformationId))) throw new Error('Named host transformation required');
  const output = hostDirectory(outputDir);
  const ledger = hostDirectory(ledgerDir);
  if (isWithin(output, ledger) || isWithin(ledger, output)) throw new Error('Output and ledger directories must be separate');
  const signingKey = capturePrivateKey?.type === 'private' ? capturePrivateKey : createPrivateKey(capturePrivateKey);
  if (signingKey.asymmetricKeyType !== 'ed25519') throw new Error('Ed25519 private capture key required');
  sign(null, Buffer.from('SHADOW_CAPTURE_KEY_PREFLIGHT_V1'), signingKey);
  if (keyFingerprint(capturePrivateKey) === keyFingerprint(authorizationPublicKey)) throw new Error('Separate authorization and capture keys required');
  let envelope;
  try { envelope = copyJsonData(grantEnvelope); } catch { envelope = null; }
  const atMs = Date.now();
  const binding = checkWriteGrant(envelope, { authorizationPublicKey, action, runId, actorId, invocationId, atMs });
  let gate = binding.status;
  const captureStorePath = join(ledger, 'capture-' + randomUUID() + '.jsonl');
  const captureFd = openSync(captureStorePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
  const directoryFd = openSync(ledger, constants.O_RDONLY | constants.O_DIRECTORY);
  try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
  const store = { appendLine(line) { writeFileSync(captureFd, line + '\n'); fsyncSync(captureFd); },
    readLines() { return readFileSync(captureStorePath, 'utf8').trimEnd().split('\n'); } };
  const session = createSession({ agent: { name: 'shadow-controlled-write-prototype', version: '0.1.0' },
    models: [], environmentFingerprint: { os: process.platform, node_version: process.version },
    privateKey: signingKey, keyId: keyFingerprint(signingKey),
    startedAtUtc: new Date(atMs).toISOString(), store });
  const record = (type, kind, data) => appendEvent(session, { event_type: type, actor: 'system',
    payload: data, extensions: { controlled_execution: { kind, ...data } } });
  record('session_start', 'START', { prototype: true, run_id: runId, capture_completeness: 'UNVERIFIED' });
  if (gate === 'GRANT_MATCH') {
    // Reserve before dispatch; failed writes also consume the grant. Crash
    // after reservation requires manual reconciliation, never blind retry.
    try {
      const marker = join(ledger, jsonDigest({ issuer: binding.issuer_fingerprint, grant_id: envelope.grant.grant_id }) + '.json');
      const fd = openSync(marker, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try {
        writeFileSync(fd, JSON.stringify({ invocation_id: invocationId, action_sha256: jsonDigest(action) }));
        fsyncSync(fd);
      }
      finally { closeSync(fd); }
      const directoryFd = openSync(ledger, constants.O_RDONLY | constants.O_DIRECTORY);
      try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
    } catch (error) { gate = error.code === 'EEXIST' ? 'GRANT_ALREADY_CONSUMED' : 'LEDGER_RESERVATION_FAILED'; }
  }
  const attempt = { action, run_id: runId, actor_id: actorId, invocation_id: invocationId,
    at_ms: atMs, grant_envelope: envelope, gate_status: gate };
  record('tool_call', 'ATTEMPT', attempt);
  if (gate !== 'GRANT_MATCH') {
    record('tool_error', 'BLOCKED', { invocation_id: invocationId, reason: gate });
    return { bundle: sealSession(session), gate_status: gate, tool_status: 'NOT_DISPATCHED', capture_store_path: captureStorePath };
  }
  const target = join(output, action.path);
  let raw;
  let writtenIdentity;
  try {
    const fd = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      writeFileSync(fd, content, 'utf8');
      fsyncSync(fd);
      const stat = fstatSync(fd);
      writtenIdentity = { dev: stat.dev, ino: stat.ino };
      raw = { status: 'CREATED', bytes_written: stat.size, path: action.path };
    } finally { closeSync(fd); }
  } catch (error) { raw = { status: 'FAILED', error_code: error.code ?? 'UNKNOWN' }; }
  // Persist raw return before invoking presentation code. A presentation
  // failure does not discard the earlier tool record.
  record('tool_result', 'RAW_RETURN', { invocation_id: invocationId, value: raw, sha256: jsonDigest(raw) });
  try {
    const visible = renderForModel ? renderForModel(JSON.parse(JSON.stringify(raw))) : raw;
    const serialized = JSON.stringify(visible);
    if (serialized === undefined || Buffer.byteLength(serialized) > 65536) throw new Error('Invalid model-visible output');
    const snapshot = JSON.parse(serialized);
    record('model_output', 'MODEL_VISIBLE_RETURN', { invocation_id: invocationId, value: snapshot,
      sha256: jsonDigest(snapshot), transformation_id: renderForModel ? transformationId : null });
  } catch {
    record('error', 'PRESENTATION_FAILED', { invocation_id: invocationId });
  }
  if (raw.status === 'CREATED') {
    try {
      const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const { stat, contentSha256: observedHash } = boundedReadback(fd);
        const matched = stat.dev === writtenIdentity.dev && stat.ino === writtenIdentity.ino
          && observedHash === action.content_sha256;
        record('file_read', 'LOCAL_READBACK', { invocation_id: invocationId, content_sha256: observedHash,
          resource_identity_match: stat.dev === writtenIdentity.dev && stat.ino === writtenIdentity.ino,
          status: matched ? 'LOCAL_READBACK_MATCH' : 'LOCAL_READBACK_MISMATCH', observer: 'HOST_LOCAL_FILESYSTEM' });
      } finally { closeSync(fd); }
    } catch { record('error', 'READBACK_UNAVAILABLE', { invocation_id: invocationId }); }
  }
  return { bundle: sealSession(session), gate_status: gate, tool_status: raw.status, capture_store_path: captureStorePath };
  } finally { closeSync(captureFd); }
}

// Configure this factory in the host, outside the agent's request channel.
// The agent request cannot change a root directory, key, subject or run.
export function createControlledWriter({ roots, ledgerDir, runId, actorId,
  authorizationPublicKey, capturePrivateKey, renderForModel = null, transformationId = null }) {
  if (!roots || Object.getPrototypeOf(roots) !== Object.prototype || ![runId, actorId].every(text)) throw new Error('Invalid host configuration');
  const configuredRoots = new Map(Object.entries(roots).map(([id, path]) => {
    if (!text(id)) throw new Error('Invalid root identity');
    return [id, hostDirectory(path)];
  }));
  const configuredLedger = hostDirectory(ledgerDir);
  return (request) => {
    request = copyJsonData(request);
    if (!sameFields(request, ['root_id', 'filename', 'content', 'invocation_id', 'grant_envelope'])
        || !configuredRoots.has(request.root_id)) throw new Error('Invalid tool request');
    return executeControlledWrite({ outputDir: configuredRoots.get(request.root_id), ledgerDir: configuredLedger,
      rootId: request.root_id, filename: request.filename, content: request.content,
      runId, actorId, invocationId: request.invocation_id, grantEnvelope: request.grant_envelope,
      authorizationPublicKey, capturePrivateKey, renderForModel, transformationId });
  };
}

export function reviewControlledWrite(bundle, { capturePublicKey, authorizationPublicKey }) {
  const limits = { capture_completeness: 'UNVERIFIED', provider_origin: 'NOT_APPLICABLE_LOCAL_PROTOTYPE',
    organizational_authority: 'UNVERIFIED', independent_effect: 'UNVERIFIED', external_checkpoint: 'NOT_CHECKED',
    model_delivery: 'NOT_OBSERVED' };
  let integrity;
  try { integrity = verifyBundle(bundle, { publicKey: capturePublicKey }); } catch { integrity = { ok: false }; }
  if (!integrity.ok) return { ...limits, integrity: 'INVALID', grant_binding: 'NOT_EVALUATED', effect: 'NOT_EVALUATED' };
  const rows = bundle.events.map((event) => ({ event, data: event.extensions?.controlled_execution }))
    .filter((row) => row.data);
  const attempts = rows.filter((row) => row.data.kind === 'ATTEMPT');
  if (attempts.length !== 1) return { ...limits, integrity: 'VALID_CAPTURE_SIGNATURE', grant_binding: 'INVALID_CAPTURE_SHAPE', effect: 'UNCONFIRMED' };
  const attempt = attempts[0].data;
  const binding = checkWriteGrant(attempt.grant_envelope, { authorizationPublicKey, action: attempt.action,
    runId: attempt.run_id, actorId: attempt.actor_id, invocationId: attempt.invocation_id, atMs: attempt.at_ms });
  const forCall = (kind) => rows.filter((row) => row.data.kind === kind && row.data.invocation_id === attempt.invocation_id);
  const raw = forCall('RAW_RETURN');
  const visible = forCall('MODEL_VISIBLE_RETURN');
  const readback = forCall('LOCAL_READBACK');
  const blocked = forCall('BLOCKED');
  const presentationFailures = forCall('PRESENTATION_FAILED');
  const readbackFailures = forCall('READBACK_UNAVAILABLE');
  const eventTypes = { START: 'session_start', ATTEMPT: 'tool_call', BLOCKED: 'tool_error',
    RAW_RETURN: 'tool_result', MODEL_VISIBLE_RETURN: 'model_output', LOCAL_READBACK: 'file_read',
    PRESENTATION_FAILED: 'error', READBACK_UNAVAILABLE: 'error' };
  let coherent = validAction(attempt.action)
    && [attempt.run_id, attempt.actor_id, attempt.invocation_id].every(text)
    && Number.isSafeInteger(attempt.at_ms) && attempt.at_ms >= 0
    && (binding.status === 'GRANT_MATCH'
      ? ['GRANT_MATCH', 'GRANT_ALREADY_CONSUMED', 'LEDGER_RESERVATION_FAILED'].includes(attempt.gate_status)
      : attempt.gate_status === binding.status)
    && rows.every(({ event, data }) => eventTypes[data.kind] === event.event_type
    && (data.kind === 'START' ? data.run_id === attempt.run_id : data.invocation_id === attempt.invocation_id)
    && event.payload_hash === jsonDigest(Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'kind'))));
  coherent &&= rows.filter(({ data }) => data.kind === 'START').length === 1
    && rows.find(({ data }) => data.kind === 'START').event.seq < attempts[0].event.seq
    && raw.length <= 1 && visible.length <= 1 && readback.length <= 1
    && blocked.length <= 1 && presentationFailures.length <= 1 && readbackFailures.length <= 1
    && !(visible.length && presentationFailures.length) && !(readback.length && readbackFailures.length)
    && (attempt.gate_status === 'GRANT_MATCH' ? blocked.length === 0
      : blocked.length === 1 && blocked[0].event.seq > attempts[0].event.seq
        && blocked[0].data.reason === attempt.gate_status && raw.length === 0 && visible.length === 0
        && readback.length === 0 && presentationFailures.length === 0 && readbackFailures.length === 0)
    && (!raw.length || (attempt.gate_status === 'GRANT_MATCH' && raw[0].event.seq > attempts[0].event.seq))
    && (!visible.length || (raw.length === 1 && visible[0].event.seq > raw[0].event.seq))
    && presentationFailures.every((row) => raw.length === 1 && row.event.seq > raw[0].event.seq)
    && [...readback, ...readbackFailures].every((row) => raw.length === 1
      && row.event.seq > raw[0].event.seq
      && [...visible, ...presentationFailures].every((presentation) => row.event.seq > presentation.event.seq));
  const validReturn = (row) => {
    try { return row && jsonDigest(row.data.value) === row.data.sha256; } catch { return false; }
  };
  coherent &&= raw.every(validReturn) && visible.every(validReturn);
  coherent &&= raw.every(({ data }) => data.value?.status === 'CREATED'
    ? sameFields(data.value, ['status', 'bytes_written', 'path']) && data.value.path === attempt.action?.path
      && Number.isSafeInteger(data.value.bytes_written) && data.value.bytes_written >= 0 && data.value.bytes_written <= MAX_WRITE_BYTES
    : sameFields(data.value, ['status', 'error_code']) && data.value.status === 'FAILED' && text(data.value.error_code));
  coherent &&= (!readback.length && !readbackFailures.length)
    || raw.length === 1 && raw[0].data.value?.status === 'CREATED';
  let returns = 'MISSING';
  if (raw.length === 1 && visible.length === 1 && validReturn(raw[0]) && validReturn(visible[0])) {
    returns = raw[0].data.sha256 === visible[0].data.sha256 ? 'IDENTICAL'
      : text(visible[0].data.transformation_id) ? 'TRANSFORM_RECORDED_UNASSESSED' : 'UNEXPLAINED_DIFFERENCE';
  }
  let effect = 'UNCONFIRMED';
  if (readback.length === 1 && raw.length === 1 && raw[0].data.value?.status === 'CREATED'
      && readback[0].event.seq > raw[0].event.seq) {
    const observed = readback[0].data;
    effect = observed.observer === 'HOST_LOCAL_FILESYSTEM' && observed.resource_identity_match === true
      && observed.content_sha256 === attempt.action?.content_sha256 ? 'LOCAL_READBACK_MATCH' : 'LOCAL_READBACK_MISMATCH';
    coherent &&= observed.status === effect;
  }
  if (!coherent) { effect = 'NOT_EVALUATED'; returns = 'NOT_EVALUATED'; }
  return { ...limits, integrity: 'VALID_CAPTURE_SIGNATURE', capture_shape: coherent ? 'CONSISTENT' : 'INCONSISTENT',
    grant_binding: binding.status, recorded_gate: attempt.gate_status, return_relation: returns, effect,
    replay_history: 'LOCAL_LEDGER_NOT_INDEPENDENTLY_VERIFIED' };
}
