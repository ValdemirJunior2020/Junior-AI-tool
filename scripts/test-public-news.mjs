import { wantsFreshNews, newsSearchQuery, searchPublicNews } from "../public-news.mjs";
const q = "oi, como esta a reacao do povo no Brasil depois do debate para presidente na tv band aconteceu?";
console.log("Current-news question recognized:", wantsFreshNews(q));
console.log("Search:", newsSearchQuery(q));
if (!wantsFreshNews(q)) process.exit(2);
try {
  const results = await searchPublicNews(q);
  console.log("Feed request: PASS");
  console.log("Articles within the last 14 days:", results.length);
  for (const article of results.slice(0,3)) console.log(article.published.slice(0,10), "-", article.source, "-",article.title);
  if (results.length===0) console.log("No current articles found; Junior AI should state this instead of inventing reactions.");
} catch (e) {
  console.error("Feed request: FAIL:", e.message);
  process.exitCode=1;
}
