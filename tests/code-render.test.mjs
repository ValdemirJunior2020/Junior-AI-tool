import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("rendered code has colored tokens, numbered wrapped lines, font controls, collapse and copy", async () => {
  const server = await createServer({ logLevel:"error", server:{middlewareMode:true}, appType:"custom" });
  try {
    const { default: CodeMarkdown } = await server.ssrLoadModule("/src/CodeMarkdown.jsx");
    const fence=String.fromCharCode(96).repeat(3);
    const message=fence+"javascript\nconst name = 'Junior';\nconsole.log(name);\n"+fence;
    const html=renderToStaticMarkup(React.createElement(CodeMarkdown,{locale:"pt-BR"},message));
    assert.match(html,/junior-code-block/);
    assert.match(html,/junior-code-bar/);
    assert.match(html,/junior-code-copy/);
    assert.match(html,/aria-label="Copiar"/);
    assert.match(html,/aria-label="Quebrar linhas"/);
    assert.match(html,/aria-label="Números de linha"/);
    assert.match(html,/aria-label="Aumentar fonte"/);
    assert.match(html,/aria-label="Diminuir fonte"/);
    assert.match(html,/aria-label="Recolher código"/);
    assert.match(html,/font-size:16px|--junior-code-font-size:16px/);
    assert.match(html,/junior-code-number/);
    assert.match(html,/>1<\/span>/);
    assert.match(html,/>2<\/span>/);
    assert.match(html,/hljs-keyword/);
    assert.match(html,/wraps/);
  } finally {
    await server.close();
  }
});
