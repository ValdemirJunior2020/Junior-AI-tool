import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { db, newId, now, makePassword, goodPassword } from "../db.mjs";
import { newTotpSecret } from "../mfa.mjs";

const fromEnv = process.argv.includes("--from-env");
if (!fromEnv && !input.isTTY) { console.error("Run interactively or use --from-env with local .env values."); process.exit(1); }
async function getAdminEmail() {
  if (fromEnv) return String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const rl = readline.createInterface({ input, output });
  try { return (await rl.question("Super Admin email: ")).trim().toLowerCase(); }
  finally { rl.close(); }
}
const email = await getAdminEmail();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error("Invalid email."); process.exit(1); }
function hiddenPassword() {
  return new Promise(resolve => {
    let value = "";
    output.write("Choose a new password (hidden): ");
    input.setRawMode(true);
    input.resume();
    function onData(chunk) {
      const key = chunk.toString("utf8");
      if (key === "\r" || key === "\n") {
        input.off("data", onData); input.setRawMode(false); input.pause(); output.write("\n"); resolve(value);
      } else if (key === "\u0003") {
        input.setRawMode(false); output.write("\nCancelled.\n"); process.exit(130);
      } else if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
      } else if (!key.startsWith("\u001b")) {
        value += key;
      }
    }
    input.on("data", onData);
  });
}
const password = fromEnv ? String(process.env.ADMIN_PASSWORD || "") : await hiddenPassword();
if (fromEnv && !password) { console.error("ADMIN_PASSWORD is missing from local .env."); process.exit(1); }
if (!goodPassword(password)) { console.error("Password must be 12–128 characters."); process.exit(1); }
const hash = await makePassword(password);
const totp = newTotpSecret();
const existing = db.prepare("SELECT id FROM users WHERE email=?").get(email);
if (existing) {
  db.prepare("UPDATE users SET pass=?, role='admin', verified=1, totp_secret=? WHERE id=?").run(hash, totp, existing.id);
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(existing.id);
  console.log("Administrator credentials updated. Previous sessions invalidated.");
} else {
  db.prepare("INSERT INTO users(id,email,pass,role,verified,created,totp_secret) VALUES (?,?,?,'admin',1,?,?)").run(newId(), email, hash, now(), totp);
  console.log("Administrator created.");
}
console.log("\nLocal bootstrap complete. The password was hashed into SQLite.");
if (fromEnv) console.log("Remove ADMIN_PASSWORD from .env after setup if you no longer need it there.");
console.log("\nIMPORTANT: Add this key to an authenticator app on YOUR phone:");
console.log(totp);
console.log("\nAuthenticator setup URI (keep private):");
console.log("otpauth://totp/" + encodeURIComponent("Junior AI:" + email) + "?secret=" + totp + "&issuer=Junior%20AI");
console.log("\nEvery administrator login now requires its six-digit authenticator code. Save the key in a secure location.");
db.close();
