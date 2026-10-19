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
import { useJuniorLanguage, LanguageFlags } from "./i18n.jsx";

async function request(route, opts = {}) {
  const response = await fetch("/api" + route, { credentials: "include", ...opts,
    headers: { ...(opts.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(opts.headers || {}) }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Error([502, 503, 504].includes(response.status) ? "Junior AI is getting ready. Please try again soon." : (json.error || "Request failed"));
  return json;
}
const post = (route, data) => request(route, { method: "POST", body: JSON.stringify(data) });
const del = (route, data) => request(route, { method: "DELETE", ...(data ? { body: JSON.stringify(data) } : {}) });
const clock = n => new Date(n).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const date = n => new Date(n).toLocaleDateString();

function Auth({ onLogin }) {
  const { language, setLanguage, t } = useJuniorLanguage();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [resetToken, setResetToken] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action"), token = params.get("token");
    if (action === "verify" && token) {
      post("/auth/verify", { token }).then(() => setMessage(t("Email verified. Sign in to continue."))).catch(e => setMessage(e.message));
      history.replaceState(null, "", "/");
    } else if (action === "reset" && token) { setMode("confirm-reset"); setResetToken(token); history.replaceState(null, "", "/"); }
  }, []);
  async function submit(e) {
    e.preventDefault(); setMessage(""); setLoading(true);
    try {
      if (mode === "login") {
        const data = await post("/auth/login", { email, password, remember: rememberMe }); onLogin(data.user, false);
      } else if (mode === "register") {
        const data = await post("/auth/register", { email, password }); onLogin(data.user, true);
      } else if (mode === "forgot") {
        const data = await post("/auth/reset/request", { email }); setMessage(data.message);
      } else {
        await post("/auth/reset/confirm", { token: resetToken, password });
        setMessage(t("Password changed. Sign in again.")); setMode("login");
      }
    } catch (err) { setMessage(t(err.message || "Request failed")); }
    finally { setLoading(false); }
  }
  return <div className="auth-page">
    <div className="auth-header"><div className="brand auth-brand"><div className="brandmark"><Sparkles size={22}/></div><span>Junior <b>AI</b></span></div><LanguageFlags language={language} setLanguage={setLanguage}/></div>
    <form className="auth-card" onSubmit={submit}>
      {(mode === "login" || mode === "register") && <div className="auth-tabs" role="group" aria-label="Account access">
        <button type="button" className={mode === "login" ? "active" : ""} aria-pressed={mode === "login"} onClick={() => { setMode("login"); setMessage(""); }}>{t("Sign in")}</button>
        <button type="button" className={mode === "register" ? "active" : ""} aria-pressed={mode === "register"} onClick={() => { setMode("register"); setMessage(""); }}>{t("Create account")}</button>
      </div>}
      <div className="auth-icon"><Sparkles size={27}/></div>
      <h1>{t(mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "confirm-reset" ? "Choose a new password" : "Welcome to Junior AI")}</h1>
      {mode !== "confirm-reset" && <label>{t("Email address")}<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>}
      {mode !== "forgot" && <label>{t("Password")}<div className="password-field"><input required minLength={mode === "login" ? undefined : 12} maxLength={128} type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={t(mode === "login" ? "Your password" : "At least 12 characters")}/><button className="password-eye" type="button" onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>}
      {mode === "login" && <label className="remember-choice">
        <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}/>
        <span>{t("Remember me")}<small>{t("Keep me signed in for 30 days")}</small></span>
      </label>}
      {message && <p className="inline-notice">{message}</p>
      <button className="primary full" disabled={loading} type="submit">{loading ? <Loader2 className="spin" size={17}/> : <ChevronRight size={17}/>}{t(mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Save new password")}</button>
      <div className="auth-switch">
        {mode === "login" ? <button type="button" onClick={() => {setMode("forgot");setMessage("");}}>{t("Forgot your password?")}</button> :
        <button type="button" onClick={() => {setMode("login");setMessage("");}}>{t(mode === "register" ? "Already have an account? Sign in" : "Back to sign in")}</button>}
      </div>
    </form>
  </div>;
}

function App() {
  const { language, setLanguage, t } = useJuniorLanguage();
  const [user, setUser] = useState(undefined);
  const [backendOffline, setBackendOffline] = useState(false);
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
  const [imageOnline, setImageOnline] = useState(false);
  const [imageStatus, setImageStatus] = useState("");
  const [imageProgress, setImageProgress] = useState(null);
  const imageProgressTimer = useRef(null);
  const imageProgressReset = useRef(null);
  const imageGeneratingSince = useRef(0);
  const imageRequestStarted = useRef(0);
  const [admin, setAdmin] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sidebar, setSidebar] = useState(() => !window.matchMedia("(max-width: 760px)").matches);
  const [showLogs, setShowLogs] = useState(true);
  const [queueStatus, setQueueStatus] = useState(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const handleResize = event => setSidebar(!event.matches);
    mq.addEventListener("change", handleResize);
    return () => mq.removeEventListener("change", handleResize);
  }, []);
  function dismissMobileMenu() {
    if (window.matchMedia("(max-width: 760px)").matches) setSidebar(false);
  }
  function goTo(nextTab) { setTab(nextTab); dismissMobileMenu(); }
  const fileInput = useRef(null);
  const bottom = useRef(null);
  useEffect(() => () => {
    clearInterval(imageProgressTimer.current);
    clearTimeout(imageProgressReset.current);
  }, []);
  const addLog = (event, detail = "") => setLogs(old => [{ created: Date.now(), event, detail }, ...old].slice(0, 60));
  useEffect(() => {
    request("/health").then(health => {
      if (health.ok !== true || health.runtime !== "local") throw new Error("Local AI backend is unavailable");
      return request("/auth/me");
    }).then(data => setUser(data.user || null)).catch(() => {
      setBackendOffline(true);
      setUser(null);
    });
  }, []);
  // Automatically recover when the home AI computer reconnects.
  useEffect(() => {
    if (!backendOffline) return;
    let cancelled = false;
    const checkConnection = async () => {
      try {
        const health = await request("/health");
        if (health.ok !== true || health.runtime !== "local") return;
        const data = await request("/auth/me");
        if (cancelled) return;
        setUser(data.user || null);
        setBackendOffline(false);
      } catch {
        // Connection is still unavailable. Retry quietly; don't expose internals to visitors.
      }
    };
    const interval = setInterval(checkConnection, 12000);
    const onVisible = () => { if (document.visibilityState === "visible") void checkConnection(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [backendOffline]);
    async function refresh() {
    const [m, c, f, l, i, g] = await Promise.allSettled([request("/models"), request("/chats"), request("/uploads"), request("/logs"), request("/images/status"), request("/images")]);
    if (m.status === "fulfilled") { const list = m.value.models || []; setModel(old => list.includes(old) ? old : list.find(x => x.includes("coder")) || list[0] || ""); }
    else addLog("model_unavailable", "Start Ollama locally");
    if (c.status === "fulfilled") setChats(c.value.chats);
    if (f.status === "fulfilled") setFiles(f.value.uploads);
    if (l.status === "fulfilled") setLogs(l.value.logs);
    if (i.status === "fulfilled") { setImageEnabled(i.value.enabled); setImageOnline(i.value.online); setImageStatus(i.value.note || ""); }
    if (g.status === "fulfilled") setGeneratedImages((g.value.images || []).map(image => image.url));
  }
  useEffect(() => { if (user) { refresh(); setDisplayName(user.display_name || ""); } }, [user?.id]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => { if (tab === "admin" && user?.role === "admin") refreshAdmin(); }, [tab]);
  const refreshAdmin = async () => { try { setAdmin(await request("/admin/summary")); } catch(e) { setNotice(e.message); } };
  async function openChat(id) {
    try {
      const data = await request("/chats/" + id);
      setChatId(id); setMessages(data.messages); setTab("chat"); setChosenFiles([]); setNotice(""); dismissMobileMenu();
    } catch(e) { setNotice(e.message); }
  }
  function newChat() { setChatId(""); setMessages([]); setChosenFiles([]); setTab("chat"); setNotice(""); dismissMobileMenu(); }
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
    if (!text.trim() || busy || !model) return;
    const prompt = text.trim();
    setText(""); setBusy(true); setNotice(""); setQueueStatus("Joining the waiting line...");
    setMessages(old => [...old, { id: "temp-" + Date.now(), role: "user", content: prompt }]);
    try {
      const accepted = await post("/chat", { prompt, chatId: chatId || null, model, fileIds: chosenFiles, locale: language });
      if (!accepted.id) throw new Error("Junior AI did not return a queue ticket");
      // Short status polls also survive ordinary reverse proxies that time out on long requests.
      let result;
      for (let attempt = 0; attempt < 400; attempt++) {
        const status = await request("/chat/jobs/" + encodeURIComponent(accepted.id));
        if (status.status === "finished") { result = status.result; break; }
        if (status.status === "failed") throw new Error(status.error || "AI generation failed");
        setQueueStatus(status.status === "waiting"
          ? (language === "pt-BR" ? "Você está na posição #" + status.position + ". Junior AI responderá quando chegar sua vez." : "You're #" + status.position + " in line. Junior AI will answer when it's your turn.")
          : (language === "pt-BR" ? "Chegou sua vez! Junior AI está pensando..." : "It's your turn! Junior AI is thinking..."));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      if (!result) throw new Error("The request is taking longer than expected. Please check your conversations before retrying.");
      setMessages(old => [...old, { id: "answer-" + Date.now(), role: "assistant", content: result.answer }]);
      setChatId(result.chatId); setChosenFiles([]);
      addLog("response_ready", "Local AI");
      const data = await request("/chats"); setChats(data.chats);
    } catch (err) {
      setMessages(old => [...old, { id: "error-" + Date.now(), role: "assistant", content: "I couldn't finish that request: " + err.message }]);
      setNotice(err.message); addLog("operation_failed", err.message);
    } finally { setBusy(false); setQueueStatus(null); }
  }
  async function createImage(e) {
    e?.preventDefault();
    if (!imagePrompt.trim() || busy || !imageEnabled || !imageOnline) return;
    setBusy(true);
    setNotice("");
    addLog("generating_image", "Requesting Fooocus image");
    clearInterval(imageProgressTimer.current);
    clearTimeout(imageProgressReset.current);
    imageRequestStarted.current = Date.now();
    imageGeneratingSince.current = 0;
    setImageProgress({ stage: "sending", percent: 2, label: "Sending image request...", elapsed: 0 });
    imageProgressTimer.current = setInterval(() => {
      setImageProgress(prev => {
        if (!prev || prev.stage === "ready" || prev.stage === "failed") return prev;
        const elapsed = Math.floor((Date.now() - imageRequestStarted.current) / 1000);
        if (prev.stage !== "generating") return { ...prev, elapsed };
        const generationSeconds = (Date.now() - imageGeneratingSince.current) / 1000;
        // An estimate, not Fooocus's real diffusion-step completion percentage.
        const percent = Math.min(95, Math.max(prev.percent, Math.round(12 + 83 * (1 - Math.exp(-generationSeconds / 165)))));
        const label = percent < 24 ? "Preparing Fooocus..." : percent < 90 ? "Generating image..." : "Finalizing image...";
        return { ...prev, percent, label, elapsed };
      });
    }, 1000);
    try {
      const accepted = await post("/images/generate", { prompt: imagePrompt.trim() });
      if (!accepted.id) throw Error("Fooocus did not return a request ticket");
      let result = null;
      // Poll small authenticated status requests instead of keeping one long
      // HTTP response open through Netlify while Fooocus creates the image.
      for (let attempts = 0; attempts < 3600; attempts++) {
        const status = await request("/images/jobs/" + encodeURIComponent(accepted.id));
        if (status.status === "finished") {
          result = status.result;
          break;
        }
        if (status.status === "failed") throw Error(status.error || "Image generation failed");
        if (status.status === "running") {
          if (!imageGeneratingSince.current) {
            imageGeneratingSince.current = Date.now();
            setImageProgress(prev => ({ ...prev, stage: "generating", percent: Math.max(12, prev?.percent || 0), label: "Preparing Fooocus..." }));
          }
        } else {
          const position = Math.max(1, Number(status.position) || 1);
          setImageProgress(prev => ({ ...prev, stage: "waiting", percent: 5, label: language === "pt-BR" ? "Você está na posição #" + position + " — aguardando sua vez..." : "You're #" + position + " in line — waiting for your turn..." }));
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      if (!result?.url) throw Error("Image generation is still running. Check My Images after refreshing.");
      setGeneratedImages(old => [result.url, ...old.filter(url => url !== result.url)]);
      setImageProgress(prev => ({ ...prev, stage: "ready", percent: 100, label: "Image ready!", elapsed: Math.floor((Date.now() - imageRequestStarted.current) / 1000) }));
      addLog("image_ready", "Saved privately for seven days");
      imageProgressReset.current = setTimeout(() => setImageProgress(null), 8000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setImageProgress(prev => ({ ...prev, stage: "failed", label: "Image generation could not finish", elapsed: Math.floor((Date.now() - imageRequestStarted.current) / 1000) }));
      setNotice(message);
      addLog("image_failed", message);
    } finally {
      clearInterval(imageProgressTimer.current);
      imageProgressTimer.current = null;
      setBusy(false);
    }
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
  if (backendOffline) return <div className="auth-page junior-connecting-page">
    <div className="brand auth-brand"><div className="brandmark"><Sparkles size={22}/></div><span>Junior <b>AI</b></span></div>
    <div className="auth-card junior-connecting-card" role="status" aria-live="polite">
      <div className="junior-connecting-icon"><Sparkles size={30}/></div>
      <h1>{t("Junior AI is getting ready")}</h1>
      <p className="muted">{t("We're preparing your experience. Thanks for your patience!")}</p>
      <div className="junior-connecting-indicator"><Loader2 className="spin" size={18}/><span>{t("Checking availability automatically...")}</span></div>
      <button type="button" className="primary full" onClick={() => window.location.reload()}><RefreshCw size={17}/> {t("Try again now")}</button>
    </div>
  </div>;

  if (!user) return <Auth onLogin={(account, newlyCreated) => {
    setUser(account);
    if (newlyCreated) setNotice(t("Welcome to Junior AI! Your account is ready."));
  }}/>;
  return <div className="shell">
    {sidebar && <button className="mobile-menu-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setSidebar(false)}/>}
    {sidebar && <aside className="sidebar" id="app-navigation" aria-label="Navigation">
      <div className="sidebar-top">
        <div className="brand"><div className="brandmark"><Sparkles size={19}/></div><span>Junior <b>AI</b></span></div>
        <button className="icon-btn" onClick={() => setSidebar(false)} title="Hide sidebar" aria-label="Close navigation menu"><PanelLeftClose size={19}/></button>
      </div>
      <button className="new-chat" onClick={newChat}><Plus size={19}/> {t("New conversation")}</button>
      <div className="nav-stack">
        <button className={tab === "chat" ? "nav active" : "nav"} onClick={() => goTo("chat")}><MessageSquare size={18}/> {t("Chat & coding")}</button>
        <button className={tab === "images" ? "nav active" : "nav"} onClick={() => goTo("images")}><ImageIcon size={18}/> {t("Create images")}</button>
        <button className={tab === "files" ? "nav active" : "nav"} onClick={() => goTo("files")}><FileText size={18}/> {t("My documents")}</button>
        <button className={tab === "settings" ? "nav active" : "nav"} onClick={() => goTo("settings")}><Settings size={18}/> Account settings</button>
        {user.role === "admin" && <button className={tab === "admin" ? "nav active" : "nav"} onClick={() => goTo("admin")}><ShieldCheck size={18}/> Super Admin</button>}
      </div>
      <div className="section-caption">{t("RECENT CONVERSATIONS")}</div>
      <div className="history-scroll">
        {chats.length === 0 && <p className="muted small pad">{t("Your conversations will appear here.")}</p>}
        {chats.map(c => <div key={c.id} className={chatId === c.id ? "history-item selected" : "history-item"}>
          <button onClick={() => openChat(c.id)} title={c.title}><MessageSquare size={15}/><span>{c.title}</span></button>
          <button className="remove-history" onClick={() => removeChat(c.id)} title="Delete"><Trash2 size={14}/></button>
        </div>)}
      </div>
      <div className="sidebar-bottom">
        <div className="seven"><ShieldCheck size={17}/> {t("All user content expires in 7 days")}</div>
        <div className="profile"><span className="avatar">{user.email.slice(0, 1).toUpperCase()}</span><div className="profile-email"><b>{t(user.role === "admin" ? "Super Admin" : "My account")}</b><span>{user.email}</span></div><button className="icon-btn" title="Log out" onClick={logout}><LogOut size={18}/></button></div>
      </div>
    </aside>}
    <main className="main">
      <header className="topbar">
        <div className="top-left"><button type="button" className="icon-btn menu-open-button" onClick={() => setSidebar(value => !value)} aria-label={sidebar ? "Close menu" : "Open menu"} aria-expanded={sidebar} aria-controls="app-navigation"><PanelLeftOpen size={20}/></button><span className="page-name">{t(tab === "chat" ? "Junior AI" : tab === "images" ? "Image studio" : tab === "files" ? "Knowledge library" : tab === "admin" ? "Super Admin" : "Settings")}</span><span className="local-label"><span className="live-dot"/> {t("Local AI")}</span></div>
        <div className="top-right"><LanguageFlags language={language} setLanguage={setLanguage}/>{tab === "chat" && <span className="model-ready" title={model ? "Junior AI automatically selected a local model" : "Start Ollama to use AI chat"}><span className={model ? "model-ready-dot" : "model-ready-dot offline"}/>{t(model ? "AI ready" : "AI offline")}</span>}<button className={showLogs ? "icon-btn selected-icon" : "icon-btn"} onClick={() => setShowLogs(!showLogs)} title="Toggle activity log"><Activity size={19}/></button></div>
      </header>
      {notice && <div className="notice"><AlertCircle size={17}/>{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {tab === "chat" && <div className="chat-stage">
        <div className="messages">
          {messages.length === 0 ? <div className="welcome">
            <div className="hello-star"><Sparkles size={40}/></div>
            <h1><span>{t("Hello there.")}</span><br/>{t("How can I help you today?")}</h1>
            
            <div className="prompts">
              <button onClick={() => setText(language === "pt-BR" ? "Revise este código React e sugira correções e testes." : "Review this React code and suggest fixes with tests.")}><Code2 size={21}/><span>{t("Review my code")}</span></button>
              <button onClick={() => {setText(language === "pt-BR" ? "Analise a planilha Excel enviada: totais, valores fora do padrão e tendências." : "Analyze the uploaded Excel workbook: totals, outliers and trends.");fileInput.current?.click();}}><FileSpreadsheet size={21}/><span>{t("Analyze Excel")}</span></button>
              <button onClick={() => {setText(language === "pt-BR" ? "Resuma este documento e destaque os fatos mais importantes." : "Summarize this document and identify the most important facts.");fileInput.current?.click();}}><FileText size={21}/><span>{t("Read deep documents")}</span></button>
              <button onClick={() => {setTab("images");}}><WandSparkles size={21}/><span>{t("Create an image")}</span></button>
            </div>
          </div> : messages.map((m, i) => <div className={"bubble-row " + m.role} key={m.id || i}>
              {m.role === "assistant" && <div className="assistant-icon"><Sparkles size={16}/></div>}
              <div className="bubble">{m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : <p>{m.content}</p>}</div>
            </div>)}
          {busy && <div className="busy-line" role="status" aria-live="polite"><span className="shimmer-orb"/><span>{queueStatus ? t(queueStatus) : t("Junior AI is working...")}</span></div>}
          <div ref={bottom}/>
        </div>
        <div className="composer-wrap">
          {!!chosenFiles.length && <div className="attachments">{chosenFiles.map(fid => {const f = files.find(x => x.id === fid);return f ? <button key={fid} onClick={() => setChosenFiles(old => old.filter(x => x !== fid))}><Paperclip size={14}/>{f.name} ×</button> : null;})}</div>}
          <form className="composer" onSubmit={send}><textarea rows={2} placeholder={t("Ask Junior AI anything...")} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => {if(e.key === "Enter" && !e.shiftKey){e.preventDefault();send();}}}/><div className="composer-bottom"><div className="composer-tools"><button type="button" title={t("Attach PDF, Excel, image or code")} onClick={() => fileInput.current?.click()}><Paperclip size={19}/><span>{t("Add files")}</span></button></div><button className="send" type="submit" disabled={busy || !text.trim() || !model}>{busy ? <Loader2 className="spin" size={19}/> : <Send size={18}/>}</button></div></form>
          <div className="footer-note">{t("Junior AI is locally powered. It can make mistakes; verify important output.")}</div>
        </div>
      </div>}
      {tab === "images" && <section className="page-content"><div className="page-heading"><div className="topic-icon purple"><WandSparkles size={27}/></div><h1>{t("Imagine something new")}</h1><p>{t("Describe what you'd like to see, and Junior AI will create an image for you.")}</p></div>
        {!imageEnabled && <div className="info-card image-setup-info"><AlertCircle size={19}/><span><strong>{t("Image creation is not available for this account yet.")}</strong> {t("Please check back later.")}</span></div>}
        {imageEnabled && !imageOnline && <div className="info-card image-setup-info"><AlertCircle size={19}/><span><strong>{t("Our image studio is temporarily unavailable.")}</strong> {t("Please try again in a few minutes. Thanks for your patience!")}</span></div>}
        {imageEnabled && imageOnline && <div className="info-card image-service-status"><CheckCircle2 size={19}/><span>{t("Image studio is ready. What would you like to create?")}</span></div>}
        {imageEnabled && !imageOnline && <button className="secondary image-retry" type="button" onClick={refresh}><RefreshCw size={15}/> {t("Try again")}</button>}
        <form className="image-compose" onSubmit={createImage}>
          <label>{t("Describe the image")}<textarea rows={5} value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder={t("A peaceful, sunlit mountain landscape, cinematic photography...")}/></label>
          <button type="submit" className="primary" disabled={busy || !imagePrompt.trim() || !imageEnabled || !imageOnline}>
            {busy ? <Loader2 className="spin" size={18}/> : <Sparkles size={18}/>}
            {t(busy ? "Creating your image..." : "Create image")}
          </button>
          {imageProgress && <div className={"image-progress-card " + (imageProgress.stage === "failed" ? "image-progress-failed" : imageProgress.stage === "ready" ? "image-progress-ready" : "")} role="status" aria-live="polite">
            <div className="image-progress-header"><span className="image-progress-label">{t(imageProgress.label)}</span><strong className="image-progress-percent">{Math.round(imageProgress.percent)}%</strong></div>
            <div className="image-progress-track" role="progressbar" aria-label={t("Estimated image generation progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(imageProgress.percent)} aria-valuetext={Math.round(imageProgress.percent) + " percent estimated"}>
              <div className="image-progress-fill" style={{width: imageProgress.percent + "%"}}/>
            </div>
            <div className="image-progress-meta"><span>{t(imageProgress.stage === "ready" ? "Completed" : imageProgress.stage === "failed" ? "See error above" : "Estimated progress — actual time may vary")}</span><span>{t("Elapsed")} {Math.floor(imageProgress.elapsed / 60)}:{String(imageProgress.elapsed % 60).padStart(2, "0")}</span></div>
          </div>}
        </form>
        <div className="image-grid">{generatedImages.map((url, i) => <div className="image-result" key={i}><img src={url} alt={t("AI-generated image")}/><a href={url} target="_blank" rel="noreferrer">{t("View full image")}</a></div>)}</div>
      </section>}
      {tab === "files" && <section className="page-content"><div className="page-heading"><div className="topic-icon"><FileText size={27}/></div><h1>{t("Your knowledge, privately stored")}</h1><p>{t("Upload PDFs, DOCX, XLSX, CSV, images and source files. Extracted text can be used in your conversations.")}</p></div><button className="primary" disabled={busy} onClick={() => fileInput.current?.click()}><Plus size={18}/> {t("Add document")}</button>
        <div className="file-list">{files.map(f => <div className="file-row" key={f.id}><div className="file-symbol">{f.kind === "image" ? <ImageIcon/> : <FileText/>}</div><div className="file-info"><b>{f.name}</b><span>{t("Added")} {date(f.created)} · {t("Automatically removed after 7 days")}</span></div><button className="secondary" onClick={() => {setChosenFiles(old => old.includes(f.id) ? old : [...old.slice(-3), f.id]);setTab("chat");}}>{t("Use in chat")}</button><button className="icon-btn" onClick={async () => {await del("/uploads/" + f.id);setFiles(old => old.filter(x => x.id !== f.id));}}><Trash2 size={17}/></button></div>)}{!files.length && <div className="empty">{t("No documents uploaded yet.")}</div>}</div>
      </section>}
      {tab === "settings" && <section className="page-content narrow"><div className="page-heading"><div className="topic-icon"><UserRound size={27}/></div><h1>{t("Account settings")}</h1><p>{user.email}</p></div>
        <div className="panel"><h3>{t("Edit profile")}</h3><form onSubmit={saveProfile} className="settings-form"><label>{t("Display name")}<input maxLength={60} required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t("Your display name")}/></label><button className="primary" type="submit"><UserRound size={17}/> {t("Save profile")}</button></form></div>
        <div className="panel"><h3>{t("Change password")}</h3><form onSubmit={changePassword} className="settings-form"><label>{t("Current password")}<input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label><label>{t("New password (12+ characters)")}<input type="password" required minLength={12} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)}/></label><button type="submit" className="primary"><KeyRound size={16}/> Change password</button></form></div>
        <div className="panel"><h3>{t("Privacy and retention")}</h3><p>{t("Your conversations, uploaded files, generated images and related content activity logs are automatically deleted after seven days. You can delete them earlier. Your account remains until you remove it.")}</p></div>
        <div className="panel danger"><h3>{t("Delete account")}</h3><p>{t("Immediately remove your account, sessions, conversations and stored files.")}</p><button className="danger-btn" onClick={deleteAccount}><Trash2 size={17}/> {t("Delete my account")}</button></div>
      </section>}
      {tab === "admin" && user.role === "admin" && <section className="page-content wide"><div className="page-heading"><div className="topic-icon"><ShieldCheck size={27}/></div><h1>Super Admin</h1><p>{t("Account management, usage metadata, system events and content deletion. Private message bodies are not displayed.")}</p></div>
        <button className="secondary" onClick={refreshAdmin}><RefreshCw size={16}/> {t("Refresh dashboard")}</button>
        {admin && <><div className="stats">{Object.entries(admin.totals).map(([k,v]) => <div className="stat" key={k}><strong>{v}</strong><span>{k}</span></div>)}</div><div className="panel"><h3>{t("Accounts")}</h3><div className="admin-table">{admin.accounts.map(u => <div className="admin-row" key={u.id}><span><b>{u.email}</b><small>{u.role} · {t(u.verified ? "verified" : "pending")} · {date(u.created)}</small></span>{u.role !== "admin" && <button className="danger-link" onClick={() => adminDelete(u.id, "user")}>{t("Delete account")}</button>}</div>)}</div></div>
          <div className="panel"><h3>{t("Stored content metadata")}</h3><div className="admin-table">{admin.content.map(x => <div className="admin-row" key={x.type+x.id}><span><b>{x.name || x.title || x.type}</b><small>{x.type} · owner {x.user_id.slice(0, 8)}… · {date(x.created)}</small></span><button className="danger-link" onClick={() => adminDelete(x.id, x.type)}>{t("Delete")}</button></div>)}</div></div>
          <div className="panel"><h3>{t("Security and activity events")}</h3><div className="admin-table">{admin.audits.map((x,i) => <div className="admin-row" key={i}><span><b>{x.event.replaceAll("_", " ")}</b><small>{date(x.created)} {clock(x.created)} · {x.user_id ? x.user_id.slice(0,8)+"…" : "system"} · {x.detail}</small></span></div>)}</div></div></>}
      </section>}
      <input ref={fileInput} hidden type="file" accept=".txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp" onChange={upload}/>
    </main>
    {showLogs && <aside className="activity-pane"><div className="activity-header"><div><Activity size={18}/><b>{t("Activity")}</b></div><button className="icon-btn" onClick={() => setShowLogs(false)} title="Hide activity"><PanelLeftClose size={18}/></button></div>
      <div className="status-card"><div className="status-ring"><span/></div><div><b>{t(busy ? "Processing locally" : "Ready to help")}</b><small>{t(busy ? "Working on your request..." : "No external AI API connected")}</small></div></div>
      <div className="activity-caption">{t("LIVE OPERATIONS")}</div><div className="activity-feed">{logs.map((l,i) => <div className="log-row" key={i}><div className="log-symbol">{l.event.includes("fail") || l.event.includes("blocked") ? <AlertCircle size={15}/> : <CheckCircle2 size={15}/>}</div><div><b>{l.event.replaceAll("_", " ")}</b><p>{l.detail}</p><span>{clock(l.created)}</span></div></div>)}</div>
      <div className="activity-footer"><ShieldCheck size={16}/> Protected by seven-day retention</div>
    </aside>}
  </div>;
}

createRoot(document.getElementById("root")).render(<App/>);
