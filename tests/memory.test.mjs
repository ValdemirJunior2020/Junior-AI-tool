import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { splitIntoPassages, safeFtsQuery, initializeMemory, indexDocument, relevantDocuments, relevantMemories, backfillDocuments } from "../memory.mjs";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const now = Date.now();
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE chats (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, title TEXT, created INT);
    CREATE TABLE messages (id TEXT PRIMARY KEY, chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, role TEXT, content TEXT, created INT);
    CREATE TABLE uploads (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, name TEXT, kind TEXT, filepath TEXT, created INT);
  `);
  // node:sqlite uses the same prepare/exec interface; bridge its transaction API for these tests.
  db.transaction = fn => () => {
    db.exec("BEGIN");
    try { const result = fn(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  for (const id of ["alice","bob"]) {
    db.prepare("INSERT INTO users VALUES (?)").run(id);
    db.prepare("INSERT INTO chats VALUES (?,?,?,?)").run(id + "-chat", id, "Chat " + id, now);
  }
  return db;
}
test("long documents are chunked without losing text near the end", () => {
  const chunks = splitIntoPassages("intro " + "word ".repeat(500) + "uniquezebra end");
  assert.ok(chunks.length > 1);
  assert.ok(chunks.some(c => c.includes("uniquezebra")));
  assert.ok(chunks.every(c => c.length <= 1050));
});
test("special search syntax is safely quoted", () => {
  assert.match(safeFtsQuery('" OR sqlite DROP + tables'), /"sqlite"/);
  assert.equal(safeFtsQuery("how is it"), "");
});
test("document retrieval respects user, selected file, expiry and deletion", () => {
  const db = database(); initializeMemory(db);
  const a = "a".repeat(32), b = "b".repeat(32), expired = "c".repeat(32);
  for (const [id, user, created] of [[a,"alice",now],[b,"bob",now],[expired,"alice",now-WEEK-9]])
    db.prepare("INSERT INTO uploads VALUES (?,?,?,?,?,?)").run(id,user,"document","text","/test",created);
  indexDocument(db,{id:a,user_id:"alice",created:now},"Opening text. " + "filler ".repeat(230) + "secretzebra at the end");
  indexDocument(db,{id:b,user_id:"bob",created:now},"Private secretzebra for Bob");
  indexDocument(db,{id:expired,user_id:"alice",created:now-WEEK-9},"Old secretzebra should be gone");
  const found = relevantDocuments(db,{userId:"alice",question:"secretzebra"});
  assert.ok(found.some(x => x.text.includes("at the end")));
  assert.ok(found.every(x => x.upload_id === a));
  assert.equal(relevantDocuments(db,{userId:"bob",question:"filler",selectedIds:[a]}).length,0);
  assert.ok(relevantDocuments(db,{userId:"alice",question:"summarize",selectedIds:[a]}).length>0);
  db.prepare("DELETE FROM uploads WHERE id=?").run(a);
  assert.equal(relevantDocuments(db,{userId:"alice",question:"secretzebra"}).length,0);
  db.close();
});
test("messages remain account-isolated, searchable for seven days and delete with chats", () => {
  const db = database();
  const a="1".repeat(32), b="2".repeat(32), old="3".repeat(32);
  db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?)").run(a,"alice-chat","alice","user","My albatrossblue plan",now);
  db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?)").run(b,"bob-chat","bob","user","My albatrossblue secret",now);
  db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?)").run(old,"alice-chat","alice","user","Old albatrossblue facts",now-WEEK-1);
  initializeMemory(db);
  let hits = relevantMemories(db,{userId:"alice",question:"albatrossblue"});
  assert.deepEqual(hits.map(h=>h.id),[a]);
  assert.equal(relevantMemories(db,{userId:"alice",question:"albatrossblue",excludeIds:[a]}).length,0);
  db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?)").run("4".repeat(32),"alice-chat","alice","user","new uniqueblueprint",now);
  assert.equal(relevantMemories(db,{userId:"alice",question:"uniqueblueprint"}).length,1);
  db.prepare("DELETE FROM chats WHERE id=?").run("alice-chat");
  assert.equal(relevantMemories(db,{userId:"alice",question:"uniqueblueprint"}).length,0);
  db.close();
});
test("backfill skips missing or expired files", async () => {
  const db = database(); initializeMemory(db);
  for (const [id,created] of [["1".repeat(32),now],["2".repeat(32),now],["3".repeat(32),now-WEEK-9]])
    db.prepare("INSERT INTO uploads VALUES (?,?,?,?,?,?)").run(id,"alice","old file","text",id,created);
  const indexed = await backfillDocuments(db, async filepath => {
    if (filepath === "2".repeat(32)) throw Error("missing");
    return "uniqueorchid retrieved";
  });
  assert.equal(indexed,1);
  assert.equal(relevantDocuments(db,{userId:"alice",question:"uniqueorchid"}).length,1);
  db.close();
});
