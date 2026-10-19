import test from "node:test";
import assert from "node:assert/strict";
import {compactConversation, continuityInstruction, extractCodeExamples, codeReferenceIndex, referencedCodeContext} from "../conversation-context.mjs";
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

test("a follow-up naming the second code references the exact second sample",()=>{
  const fence=String.fromCharCode(96).repeat(3);
  const answer=[
    "Example 1: Python",fence+"python\nprint('python')\n"+fence,
    "Example 2: JavaScript",fence+"javascript\nconsole.log('SECOND')\n"+fence,
    "Example 3: PowerShell",fence+"powershell\nWrite-Host 'THIRD'\n"+fence,
    "Example 4: SQL",fence+"sql\nSELECT 4;\n"+fence
  ].join("\n\n");
  const history=[{role:"user",content:"Mostre quatro exemplos"},
    {role:"assistant",content:answer}];
  assert.equal(extractCodeExamples(answer).length,4);
  assert.equal(codeReferenceIndex("modifique o segundo código"),1);
  assert.equal(codeReferenceIndex("e o terceiro exemplo?"),2);
  assert.equal(codeReferenceIndex("e o 2º?"),1);
  assert.equal(codeReferenceIndex("mude o 3o exemplo"),2);
  const result=referencedCodeContext(history,"altere o segundo código sem mexer nos outros");
  assert.match(result,/Code #2 \(javascript\)/);
  assert.match(result,/console\.log\('SECOND'\)/);
  assert.doesNotMatch(result,/Write-Host 'THIRD'/);
  assert.match(referencedCodeContext(history,"e o segundo?"),/Code #2 \(javascript\)/);
});
test("long previous answers retain the selected code even when history is compressed",()=>{
  const fence=String.fromCharCode(96).repeat(3);
  const answer="Introduction ".repeat(800)+
    "\n"+fence+"python\nprint('first')\n"+fence+
    "\nMore text ".repeat(250)+
    "\n"+fence+"javascript\nconst selected = 42;\n"+fence+
    "\n"+ "Conclusion ".repeat(500);
  const history=[{role:"user",content:"Show two examples"},{role:"assistant",content:answer}];
  const summary=compactConversation(history,"Change the second code");
  assert.ok(summary[1].content.length<answer.length);
  const specific=referencedCodeContext(history,"Change the second code");
  assert.match(specific,/const selected = 42;/);
});
test("missing referenced index is reported rather than fabricated",()=>{
  const fence=String.fromCharCode(96).repeat(3);
  const history=[{role:"assistant",content:fence+"python\nprint(1)\n"+fence}];
  assert.match(referencedCodeContext(history,"altere o quarto código"),/did not have the requested code block #4|not requested code block #4/);
  assert.equal(referencedCodeContext(history,"What is the weather?"),"");
});
