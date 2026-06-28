// Contract tests for the GLM (Zhipu) provider — Tier 2 #12.
//
// The function makes one HTTP POST to open.bigmodel.cn. These tests inject
// a mock fetch via the `fetchImpl` parameter so we can assert request
// shape (Authorization header, OpenAI-compatible body, system + user
// message ordering) without spending GLM credits or needing network access.
//
// The point: any refactor that breaks the OpenAI-compatible request
// shape (e.g. renaming `max_tokens` to `maxTokens` in the wire payload,
// or dropping `Bearer ` from the auth header) is caught at CI before
// hitting Mainland China bank pitch demos in production.

import { test } from "node:test";
import assert from "node:assert/strict";
import { callGlm, GLM_BASE_URL, GLM_DEFAULT_MODEL } from "../lib/glm-call.js";

function makeMockFetch({ status = 200, body, captureRequest } = {}) {
  return async (url, init) => {
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
    { message: { content: "  Risk Officer agrees the LBO leverage at 4.4× is policy 4.3 compliant.  " } },
  ],
};

function withEnv(key, value, fn) {
  const prev = process.env[key];
  process.env[key] = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

test("callGlm throws if GLM_API_KEY is not configured", async () => {
  const prev = process.env.GLM_API_KEY;
  delete process.env.GLM_API_KEY;
  try {
    await assert.rejects(
      () => callGlm({ systemPrompt: "sys", userMessage: "msg" }),
      /GLM_API_KEY not configured/
    );
  } finally {
    if (prev !== undefined) process.env.GLM_API_KEY = prev;
  }
});

test("callGlm posts to the OpenAI-compatible chat/completions endpoint", async () => {
  await withEnv("GLM_API_KEY", "test-key-123", async () => {
    let captured;
    const fetchImpl = makeMockFetch({
      body: happyBody,
      captureRequest: (r) => { captured = r; },
    });
    await callGlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl });
    assert.equal(captured.url, `${GLM_BASE_URL}/chat/completions`);
    assert.equal(captured.init.method, "POST");
  });
});

test("callGlm sets Bearer Authorization header with the env key", async () => {
  await withEnv("GLM_API_KEY", "sk-zhipu-abc", async () => {
    let captured;
    const fetchImpl = makeMockFetch({
      body: happyBody,
      captureRequest: (r) => { captured = r; },
    });
    await callGlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl });
    assert.equal(captured.init.headers.Authorization, "Bearer sk-zhipu-abc");
    assert.equal(captured.init.headers["Content-Type"], "application/json");
  });
});

test("callGlm body uses GLM_DEFAULT_MODEL + max_tokens (snake_case wire field)", async () => {
  await withEnv("GLM_API_KEY", "k", async () => {
    let captured;
    const fetchImpl = makeMockFetch({
      body: happyBody,
      captureRequest: (r) => { captured = r; },
    });
    await callGlm({ systemPrompt: "sys", userMessage: "msg", maxTokens: 99, fetchImpl });
    assert.equal(captured.parsedBody.model, GLM_DEFAULT_MODEL);
    // ZhipuAI OpenAI-compat expects max_tokens not maxTokens
    assert.equal(captured.parsedBody.max_tokens, 99);
    assert.equal(captured.parsedBody.maxTokens, undefined);
  });
});

test("callGlm sends system message before user message in the order GLM expects", async () => {
  await withEnv("GLM_API_KEY", "k", async () => {
    let captured;
    const fetchImpl = makeMockFetch({
      body: happyBody,
      captureRequest: (r) => { captured = r; },
    });
    await callGlm({
      systemPrompt: "You are the Risk Officer voice.",
      userMessage: "LBO leverage 4.4×, does Policy 4.3 apply?",
      fetchImpl,
    });
    const msgs = captured.parsedBody.messages;
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, "system");
    assert.equal(msgs[0].content, "You are the Risk Officer voice.");
    assert.equal(msgs[1].role, "user");
    assert.equal(msgs[1].content, "LBO leverage 4.4×, does Policy 4.3 apply?");
  });
});

test("callGlm default maxTokens is 220 (matches voice rationale budget)", async () => {
  await withEnv("GLM_API_KEY", "k", async () => {
    let captured;
    const fetchImpl = makeMockFetch({
      body: happyBody,
      captureRequest: (r) => { captured = r; },
    });
    await callGlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl });
    assert.equal(captured.parsedBody.max_tokens, 220);
  });
});

test("callGlm returns trimmed content + model on 200 OK", async () => {
  await withEnv("GLM_API_KEY", "k", async () => {
    const fetchImpl = makeMockFetch({ body: happyBody });
    const result = await callGlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl });
    assert.equal(
      result.text,
      "Risk Officer agrees the LBO leverage at 4.4× is policy 4.3 compliant."
    );
    assert.equal(result.model, GLM_DEFAULT_MODEL);
  });
});

test("callGlm throws with status + truncated detail on non-2xx response", async () => {
  await withEnv("GLM_API_KEY", "k", async () => {
    const longDetail = "x".repeat(500); // exceeds the 200-char slice
    const fetchImpl = makeMockFetch({ status: 401, body: `{"error":"${longDetail}"}` });
    await assert.rejects(
      () => callGlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl }),
      (err) => {
        // status code must be in the error message so logs can triage
        assert.match(err.message, /GLM API 401:/);
        // truncated to 200 chars so a hostile/long upstream can't fill logs
        assert.ok(err.message.length < 300);
        return true;
      }
    );
  });
});

test("callGlm throws on rate-limit 429 with status code in message", async () => {
  await withEnv("GLM_API_KEY", "k", async () => {
    const fetchImpl = makeMockFetch({ status: 429, body: "rate limit" });
    await assert.rejects(
      () => callGlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl }),
      /GLM API 429: rate limit/
    );
  });
});

test("callGlm throws 'empty content' when choices array is missing", async () => {
  await withEnv("GLM_API_KEY", "k", async () => {
    const fetchImpl = makeMockFetch({ body: { choices: [] } });
    await assert.rejects(
      () => callGlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl }),
      /GLM returned empty content/
    );
  });
});

test("callGlm throws 'empty content' when message.content is empty string", async () => {
  await withEnv("GLM_API_KEY", "k", async () => {
    const fetchImpl = makeMockFetch({
      body: { choices: [{ message: { content: "" } }] },
    });
    await assert.rejects(
      () => callGlm({ systemPrompt: "sys", userMessage: "msg", fetchImpl }),
      /GLM returned empty content/
    );
  });
});

test("GLM_BASE_URL is the official Zhipu OpenAI-compat endpoint (not v3)", () => {
  // If anyone reaches for v3 the OpenAI-compat surface flips and the
  // 5-voice deliberate.js path silently breaks for Mainland bank pitches.
  assert.equal(GLM_BASE_URL, "https://open.bigmodel.cn/api/paas/v4");
});
