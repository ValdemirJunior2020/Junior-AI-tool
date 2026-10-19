import test from "node:test";
import assert from "node:assert/strict";
import { CODE_SETTINGS_DEFAULTS, normalizeCodeSettings, splitHighlightedLines } from "../code-display.mjs";

test("default preferences enable wrapping and numbering at a readable size",()=>{
  assert.deepEqual(normalizeCodeSettings(null),CODE_SETTINGS_DEFAULTS);
  assert.deepEqual(normalizeCodeSettings({wrap:false,lineNumbers:false,fontSize:19}),
    {wrap:false,lineNumbers:false,fontSize:19});
  assert.equal(normalizeCodeSettings({fontSize:999}).fontSize,22);
  assert.equal(normalizeCodeSettings({fontSize:-3}).fontSize,12);
  assert.equal(normalizeCodeSettings({fontSize:"bogus"}).fontSize,16);
  assert.equal(normalizeCodeSettings({wrap:"no"}).wrap,true);
});
test("highlighted multiline tokens are correctly closed/reopened per source line",()=>{
  const source='<span class="hljs-string">line one\nline two</span>\n<span class="hljs-keyword">return</span>';
  const lines=splitHighlightedLines(source);
  assert.deepEqual(lines,[
    '<span class="hljs-string">line one</span>',
    '<span class="hljs-string">line two</span>',
    '<span class="hljs-keyword">return</span>'
  ]);
});
test("nested syntax highlights survive splitting with accurate line numbers",()=>{
  const input='<span class="hljs-section"><span class="hljs-title">SELECT\nCOUNT</span>\nEND</span>';
  const lines=splitHighlightedLines(input);
  assert.equal(lines.length,3);
  assert.equal(lines[0],'<span class="hljs-section"><span class="hljs-title">SELECT</span></span>');
  assert.equal(lines[1],'<span class="hljs-section"><span class="hljs-title">COUNT</span></span>');
  assert.equal(lines[2],'<span class="hljs-section">END</span>');
});
test("preserves escaped literal code, empty lines, and newlines",()=>{
  assert.deepEqual(splitHighlightedLines('a &lt; b\n\nc'),['a &lt; b','','c']);
  assert.deepEqual(splitHighlightedLines(''),['']);
  assert.deepEqual(splitHighlightedLines('x\n'),['x','']);
});
