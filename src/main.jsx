import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, Plus, MessageSquare, Image as ImageIcon, FileSpreadsheet, Code2, FileText,
  ShieldCheck, Activity, Settings, LogOut, Paperclip, Send, Trash2, Eye, EyeOff,
  UserRound, ArrowLeft, Loader2, CheckCircle2, AlertCircle, RefreshCw, KeyRound,
  ChevronRight, Github, WandSparkles, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import "./style.css";

async function request(route, opts = {}) {
  const response = await fetch("/api" + route, { credentials: "include", ...opts,
    headers: { ...(opts.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(opts.headers || {}) }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(json.error || "Request failed");
  return json;
}
const post = (route, data) => request(route, { method: "POST", body: JSON.stringify(data) });
const del = (route, data) => request(route, { method: "DELETE", ...(data ? { body: JSON.stringify(data) } : {}) });
const clock = n => new Date(n).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const date = n => new Date(n).toLocaleDateString();

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action"), token = params.get("token");
    if (action === "verify" && token) {
      post("/auth/verify", { token }).then(() => setMessage("Email verified. Sign in to continue.")).catch(e => setMessage(e.message));
      history.replaceState(null, "", "/");
    } else if (action === "reset" && token) { setMode("confirm-reset"); setResetToken(token); history.replaceState(null, "", "/"); }
  }, []);
  async function submit(e) {
    e.preventDefault(); setMessage(""); setLoading(true);
    try {
      if (mode === "login") {
        const data = await post("/auth/login", { email, password, otp }); onLogin(data.user);
      } else if (mode === "register") {
        const data = await post("/auth/register", { email, password }); setMessage(data.message); setMode("login");
      } else if (mode === "forgot") {
        const data = await post("/auth/reset/request", { email }); setMessage(data.message);
      } else {
        await post("/auth/reset/confirm", { token: resetToken, password });
        setMessage("Password changed. Sign in again."); setMode("login");
      }
    } catch (err) { setMessage(err.message); }
    finally { setLoading(false); }
  }
  return <div className="auth-page">
    <div className="brand auth-brand"><div className="brandmark"><Sparkles size={22}/></div><span>Junior <b>AI</b></span></div>
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-icon"><Sparkles size={27}/></div>
      <h1>{mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "confirm-reset" ? "Choose a new password" : "Welcome to Junior AI"}</h1>
      <p className="muted">Your private AI engine, with a thoughtful and encouraging voice.</p>
      {mode !== "confirm-reset" && <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>}
      {mode !== "forgot" && <label>Password<div className="password-field"><input required minLength={mode === "login" ? undefined : 12} maxLength={128} type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "login" ? "Your password" : "At least 12 characters"}/><button className="password-eye" type="button" onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>}
      {mode === "login" && <label>Authenticator code (Super Admin only)<input type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,""))} placeholder="6 digits for admin login"/></label>}
      {message && <p className="inline-notice">{message}</p>}
      <button className="primary full" disabled={loading} type="submit">{loading ? <Loader2 className="spin" size={17}/> : <ChevronRight size={17}/>}{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Save new password"}</button>
      <div className="auth-switch">
        {mode === "login" ? <><button type="button" onClick={() => {setMode("register");setMessage("");}}>Create account</button><button type="button" onClick={() => {setMode("forgot");setMessage("");}}>Forgot password?</button></> :
        <button type="button" onClick={() => {setMode("login");setMessage("");}}>Back to sign in</button>}
      </div>
      <div className="privacy-note"><ShieldCheck size={15}/> Local processing · No third-party AI keys · Content expires after 7 days</div>
    </form>
  </div>;
}

function App() {
  const [user, setUser] = useState(undefined);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [chats, setChats] = useState([]);
  const [chatId, setChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [chosenFiles, setChosenFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState("chat");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState([]);
  const [imageEnabled, setImageEnabled] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sidebar, setSidebar] = useState(true);
  const [showLogs, setShowLogs] = useState(true);
  const fileInput = useRef(null);
  const bottom = useRef(null);
  const addLog = (event, detail = "") => setLogs(old => [{ created: Date.now(), event, detail }, ...old].slice(0, 60));
  useEffect(() => { request("/auth/me").then(d => setUser(d.user)).catch(() => setUser(null)); }, []);
  async function refresh() {
    const [m, c, f, l, i] = await Promise.allSettled([request("/models"), request("/chats"), request("/uploads"), request("/logs"), request("/images/status")]);
    if (m.status === "fulfilled") { const list = m.value.models || []; setModels(list); setModel(old => list.includes(old) ? old : list.find(x => x.includes("coder")) || list[0] || ""); }
    else addLog("model_unavailable", "Start Ollama locally");
    if (c.status === "fulfilled") setChats(c.value.chats);
    if (f.status === "fulfilled") setFiles(f.value.uploads);
    if (l.status === "fulfilled") setLogs(l.value.logs);
    if (i.status === "fulfilled") setImageEnabled(i.value.enabled);
  }
  useEffect(() => { if (user) { refresh(); setDisplayName(user.display_name || ""); } }, [user?.id]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => { if (tab === "admin" && user?.role === "admin") refreshAdmin(); }, [tab]);
  const refreshAdmin = async () => { try { setAdmin(await request("/admin/summary")); } catch(e) { setNotice(e.message); } };
  async function openChat(id) {
    try {
      const data = await request("/chats/" + id);
      setChatId(id); setMessages(data.messages); setTab("chat"); setChosenFiles([]); setNotice("");
    } catch(e) { setNotice(e.message); }
  }
  function newChat() { setChatId(""); setMessages([]); setChosenFiles([]); setTab("chat"); setNotice(""); }
  async function upload(e) {
    const picked = e.target.files?.[0]; if (!picked) return;
    if (picked.size > 6 * 1024 * 1024) { setNotice("Maximum file size is 6 MB"); return; }
    setBusy(true); addLog("reading_file", picked.name);
    const form = new FormData(); form.append("file", picked);
    try {
      const info = await request("/upload", { method: "POST", body: form });
      setFiles(old => [info, ...old]); setChosenFiles(old => [...old.slice(-3), info.id]);
      addLog("file_ready", picked.name); setNotice("File attached. Ask Junior AI about it.");
    } catch (e) { setNotice(e.message); addLog("file_failed", picked.name); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function send(e) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    const prompt = text.trim();
    setText(""); setBusy(true); setNotice("");
    setMessages(old => [...old, { id: "temp-" + Date.now(), role: "user", content: prompt }]);
    addLog("thinking", "Sending to " + (model || "local model"));
    try {
      const result = await post("/chat", { prompt, chatId: chatId || null, model, fileIds: chosenFiles });
      setMessages(old => [...old, { id: "answer-" + Date.now(), role: "assistant", content: result.answer }]);
      setChatId(result.chatId); setChosenFiles([]);
      addLog("response_ready", model);
      const data = await request("/chats"); setChats(data.chats);
    } catch (err) { setNotice(err.message); addLog("operation_failed", err.message); }
    finally { setBusy(false); }
  }
  async function createImage(e) {
    e.preventDefault(); if (!imagePrompt.trim() || busy) return;
    setBusy(true); setNotice(""); addLog("generating_image", "Fooocus local");
    try {
      const result = await post("/images/generate", { prompt: imagePrompt });
      setGeneratedImages(old => [result.url, ...old]); addLog("image_ready", "Saved for seven days");
    } catch (err) { setNotice(err.message); addLog("image_failed", err.message); }
    finally { setBusy(false); }
  }
  async function removeChat(id) {
    if (!window.confirm("Delete this conversation now?")) return;
    await del("/chats/" + id); if (id === chatId) newChat(); await refresh();
  }
  async function saveProfile(e) {
    e.preventDefault();
    try { const result = await request("/auth/profile", { method: "PATCH", body: JSON.stringify({ displayName }) }); setUser(old => ({ ...old, display_name: result.display_name })); setNotice("Profile saved locally."); }
    catch (err) { setNotice(err.message); }
  }
  async function changePassword(e) {
    e.preventDefault();
    try { await post("/auth/password", { current: currentPassword, password: newPassword }); setUser(null); setNotice("Password changed. Sign in again."); }
    catch(err) { setNotice(err.message); }
  }
  async function deleteAccount() {
    const password = window.prompt("Type your account password to permanently delete your account:");
    if (!password) return;
    if (!window.confirm("Delete your account, conversations and files permanently?")) return;
    try { await del("/auth/account", { password }); setUser(null); }
    catch (err) { setNotice(err.message); }
  }
  async function logout() { await post("/auth/logout", {}).catch(() => {}); setUser(null); setChatId(""); setMessages([]); }
  async function adminDelete(target, type) {
    if (!window.confirm("Delete selected " + type + " permanently?")) return;
    try {
      await del(type === "user" ? "/admin/users/" + target : "/admin/content/" + type + "/" + target);
      addLog("admin_delete", type); refreshAdmin();
    } catch(e) { setNotice(e.message); }
  }
  if (user === undefined) return <div className="boot"><Sparkles className="pulse" size={38}/><span>Starting Junior AI...</span></div>;
  if (!user) return <Auth onLogin={setUser}/>;
  return <div className="shell">
    {sidebar && <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand"><div className="brandmark"><Sparkles size={19}/></div><span>Junior <b>AI</b></span></div>
        <button className="icon-btn" onClick={() => setSidebar(false)} title="Hide sidebar"><PanelLeftClose size={19}/></button>
      </div>
      <button className="new-chat" onClick={newChat}><Plus size={19}/> New conversation</button>
      <div className="nav-stack">
        <button className={tab === "chat" ? "nav active" : "nav"} onClick={() => setTab("chat")}><MessageSquare size={18}/> Chat & coding</button>
        <button className={tab === "images" ? "nav active" : "nav"} onClick={() => setTab("images")}><ImageIcon size={18}/> Create images</button>
        <button className={tab === "files" ? "nav active" : "nav"} onClick={() => setTab("files")}><FileText size={18}/> My documents</button>
        <button className={tab === "settings" ? "nav active" : "nav"} onClick={() => setTab("settings")}><Settings size={18}/> Account settings</button>
        {user.role === "admin" && <button className={tab === "admin" ? "nav active" : "nav"} onClick={() => setTab("admin")}><ShieldCheck size={18}/> Super Admin</button>}
      </div>
      <div className="section-caption">RECENT CONVERSATIONS</div>
      <div className="history-scroll">
        {chats.length === 0 && <p className="muted small pad">Your conversations will appear here.</p>}
        {chats.map(c => <div key={c.id} className={chatId === c.id ? "history-item selected" : "history-item"}>
          <button onClick={() => openChat(c.id)} title={c.title}><MessageSquare size={15}/><span>{c.title}</span></button>
          <button className="remove-history" onClick={() => removeChat(c.id)} title="Delete"><Trash2 size={14}/></button>
        </div>)}
      </div>
      <div className="sidebar-bottom">
        <div className="seven"><ShieldCheck size={17}/> All user content expires in 7 days</div>
        <div className="profile"><span className="avatar">{user.email.slice(0, 1).toUpperCase()}</span><div className="profile-email"><b>{user.role === "admin" ? "Super Admin" : "My account"}</b><span>{user.email}</span></div><button className="icon-btn" title="Log out" onClick={logout}><LogOut size={18}/></button></div>
      </div>
    </aside>}
    <main className="main">
      <header className="topbar">
        <div className="top-left">{!sidebar && <button className="icon-btn" onClick={() => setSidebar(true)}><PanelLeftOpen size={19}/></button>}<span className="page-name">{tab === "chat" ? "Junior AI" : tab === "images" ? "Image studio" : tab === "files" ? "Knowledge library" : tab === "admin" ? "Super Admin" : "Settings"}</span><span className="local-label"><span className="live-dot"/> Local AI</span></div>
        <div className="top-right">{tab === "chat" && <select className="model-select" value={model} onChange={e => setModel(e.target.value)}><option value="">Choose a model</option>{models.map(x => <option key={x} value={x}>{x}</option>)}</select>}<button className={showLogs ? "icon-btn selected-icon" : "icon-btn"} onClick={() => setShowLogs(!showLogs)} title="Toggle activity log"><Activity size={19}/></button></div>
      </header>
      {notice && <div className="notice"><AlertCircle size={17}/>{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {tab === "chat" && <div className="chat-stage">
        <div className="messages">
          {messages.length === 0 ? <div className="welcome">
            <div className="hello-star"><Sparkles size={40}/></div>
            <h1><span>Hello there.</span><br/>How can I help you today?</h1>
            <p>Build something great, understand a complex file, or explore a new idea. Your work stays on this computer.</p>
            <div className="prompts">
              <button onClick={() => setText("Review this React code and suggest fixes with tests.")}><Code2 size={21}/><span>Review my code</span></button>
              <button onClick={() => {setText("Analyze the uploaded Excel workbook: totals, outliers and trends.");fileInput.current?.click();}}><FileSpreadsheet size={21}/><span>Analyze Excel</span></button>
              <button onClick={() => {setText("Summarize this document and identify the most important facts.");fileInput.current?.click();}}><FileText size={21}/><span>Read deep documents</span></button>
              <button onClick={() => {setTab("images");}}><WandSparkles size={21}/><span>Create an image</span></button>
            </div>
          </div> : messages.map((m, i) => <div className={"bubble-row " + m.role} key={m.id || i}>
              {m.role === "assistant" && <div className="assistant-icon"><Sparkles size={16}/></div>}
              <div className="bubble">{m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : <p>{m.content}</p>}</div>
            </div>)}
          {busy && <div className="busy-line"><span className="shimmer-orb"/><span>Junior AI is working<span className="typing-dots">...</span></span></div>}
          <div ref={bottom}/>
        </div>
        <div className="composer-wrap">
          {!!chosenFiles.length && <div className="attachments">{chosenFiles.map(fid => {const f = files.find(x => x.id === fid);return f ? <button key={fid} onClick={() => setChosenFiles(old => old.filter(x => x !== fid))}><Paperclip size={14}/>{f.name} ×</button> : null;})}</div>}
          <form className="composer" onSubmit={send}><textarea rows={2} placeholder="Ask Junior AI anything..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => {if(e.key === "Enter" && !e.shiftKey){e.preventDefault();send();}}}/><div className="composer-bottom"><div className="composer-tools"><button type="button" title="Attach PDF, Excel, image or code" onClick={() => fileInput.current?.click()}><Paperclip size={19}/><span>Add files</span></button></div><button className="send" type="submit" disabled={busy || !text.trim() || !model}>{busy ? <Loader2 className="spin" size={19}/> : <Send size={18}/>}</button></div></form>
          <div className="footer-note">Junior AI is locally powered. It can make mistakes; verify important output.</div>
        </div>
      </div>}
      {tab === "images" && <section className="page-content"><div className="page-heading"><div className="topic-icon purple"><WandSparkles size={27}/></div><h1>Imagine something new</h1><p>Create images on your computer using an optional Fooocus-API installation.</p></div>
        {!imageEnabled && <div className="info-card"><AlertCircle size={19}/><span>Fooocus is not connected yet. Install the local API adapter and enable it in your .env file. AMD DirectML support depends on your setup.</span></div>}
        <form className="image-compose" onSubmit={createImage}><label>Describe the image<textarea rows={5} value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="A peaceful, sunlit mountain landscape, cinematic photography..."/></label><button type="submit" className="primary" disabled={busy || !imagePrompt.trim() || !imageEnabled}>{busy ? <Loader2 className="spin" size={18}/> : <Sparkles size={18}/>} Generate locally</button></form>
        <div className="image-grid">{generatedImages.map((url, i) => <div className="image-result" key={i}><img src={url} alt="AI-generated image"/><a href={url} target="_blank" rel="noreferrer">View full image</a></div>)}</div>
      </section>}
      {tab === "files" && <section className="page-content"><div className="page-heading"><div className="topic-icon"><FileText size={27}/></div><h1>Your knowledge, privately stored</h1><p>Upload PDFs, DOCX, XLSX, CSV, images and source files. Extracted text can be used in your conversations.</p></div><button className="primary" disabled={busy} onClick={() => fileInput.current?.click()}><Plus size={18}/> Add document</button>
        <div className="file-list">{files.map(f => <div className="file-row" key={f.id}><div className="file-symbol">{f.kind === "image" ? <ImageIcon/> : <FileText/>}</div><div className="file-info"><b>{f.name}</b><span>Added {date(f.created)} · Automatically removed after 7 days</span></div><button className="secondary" onClick={() => {setChosenFiles(old => old.includes(f.id) ? old : [...old.slice(-3), f.id]);setTab("chat");}}>Use in chat</button><button className="icon-btn" onClick={async () => {await del("/uploads/" + f.id);setFiles(old => old.filter(x => x.id !== f.id));}}><Trash2 size={17}/></button></div>)}{!files.length && <div className="empty">No documents uploaded yet.</div>}</div>
      </section>}
      {tab === "settings" && <section className="page-content narrow"><div className="page-heading"><div className="topic-icon"><UserRound size={27}/></div><h1>Account settings</h1><p>{user.email}</p></div>
        <div className="panel"><h3>Edit profile</h3><form onSubmit={saveProfile} className="settings-form"><label>Display name<input maxLength={60} required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name"/></label><button className="primary" type="submit"><UserRound size={17}/> Save profile</button></form></div>
        <div className="panel"><h3>Change password</h3><form onSubmit={changePassword} className="settings-form"><label>Current password<input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label><label>New password (12+ characters)<input type="password" required minLength={12} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)}/></label><button type="submit" className="primary"><KeyRound size={16}/> Change password</button></form></div>
        <div className="panel"><h3>Privacy and retention</h3><p>Your conversations, uploaded files, generated images and related content activity logs are automatically deleted after seven days. You can delete them earlier. Your account remains until you remove it.</p></div>
        <div className="panel danger"><h3>Delete account</h3><p>Immediately remove your account, sessions, conversations and stored files.</p><button className="danger-btn" onClick={deleteAccount}><Trash2 size={17}/> Delete my account</button></div>
      </section>}
      {tab === "admin" && user.role === "admin" && <section className="page-content wide"><div className="page-heading"><div className="topic-icon"><ShieldCheck size={27}/></div><h1>Super Admin</h1><p>Account management, usage metadata, system events and content deletion. Private message bodies are not displayed.</p></div>
        <button className="secondary" onClick={refreshAdmin}><RefreshCw size={16}/> Refresh dashboard</button>
        {admin && <><div className="stats">{Object.entries(admin.totals).map(([k,v]) => <div className="stat" key={k}><strong>{v}</strong><span>{k}</span></div>)}</div><div className="panel"><h3>Accounts</h3><div className="admin-table">{admin.accounts.map(u => <div className="admin-row" key={u.id}><span><b>{u.email}</b><small>{u.role} · {u.verified ? "verified" : "pending"} · {date(u.created)}</small></span>{u.role !== "admin" && <button className="danger-link" onClick={() => adminDelete(u.id, "user")}>Delete account</button>}</div>)}</div></div>
          <div className="panel"><h3>Stored content metadata</h3><div className="admin-table">{admin.content.map(x => <div className="admin-row" key={x.type+x.id}><span><b>{x.name || x.title || x.type}</b><small>{x.type} · owner {x.user_id.slice(0, 8)}… · {date(x.created)}</small></span><button className="danger-link" onClick={() => adminDelete(x.id, x.type)}>Delete</button></div>)}</div></div>
          <div className="panel"><h3>Security and activity events</h3><div className="admin-table">{admin.audits.map((x,i) => <div className="admin-row" key={i}><span><b>{x.event.replaceAll("_", " ")}</b><small>{date(x.created)} {clock(x.created)} · {x.user_id ? x.user_id.slice(0,8)+"…" : "system"} · {x.detail}</small></span></div>)}</div></div></>}
      </section>}
      <input ref={fileInput} hidden type="file" accept=".txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp" onChange={upload}/>
    </main>
    {showLogs && <aside className="activity-pane"><div className="activity-header"><div><Activity size={18}/><b>Activity</b></div><button className="icon-btn" onClick={() => setShowLogs(false)} title="Hide activity"><PanelLeftClose size={18}/></button></div>
      <div className="status-card"><div className="status-ring"><span/></div><div><b>{busy ? "Processing locally" : "Ready to help"}</b><small>{busy ? "Working on your request..." : "No external AI API connected"}</small></div></div>
      <div className="activity-caption">LIVE OPERATIONS</div><div className="activity-feed">{logs.map((l,i) => <div className="log-row" key={i}><div className="log-symbol">{l.event.includes("fail") || l.event.includes("blocked") ? <AlertCircle size={15}/> : <CheckCircle2 size={15}/>}</div><div><b>{l.event.replaceAll("_", " ")}</b><p>{l.detail}</p><span>{clock(l.created)}</span></div></div>)}</div>
      <div className="activity-footer"><ShieldCheck size={16}/> Protected by seven-day retention</div>
    </aside>}
  </div>;
}

createRoot(document.getElementById("root")).render(<App/>);
