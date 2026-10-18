import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { db, newId, now, makePassword, goodPassword } from "../db.mjs";

if (!input.isTTY) { console.error("Run this on your own computer in an interactive terminal."); process.exit(1); }
const rl = readline.createInterface({ input, output });
const email = (await rl.question("Super Admin email: ")).trim().toLowerCase();
rl.close();
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
const password = await hiddenPassword();
if (!goodPassword(password)) { console.error("Password must be 12–128 characters."); process.exit(1); }
const hash = await makePassword(password);
const existing = db.prepare("SELECT id FROM users WHERE email=?").get(email);
if (existing) {
  db.prepare("UPDATE users SET pass=?, role='admin', verified=1 WHERE id=?").run(hash, existing.id);
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(existing.id);
  console.log("Administrator credentials updated. Previous sessions invalidated.");
} else {
  db.prepare("INSERT INTO users VALUES (?,?,?,'admin',1,?)").run(newId(), email, hash, now());
  console.log("Administrator created.");
}
db.close();
