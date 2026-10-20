import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { saveBuilderStatus } from "../builder-status-store.mjs";

test("builder status updates serialize and leave a valid final JSON without orphan tmp files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "junior-builder-status-"));
  try {
    const dest = path.join(root, "job", "status.json");
    const writes = [];
    for (let i = 0; i < 30; i++) writes.push(saveBuilderStatus(dest, { id: "case", attempt: i, state: "running" }));
    await Promise.all(writes);
    const saved = JSON.parse(await readFile(dest, "utf8"));
    assert.equal(saved.attempt, 29);
    assert.equal(saved.state, "running");
    assert.deepEqual(await readdir(path.dirname(dest)), ["status.json"]);
    await saveBuilderStatus(dest, { id: "case", attempt: 30, state: "ready" });
    assert.equal(JSON.parse(await readFile(dest, "utf8")).state, "ready");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
