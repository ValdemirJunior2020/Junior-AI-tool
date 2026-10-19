import "dotenv/config";
import Database from "better-sqlite3";
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { initializeMemory } from "./memory.mjs";
const scrypt = promisify(scryptCallback);
export const DATA = path.resolve(process.env.DATA_DIR || "./data");
export const STORE = path.join(DATA, "files");
await mkdir(STORE, { recursive: true });
export const db = new Database(path.join(DATA, "junior.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("secure_delete = ON");
db.exec([
"CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', verified INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)",
"CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL)",
"CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, expires INTEGER NOT NULL)",
"CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, created INTEGER NOT NULL)",
"CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, created INTEGER NOT NULL)",
"CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, kind TEXT NOT NULL, filepath TEXT NOT NULL, created INTEGER NOT NULL)",
"CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, filepath TEXT NOT NULL, created INTEGER NOT NULL)",
"CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, user_id TEXT, event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL)"
].join(";") + ";");
if (!db.pragma("table_info(users)").some(col => col.name === "display_name")) db.exec("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
if (!db.pragma("table_info(users)").some(col => col.name === "totp_secret")) db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT NOT NULL DEFAULT ''");
// Existing authenticator secrets are no longer used; clear them from local records.
db.prepare("UPDATE users SET totp_secret='' WHERE totp_secret<>''").run();
// Create the local full-text indexes without replacing or modifying existing user records.
initializeMemory(db);
export const now = () => Date.now();
export const newId = () => randomBytes(16).toString("hex");
export const digest = (v) => createHash("sha256").update(v).digest("hex");
export const WEEK = 7 * 24 * 60 * 60 * 1000;
export const safeText = (v, max = 16000) => typeof v === "string" ? v.trim().slice(0, max) : "";
export const goodPassword = (v) => typeof v === "string" && v.length >= 12 && v.length <= 128;
export async function makePassword(v) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(v, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return "scrypt:" + salt + ":" + derived.toString("hex");
}
export async function verifyPassword(v, saved) {
  const parts = String(saved || "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const expected = Buffer.from(parts[2], "hex");
  if (expected.length !== 64) return false;
  const actual = await scrypt(v, parts[1], 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(expected, actual);
}
export function audit(userId, event, detail = "") {
  db.prepare("INSERT INTO audit VALUES (?,?,?,?,?)").run(newId(), userId || null, event, safeText(detail, 90), now());
}
export async function eraseFiles(userId) {
  for (const table of ["uploads", "images"]) {
    for (const f of db.prepare("SELECT filepath FROM " + table + " WHERE user_id=?").all(userId))
      await unlink(f.filepath).catch(() => {});
  }
}
export async function cleanup() {
  const oldest = now() - WEEK;
  for (const table of ["uploads", "images"]) {
    for (const row of db.prepare("SELECT filepath FROM " + table + " WHERE created < ?").all(oldest))
      await unlink(row.filepath).catch(() => {});
  }
  db.transaction(() => {
    for (const table of ["messages", "uploads", "images", "audit"])
      db.prepare("DELETE FROM " + table + " WHERE created < ?").run(oldest);
    db.prepare("DELETE FROM sessions WHERE expires < ?").run(now());
    db.prepare("DELETE FROM tokens WHERE expires < ?").run(now());
    db.prepare("DELETE FROM chats WHERE created < ?").run(oldest);
  })();
  db.pragma("wal_checkpoint(TRUNCATE)");
}
