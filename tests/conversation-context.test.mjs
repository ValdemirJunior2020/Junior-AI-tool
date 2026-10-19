import test from "node:test";
import assert from "node:assert/strict";
import {compactConversation, continuityInstruction} from "../conversation-context.mjs";
test("latest question and preceding code example survive large older replies", ()=>{
 const earlier = [
  {role:"user",content:"Give me four code samples"},
  {role:"assistant",content:"```python\n" + "print('old')\n".repeat(1800) + "```"},
  {role:"user",content:"Why are these codes not colorful?"},
  {role:"assistant",content:"I will check the code highlighting."}
 ];
 const out=compactConversation(earlier,"and why did you forget what I asked?");
 assert.deepEqual(out.slice(-2).map(m=>m.role),["user","assistant"]);
 assert.equal(out.at(-2).content,"Why are these codes not colorful?");
 assert.match(continuityInstruction(out),/follow-up/);
 assert.ok(out.reduce((n,m)=>n+m.content.length,0)<=15000);
});
test("conversation compaction does not mix messages or mutate original history",()=>{
 const input=[{role:"user",content:"oi"},{role:"assistant",content:"olá"}];
 assert.deepEqual(compactConversation(input,"por que?"),input);
 assert.equal(input.length,2);
});
