import express from "express";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import { randomBytes } from "node:crypto";
import { db, now, newId, digest, WEEK, safeText, goodPassword, makePassword, verifyPassword, audit, eraseFiles } from "./db.mjs";

export const router = express.Router();
const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false });
const publicUrl = (process.env.PUBLIC_URL || "http://localhost:3001").replace(/\/$/, "");
const mailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
const mailer = mailConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT || 587) === 465,
  ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } : {})
}) : null;
const normalizeEmail = (input) => safeText(input, 254).toLowerCase();
const validEmail = (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
function session(res, user) {
  const raw = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(digest(raw), user.id, now() + WEEK);
  res.cookie("junior_session", raw, { httpOnly: true, secure: publicUrl.startsWith("https:"), sameSite: "lax", path: "/", maxAge: WEEK });
}
export function userFor(req) {
  const raw = req.cookies.junior_session;
  if (!raw || typeof raw !== "string") return null;
  return db.prepare("SELECT u.id,u.email,u.role,u.verified,u.display_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>?").get(digest(raw), now()) || null;
}
export function requireUser(req, res, next) {
  req.user = userFor(req);
  if (!req.user) return res.status(401).json({ error: "Sign in to continue" });
  next();
}
export function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}
async function tokenEmail(user, kind) {
  if (!mailer) throw new Error("Email relay is not configured");
  const raw = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM tokens WHERE user_id=? AND kind=?").run(user.id, kind);
  db.prepare("INSERT INTO tokens VALUES (?,?,?,?)").run(digest(raw), user.id, kind, now() + 20 * 60 * 1000);
  const link = publicUrl + "/?action=" + kind + "&token=" + raw;
  await mailer.sendMail({ from: process.env.SMTP_FROM, to: user.email,
    subject: kind === "verify" ? "Verify Junior AI account" : "Reset Junior AI password",
    text: "Open this link within 20 minutes:\n" + link + "\nIgnore if you did not request it." });
}
router.get("/me", (req, res) => res.json({ user: userFor(req) }));
router.post("/register", limit, async (req, res, next) => {
  try {
    const mail = normalizeEmail(req.body.email);
    if (!validEmail(mail) || !goodPassword(req.body.password)) return res.status(400).json({ error: "Provide a valid email and a 12–128 character password" });
    if (!mailConfigured) return res.status(503).json({ error: "Registration will open when the owner configures SMTP verification" });
    if (db.prepare("SELECT id FROM users WHERE email=?").get(mail)) return res.status(409).json({ error: "That email is already registered" });
    const u = { id: newId(), email: mail };
    db.prepare("INSERT INTO users(id,email,pass,role,verified,created) VALUES (?,?,?,'user',0,?)").run(u.id, mail, await makePassword(req.body.password), now());
    try { await tokenEmail(u, "verify"); } catch {
      db.prepare("DELETE FROM users WHERE id=?").run(u.id);
      return res.status(503).json({ error: "Verification delivery failed; ask the site owner to check the SMTP server" });
    }
    audit(u.id, "registered");
    res.status(201).json({ message: "Please verify your email" });
  } catch (e) { next(e); }
});
router.post("/verify", limit, (req, res) => {
  const key = digest(safeText(req.body.token, 128));
  const row = db.prepare("SELECT user_id FROM tokens WHERE id=? AND kind='verify' AND expires>?").get(key, now());
  if (!row) return res.status(400).json({ error: "Verification link is expired or invalid" });
  db.transaction(() => {
    db.prepare("UPDATE users SET verified=1 WHERE id=?").run(row.user_id);
    db.prepare("DELETE FROM tokens WHERE id=?").run(key);
  })();
  audit(row.user_id, "verified");
  res.json({ ok: true });
});
router.post("/login", limit, async (req, res, next) => {
  try {
    const u = db.prepare("SELECT * FROM users WHERE email=?").get(normalizeEmail(req.body.email));
    if (!u || !await verifyPassword(String(req.body.password || ""), u.pass)) return res.status(401).json({ error: "Invalid login" });
    if (!u.verified) return res.status(403).json({ error: "Verify your email to continue" });
    session(res, u); audit(u.id, "login"); res.json({ user: { id: u.id, email: u.email, role: u.role } });
  } catch (e) { next(e); }
});
router.post("/logout", requireUser, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE id=?").run(digest(req.cookies.junior_session));
  res.clearCookie("junior_session", { path: "/" }); res.json({ ok: true });
});
router.post("/reset/request", limit, async (req, res) => {
  const u = db.prepare("SELECT id,email FROM users WHERE email=? AND verified=1").get(normalizeEmail(req.body.email));
  if (u && mailConfigured) await tokenEmail(u, "reset").catch(() => {});
  res.json({ message: "If the account exists, a reset email will be sent" });
});
router.post("/reset/confirm", limit, async (req, res, next) => {
  try {
    if (!goodPassword(req.body.password)) return res.status(400).json({ error: "Use a 12–128 character password" });
    const key = digest(safeText(req.body.token, 128));
    const row = db.prepare("SELECT user_id FROM tokens WHERE id=? AND kind='reset' AND expires>?").get(key, now());
    if (!row) return res.status(400).json({ error: "Reset link expired or invalid" });
    const hash = await makePassword(req.body.password);
    db.transaction(() => {
      db.prepare("UPDATE users SET pass=? WHERE id=?").run(hash, row.user_id);
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(row.user_id);
      db.prepare("DELETE FROM tokens WHERE user_id=?").run(row.user_id);
    })();
    audit(row.user_id, "password_reset"); res.json({ ok: true });
  } catch (e) { next(e); }
});
router.patch("/profile", requireUser, (req, res) => {
  const name = safeText(req.body.displayName, 60);
  if (name.length < 1 || /[<>]/.test(name)) return res.status(400).json({ error: "Enter a display name (1–60 characters)" });
  db.prepare("UPDATE users SET display_name=? WHERE id=?").run(name, req.user.id);
  audit(req.user.id, "profile_updated"); res.json({ display_name: name });
});
router.post("/password", requireUser, async (req, res, next) => {
  try {
    if (!goodPassword(req.body.password)) return res.status(400).json({ error: "Use a 12–128 character new password" });
    const old = db.prepare("SELECT pass FROM users WHERE id=?").get(req.user.id);
    if (!await verifyPassword(String(req.body.current || ""), old.pass)) return res.status(403).json({ error: "Current password is incorrect" });
    db.prepare("UPDATE users SET pass=? WHERE id=?").run(await makePassword(req.body.password), req.user.id);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.user.id);
    audit(req.user.id, "password_changed");
    res.clearCookie("junior_session", { path: "/" }); res.json({ ok: true });
  } catch (e) { next(e); }
});
router.delete("/account", requireUser, async (req, res, next) => {
  try {
    const row = db.prepare("SELECT pass FROM users WHERE id=?").get(req.user.id);
    if (!await verifyPassword(String(req.body.password || ""), row.pass)) return res.status(403).json({ error: "Password does not match" });
    await eraseFiles(req.user.id);
    db.prepare("DELETE FROM users WHERE id=?").run(req.user.id);
    audit(null, "account_deleted");
    res.clearCookie("junior_session", { path: "/" }); res.json({ ok: true });
  } catch (e) { next(e); }
});
export { mailConfigured };
