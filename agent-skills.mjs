import path from "node:path";
import { readFile, access } from "node:fs/promises";
import { DATA } from "./db.mjs";

export const AGENT_SKILLS_ROOT=path.join(DATA,"agent-skills");
export const SKILL_PHASES=Object.freeze({
  foundation:["spec-driven-development","planning-and-task-breakdown"],
  backend:["incremental-implementation","test-driven-development","debugging-and-error-recovery"],
  frontend:["frontend-ui-engineering","test-driven-development","code-review-and-quality"],
  complete:["spec-driven-development","planning-and-task-breakdown","test-driven-development","debugging-and-error-recovery"]
});
const safeSkill=name=>/^[a-z][a-z0-9-]{0,70}$/.test(name);
export async function agentSkillsInstalled(){
  try { await access(path.join(AGENT_SKILLS_ROOT,"skills","using-agent-skills","SKILL.md"));return true;}catch{return false;}
}
export async function phaseSkillsText(phase,{maxChars=8000}={}){
  const names=SKILL_PHASES[phase]||SKILL_PHASES.complete;
  let remaining=maxChars, sections=[];
  for(const name of names){
    if(!safeSkill(name))continue;
    let markdown;
    try {markdown=await readFile(path.join(AGENT_SKILLS_ROOT,"skills",name,"SKILL.md"),"utf8");} catch {continue;}
    const chunk=markdown.slice(0,Math.min(2800,remaining));
    if(!chunk)break;
    sections.push("## Engineering skill: "+name+"\n"+chunk);
    remaining-=chunk.length;
  }
  return sections.join("\n\n");
}
