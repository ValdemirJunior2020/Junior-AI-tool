import React, { useState } from "react";
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
import { Check, Copy } from "lucide-react";
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
  if (chosen === "plaintext" || content.length > 30000) return hljs.escapeHTML
    ? hljs.escapeHTML(content)
    : content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  try {
    return hljs.highlight(content, { language: chosen, ignoreIllegals: true }).value;
  } catch {
    return content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

function CodeBlock({ code, language, locale = "en" }) {
  const [copied, setCopied] = useState(false);
  const lang = languageForCode(language);
  const highlighted = highlightSnippet(code, language);
  const copyLabel = locale === "pt-BR" ? "Copiar" : locale === "es-ES" ? "Copiar" : "Copy";
  const copiedLabel = locale === "pt-BR" ? "Copiado" : locale === "es-ES" ? "Copiado" : "Copied";
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return <div className="junior-code-block">
    <div className="junior-code-bar">
      <span className="junior-code-lang">{lang === "plaintext" ? "CODE" : lang.toUpperCase()}</span>
      <button type="button" className="junior-code-copy" onClick={copyCode}
        aria-label={copied ? copiedLabel : copyLabel} title={copied ? copiedLabel : copyLabel}>
        {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? copiedLabel : copyLabel}
      </button>
    </div>
    <pre className="junior-code-pre"><code className={"hljs" + (lang !== "plaintext" ? " language-" + lang : "")}
      dangerouslySetInnerHTML={{ __html: highlighted }}/></pre>
  </div>;
}

// A pre element is an unambiguous fenced/indented Markdown code block;
// inline code remains an ordinary <code> element.
export default function CodeMarkdown({ children, locale = "en" }) {
  return <ReactMarkdown components={{
    pre({ children: contents }) {
      const codeElement = React.Children.toArray(contents).find(node =>
        React.isValidElement(node) && node.type === "code"
      );
      if (!codeElement) return <pre>{contents}</pre>;
      const text = String(codeElement.props.children ?? "").replace(/\n$/, "");
      const matched = /(?:^|\s)language-([a-z0-9+#-]+)/i.exec(codeElement.props.className || "");
      return <CodeBlock code={text} language={matched?.[1] || ""} locale={locale}/>;
    },
    code({ children: text, ...props }) {
      return <code {...props}>{text}</code>;
    }
  }}>{children}</ReactMarkdown>;
}
