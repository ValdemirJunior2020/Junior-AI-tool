import React, { useMemo, useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import powershell from "highlight.js/lib/languages/powershell";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import java from "highlight.js/lib/languages/java";
import csharp from "highlight.js/lib/languages/csharp";
import cpp from "highlight.js/lib/languages/cpp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import { Check, Copy, WrapText, ListOrdered, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { CODE_SETTINGS_DEFAULTS, normalizeCodeSettings, splitHighlightedLines } from "../code-display.mjs";
import "highlight.js/styles/atom-one-dark.css";

const LANGUAGES = {
  javascript, typescript, python, bash, powershell, json, xml, css,
  sql, java, csharp, cpp, go, rust, ruby, php, yaml, markdown
};
for (const [name, grammar] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, grammar);

const ALIASES = {
  js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  py: "python", ps1: "powershell", pwsh: "powershell",
  sh: "bash", shell: "bash", zsh: "bash", console: "bash",
  html: "xml", svg: "xml", cs: "csharp", "c#": "csharp",
  c: "cpp", "c++": "cpp", h: "cpp", golang: "go",
  yml: "yaml", md: "markdown", rb: "ruby", text: "plaintext",
  txt: "plaintext", plaintext: "plaintext", none: "plaintext"
};

export function languageForCode(info = "") {
  const name = String(info).replace(/^language-/i, "").trim().toLowerCase().split(/\s+/)[0];
  const normalized = ALIASES[name] || name;
  return Object.hasOwn(LANGUAGES, normalized) ? normalized : "plaintext";
}

export function highlightSnippet(text, language = "") {
  const content = String(text);
  const chosen = languageForCode(language);
  const escape = value => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (content.length > 30000) return escape(content);
  try {
    if (chosen === "plaintext") {
      // Some older Ollama replies omit a language tag. Colorize multi-line
      // snippets conservatively, without changing the source or executing it.
      return content.includes("\n") && content.length < 10000
        ? hljs.highlightAuto(content).value : escape(content);
    }
    return hljs.highlight(content, { language: chosen, ignoreIllegals: true }).value;
  } catch {
    return escape(content);
  }
}

// Display preferences contain no chat content and are saved only in this browser.
// The tiny store keeps preferences synchronized across old and new code blocks.
const DISPLAY_KEY = "junior-ai-code-display-v1";
const listeners = new Set();
let displayPreferences = null;

function readPreferences() {
  if (!displayPreferences) {
    let saved = null;
    try {
      if (typeof window !== "undefined") saved = JSON.parse(window.localStorage.getItem(DISPLAY_KEY) || "null");
    } catch {}
    displayPreferences = normalizeCodeSettings(saved);
  }
  return displayPreferences;
}
function subscribePreferences(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function savePreferences(partial) {
  displayPreferences = normalizeCodeSettings({ ...readPreferences(), ...partial });
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(DISPLAY_KEY, JSON.stringify(displayPreferences));
  } catch {}
  listeners.forEach(listener => listener());
}
const serverPreferences = () => CODE_SETTINGS_DEFAULTS;
function useCodePreferences() {
  return useSyncExternalStore(subscribePreferences, readPreferences, serverPreferences);
}

const UI = {
  "pt-BR": {copy:"Copiar",copied:"Copiado",wrap:"Quebrar linhas",numbers:"Números de linha",
    smaller:"Diminuir fonte",larger:"Aumentar fonte",collapse:"Recolher código",expand:"Expandir código",size:"Fonte"},
  "es-ES": {copy:"Copiar",copied:"Copiado",wrap:"Ajustar líneas",numbers:"Números de línea",
    smaller:"Reducir letra",larger:"Aumentar letra",collapse:"Contraer código",expand:"Expandir código",size:"Letra"},
  en: {copy:"Copy",copied:"Copied",wrap:"Wrap lines",numbers:"Line numbers",
    smaller:"Smaller font",larger:"Larger font",collapse:"Collapse code",expand:"Expand code",size:"Font"}
};

function CodeBlock({ code, language, locale = "en" }) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const settings = useCodePreferences();
  const labels = UI[locale] || UI.en;
  const lang = languageForCode(language);
  const highlighted = useMemo(() => highlightSnippet(code, language), [code, language]);
  const lines = useMemo(() => splitHighlightedLines(highlighted), [highlighted]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return <div className={"junior-code-block" + (collapsed ? " is-collapsed" : "")}
    style={{ "--junior-code-font-size": settings.fontSize + "px" }}>
    <div className="junior-code-bar">
      <span className="junior-code-lang">{lang === "plaintext" ? "CODE" : lang.toUpperCase()}</span>
      <div className="junior-code-controls">
        <button type="button" className={"junior-code-option" + (settings.wrap ? " is-on" : "")}
          onClick={() => savePreferences({wrap: !settings.wrap})}
          aria-pressed={settings.wrap} aria-label={labels.wrap} title={labels.wrap}>
          <WrapText size={14}/><span className="junior-code-option-label">{labels.wrap}</span>
        </button>
        <button type="button" className={"junior-code-option" + (settings.lineNumbers ? " is-on" : "")}
          onClick={() => savePreferences({lineNumbers: !settings.lineNumbers})}
          aria-pressed={settings.lineNumbers} aria-label={labels.numbers} title={labels.numbers}>
          <ListOrdered size={14}/><span className="junior-code-option-label">{labels.numbers}</span>
        </button>
        <span className="junior-code-size-control" role="group" aria-label={labels.size}>
          <button type="button" onClick={() => savePreferences({fontSize: settings.fontSize - 1})}
            disabled={settings.fontSize <= 12} aria-label={labels.smaller} title={labels.smaller}>
            <Minus size={13}/>
          </button>
          <span className="junior-code-size-label" aria-live="polite">{settings.fontSize}px</span>
          <button type="button" onClick={() => savePreferences({fontSize: settings.fontSize + 1})}
            disabled={settings.fontSize >= 22} aria-label={labels.larger} title={labels.larger}>
            <Plus size={13}/>
          </button>
        </span>
        <button type="button" className="junior-code-option" onClick={() => setCollapsed(value => !value)}
          aria-expanded={!collapsed} aria-label={collapsed ? labels.expand : labels.collapse}
          title={collapsed ? labels.expand : labels.collapse}>
          {collapsed ? <ChevronDown size={15}/> : <ChevronUp size={15}/>}
          <span className="junior-code-option-label">{collapsed ? labels.expand : labels.collapse}</span>
        </button>
        <button type="button" className="junior-code-copy" onClick={copyCode}
          aria-label={copied ? labels.copied : labels.copy} title={copied ? labels.copied : labels.copy}>
          {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? labels.copied : labels.copy}
        </button>
      </div>
    </div>
    {!collapsed && <pre className="junior-code-pre"><code
      className={"hljs" + (lang !== "plaintext" ? " language-" + lang : "")}>
      {lines.map((html, index) =>
        <span key={index} className={"junior-code-row" +
          (settings.lineNumbers ? " has-numbers" : "") + (settings.wrap ? " wraps" : "")}>
          {settings.lineNumbers &&
            <span className="junior-code-number" aria-hidden="true">{index + 1}</span>}
          <span className="junior-code-source" dangerouslySetInnerHTML={{__html: html || "&#8203;"}}/>
        </span>
      )}
    </code></pre>}
  </div>;
}

// Some model replies contain plain indented blocks; render every pre block
// through the same component rather than silently falling back to monochrome.
export function codeDetailsFromPre(contents) {
  const children = React.Children.toArray(contents);
  const target = children.find(node => React.isValidElement(node) &&
    (node.type === "code" || node.props?.className?.includes?.("language-")));
  const element = target || children.find(node => React.isValidElement(node));
  const raw = element?.props?.children ?? contents;
  const text = (Array.isArray(raw) ? raw.join("") : String(raw ?? "")).replace(/\n$/, "");
  const cls = String(element?.props?.className || "");
  const matched = /(?:^|\s)language-([a-z0-9+#-]+)/i.exec(cls);
  return {text, language: matched?.[1] || ""};
}

export default function CodeMarkdown({ children, locale = "en" }) {
  return <ReactMarkdown components={{
    pre({ children: contents }) {
      const {text, language} = codeDetailsFromPre(contents);
      return <CodeBlock code={text} language={language} locale={locale}/>;
    },
    code({ children: text, ...props }) {
      return <code {...props}>{text}</code>;
    }
  }}>{children}</ReactMarkdown>;
}
