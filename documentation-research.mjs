// Browser access for Junior AI is opt-in and restricted to documented public HTTPS hosts.
// Never pass localhost, intranet, numeric-IP, cloud metadata, or user credentials to Crawl4AI.
import { spawn } from "node:child_process";

export const TRUSTED_DOC_HOSTS = new Set([
  "docs.python.org", "developer.mozilla.org", "nodejs.org", "react.dev",
  "www.typescriptlang.org", "www.python.org", "git-scm.com", "docs.github.com",
  "docs.docker.com", "learn.microsoft.com", "docs.npmjs.com", "docs.crawl4ai.com",
  "docs.ollama.com", "www.sqlite.org", "sqlite.org", "docs.rs", "go.dev"
]);
const MAX_URL_LENGTH = 1200;

export function safeDocumentationUrl(raw) {
  if (typeof raw !== "string" || raw.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!TRUSTED_DOC_HOSTS.has(url.hostname.toLowerCase())) return null;
    // Strip fragments; ignore tracking parameters, except documentation sites sometimes use query pages.
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

export function documentationLinksInPrompt(prompt) {
  const words = String(prompt || "").match(/https:\/\/[^\s"'<>]{1,1200}/g) || [];
  const links = [];
  for (const word of words) {
    const url = safeDocumentationUrl(word.replace(/[),.;!?]+$/, ""));
    if (url && !links.includes(url)) links.push(url);
    if (links.length >= 2) break;
  }
  return links;
}

export async function crawlDocumentation(url, { timeoutMs = 24000 } = {}) {
  const safe = safeDocumentationUrl(url);
  if (!safe) throw Error("This research tool only opens supported public HTTPS documentation sites.");
  const command = process.env.CRAWL4AI_PYTHON?.trim() || (process.platform === "win32" ? "py" : "python3");
  const args = ["scripts/crawl-documentation.py", safe];
  return new Promise((resolve, reject) => {
    let result = "", errors = "";
    const proc = spawn(command, args, {
      cwd: process.cwd(), shell: false, windowsHide: true,
      env: { ...process.env, CRAWL4AI_NO_CLOUD_NOTICE: "1", PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timer = setTimeout(() => { proc.kill(); reject(Error("Documentation research timed out")); }, timeoutMs);
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", chunk => { result = (result + chunk).slice(-18000); });
    proc.stderr.on("data", chunk => { errors = (errors + chunk).slice(-1000); });
    proc.on("error", error => { clearTimeout(timer); reject(Error("Local Crawl4AI Python is not available: " + error.message)); });
    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(Error("Local documentation reader failed (code " + code + ")"));
      try {
        const data = JSON.parse(result.trim().split("\n").at(-1));
        if (data.error || !data.text) throw Error("Could not extract readable documentation");
        resolve({ url: safe, text: String(data.text).slice(0, 9000) });
      } catch { reject(Error("Documentation reader returned no usable text")); }
    });
  });
}
