// Lightweight public-news discovery, no API key and no arbitrary-site requests.
// Headlines are source claims, not proof of broad public sentiment.
const FRESH = /\b(hoje|agora|ontem|recente|recentes|últim[oa]s?|atual(?:mente)?|aconteceu|reação|reacao|repercussão|repercussao|notícias?|noticias|today|yesterday|latest|recent|news|reaction|aftermath|breaking|esta semana|this week|esta mañana|actualidad)\b/i;
const EVENTS = /\b(debate|eleiç[ãõ]o|election|eleccion|president|presidente|band|pol[ií]tic|economia|economy|mercado|market|guerra|war|jogo|game|partida|preço|price|governo|government|protest|manifest|notícia|news)\b/i;

export function wantsFreshNews(question) {
  const p = String(question || "").slice(0, 1200);
  return FRESH.test(p) && EVENTS.test(p);
}
export function newsSearchQuery(question) {
  const p = String(question || "").slice(0, 260).replace(/https?:\/\/\S+/g,"").replace(/[<>{}\r\n]+/g," ").trim();
  if (/\bdebate\b/i.test(p) && /\bband\b/i.test(p) && /\bpresiden/i.test(p)) {
    return "debate presidencial Band repercussão reações Brasil";
  }
  return p;
}
function entities(raw) {
  return String(raw || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi,(_,num)=>String.fromCodePoint(parseInt(num,16)))
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}
function field(item, name) {
  const re = new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i");
  return entities(item.match(re)?.[1] || "").trim();
}
export function parseNewsFeed(xml, nowMs = Date.now()) {
  const items = [];
  for (const m of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body = m[1];
    const title = field(body,"title").replace(/<[^>]*>/g,"").slice(0,240);
    const link = field(body,"link").trim();
    const source = field(body,"source").replace(/<[^>]*>/g,"").slice(0,80);
    const stamp = Date.parse(field(body,"pubDate"));
    if (!title || !Number.isFinite(stamp) || stamp > nowMs+3600000 || nowMs-stamp > 14*86400000) continue;
    try {
      const u = new URL(link);
      if (u.protocol !== "https:" || u.username || u.password || !["news.google.com","www.google.com"].includes(u.hostname)) continue;
      items.push({title, url:u.href, source: source || "Google News", published:new Date(stamp).toISOString()});
    } catch {}
    if (items.length>=7) break;
  }
  return items;
}
export async function searchPublicNews(question, {fetcher=fetch, nowMs=Date.now()} = {}) {
  const q = newsSearchQuery(question);
  if (!q) return [];
  const isBrazil = /\b(brasil|brazil|band|presidente|debate|reação|reacao|repercussão|repercussao)\b/i.test(q);
  const params = new URLSearchParams({
    q:q+" when:14d", hl:isBrazil?"pt-BR":"en-US", gl:isBrazil?"BR":"US", ceid:isBrazil?"BR:pt-419":"US:en"
  });
  const uri = "https://news.google.com/rss/search?"+params.toString();
  const response = await fetcher(uri, {signal:AbortSignal.timeout(11000), headers:{"accept":"application/rss+xml, application/xml, text/xml"}});
  if (!response.ok) throw Error("News source returned HTTP "+response.status);
  if (Number(response.headers?.get?.("content-length") || 0)>900000) throw Error("News feed too large");
  const text = await response.text();
  if (text.length>900000 || !/<rss\b/i.test(text)) throw Error("Invalid news feed");
  return parseNewsFeed(text, nowMs);
}
export function newsEvidence(items) {
  return items.map((x,i)=>"["+ (i+1) +"] "+x.title+"\nPublisher: "+x.source+"\nPublished: "+x.published+"\nLink: "+x.url).join("\n\n");
}
export function newsSourcesFooter(items) {
  return items.length ? "\n\n**Fontes de notícias consultadas (manchetes e datas; conteúdo integral não verificado):**\n"+
    items.map(x=>"- "+x.source+" — "+x.published.slice(0,10)+": ["+x.title.replace(/[\[\]]/g,"")+"]("+x.url+")").join("\n") : "";
}
