import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DATA } from "../db.mjs";

// Opt-in installation only. Do not execute third-party setup scripts.
const target=path.join(DATA,"agent-skills");
const upstream="https://github.com/addyosmani/agent-skills.git";
await mkdir(DATA,{recursive:true});
const tmp=await mkdtemp(path.join(DATA,"agent-skills-staging-"));
try{
  const r=spawnSync("git",["clone","--depth","1","--",upstream,tmp],{stdio:"inherit",shell:false,timeout:120000});
  if(r.error||r.status!==0)throw Error("Failed to fetch Agent Skills from GitHub.");
  await access(path.join(tmp,"skills","using-agent-skills","SKILL.md"));
  try{await access(target);throw Error("Agent Skills already installed. Existing installation preserved.");}catch(e){if(e.code!=="ENOENT")throw e;}
  await rename(tmp,target);
  console.log("Agent Skills installed locally at: "+target);
  console.log("Note: software build execution remains disabled until isolation is verified.");
}catch(e){await rm(tmp,{recursive:true,force:true}).catch(()=>{});console.error(e.message);process.exitCode=1;}
