import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { makePassword, verifyPassword } from "../db.mjs";
import { newTotpSecret, codeFor, verifyTotp } from "../mfa.mjs";
import { assertLocalFooocusUrl, scanFiles } from "../fooocus-local.mjs";

test("local password bootstrap stores salted hashes and validates login", async () => {
  const secret = "A-new-unique-local-admin-password-2026";
  const hash = await makePassword(secret);
  assert.match(hash, /^scrypt:[a-f0-9]+:[a-f0-9]+$/);
  assert.equal(hash.includes(secret), false);
  assert.equal(await verifyPassword(secret, hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("admin authenticator produces and verifies locally generated TOTP codes", () => {
  const secret = newTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  const code = codeFor(secret);
  assert.equal(verifyTotp(secret, code), true);
  assert.equal(verifyTotp(secret, "111"), false);
});

test("official Fooocus connection rejects cloud and public HTTP destinations", () => {
  const previous = process.env.FOOOCUS_UI_URL;
  try {
    process.env.FOOOCUS_UI_URL = "http://127.0.0.1:7865";
    assert.equal(assertLocalFooocusUrl(), "http://127.0.0.1:7865/");
    process.env.FOOOCUS_UI_URL = "https://fooocus.example.com";
    assert.throws(() => assertLocalFooocusUrl(), /localhost/);
    process.env.FOOOCUS_UI_URL = "http://192.168.0.100:7865";
    assert.throws(() => assertLocalFooocusUrl(), /localhost/);
  } finally {
    if (previous === undefined) delete process.env.FOOOCUS_UI_URL;
    else process.env.FOOOCUS_UI_URL = previous;
  }
});

test("Fooocus output scan only returns image files within the selected directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "junior-fooocus-test-"));
  try {
    await mkdir(path.join(root, "2026-10-18"));
    await writeFile(path.join(root, "2026-10-18", "generated.png"), Buffer.alloc(100, 1));
    await writeFile(path.join(root, "2026-10-18", "log.html"), "this is not a generated image");
    const found = await scanFiles(root);
    assert.equal(found.length, 1);
    assert.match(found[0].path, /generated\.png$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
