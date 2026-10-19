import test from "node:test";
import assert from "node:assert/strict";
import { wantsFreshNews, newsSearchQuery, parseNewsFeed, searchPublicNews, newsEvidence } from "../public-news.mjs";

test("triggers research for recent Brazilian presidential debate reactions", () => {
  const q="oi, como esta a reacao do povo no Brasil depois do debate para presidente na tv band aconteceu?";
  assert.equal(wantsFreshNews(q),true);
  assert.match(newsSearchQuery(q),/debate presidencial Band/);
  assert.equal(wantsFreshNews("What is Python asyncio?"),false);
  assert.equal(wantsFreshNews("Create a React component with a news badge"),false);
});
test("parses dated source claims without treating stale or unsafe URLs as current evidence",()=>{
 const current=new Date("2026-10-19T16:00:00Z").getTime();
 const valid='<item><title>Debate &amp; reações - Rádio Teste</title><link>https://news.google.com/rss/articles/ABC</link><pubDate>Mon, 19 Oct 2026 12:00:00 GMT</pubDate><source>Rádio Teste</source></item>';
 const stale='<item><title>Older article</title><link>https://news.google.com/rss/articles/OLD</link><pubDate>Tue, 01 Sep 2026 12:00:00 GMT</pubDate></item>';
 const bad='<item><title>Misleading URL</title><link>http://127.0.0.1/secrets</link><pubDate>Mon, 19 Oct 2026 12:00:00 GMT</pubDate></item>';
 const found=parseNewsFeed("<rss><channel>"+valid+stale+bad+"</channel></rss>",current);
 assert.equal(found.length,1);
 assert.equal(found[0].title,"Debate & reações - Rádio Teste");
 assert.equal(found[0].source,"Rádio Teste");
 assert.match(newsEvidence(found),/Published: 2026-10-19/);
});
test("uses free fixed-origin RSS feed and respects returned news dates", async ()=>{
 const current=new Date("2026-10-19T16:00:00Z").getTime();
 let address;
 const items=await searchPublicNews("qual a repercussão do debate na Band hoje?",{
  nowMs:current,
  fetcher: async (url)=>{
    address=new URL(url);
    return {
      ok:true,headers:{get:()=>null},
      text:async()=>'<rss><channel><item><title>Debate reactions</title><link>https://news.google.com/rss/articles/123</link><pubDate>Mon, 19 Oct 2026 13:00:00 GMT</pubDate><source>Jornal Teste</source></item></channel></rss>'
    };
  }
 });
 assert.equal(address.origin,"https://news.google.com");
 assert.equal(address.searchParams.get("gl"),"BR");
 assert.equal(items.length,1);
});
test("non-RSS response is rejected instead of passing hallucination bait to the model",async()=>{
 await assert.rejects(searchPublicNews("notícias de economia hoje",{
   fetcher:async()=>({ok:true,headers:{get:()=>null},text:async()=>"<html>no news</html>"})
 }),/Invalid news feed/);
});
