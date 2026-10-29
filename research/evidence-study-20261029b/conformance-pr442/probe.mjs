/**
 * Research mechanism replay of upstream conformance PR #442.
 * Upstream scenario and guard logic are extracted without changing their
 * executable statements; Node removes TypeScript syntax. sendRpc and reporting
 * constants are injected. This is not an upstream CLI/HTTP/SDK test.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root = path.dirname(fileURLToPath(import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const manifest = JSON.parse(read('upstream-manifest.json'));
for (const source of manifest.sources) {
  const bytes = fs.readFileSync(path.join(root, source.local_path));
  assert.equal(digest(bytes), source.sha256, `Source hash mismatch: ${source.local_path}`);
  const gitHeader = Buffer.from(`blob ${bytes.length}\0`);
  assert.equal(createHash('sha1').update(gitHeader).update(bytes).digest('hex'), source.git_blob_sha, `Git blob mismatch: ${source.local_path}`);
}

function extractFunction(source, name) {
  const start = source.indexOf(`export function ${name}(`);
  assert.ok(start >= 0, `Function absent: ${name}`);
  const end = source.indexOf('\n}\n', start);
  assert.ok(end >= start, `Function boundary absent: ${name}`);
  return source.slice(start, end + 3).replace(/^export function /, 'function ');
}

function extractScenario(source) {
  const start = source.indexOf('export class InputRequiredResultCapabilityCheckScenario ');
  const end = source.indexOf('export class InputRequiredResultIgnoreExtraParamsScenario ', start);
  assert.ok(start >= 0 && end > start, 'Pinned scenario boundaries absent');
  return source.slice(start, end).replace(/^export class /, 'class ');
}

const fixtures = [
  {
    id: 'allowed_sampling', expected_support: 'EXERCISED_SUCCESS',
    response: {result: {resultType: 'input_required', requestState: 'fixture-state', inputRequests: {sample: {method: 'sampling/createMessage', params: {}}}}},
    expected_base: 'SUCCESS', expected_fixed: 'SUCCESS', expected_untestable_fixed: false,
  },
  {
    id: 'forbidden_elicitation', expected_support: 'CAPABILITY_VIOLATION',
    response: {result: {resultType: 'input_required', requestState: 'fixture-state', inputRequests: {ask: {method: 'elicitation/create', params: {}}}}},
    expected_base: 'FAILURE', expected_fixed: 'FAILURE', expected_untestable_fixed: false,
  },
  {
    id: 'request_state_only', expected_support: 'UNTESTABLE_NOT_PROTOCOL_VIOLATION',
    response: {result: {resultType: 'input_required', requestState: 'fixture-state'}},
    expected_base: 'SUCCESS', expected_fixed: 'FAILURE', expected_untestable_fixed: true,
  },
  {
    id: 'empty_input_requests', expected_support: 'UNTESTABLE_NOT_PROTOCOL_VIOLATION',
    response: {result: {resultType: 'input_required', requestState: 'fixture-state', inputRequests: {}}},
    expected_base: 'SUCCESS', expected_fixed: 'FAILURE', expected_untestable_fixed: true,
  },
  {
    id: 'complete_instead_of_requested_fixture', expected_support: 'FIXTURE_CONTRACT_MISMATCH',
    response: {result: {resultType: 'complete', content: [{type: 'text', text: 'done'}]}},
    expected_base: 'FAILURE', expected_fixed: 'FAILURE', expected_untestable_fixed: false,
  },
  {
    id: 'json_rpc_error_control', expected_support: 'EXECUTION_ERROR',
    response: {error: {code: -32603, message: 'controlled execution error'}},
    expected_base: 'FAILURE', expected_fixed: 'FAILURE', expected_untestable_fixed: false,
  },
  {
    id: 'no_result_control', expected_support: 'MISSING_EVIDENCE', response: {},
    expected_base: 'FAILURE', expected_fixed: 'FAILURE', expected_untestable_fixed: false,
  },
];

const observations = [];
for (const version of ['base', 'fixed']) {
  const scenarioText = extractScenario(read(`sources/${version}-input-required-result.ts`));
  const guards = read(`sources/${version}-helpers.ts`);
  const functions = ['isInputRequiredResult', 'isCompleteResult'].map(name => extractFunction(guards, name));
  if (version === 'fixed') functions.push(extractFunction(read('sources/fixed-untestable.ts'), 'notTestable'));
  const typedSource = functions.join('\n') + '\n' + scenarioText + '\n globalThis.ExtractedScenario = InputRequiredResultCapabilityCheckScenario;\n';
  const executable = stripTypeScriptTypes(typedSource, {mode: 'strip', sourceUrl: `pr442-${version}.ts`});
  for (const fixture of fixtures) {
    const calls = [];
    const responseBytes = JSON.stringify(fixture.response);
    const context = vm.createContext({
      DRAFT_PROTOCOL_VERSION: '2026-07-28',
      MRTR_SPEC_REFERENCES: [],
      sendRpc: async (url, method, parameters) => {
        calls.push({url, method, parameters: JSON.parse(JSON.stringify(parameters))});
        return JSON.parse(responseBytes);
      },
    });
    new vm.Script(executable, {filename: `extracted-${version}.js`}).runInContext(context, {timeout: 1000});
    const checks = JSON.parse(JSON.stringify(await new context.ExtractedScenario().run({serverUrl: 'stub://local-only'})));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'tools/call');
    assert.equal(calls[0].parameters.name, 'test_input_required_result_capabilities');
    assert.deepEqual(calls[0].parameters._meta['io.modelcontextprotocol/clientCapabilities'], {sampling: {}});
    assert.equal(checks.length, 1);
    assert.equal(checks[0].id, 'sep-2322-respect-client-capabilities');
    const expectedStatus = fixture[`expected_${version}`];
    const actualUntestable = checks[0].details?.untestable === true;
    const expectedUntestable = version === 'fixed' && fixture.expected_untestable_fixed;
    const matched = checks[0].status === expectedStatus && actualUntestable === expectedUntestable;
    if (expectedUntestable) assert.ok(checks[0].errorMessage.startsWith('Not testable:'));
    observations.push({
      fixture_id: fixture.id, version, input: fixture.response,
      authored_expected_support: fixture.expected_support,
      authored_expected_native_status: expectedStatus,
      authored_expected_untestable: expectedUntestable,
      rpc_stub_calls: calls, raw_checks: checks,
      consumer_interpretation: actualUntestable ? 'UNVERIFIED_WITHHOLD' : checks[0].status === 'SUCCESS' ? 'NATIVE_SUCCESS' : 'NATIVE_FAILURE_WITH_REASON_REVIEW',
      matched_expectation: matched,
    });
  }
}
const summary = {
  base_statuses: observations.filter(row => row.version === 'base').map(row => [row.fixture_id, row.raw_checks[0].status]),
  fixed_statuses: observations.filter(row => row.version === 'fixed').map(row => [row.fixture_id, row.raw_checks[0].status, row.raw_checks[0].details?.untestable === true]),
  expectation_match_count: observations.filter(row => row.matched_expectation).length,
  checker_invocations: observations.length,
  independent_historical_defects: 1,
  previously_known_non_exercised_success_inputs: 2,
};
const result = {
  schema: 'shadow-conformance-pr442-mechanism-replay/1',
  created_at_utc: new Date().toISOString(), node: process.version,
  scope: 'Unmodified upstream scenario statements and actual type guards; TypeScript syntax removed; sendRpc and reporting constants injected. No upstream CLI, HTTP, SDK, provider, or real service execution.',
  selection: 'Cases authored after reading a known merged fix; development replay, not held-out discovery or production rates.',
  source_manifest_sha256: digest(read('upstream-manifest.json')),
  driver_sha256: digest(fs.readFileSync(fileURLToPath(import.meta.url))),
  complete_harness_reproduction: false, new_bug_discovery: false,
  fixtures, observations, summary,
};
fs.writeFileSync(path.join(root, 'results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (summary.expectation_match_count !== summary.checker_invocations) process.exitCode = 1;
