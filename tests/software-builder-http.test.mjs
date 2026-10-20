import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Isolate SQLite from developer data and other test files.
const root = await mkdtemp(path.join(os.tmpdir(), "junior-builder-api-"));
process.env.DATA_DIR = root;
const { builderRouter } = await import("../software-builder.mjs");
const { db } = await import("../db.mjs");
const app = express();
app.use(express.json());
app.use("/api/builder", (req, _res, next) => {
  req.user = { id: "test-builder-user", role: "user" };
  next();
}, builderRouter);
const server = await new Promise(resolve => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
const base = "http://127.0.0.1:" + server.address().port + "/api/builder";
test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  await rm(root, { recursive: true, force: true });
});

test("locally signed-in user can read builder status", async () => {
  const r = await fetch(base + "/status");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.local, true);
  assert.equal(j.remoteReadOnly, false);
});

test("remote proxy can view own builder status but cannot start or retry code execution", async () => {
  const headers = { Host: "junior-ai-tool.netlify.app", Origin: "https://junior-ai-tool.netlify.app" };
  const status = await fetch(base + "/status", { headers });
  assert.equal(status.status, 200);
  const j = await status.json();
  assert.equal(j.local, false);
  assert.equal(j.remoteReadOnly, true);
  const projects = await fetch(base + "/projects", { headers });
  assert.equal(projects.status, 200);
  const create = await fetch(base + "/projects", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ name: "x", prompt: "Make a complete web app with tests" }) });
  assert.equal(create.status, 403);
  const retry = await fetch(base + "/projects/0123456789abcdef/retry", { method: "POST", headers });
  assert.equal(retry.status, 403);
});

test("read-only polling has enough budget for typical overnight status refreshes", async () => {
  for (let i = 0; i < 190; i++) {
    const r = await fetch(base + "/status");
    assert.equal(r.status, 200, "poll " + i + " should not be blocked");
    await r.body?.cancel();
  }
});
