import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.env.FOOOCUS_DIR ? path.resolve(process.env.FOOOCUS_DIR) : "";
const python = path.join(root || ".", "python_embeded", "python.exe");
const entry = path.join(root || ".", "Fooocus", "entry_with_update.py");
if (process.platform !== "win32") { console.error("This launcher is for the official Fooocus Windows portable distribution."); process.exit(1); }
if (!root || !existsSync(python) || !existsSync(entry)) {
  console.error("Set FOOOCUS_DIR in your local .env to the extracted official Fooocus directory with python_embeded and Fooocus folders.");
  process.exit(1);
}
console.log("Preparing official Fooocus's embedded Python environment for AMD DirectML.");
console.log("This changes ONLY Fooocus's local embedded Python packages, not Junior AI or your system Python.");
console.log("Do not run this if Fooocus is already generating images.");
const commands = [
  ["-m", "pip", "uninstall", "torch", "torchvision", "torchaudio", "torchtext", "functorch", "xformers", "-y"],
  ["-m", "pip", "install", "torch-directml"]
];
for (const args of commands) {
  console.log("Running local pip operation:", args.filter(x => !["-y"].includes(x)).join(" "));
  const status = await new Promise((resolve, reject) => {
    const proc = spawn(python, args, { cwd: root, stdio: "inherit", windowsHide: false });
    proc.on("error", reject);
    proc.on("close", resolve);
  });
  if (status !== 0) { console.error("Fooocus AMD dependency setup failed, status:", status); process.exit(1); }
}
console.log("AMD DirectML dependencies installed. Run START-FOOOCUS-AMD.bat.");
