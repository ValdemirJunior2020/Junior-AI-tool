import express from "express";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, readdir, rename, rm } from "node:fs/promises";
import { DATA, audit, safeText } from "./db.mjs";
import { collectProjectFiles, zipBuffers } from "./software-builder-zip.mjs";

export const builderRouter=express.Router();
const ROOT=path.join(DATA,"software-builder");
const enabled=()=>process.env.ENABLE_SOFTWARE_BUILDER==="true";
const running=new Map();
const ID=/^[a-f0-9]{16}$/;
const modelName=()=>/^[a-zA-Z0-9_./:-]{1,100}$/.test(process.env.OPENHANDS_MODEL||"qwen2.5-coder:7b") ? (process.env.OPENHANDS_MODEL||"qwen2.5-coder:7b") : "qwen2.5-coder:7b";
// The OpenAI-compatible Ollama endpoint must remain local to WSL. No cloud/API billing fallback.
function ollamaEndpoint(){
  const url=new URL(process.env.OPENHANDS_OLLAMA_URL||"http://127.0.0.1:11434/v1");
  if(url.protocol!=="http:"||!["localhost","127.0.0.1","[::1]"].includes(url.hostname)||url.port!=="11434"||url.pathname!=="/v1"||url.username||url.password||url.search||url.hash) throw Error("Builder Ollama URL must be a WSL-reachable local http://127.0.0.1:11434/v1 endpoint.");
  return url.href.replace(/\/$/,"");
}
function localBrowser(req) {
  const host=req.get("host")||"",origin=req.get("origin")||"";
  const address=req.socket.remoteAddress||"";
  return /^(127\.0\.0\.1|localhost):\d+$/.test(host)
    && (!origin||/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
    && ["127.0.0.1","::1","::ffff:127.0.0.1"].includes(address);
}
builderRouter.use((req,res,next)=>localBrowser(req)?next():res.status(403).json({error:"Software Builder is available only from the local Junior AI website on this PC."}));
const location=id=>path.join(ROOT,id);
const manifest=id=>path.join(location(id),"status.json");
const workspace=id=>path.join(location(id),"project");
async function save(job){
  const data={id:job.id,name:job.name,created:job.created,updated:Date.now(),state:job.state,model:job.model,error:job.error||"",log:(job.log||[]).slice(-45)};
  const dest=manifest(job.id);await mkdir(location(job.id),{recursive:true});
  await writeFile(dest+".tmp",JSON.stringify(data,null,2));await rename(dest+".tmp",dest);
}
async function read(id) {
  if(!ID.test(id)) return null;
  const j=await readFile(manifest(id),"utf8").then(JSON.parse).catch(()=>null);
  if(!j||j.id!==id) return null;
  if(j.state==="running"&&!running.has(id)) return {...j,state:"interrupted",error:"Junior AI restarted before OpenHands finished. Files are preserved."};
  return j;
}
const sh=s=>"'"+String(s).replaceAll("'","'\\''")+"'";
function command(job) {
  const root=location(job.id),folder=workspace(job.id);
  return [
    "set -euo pipefail",
    'export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"',
    "command -v openhands >/dev/null || { echo 'OpenHands is not installed in Ubuntu WSL. Run SETUP-OPENHANDS-LOCAL.ps1.' >&2; exit 127; }",
    "cd \"$(wslpath -u "+sh(folder)+")\"",
    "export OPENHANDS_SUPPRESS_BANNER=1",
    "export TERM=dumb",
    "export NO_COLOR=1",
    "export LLM_API_KEY=local-ollama",
    "export LLM_MODEL="+sh("openai/"+job.model),
    "export LLM_BASE_URL="+sh(ollamaEndpoint()),
    "exec openhands --headless --json --override-with-envs --file \"$(wslpath -u "+sh(path.join(root,job.attempt===2?"retry.md":"task.md"))+")\""
  ].join("\n");
}
function append(job,line){
  if(!line.trim()) return;
  let message=line.trim();
  try {
    if(message.startsWith("{")){
      const event=JSON.parse(message);
      message=event.kind||event.type||event.tool_name||"OpenHands event";
      if(event.action?.kind) message+=" • "+event.action.kind;
      if(event.observation?.is_error) message+=" • tool reported an error";
    }
  }catch{ message=message.slice(0,240); }
  message=message.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,"").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,"");
  job.log.push(message.slice(0,240));
  job.log=job.log.slice(-45);
}
async function execute(job,userId) {
  job.state="running";await save(job);
  const args=["--distribution","Ubuntu","--","bash","-lc",command(job)];
  const child=spawn("wsl.exe",args,{windowsHide:true,stdio:["ignore","pipe","pipe"],shell:false,env:process.env});
  running.set(job.id,child);
  let partial="",bytes=0;
  const onData=chunk=>{
    bytes+=chunk.length;
    if(bytes>3*1024*1024) return; // Avoid unbounded event output.
    partial+=chunk.toString("utf8");
    const lines=partial.split(/\r?\n/);partial=lines.pop()||"";
    for(const line of lines) append(job,line);
  };
  child.stdout.on("data",onData);child.stderr.on("data",onData);
  let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true;child.kill();},45*60*1000);
  try{
    const exitCode=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("close",resolve);});
    if(partial.trim()) append(job,partial);
    if(timedOut) throw Error("The 45-minute build limit was reached. Existing project files were preserved.");
    if(exitCode!==0) throw Error("OpenHands exited with code "+exitCode+". Check the activity log and WSL/Ollama setup.");
    const files=await collectProjectFiles(workspace(job.id));
    if(!files.length) throw Error("OpenHands completed without writing any files. The selected local model may not be using terminal tools correctly. Try a tool-capable model and first test: create hello.py with print('ok').");
    job.state="ready";job.log.push("Files created: "+files.length+". OpenHands completed. Independently verify the application before using it.");
    audit(userId,"software_builder_ready",job.id);
  }catch(e){
    job.state="failed";job.error=safeText(e.message||String(e),230);
    append(job,job.error);audit(userId,"software_builder_failed",job.id);
  }finally{
    clearTimeout(timeout);running.delete(job.id);
    await save(job).catch(e=>console.error("[Builder] Could not persist job:",e.message));
  }
}
export async function cleanupBuilder(cutoff){
  const entries=await readdir(ROOT,{withFileTypes:true}).catch(()=>[]);
  for(const entry of entries){
    if(!entry.isDirectory()||!ID.test(entry.name)||running.has(entry.name)) continue;
    const job=await read(entry.name);
    if(job&&job.created<cutoff) await rm(location(entry.name),{recursive:true,force:true});
  }
}
builderRouter.get("/status",async(_req,res)=>{
  let model=modelName(),configurationError="";
  try{ollamaEndpoint();}catch(e){configurationError=e.message;}
  res.json({enabled:enabled(),local:true,running:running.size,model,configurationError,workspace:"Local Windows PC / Ubuntu WSL",engine:"OpenHands CLI + Ollama"});
});
builderRouter.get("/projects",async(_req,res)=>{
  const entries=await readdir(ROOT,{withFileTypes:true}).catch(()=>[]);
  const projects=(await Promise.all(entries.filter(x=>x.isDirectory()&&ID.test(x.name)).map(x=>read(x.name)))).filter(Boolean)
    .sort((a,b)=>b.created-a.created).slice(0,30);
  res.json({projects});
});
builderRouter.get("/projects/:id",async(req,res)=>{
  const j=await read(req.params.id);if(!j) return res.status(404).json({error:"Project not found"});
  // Include freshest in-memory activity without committing secrets or full agent output.
  const active=running.has(j.id)&&inFlight===j.id?activeJob:null;
  res.json({project:active?{...j,state:active.state,log:active.log}:j});
});
let inFlight=null,activeJob=null;
builderRouter.post("/projects",async(req,res)=>{
  if(!enabled()) return res.status(503).json({error:"Software Builder is disabled. Complete the local OpenHands setup and enable it in .env."});
  if(running.size||inFlight) return res.status(409).json({error:"Only one local software build can run at a time."});
  const prompt=safeText(req.body?.prompt,4500),name=safeText(req.body?.name,75);
  if(prompt.length<20) return res.status(400).json({error:"Describe the software in at least 20 characters."});
  if(!name) return res.status(400).json({error:"Enter a project name."});
  try{ollamaEndpoint();}catch(e){return res.status(400).json({error:e.message});}
  const job={id:randomBytes(8).toString("hex"),name,created:Date.now(),state:"queued",model:modelName(),error:"",log:["Preparing isolated project directory..."]};
  inFlight=job.id;activeJob=job;
  try{
    await mkdir(workspace(job.id),{recursive:true});
    const task=[
      "# Junior AI Software Builder",
      "Build a complete small application in the CURRENT working directory (the isolated, empty project workspace).",
      "Do not read, write, delete, or execute files outside this current project workspace.",
      "Never access secrets, system configuration, other home folders, SSH keys or existing projects.",
      "Your FIRST action MUST be to use the terminal tool to create an actual source file inside this workspace.",
      "Do NOT end the task until you have inspected the files on disk with the terminal tool.",
      "Create actual source files and a README with installation and usage instructions.",
      "Install dependencies only when necessary and use free, open-source tools.",
      "Run appropriate tests/build commands; inspect failures, fix and run them again.",
      "If a step cannot be verified, explicitly record the limitation in README.",
      "Do not deploy, install globally, open network listeners publicly or use paid APIs.",
      "",
      "Project name: "+name,
      "User requirements:",
      prompt
    ].join("\n");
    await writeFile(path.join(location(job.id),"task.md"),task,"utf8");
    await save(job);audit(req.user.id,"software_builder_started",job.id);
    res.status(202).json({id:job.id,state:job.state});
    void execute(job,req.user.id).finally(()=>{if(inFlight===job.id){inFlight=null;activeJob=null;}});
  }catch(e){
    inFlight=null;activeJob=null;
    if(!res.headersSent) res.status(500).json({error:"Unable to initialize the project safely."});
  }
});
builderRouter.get("/projects/:id/download",async(req,res)=>{
  const j=await read(req.params.id);
  if(!j) return res.status(404).json({error:"Project not found"});
  if(j.state!=="ready") return res.status(409).json({error:"ZIP is available only after OpenHands finishes and project files exist."});
  try{
    const files=await collectProjectFiles(workspace(j.id));
    if(!files.length) return res.status(409).json({error:"Project has no files to download."});
    const zip=zipBuffers(files);
    const name=j.name.replace(/[^A-Za-z0-9_-]/g,"-").slice(0,45)||"software";
    res.set("Content-Type","application/zip");
    res.set("Content-Disposition",'attachment; filename="'+name+"-"+j.id+".zip"+'"');
    res.set("Cache-Control","no-store");
    res.send(zip);
  }catch(e){res.status(422).json({error:"Unable to package this project: "+safeText(e.message,150)});}
});
