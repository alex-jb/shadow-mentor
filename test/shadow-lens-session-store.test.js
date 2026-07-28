// Tests for the Shadow Lens session store + ephemeral request token.
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {
  InMemoryLensStore, FileLensStore, issueSessionToken, verifySessionToken, newSessionId,
} from "../apps/shadow-lens/backend/session-store.mjs";

const SECRET = "test-secret-0123456789";

test("in-memory store round-trips + isolates via clone", async () => {
  const s = new InMemoryLensStore();
  const id = newSessionId();
  await s.create({ session_id: id, stage: "created", capture: null });
  const got = await s.get(id);
  got.capture = { mutated: true }; // mutating the returned copy must not affect the store
  assert.equal((await s.get(id)).capture, null);
  await s.update(id, { stage: "captured" });
  assert.equal((await s.get(id)).stage, "captured");
});

test("file store rejects path traversal ids", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sls-"));
  const s = new FileLensStore(dir);
  await assert.rejects(() => s.create({ session_id: "../evil", stage: "x" }));
  const id = newSessionId();
  await s.create({ session_id: id, stage: "created" });
  assert.equal((await s.get(id)).stage, "created");
});

test("token verifies, rejects tampering, and expires", () => {
  const id = newSessionId();
  const tok = issueSessionToken(id, { secret: SECRET, ttlSec: 900 });
  assert.equal(verifySessionToken(tok, { secret: SECRET }).valid, true);
  assert.equal(verifySessionToken(tok, { secret: "wrong" }).valid, false);
  assert.equal(verifySessionToken(tok + "x", { secret: SECRET }).valid, false);
  // expired
  const old = issueSessionToken(id, { secret: SECRET, ttlSec: -1 });
  const v = verifySessionToken(old, { secret: SECRET });
  assert.equal(v.valid, false);
  assert.equal(v.reason, "expired");
});

test("malformed token is rejected, not thrown", () => {
  assert.equal(verifySessionToken("garbage", { secret: SECRET }).valid, false);
  assert.equal(verifySessionToken(null, { secret: SECRET }).valid, false);
});
