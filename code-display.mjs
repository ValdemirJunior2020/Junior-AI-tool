// Pure helpers for consistently rendering syntax-highlighted code with line numbers.
// Highlights arrive from highlight.js (which HTML-escapes input); spans can cross
// newline boundaries, so closing/reopening them is necessary for valid per-line HTML.
export const CODE_SETTINGS_DEFAULTS = Object.freeze({
  wrap: true,
  lineNumbers: true,
  fontSize: 16
});

export function normalizeCodeSettings(value) {
  const input = value && typeof value === "object" ? value : {};
  const font = Number(input.fontSize);
  return {
    wrap: typeof input.wrap === "boolean" ? input.wrap : CODE_SETTINGS_DEFAULTS.wrap,
    lineNumbers: typeof input.lineNumbers === "boolean" ? input.lineNumbers : CODE_SETTINGS_DEFAULTS.lineNumbers,
    fontSize: Number.isFinite(font) ? Math.max(12, Math.min(22, Math.round(font))) : CODE_SETTINGS_DEFAULTS.fontSize
  };
}

export function splitHighlightedLines(markup) {
  const lines = [];
  let current = "";
  const openSpans = [];
  // highlight.js emits <span class="hljs-..."> and </span> only; all
  // literal code markup is escaped and cannot become an HTML element here.
  const html = String(markup || "");
  const tokens = html.match(/<span class="[^"]+">|<\/span>|[^<]+|</g) || [];
  for (const token of tokens) {
    if (/^<span class="[^"]+">$/.test(token)) {
      openSpans.push(token);
      current += token;
    } else if (token === "</span>") {
      if (openSpans.length) openSpans.pop();
      current += token;
    } else {
      const parts = token.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push(current + "</span>".repeat(openSpans.length));
          current = openSpans.join("");
        }
        current += parts[i];
      }
    }
  }
  lines.push(current);
  return lines;
}
