import test from "node:test";
import assert from "node:assert/strict";
import { safeDocumentationUrl, documentationLinksInPrompt, TRUSTED_DOC_HOSTS } from "../documentation-research.mjs";

test("known public documentation URLs are accepted", () => {
  for (const url of [
    "https://docs.python.org/3/library/subprocess.html",
    "https://react.dev/reference/react/useState",
    "https://learn.microsoft.com/en-us/powershell/"
  ]) assert.equal(safeDocumentationUrl(url), url);
  assert.ok(TRUSTED_DOC_HOSTS.has("docs.python.org"));
});
test("internal hosts, credentials, ports, HTTP and unsupported domains are blocked", () => {
  for (const url of [
    "http://docs.python.org/3/",
    "https://localhost/",
    "https://127.0.0.1/",
    "https://192.168.0.1/",
    "https://169.254.169.254/latest/meta-data/",
    "https://user:pass@docs.python.org/3/",
    "https://docs.python.org:8443/3/",
    "https://docs.python.org.evil.example/3/",
    "https://evil.example/",
    "file:///C:/Windows/win.ini",
    "ftp://docs.python.org/"
  ]) assert.equal(safeDocumentationUrl(url), null, url);
});
test("only explicit links get selected, capped to two trusted sources", () => {
  const prompt = "Read https://docs.python.org/3/library/asyncio.html and https://react.dev/reference/react/useEffect. Avoid https://localhost/admin and https://evil.example/";
  assert.deepEqual(documentationLinksInPrompt(prompt), [
    "https://docs.python.org/3/library/asyncio.html",
    "https://react.dev/reference/react/useEffect"
  ]);
  assert.deepEqual(documentationLinksInPrompt("Explain asyncio without visiting external URLs"), []);
});
