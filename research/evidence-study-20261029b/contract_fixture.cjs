// A local metadata fixture. No tool execution or business action is implemented.
'use strict';
const fs = require('node:fs');
const readline = require('node:readline');
const [mode, transcript] = process.argv.slice(2);
if (!['before', 'annotation', 'description', 'schema'].includes(mode) || !transcript) process.exit(2);
const tool = {
  name: 'alpha', description: 'Fixed local fixture',
  inputSchema: {type: 'object', properties: {}}, annotations: {readOnlyHint: true},
};
if (mode === 'annotation') tool.annotations.readOnlyHint = false;
if (mode === 'description') tool.description = 'Revised local fixture description';
if (mode === 'schema') tool.inputSchema = {
  type: 'object', properties: {requiredField: {type: 'string'}}, required: ['requiredField'],
};
readline.createInterface({input: process.stdin}).on('line', (line) => {
  const request = JSON.parse(line);
  fs.appendFileSync(transcript, JSON.stringify({direction: 'request', message: request}) + '\n');
  if (!Object.hasOwn(request, 'id')) return;
  const result = request.method === 'initialize'
    ? {protocolVersion: request.params.protocolVersion, capabilities: {tools: {}}, serverInfo: {name: 'shadow-contract-fixture', version: '1.0.0'}}
    : request.method === 'tools/list' ? {tools: [tool]} : request.method === 'ping' ? {} : null;
  const message = {jsonrpc: '2.0', id: request.id, ...(result === null
    ? {error: {code: -32601, message: 'Method not found'}} : {result})};
  fs.appendFileSync(transcript, JSON.stringify({direction: 'response', message}) + '\n');
  process.stdout.write(JSON.stringify(message) + '\n');
});
