// Lightweight public-news discovery, no API key and no arbitrary-site requests.
// Headlines are source claims, not proof of broad public sentiment.
const FRESH = /\b(hoje|agora|ontem|recente|recentes|últim[oa]s?|atual(?:mente)?|aconteceu|reação|reacao|repercussão|repercussao|notícias?|noticias|today|yesterday|latest|recent|news|reaction|aftermath|breaking|esta semana|this week|esta mañana|actualidad)\b/i;
const EVENTS = /\b(debate|eleiç[ãõ]o|election|eleccion|president|presidente|band|pol[ií]tic|economia|economy|mercado|market|guerra|war|jogo|game|partida|preço|price|governo|government|protest|manifest|notícia|news)\b/i;

export function wantsFreshNews(question) {
  const p = String(question || "").slice(0, 1200);
  // The word "news" inside a coding request is not a request to fetch current headlines.
  if (/\b(react|component|javascript|typescript|python|css|html|code)\b/i.test(p) && /\b(create|build|write|implement|make)\b/i.test(p)) return false;
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
// A compact source list; never display Google's multi-hundred-character RSS URLs.
export function newsSourcesFooter(items, locale = "pt-BR") {
  if (!items.length) return "";
  const heading = locale === "en" ? "Sources checked" :
    locale === "es-ES" ? "Fuentes consultadas" : "Fontes consultadas";
  const caveat = locale === "en" ? "Headlines only — full articles and public opinion not verified." :
    locale === "es-ES" ? "Solo titulares; no se verificaron artículos completos ni la opinión pública." :
    "Somente manchetes; textos integrais e opinião pública não verificados.";
  const visible = items.slice(0, 5);
  // Title stays in the model's evidence, not in the footer: links should stay short.
  const lines = visible.map((x, i) => {
    const publisher = x.source.replace(/[\[\]\n\r]/g, "").slice(0, 70);
    return "- **[" + (i + 1) + "]** [" + publisher + "](" + x.url + ") · " +
      x.published.slice(0, 10).split("-").reverse().join("/");
  });
  const more = items.length > visible.length ? "\n" + (locale === "en" ? "Additional headlines found: " :
    locale === "es-ES" ? "Otros titulares encontrados: " : "Outras manchetes encontradas: ") +
    (items.length - visible.length) + "." : "";
  return "\n\n---\n\n### 📰 " + heading + "\n\n" + lines.join("\n") +
    more + "\n\n_" + caveat + "_";
}
