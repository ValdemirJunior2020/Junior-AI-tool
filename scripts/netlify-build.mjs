import "dotenv/config";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], { stdio: "inherit", env: process.env });

const api = process.env.JUNIOR_BACKEND_URL?.trim();
let redirects;
if (api) {
  const u = new URL(api);
  const disallowed = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);
  if (u.protocol !== "https:" || disallowed.has(u.hostname) || u.username || u.password || u.pathname !== "/" || u.search || u.hash) {
    throw new Error("JUNIOR_BACKEND_URL must be a public HTTPS Pangolin hostname without path, credentials, or query string.");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || !u.hostname.includes(".")) {
    throw new Error("Use a public HTTPS domain for JUNIOR_BACKEND_URL.");
  }
  redirects = "/api/* " + u.origin + "/api/:splat 200\n/* /index.html 200\n";
  console.log("Netlify proxy configured to secure Pangolin host:", u.hostname);
} else {
  redirects = "/api/* /backend-unavailable.json 200\n/* /index.html 200\n";
  console.warn("No JUNIOR_BACKEND_URL: Netlify will show offline-safe landing page. Signup is disabled.");
}
await writeFile(path.resolve("dist", "_redirects"), redirects);
await writeFile(path.resolve("dist", "backend-unavailable.json"), JSON.stringify({
  ok: false, offline: true,
  error: "Junior AI's local server is not connected. The owner must configure Pangolin."
}));
console.log("Netlify static files ready.");
