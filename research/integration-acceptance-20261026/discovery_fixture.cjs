// Synthetic MCP stdio server for a documented historical CLI failure.
// No networking, provider calls, credentials, or external actions.
'use strict';
const fs = require('node:fs');
const readline = require('node:readline');
const [mode, transcript] = process.argv.slice(2);
if (!['empty', 'nonempty', 'error'].includes(mode) || !transcript) {
  process.stderr.write('Usage: fixture.cjs empty|nonempty|error transcript.jsonl\n');
  process.exit(2);
}
const lines = readline.createInterface({input: process.stdin});
const emit = (value) => process.stdout.write(JSON.stringify(value) + '\n');
lines.on('line', (line) => {
  const request = JSON.parse(line);
  fs.appendFileSync(transcript, JSON.stringify({direction: 'request', message: request}) + '\n');
  if (!Object.hasOwn(request, 'id')) return;
  let response;
  if (request.method === 'initialize') {
    response = {result: {
      protocolVersion: request.params.protocolVersion,
      capabilities: {tools: {}},
      serverInfo: {name: 'shadow-discovery-fixture', version: '1.0.0'},
    }};
  } else if (request.method === 'tools/list') {
    response = mode === 'error'
      ? {error: {code: -32603, message: 'fixture discovery failure'}}
      : {result: {tools: mode === 'empty' ? [] : [{
        name: 'alpha', description: 'A fixed local fixture tool',
        inputSchema: {type: 'object', properties: {}},
      }]}};
  } else if (request.method === 'ping') {
    response = {result: {}};
  } else {
    response = {error: {code: -32601, message: 'Method not found'}};
  }
  const message = {jsonrpc: '2.0', id: request.id, ...response};
  fs.appendFileSync(transcript, JSON.stringify({direction: 'response', message}) + '\n');
  emit(message);
});
