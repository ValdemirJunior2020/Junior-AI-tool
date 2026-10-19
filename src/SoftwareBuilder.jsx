import React,{useEffect,useState} from "react";
import { Code2, Play, Download, RefreshCw, AlertCircle, CheckCircle2, Loader2, ShieldCheck, FolderArchive } from "lucide-react";
import "./SoftwareBuilder.css";

async function api(route,opts={}) {
  const r=await fetch("/api/builder"+route,{credentials:"include",...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw Error(j.error||"Builder request failed");
  return j;
}
export default function SoftwareBuilder() {
  const [status,setStatus]=useState(null),[projects,setProjects]=useState([]),[active,setActive]=useState(""),[name,setName]=useState(""),[prompt,setPrompt]=useState("");
  const [error,setError]=useState(""),[starting,setStarting]=useState(false),[busy,setBusy]=useState(false);
  async function reload(){
    const [s,p]=await Promise.all([api("/status"),api("/projects")]);
    setStatus(s);setProjects(p.projects||[]);
  }
  useEffect(()=>{reload().catch(e=>setError(e.message));},[]);
  useEffect(()=>{
    if(!active)return;
    let disposed=false;
    const poll=async()=>{
      try{
        const j=(await api("/projects/"+active)).project;
        if(disposed)return;
        setProjects(old=>[j,...old.filter(x=>x.id!==j.id)]);
        if(!["running","queued"].includes(j.state)){setActive("");await reload();}
      }catch(e){if(!disposed)setError(e.message);}
    };
    poll();
    const timer=setInterval(poll,2500);
    return ()=>{disposed=true;clearInterval(timer);};
  },[active]);
  async function start(e) {
    e.preventDefault();
    if(starting)return;
    setStarting(true);setError("");
    try{
      const r=await api("/projects",{method:"POST",body:JSON.stringify({name:name.trim()||prompt.trim().slice(0,65),prompt:prompt.trim()})});
      setActive(r.id);setName("");setPrompt("");await reload();
    }catch(e){setError(e.message);}
    finally{setStarting(false);}
  }
  const running=Boolean(active)||projects.some(p=>["running","queued"].includes(p.state));
  const canStart=status?.enabled===true&&!status.configurationError&&!running&&!starting;
  return <section className="page-content software-builder">
    <div className="page-heading">
      <div className="topic-icon builder-icon"><Code2 size={27}/></div>
      <h1>Software Builder</h1>
      <p>Describe a small application. Local OpenHands creates files, runs its coding workflow and packages the project into a ZIP.</p>
    </div>
    <div className="builder-note"><ShieldCheck size={20}/><span><strong>Administrator • local computer only.</strong> This feature runs an autonomous coding agent that can execute commands. Only submit trusted tasks. Review generated code before running or distributing it. An agent claiming tests passed is not independent validation.</span></div>
    {status&&<div className="builder-status">
      <span className={"builder-dot "+(status.enabled?"online":"offline")}/>
      <div><b>{status.enabled?"Builder configured":"Setup required"}</b><small>OpenHands + local Ollama • {status.model} • No paid API</small></div>
      <button type="button" className="secondary" onClick={()=>{setBusy(true);reload().catch(e=>setError(e.message)).finally(()=>setBusy(false));}} disabled={busy}><RefreshCw size={15}/> Refresh</button>
    </div>}
    {status&&!status.enabled&&<div className="builder-setup"><b>OpenHands is not enabled on this PC.</b><p>Install Ubuntu WSL, Python 3.12, uv and OpenHands with the repository's <code>SETUP-OPENHANDS-LOCAL.ps1</code>. It will be enabled only after the local setup passes. Your original one-BAT launcher is preserved.</p></div>}
    {status?.configurationError&&<div className="builder-setup">{status.configurationError}</div>}
    {error&&<div className="builder-error" role="alert"><AlertCircle size={17}/>{error}</div>}
    <form className="builder-form" onSubmit={start}>
      <label>Project name (optional)<input maxLength={75} value={name} onChange={e=>setName(e.target.value)} placeholder="Auto-generated from your request"/></label>
      <label>What software should OpenHands build?<textarea required minLength={20} maxLength={4500} rows={6} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Build a complete local app that imports call files, analyzes results, saves data, includes tests and clear setup instructions..."/></label>
      <button className="primary" type="submit" disabled={!canStart||prompt.trim().length<20}>
        {starting?<Loader2 className="spin" size={17}/>:<Play size={17}/>} Create, test & package ZIP
      </button>
      {prompt.trim().length>0&&prompt.trim().length<20&&<p className="builder-small">Please describe what you want to build in at least 20 characters.</p>}
      <p className="builder-small">Build jobs are limited to 45 minutes. If OpenHands fails, existing project files are preserved. Builds are not guaranteed to pass every test.</p>
    </form>
    <div className="builder-projects-head"><h2>Recent builds</h2><span>Files are kept locally for up to 7 days</span></div>
    {!projects.length?<div className="empty">No software projects created yet.</div>:<div className="builder-project-list">
      {projects.map(p=><article key={p.id} className="builder-project">
        <div className="builder-project-header">
          <div className="builder-project-title"><FolderArchive size={20}/><div><strong>{p.name}</strong><small>{new Date(p.created).toLocaleString()} • {p.model}</small></div></div>
          <span className={"builder-state "+p.state}>{p.state==="ready"?<CheckCircle2 size={15}/>:p.state==="running"?<Loader2 className="spin" size={15}/>:null}{p.state}</span>
        </div>
        {p.error&&<p className="builder-project-error">{p.error}</p>}
        {p.log?.length>0&&<details className="builder-logs" open={["running","failed","interrupted"].includes(p.state)}>
          <summary>OpenHands activity ({p.log.length} updates)</summary>
          <div role="log" aria-label={"Activity for "+p.name}>{p.log.map((line,i)=><p key={i}>{line}</p>)}</div>
        </details>}
        {p.state==="ready"&&<a className="builder-download" href={"/api/builder/projects/"+encodeURIComponent(p.id)+"/download"} download><Download size={17}/> Download project ZIP</a>}
      </article>)}
    </div>}
  </section>;
}
