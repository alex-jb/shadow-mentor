// Contract tests for the local-LLM (Ollama / llama.cpp) provider.
//
// The function makes one HTTP POST to a local OpenAI-compatible endpoint.
// These tests inject a mock fetch via `fetchImpl` so we can assert the
// request shape (no Authorization header, OpenAI-compat body, system +
// user message ordering) WITHOUT requiring Ollama to actually be running
// on the CI box. That matters because:
//
//   1. CI doesn't have Ollama installed and we don't want to install it
//      just to run contract tests.
//   2. A cold-email prospect's first run will install Ollama after the
//      first failed request — the test surface should not depend on
//      anything operator-side.
//   3. Network egress to localhost is still blocked in some CI sandboxes;
//      the test stub sidesteps that entirely.
//
// The point: any refactor that breaks the OpenAI-compat request shape
// (e.g. renaming `max_tokens` to `maxTokens` in the wire payload, or
// accidentally adding an Authorization header that breaks Ollama's
// no-auth default) is caught at CI before hitting Y.U. Dean + VP demo
// in mid-July, where local LLM is the "Runs on your laptop, zero-breach
// risk" demo cell.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  callLocalLlm,
  LOCAL_LLM_BASE_URL,
  LOCAL_LLM_DEFAULT_MODEL,
} from "../lib/local-llm-call.js";

function makeMockFetch({ status = 200, body, captureRequest, throwError } = {}) {
  return async (url, init) => {
    if (throwError) throw throwError;
    if (captureRequest) {
      captureRequest({ url, init, parsedBody: JSON.parse(init.body) });
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    };
  };
}

const happyBody = {
  choices: [
    { message: { content: "  Credit Fundamentals voice: FICO 740 passes Addendum A floor.  " } },
  ],
};

test("callLocalLlm posts to the OpenAI-compatible /chat/completions endpoint", async () => {
  let captured;
  const fetchImpl = makeMockFetch({
    body: happyBody,
    captureRequest: (r) => { captured = r; },
  });
  await callLocalLlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl });
  assert.equal(captured.url, `${LOCAL_LLM_BASE_URL}/chat/completions`);
  assert.equal(captured.init.method, "POST");
});

test("callLocalLlm sends NO Authorization header (Ollama is no-auth by default)", async () => {
  // If a future refactor mistakenly adds `Authorization: Bearer ${apiKey}`,
  // Ollama returns 400 because the auth shim isn't in its OpenAI compat
  // layer. This test pins the no-auth contract.
  let captured;
  const fetchImpl = makeMockFetch({
    body: happyBody,
    captureRequest: (r) => { captured = r; },
  });
  await callLocalLlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl });
  assert.equal(captured.init.headers.Authorization, undefined);
  assert.equal(captured.init.headers["Content-Type"], "application/json");
});

test("callLocalLlm body uses default model + max_tokens (snake_case wire field)", async () => {
  let captured;
  const fetchImpl = makeMockFetch({
    body: happyBody,
    captureRequest: (r) => { captured = r; },
  });
  await callLocalLlm({ systemPrompt: "sys", userMessage: "msg", maxTokens: 99, fetchImpl });
  assert.equal(captured.parsedBody.model, LOCAL_LLM_DEFAULT_MODEL);
  // Ollama OpenAI-compat expects max_tokens not maxTokens
  assert.equal(captured.parsedBody.max_tokens, 99);
  assert.equal(captured.parsedBody.maxTokens, undefined);
});

test("callLocalLlm sends system message before user message", async () => {
  let captured;
  const fetchImpl = makeMockFetch({
    body: happyBody,
    captureRequest: (r) => { captured = r; },
  });
  await callLocalLlm({
    systemPrompt: "You are the Credit Fundamentals voice.",
    userMessage: "FICO 740 DTI 0.28, qualifying?",
    fetchImpl,
  });
  const msgs = captured.parsedBody.messages;
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, "system");
  assert.equal(msgs[0].content, "You are the Credit Fundamentals voice.");
  assert.equal(msgs[1].role, "user");
  assert.equal(msgs[1].content, "FICO 740 DTI 0.28, qualifying?");
});

test("callLocalLlm default maxTokens is 220 (matches voice rationale budget)", async () => {
  let captured;
  const fetchImpl = makeMockFetch({
    body: happyBody,
    captureRequest: (r) => { captured = r; },
  });
  await callLocalLlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl });
  assert.equal(captured.parsedBody.max_tokens, 220);
});

test("callLocalLlm returns trimmed content + model on 200 OK", async () => {
  const fetchImpl = makeMockFetch({ body: happyBody });
  const result = await callLocalLlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl });
  assert.equal(
    result.text,
    "Credit Fundamentals voice: FICO 740 passes Addendum A floor."
  );
  assert.equal(result.model, LOCAL_LLM_DEFAULT_MODEL);
});

test("callLocalLlm supports per-call model override (Gemma / Qwen / Llama swap)", async () => {
  let captured;
  const fetchImpl = makeMockFetch({
    body: happyBody,
    captureRequest: (r) => { captured = r; },
  });
  await callLocalLlm({
    systemPrompt: "sys",
    userMessage: "msg",
    model: "gemma3:9b",
    fetchImpl,
  });
  assert.equal(captured.parsedBody.model, "gemma3:9b");
});

test("callLocalLlm supports per-call baseUrl override (llama.cpp / LM Studio)", async () => {
  let captured;
  const fetchImpl = makeMockFetch({
    body: happyBody,
    captureRequest: (r) => { captured = r; },
  });
  await callLocalLlm({
    systemPrompt: "sys",
    userMessage: "msg",
    baseUrl: "http://127.0.0.1:8080/v1",
    fetchImpl,
  });
  assert.equal(captured.url, "http://127.0.0.1:8080/v1/chat/completions");
});

test("callLocalLlm surfaces actionable 'Is Ollama running?' message on ECONNREFUSED", async () => {
  // The single most common failure mode in production: prospect installs
  // Shadow, runs cold-email demo, forgets `ollama serve`. The error must
  // tell them what to do, not bubble up a raw TypeError.
  const econnRefused = Object.assign(new TypeError("fetch failed"), {
    cause: { code: "ECONNREFUSED" },
  });
  const fetchImpl = makeMockFetch({ throwError: econnRefused });
  await assert.rejects(
    () => callLocalLlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl }),
    (err) => {
      assert.match(err.message, /local LLM endpoint unreachable/);
      assert.match(err.message, /Is Ollama running/);
      assert.match(err.message, /ollama serve/);
      return true;
    }
  );
});

test("callLocalLlm throws with status + truncated detail on non-2xx response", async () => {
  const longDetail = "x".repeat(500);
  const fetchImpl = makeMockFetch({ status: 404, body: `model not found: ${longDetail}` });
  await assert.rejects(
    () => callLocalLlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl }),
    (err) => {
      assert.match(err.message, /local LLM API 404:/);
      assert.ok(err.message.length < 300);
      return true;
    }
  );
});

test("callLocalLlm throws 'empty content' when choices array is missing", async () => {
  const fetchImpl = makeMockFetch({ body: { choices: [] } });
  await assert.rejects(
    () => callLocalLlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl }),
    /local LLM returned empty content/
  );
});

test("LOCAL_LLM_BASE_URL defaults to Ollama's OpenAI-compat /v1 endpoint", () => {
  // If the default ever drifts (e.g. someone changes it to /api/generate
  // which is Ollama-native NOT OpenAI-compat), the 5-voice deliberate.js
  // path silently breaks for the cold-email demo flow.
  assert.equal(LOCAL_LLM_BASE_URL, "http://127.0.0.1:11434/v1");
});

test("LOCAL_LLM_DEFAULT_MODEL is phi4-mini (MIT, ~3.8B, fits 16GB M2 Pro)", () => {
  // Pin the default — anything else changes the cold-email demo cell's
  // hardware-target story.
  assert.equal(LOCAL_LLM_DEFAULT_MODEL, "phi4-mini");
});
