// Tests for the Elastic backend stub + factory selector. We don't connect to
// a real Elasticsearch — just verify the contract: factory returns Elastic
// instance when env vars set, falls back to InMemory otherwise, and the stub
// methods throw the documented "wire @elastic/elasticsearch" error so a bank
// engineer hitting these in dev knows exactly what to do.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ElasticMemory, buildMemoryBackend } from "../lib/memory-elastic.js";
import { memorySingleton } from "../lib/memory.js";

test("ElasticMemory constructor requires url", () => {
  assert.throws(() => new ElasticMemory({}), /ELASTIC_URL/);
});

test("ElasticMemory constructor accepts url + apiKey", () => {
  const m = new ElasticMemory({ url: "https://es.example.com", apiKey: "fake" });
  assert.equal(m.url, "https://es.example.com");
  assert.equal(m.apiKey, "fake");
  assert.equal(m.indexPrefix, "shadow-analyst-");
});

test("ElasticMemory _indexFor mints per-analyst index", () => {
  const m = new ElasticMemory({ url: "https://es.example.com" });
  assert.equal(m._indexFor("hashed_abc"), "shadow-analyst-hashed_abc");
  assert.equal(m._indexFor(), "shadow-analyst-_anon");
});

test("ElasticMemory.recall stub throws documented wire error", async () => {
  const m = new ElasticMemory({ url: "https://es.example.com" });
  await assert.rejects(() => m.recall({ persona: "compliance" }), /wire @elastic\/elasticsearch/);
});

test("ElasticMemory.recallCalibrationStats stub throws wire error", async () => {
  const m = new ElasticMemory({ url: "https://es.example.com" });
  await assert.rejects(() => m.recallCalibrationStats({ persona: "compliance" }), /wire @elastic\/elasticsearch/);
});

test("ElasticMemory.append stub throws wire error", async () => {
  const m = new ElasticMemory({ url: "https://es.example.com" });
  await assert.rejects(() => m.append({ entry_id: "x" }), /wire @elastic\/elasticsearch/);
});

test("buildMemoryBackend falls back to InMemory when no Elastic env", async () => {
  const prevBackend = process.env.SHADOW_MEMORY_BACKEND;
  const prevUrl = process.env.ELASTIC_URL;
  delete process.env.SHADOW_MEMORY_BACKEND;
  delete process.env.ELASTIC_URL;
  const backend = await buildMemoryBackend();
  assert.equal(backend, memorySingleton);
  if (prevBackend !== undefined) process.env.SHADOW_MEMORY_BACKEND = prevBackend;
  if (prevUrl !== undefined) process.env.ELASTIC_URL = prevUrl;
});

test("buildMemoryBackend returns Elastic instance when env vars set", async () => {
  const prevBackend = process.env.SHADOW_MEMORY_BACKEND;
  const prevUrl = process.env.ELASTIC_URL;
  process.env.SHADOW_MEMORY_BACKEND = "elastic";
  process.env.ELASTIC_URL = "https://es.example.com";
  const backend = await buildMemoryBackend();
  assert.ok(backend instanceof ElasticMemory);
  if (prevBackend !== undefined) process.env.SHADOW_MEMORY_BACKEND = prevBackend;
  else delete process.env.SHADOW_MEMORY_BACKEND;
  if (prevUrl !== undefined) process.env.ELASTIC_URL = prevUrl;
  else delete process.env.ELASTIC_URL;
});
