import { documentationLinksInPrompt, crawlDocumentation } from "../documentation-research.mjs";
const prompt = "Read https://docs.python.org/3/library/asyncio.html and tell me the exact Hello World code example";
const links = documentationLinksInPrompt(prompt);
console.log("Links selected:", links.length, links);
if (links.length !== 1) process.exit(2);
try {
  const result = await crawlDocumentation(links[0], { timeoutMs: 35000 });
  const found = result.text.includes("Hello World") && result.text.includes("asyncio.sleep(1)");
  console.log("Node to Python Crawl4AI bridge:", found ? "PASS" : "CONTENT NOT FOUND");
  console.log("Extracted characters:", result.text.length);
  console.log("Official asyncio sample found:", found);
  if (!found) process.exitCode = 3;
} catch (error) {
  console.error("Node to Python Crawl4AI bridge: FAIL");
  console.error("Reason:", error.message);
  process.exitCode = 1;
}
