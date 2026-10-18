import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DATA } from "../db.mjs";

const root = process.env.FOOOCUS_DIR ? path.resolve(process.env.FOOOCUS_DIR) : "";
const python = path.join(root || ".", "python_embeded", "python.exe");
const entry = path.join(root || ".", "Fooocus", "entry_with_update.py");
if (process.platform !== "win32" || !root || !existsSync(python) || !existsSync(entry)) {
  console.error("FOOOCUS_DIR must point to official Fooocus Windows portable root with python_embeded/python.exe and Fooocus/entry_with_update.py.");
  process.exit(1);
}
const output = path.join(DATA, "fooocus-output");
const temp = path.join(DATA, "fooocus-temp");
await mkdir(output, { recursive: true });
await mkdir(temp, { recursive: true });
const args = [
  "-s", entry, "--directml", "--port", "7865", "--disable-in-browser",
  "--disable-analytics", "--output-path", output, "--temp-path", temp
];
console.log("Starting official Fooocus on local-only http://127.0.0.1:7865 using AMD DirectML.");
console.log("Outputs and temporary files are confined to Junior AI's retention-managed local data directory.");
const proc = spawn(python, args, { cwd: root, stdio: "inherit", windowsHide: false, env: { ...process.env, GRADIO_ANALYTICS_ENABLED: "False" } });
proc.on("error", err => { console.error("Fooocus could not start:", err.message); process.exitCode = 1; });
proc.on("exit", code => { console.log("Fooocus ended with exit code:", code); process.exitCode = code || 0; });
