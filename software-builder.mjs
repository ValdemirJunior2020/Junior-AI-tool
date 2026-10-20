import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { saveBuilderStatus } from "./builder-status-store.mjs";
import { DATA, audit, safeText } from "./db.mjs";
import { collectProjectFiles, zipBuffers, validateProjectArtifact } from "./software-builder-zip.mjs";

export const builderRouter=express.Router();
const ROOT=path.join(DATA,"software-builder");
// Safety stop: the current OpenHands CLI has demonstrably written outside its
// project workspace into the Junior AI repository. Do not launch it again until
// the execution backend is moved into a verified OS-enforced sandbox.
const WORKSPACE_ISOLATION_VERIFIED=false;
const enabled=()=>process.env.ENABLE_SOFTWARE_BUILDER==="true"&&WORKSPACE_ISOLATION_VERIFIED;
const running=new Map();
let activeJob=null;
const pending=[];
let queueDraining=false;
// No fixed build duration. Stop only a truly stalled agent (2h without output).
const STALL_MS=2*60*60*1000;
const MAX_QUEUE=12;
const ID=/^[a-f0-9]{16}$/;
const modelName=()=>/^[a-zA-Z0-9_./:-]{1,100}$/.test(process.env.OPENHANDS_MODEL||"qwen3.5:9b") ? (process.env.OPENHANDS_MODEL||"qwen3.5:9b") : "qwen3.5:9b";
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
// Read-only project tracking is safe for signed-in users through the public Netlify proxy.
// Starting or retrying the agent still requires a local browser: OpenHands runs OS commands
// in WSL and the project workspace is not a proven security sandbox for remote execution.
builderRouter.use((req,res,next)=>{
  if(req.method==="GET"||req.method==="HEAD")return next();
  if(localBrowser(req))return next();
  res.status(403).json({error:"Remote access is read-only. Open the local Junior AI website on this PC to start or retry software builds."});
});
// Builder polling has its own per-account budget so status updates cannot consume the
// app-wide limit. POSTs and ZIP downloads retain the normal app-wide protection.
builderRouter.use(rateLimit({
  windowMs:15*60*1000,limit:600,standardHeaders:"draft-7",legacyHeaders:false,
  skip:req=>req.method!=="GET"&&req.method!=="HEAD",
  keyGenerator:req=>req.user.id
}));
const location=id=>path.join(ROOT,id);
const manifest=id=>path.join(location(id),"status.json");
const workspace=id=>path.join(location(id),"project");
const BUILD_PHASES=[
  ["foundation","Write a minimal working backend entrypoint, an executable smoke test and a README in this workspace. Focus on actual files, not narration. Inspect the created files before ending."],
  ["backend","Using existing files, implement the core backend application: audio discovery, Whisper integration, a durable queue and persistence. Write files in small, syntactically valid increments. Run tests where possible."],
  ["frontend","Using existing files, implement the React UI and Windows launcher, integrate with the backend, fix build errors and document any unfinished work. Do not erase existing code."]
];

async function save(job){
  const data={id:job.id,name:job.name,created:job.created,started:job.started||null,finished:job.finished||null,updated:Date.now(),state:job.state,owner:job.owner,model:job.model,attempt:job.attempt||0,phaseFile:job.phaseFile||null,error:job.error||"",log:(job.log||[]).slice(-45)};
  await saveBuilderStatus(manifest(job.id),data);
}
async function read(id) {
  if(!ID.test(id)) return null;
  const j=await readFile(manifest(id),"utf8").then(JSON.parse).catch(()=>null);
  if(!j||j.id!==id) return null;
  if(j.state==="running"&&!running.has(id)) return {...j,state:"interrupted",error:"Junior AI restarted before OpenHands finished. Files are preserved."};
  if(j.state==="ready") {
    const files=await collectProjectFiles(workspace(id)).catch(()=>[]);
    const check=validateProjectArtifact(files,j.name);
    if(!check.valid)return {...j,state:"failed",error:"Invalid build artifact: "+check.issues.join(", ")+". Existing files are preserved."};
  }
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
    // Fail with a concrete filesystem error before starting a costly agent session.
    'test -d "$PWD" && test -w "$PWD" || { echo "Builder workspace is not writable: $PWD" >&2; exit 73; }',
    'printf "ok" > .junior-wsl-write-check && test "$(cat .junior-wsl-write-check)" = "ok" && rm -f .junior-wsl-write-check',
    'printf "Builder working directory: %s\\n" "$PWD"',
    'export OPENHANDS_WORK_DIR="$PWD"',
    "export OPENHANDS_SUPPRESS_BANNER=1",
    "export TERM=dumb",
    "export NO_COLOR=1",
    "export LLM_API_KEY=local-ollama",
    "export LLM_MODEL="+sh("openai/"+job.model),
    "export LLM_BASE_URL="+sh(ollamaEndpoint()),
    "exec openhands --headless --json --override-with-envs --file \"$(wslpath -u "+sh(path.join(root,job.phaseFile|| (job.attempt===2?"retry.md":"task.md")))+")\""
  ].join("\n");
}
function append(job,line){
  if(!line.trim()) return;
  let message=line.trim();
  try {
    if(message.startsWith("{")){
      const event=JSON.parse(message);
      message=event.kind||event.type||event.tool_name||"OpenHands event";
      const action=event.action||event.data?.action;
      const observation=event.observation||event.data?.observation;
      if(action?.kind)message+=" • "+action.kind;
      // Preserve a sanitized fragment of terminal errors; generic ObservationEvent
      // hides useful reasons such as heredoc failures, permissions, and missing tools.
      const detail=observation?.error||observation?.stderr||observation?.output||observation?.content||event.error||event.message;
      if(observation?.is_error)message+=" • tool reported an error";
      if(typeof detail==="string"&&detail.trim()){
        const tail=detail.trim().split(/\r?\n/).filter(Boolean).slice(-2).join(" ");
        message+=" • "+tail.slice(0,165);
      }
    }
  }catch{ message=message.slice(0,240); }
  message=message.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,"").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,"");
  job.log.push(message.slice(0,240));
  job.log=job.log.slice(-45);
}
async function runOpenHands(job) {
  const args=["--distribution","Ubuntu","--","bash","-lc",command(job)];
  const child=spawn("wsl.exe",args,{windowsHide:true,stdio:["ignore","pipe","pipe"],shell:false,env:process.env});
  running.set(job.id,child);
  let partial="",bytes=0,lastOutputAt=Date.now();
  const onData=chunk=>{
    lastOutputAt=Date.now();
    bytes+=chunk.length;
    if(bytes>3*1024*1024) return;
    partial+=chunk.toString("utf8");
    const lines=partial.split(/\r?\n/);partial=lines.pop()||"";
    for(const line of lines) append(job,line);
  };
  child.stdout.on("data",onData);child.stderr.on("data",onData);
  let stalled=false;
  const watchdog=setInterval(()=>{
    if(Date.now()-lastOutputAt>=STALL_MS){
      stalled=true;
      append(job,"OpenHands produced no output for 2 hours. Stopping stalled process so the shared queue can continue.");
      child.kill();
    }
  },60000);
  try{
    const exitCode=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("close",resolve);});
    if(partial.trim())append(job,partial);
    if(stalled)throw Error("OpenHands stopped after two hours without output. Existing files are preserved.");
    if(exitCode!==0)throw Error("OpenHands exited with code "+exitCode+". Check the activity log and WSL/Ollama setup.");
  }finally{
    clearInterval(watchdog);
    running.delete(job.id);
  }
}
async function inspectWorkspace(job){
  const entries=await readdir(workspace(job.id),{withFileTypes:true}).catch(()=>[]);
  append(job,"Workspace check: "+(entries.length?entries.slice(0,12).map(x=>x.name+(x.isDirectory()?"/":"")).join(", "):"no files at project root"));
}
async function execute(job,userId) {
  job.state="running";job.started=Date.now();job.finished=null;job.error="";
  await save(job);
  try{
    for(let attempt=1;attempt<=2;attempt++){
      job.attempt=attempt;
      if(attempt===2){
        const original=await readFile(path.join(location(job.id),"task.md"),"utf8");
        const retry=[
          "# Immediate execution required: previous run produced no files",
          "Do not describe a plan, do not answer with prose, and do not finish without working files.",
          "Your FIRST response must be a terminal tool call that creates an actual source file in this working directory.",
          "Start with: mkdir -p backend frontend/src",
          "Then implement the requirements below by writing the code through terminal tools.",
          "Check files with ls -la and run practical tests before finishing.",
          "If tool execution is unavailable, report that failure; do not claim you created software.",
          "",
          original
        ].join("\n");
        await writeFile(path.join(location(job.id),"retry.md"),retry,"utf8");
        append(job,"First attempt created no files. Automatically retrying with direct terminal instructions.");
      }
      await save(job);
      // Complex specifications overwhelm small local models. Start with small,
      // testable increments while preserving the original task and the workspace.
      const originalTask=await readFile(path.join(location(job.id),"task.md"),"utf8");
      const phases=originalTask.length>5000?BUILD_PHASES:[["complete","Create and test the requested software by writing actual files in the current project directory."]];
      let completedStages=0;
      for(let index=0;index<phases.length;index++){
        const [phase,focus]=phases[index];
        const phaseFile="stage-"+attempt+"-"+index+".md";
        const staged=[
          "# OpenHands: "+phase+" (stage "+(index+1)+"/"+phases.length+")",
          "MANDATORY: write source files into the CURRENT working directory.",
          "Use short, reliable terminal commands. Avoid giant heredocs and truncated output.",
          "Run pwd and ls; fix any write or syntax errors before stopping.",
          "Do not delete existing workspace files. You are continuing a multi-stage build.",
          "CURRENT STAGE: "+focus,
          // Small local models must receive a focused, bounded task instead of the
          // same 15K-character full specification on every phase.
          "Project title: "+job.name,
          "Context: Build a local Windows Python Whisper audio transcriber with a React UI, an overnight file queue, SQLite checkpoints, safe exports and a single BAT launcher.",
          "Required details for this stage:",
          phase==="foundation" ? "Create backend/main.py, backend/requirements.txt, README.md and a minimal unittest in actual files. Run python3 -m py_compile backend/main.py. Do not build the entire application yet." :
            phase==="backend" ? "Implement local Whisper and FFmpeg processing, watch-folder polling and database persistence in backend. Never delete source audio by default. Include error handling and tests." :
            "Implement a simple Vite React frontend showing queue progress and settings, integrate backend endpoints, and provide a single Windows BAT launcher. Verify generated files.",
          "Original requirements (trimmed reference, not instructions to do all phases at once):",
          originalTask.slice(0,2400)
        ].join("\n");
        await writeFile(path.join(location(job.id),phaseFile),staged,"utf8");
        job.phaseFile=phaseFile;
        append(job,"OpenHands stage "+(index+1)+"/"+phases.length+": "+phase);
        await save(job);
        await runOpenHands(job);
        const stageFiles=await collectProjectFiles(workspace(job.id));
        if(!stageFiles.length){
          append(job,"Stage "+phase+" wrote no accessible project files; stopping this attempt.");
          break;
        }
        completedStages++;
        append(job,"Stage "+phase+" completed; "+stageFiles.length+" saved files.");
      }
      job.phaseFile=null;
      const files=await collectProjectFiles(workspace(job.id));
      if(!files.length)await inspectWorkspace(job);
      const artifact=validateProjectArtifact(files,job.name);
      if(files.length&&completedStages===phases.length&&artifact.valid){
        job.state="ready";
        append(job,"Files created: "+files.length+". OpenHands completed. Independently verify the application before using it.");
        audit(userId,"software_builder_ready",job.id);
        break;
      }
      if(attempt===2)throw Error(artifact.issues.length?"Build artifact incomplete: "+artifact.issues.join(", "):"OpenHands did not complete every build stage. Partial files are preserved; check the recorded stages and terminal output before retrying.");
    }
  }catch(e){
    job.state="failed";
    job.error=safeText(e.message||String(e),230);
    append(job,job.error);audit(userId,"software_builder_failed",job.id);
  }finally{
    job.finished=Date.now();
    await save(job).catch(e=>console.error("[Builder] Could not persist job:",e.message));
  }
}
function queueInfo(job) {
  const position=job.state==="running"?0:pending.findIndex(p=>p.id===job.id)+1;
  return {...job,queuePosition:position>0?position:0,
    elapsedSeconds:Math.max(0,Math.floor((Date.now()-(job.state==="running"?(job.started||job.created):job.created))/1000)),
    estimatedWaitMinutes:null,maxBuildMinutes:null};
}
async function drainQueue(){
  if(queueDraining)return;
  queueDraining=true;
  try{
    while(pending.length){
      const job=pending.shift();
      activeJob=job;
      if(!job)continue;
      try{await execute(job,job.owner);}catch(e){
        job.state="failed";job.error=safeText(e.message||String(e),230);
        await save(job).catch(()=>{});
      }
      activeJob=null;
    }
  }finally{activeJob=null;queueDraining=false;if(pending.length)void drainQueue();}
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
  res.json({enabled:enabled(),local:localBrowser(_req),remoteReadOnly:!localBrowser(_req),running:running.size,waiting:pending.length,maxBuildMinutes:null,model,configurationError,workspace:"Local Windows PC / Ubuntu WSL",engine:"OpenHands CLI + Ollama"});
});
builderRouter.get("/projects",async(req,res)=>{
  const entries=await readdir(ROOT,{withFileTypes:true}).catch(()=>[]);
  const projects=(await Promise.all(entries.filter(x=>x.isDirectory()&&ID.test(x.name)).map(x=>read(x.name)))).filter(Boolean)
    .sort((a,b)=>b.created-a.created).slice(0,30);
  res.json({projects:projects.filter(p=>p.owner===req.user.id||(!p.owner&&req.user.role==="admin")).map(queueInfo)});
});
builderRouter.get("/projects/:id",async(req,res)=>{
  const j=await read(req.params.id);if(!j) return res.status(404).json({error:"Project not found"});
  if(j.owner!==req.user.id&&!(req.user.role==="admin"&&!j.owner))return res.status(404).json({error:"Project not found"});
  // Include freshest in-memory activity without committing secrets or full agent output.
  const active=running.has(j.id)&&activeJob?.id===j.id?activeJob:null;
  res.json({project:queueInfo(active?{...j,state:active.state,log:active.log}:j)});
});
builderRouter.post("/projects",async(req,res)=>{
  if(!enabled()) return res.status(503).json({error:"Software Builder is temporarily paused for safety: OpenHands wrote outside its project workspace into the Junior AI repository. Existing projects are preserved. A verified isolated runtime is required before builds can resume."});
  if(pending.length>=MAX_QUEUE)return res.status(429).json({error:"The software build queue is full. Please try later."});
  if(pending.some(p=>p.owner===req.user.id)||activeJob?.owner===req.user.id)return res.status(409).json({error:"You already have a build in progress or waiting in line."});
  const prompt=safeText(req.body?.prompt,15000),name=safeText(req.body?.name,75);
  if(prompt.length<20) return res.status(400).json({error:"Describe the software in at least 20 characters."});
  if(!name) return res.status(400).json({error:"Enter a project name."});
  try{ollamaEndpoint();}catch(e){return res.status(400).json({error:e.message});}
  const job={id:randomBytes(8).toString("hex"),name,owner:req.user.id,created:Date.now(),state:"queued",model:modelName(),error:"",log:["Preparing isolated project directory..."]};
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
    pending.push(job);
    res.status(202).json({id:job.id,state:job.state,queuePosition:pending.length,estimatedWaitMinutes:null});
    void drainQueue();
  }catch(e){
    if(!res.headersSent) res.status(500).json({error:"Unable to initialize the project safely."});
  }
});
builderRouter.post("/projects/:id/retry",async(req,res)=>{
  const j=await read(req.params.id);
  if(!j||j.owner!==req.user.id)return res.status(404).json({error:"Project not found"});
  // Legacy jobs can still have "ready" persisted after only a WSL probe was
  // generated. Revalidate the artifact at retry time as well as when listing.
  const currentFiles=await collectProjectFiles(workspace(j.id)).catch(()=>[]);
  const validArtifact=validateProjectArtifact(currentFiles,j.name).valid;
  if(!["failed","interrupted"].includes(j.state)&&!(j.state==="ready"&&!validArtifact))
    return res.status(409).json({error:"Only failed, interrupted, or invalid completed projects can be retried."});
  if(!enabled())return res.status(503).json({error:"Software Builder is temporarily paused for safety because OpenHands wrote into the Junior AI repository outside its intended workspace."});
  if(pending.length>=MAX_QUEUE)return res.status(429).json({error:"The build queue is full."});
  if(pending.some(p=>p.owner===req.user.id)||activeJob?.owner===req.user.id)return res.status(409).json({error:"You already have an active or queued build."});
  const original=await readFile(path.join(location(j.id),"task.md"),"utf8").catch(()=>null);
  if(!original)return res.status(409).json({error:"The original build instructions are unavailable."});
  const job={...j,started:null,finished:null,attempt:0,error:"",state:"queued",log:[...(j.log||[]).slice(-35),"Retry requested; original files and task preserved."]};
  await save(job);
  pending.push(job);
  audit(req.user.id,"software_builder_retried",j.id);
  res.status(202).json({id:j.id,state:job.state,queuePosition:pending.length});
  void drainQueue();
});
builderRouter.get("/projects/:id/download",async(req,res)=>{
  const j=await read(req.params.id);
  if(!j||!(j.owner===req.user.id||(!j.owner&&req.user.role==="admin"))) return res.status(404).json({error:"Project not found"});
  if(j.state!=="ready") return res.status(409).json({error:"ZIP is available only after OpenHands finishes and project files exist."});
  try{
    const files=await collectProjectFiles(workspace(j.id));
    const verification=validateProjectArtifact(files,j.name);
    if(!verification.valid)return res.status(409).json({error:"Build artifact is incomplete: "+verification.issues.join(", ")});
    const zip=zipBuffers(files);
    const name=j.name.replace(/[^A-Za-z0-9_-]/g,"-").slice(0,45)||"software";
    res.set("Content-Type","application/zip");
    res.set("Content-Disposition",'attachment; filename="'+name+"-"+j.id+".zip"+'"');
    res.set("Cache-Control","no-store");
    res.send(zip);
  }catch(e){res.status(422).json({error:"Unable to package this project: "+safeText(e.message,150)});}
});
