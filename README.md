# Junior AI Tool

Private, local-first AI assistant with a Gemini-inspired but independently designed React UI. Uses local Ollama, SQLite, and the official local Fooocus Gradio app (Windows AMD DirectML). No paid AI API or third-party AI key required.

**Status: working development foundation, NOT security-audited for unrestricted public access.** Model instructions and regex filters cannot guarantee no profanity, no pornography or immunity to prompt injection. A public release still requires additional safeguards.

## Features

- Local Ollama coding/reasoning chat with installed model selection.
- **Private smart memory:** SQLite FTS5 finds relevant passages throughout retained text documents and recalls related user messages from the last seven days. No embeddings, model downloads, API keys, or additional services. Each search is scoped to the authenticated account. Index entries are deleted when their source files or conversations expire or are deleted.
- Upload and analyze XLSX, CSV, PDF with selectable text, DOCX, source code, TXT, Markdown, JSON and images (image analysis needs a vision-enabled local model).
- Official Fooocus image generation by automating its localhost Gradio interface in local Google Chrome; no API keys or separate Fooocus-API service. Admin-only by default.
- Signup with email confirmation, login, logout, password changes, password reset via SMTP, profile-name editing, account deletion, and mandatory Super Admin TOTP authentication.
- Super Admin dashboard with account, usage, content **metadata**, audit logs, and content/account deletion. Private message bodies are not shown.
- Seven-day deletion of conversations, documents, generated images and activity logs. Login/account data remains until account deletion.
- Minimalist loading animations and operation activity feed.
- Node backend bound to 127.0.0.1; data in local SQLite and local files.

## Install on your Windows computer

Requirements: Node.js 22+, Ollama running locally, model storage, working graphics drivers.

1. Clone this repository onto your computer.
2. Run SETUP-JUNIOR-AI.bat. It installs Node dependencies and creates your local .env.
3. Open your LOCAL .env and fill in ADMIN_EMAIL and ADMIN_PASSWORD with a **new** administrator password (12+ characters). Run `npm run admin:env` **on your own Windows PC**. The script hashes the password in the local SQLite database and prints a one-time authenticator key for your phone. If your password contains a # character, put the value in double quotes in .env (for example, ADMIN_PASSWORD="a-new-long-secret-with-#-inside"); otherwise dotenv interprets # as a comment. All administrator logins still require the password and your six-digit authenticator code. The plaintext .env is never committed, sent to the server, or exposed to other users. It is more secure to remove ADMIN_PASSWORD from .env after bootstrapping, but you can keep it locally if you accept the extra disk-disclosure risk. You can alternatively run `npm run admin` for concealed interactive entry. Do not reuse a password previously disclosed in a chat.
4. Install a local model using: ollama pull qwen2.5-coder:14b
5. Run START-JUNIOR-AI.bat, then browse http://127.0.0.1:3001
6. Check ollama ps during model use to verify GPU acceleration. AMD/Windows compatibility varies with runtimes and drivers.

Developer mode: npm run dev (Vite frontend 5173, API 3001). Production build: npm run build then npm start. Tests: npm test.

## Public signup and verification

Registration is **disabled until SMTP is configured**. Configure SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USER and SMTP_PASS as appropriate in your local .env. A self-hosted mail relay with domain, DNS records and tested deliverability can satisfy the no-third-party-API-key requirement. Do not expose the SMTP credentials. Email verification and password resets use one-time 20-minute links.

## Official Fooocus on Windows AMD DirectML

**This app uses the original** [lllyasviel/Fooocus](https://github.com/lllyasviel/Fooocus), not Fooocus-API. Its official AMD instructions use `--directml`, **not** `--arg_directml`. AMD DirectML support is described by the project as beta. Your Radeon RX 9060 XT with 16GB VRAM is above the documented AMD 8GB minimum, but RDNA4 driver compatibility still needs an actual test.

1. Download and extract Fooocus from its official GitHub release: https://github.com/lllyasviel/Fooocus/releases. The portable folder must contain both `python_embeded` and `Fooocus`.
2. In your local .env, set `FOOOCUS_DIR=C:\\AI\\Fooocus_win64_2-5-0` (replace this example with your extracted Fooocus directory). Do not add quotation marks. Set `FOOOCUS_UI_URL=http://127.0.0.1:7865`.
3. Run `npm run fooocus:setup` once. This uninstalls Nvidia-specific Torch packages in Fooocus's **embedded Python only**, then installs `torch-directml` per the official README. It does **not** change your system Python or Ollama installation.
4. Launch `START-FOOOCUS-AMD.bat` (or `npm run fooocus:start`). Junior AI launches official Fooocus with `--directml --port 7865 --disable-in-browser --disable-analytics` and private output/temp folders. This is a dedicated backend instance; **do not** run a second conflicting Fooocus copy on the same port.
5. Check http://127.0.0.1:7865 on the same PC. Models may download on first launch; subsequent use runs locally.
6. Set `ENABLE_FOOOCUS=true` in .env and restart Junior AI, then open its **Create images** tab. It checks local Fooocus readiness and uses a headless local Chrome to enter the prompt, click Generate, and collect the output saved in Junior AI's private data folder. It does not call any cloud AI image API.
7. Keep `ALLOW_PUBLIC_IMAGES=false` until independent local image moderation has been deployed and tested. Current basic prompt blocking/negative prompt is insufficient to guarantee no explicit images. Admin-only generation is permitted for controlled testing.

**Privacy/retention:** Fooocus output/temp directories under Junior AI's data folder are included in automatic seven-day cleanup; image files copied into user storage are deleted with the same schedule. Avoid running an unrelated Fooocus instance sharing those folders. Never add `--share`, bind Gradio to `0.0.0.0`, or expose port 7865 in Pangolin. The Node service is the sole public gateway.

**Limitations:** DirectML is experimental for this GPU and Fooocus uses an internal Gradio interface rather than a stable production API. The automation depends on that UI's selectors and must be tested on your actual Fooocus release before public deployment. Chrome must be installed on the Windows machine. Generations on this GPU may be slow; initial model downloads need internet. This feature does not require or install Fooocus-API.

## Netlify public interface (separate from local AI)

A Netlify project named junior-ai-tool has been created under the connected account:
https://app.netlify.com/projects/junior-ai-tool

Netlify can host only the React interface; the Ollama/Fooocus backend and SQLite still run on the Windows PC.
To publish the first version, connect this GitHub repository (main branch) from Netlify's Continuous Deployment settings. The included netlify.toml builds the site using npm run build:netlify and publishes dist. Without a Pangolin URL the frontend displays a safe "connecting" message rather than accepting user signups. Never put your LOCAL .env or administrator password on Netlify.

After Pangolin is configured, set the Netlify site build variable JUNIOR_BACKEND_URL to the external HTTPS Pangolin backend hostname, then redeploy and set PUBLIC_URL on your Windows .env to the public Netlify URL. Complete instructions are in docs/NETLIFY-PANGOLIN.md.

## Expose worldwide using self-hosted Pangolin

1. Obtain a public Linux VPS and domain (these **may cost money**; no paid AI APIs does not make hosting free).
2. Follow the official Pangolin Community Edition installation guide, with TLS, security patches, DNS and VPS firewall configured.
3. Create a Pangolin Site/Newt connector on the Windows PC from your own Pangolin admin panel. Its outbound tunnel connects to the public VPS.
4. Create a public HTTPS resource forwarding to Junior AI on http://127.0.0.1:3001. Users access the public resource in their browsers and authenticate with Junior AI.
5. Set NODE_ENV=production and PUBLIC_URL=https://your-actual-public-domain.example on your Windows .env. Restart the app. Confirm secure cookies, HTTPS, signups and real email delivery from a remote browser.
6. Open only ports required on the VPS, typically TCP 80/443 and UDP 51820 for site tunnels; Pangolin client port UDP 21820 only if needed. Never expose ports 11434, 8888, 3001 or the SQLite data directory directly to the internet.

Pangolin documentation:
- https://docs.pangolin.net/self-host/quick-install
- https://docs.pangolin.net/self-host/dns-and-networking
- https://docs.pangolin.net/manage/sites/install-newt

## Security checklist before a real public launch

This is not hacker-proof. The Fooocus user-interface automation is experimental and not a security guarantee. Conduct independent penetration testing and verify account isolation, HTTPS, proxy trust, CSRF, quota enforcement, safe image/document moderation, credential stuffing, malware scanning, disk exhaustion, rate limiting, logging and GDPR/privacy obligations. Move document parsing into isolated workers with memory/CPU/zip-bomb limits. Add a robust **local** moderation model for prompts, AI responses, image uploads and generated images, plus human review. The current filters are preliminary. Public services operating on a single GPU also need fair scheduling and resource quotas.

Store local files on an encrypted drive. Prevent cloud sync and unexpired backups from defeating seven-day retention. Do not use this code to promise total deletion from external backups. The UI reports that user content is removed after seven days; profile information remains until account deletion. Display-name editing is supported. Email-address editing is not yet supported and requires re-verification.

## Public news research (no API key)

- Recent-event questions trigger a lightweight, on-demand Google News RSS search from the local Node backend, with dated publisher/headline leads and clickable links.
- It does not require Google Cloud credentials, an API key, or an additional always-running service.
- News headlines are not treated as verified article content, scientific sampling, representative polling or the opinion of an entire population. Cite dated reports and explain uncertainties.
- If the free RSS source cannot be reached or returns no suitable recent articles, Junior AI must report the limitation rather than invent reactions or recent events.
- The source is not guaranteed to be available from every network. It is distinct from Crawl4AI, which currently handles explicit allowlisted documentation links.

## Local Crawl4AI documentation research

- Junior AI reads up to two **explicit** HTTPS documentation links supplied in a chat message, on demand. The supported hosts include docs.python.org, developer.mozilla.org, react.dev, docs.github.com, learn.microsoft.com, docs.docker.com and docs.crawl4ai.com.
- Powered by the existing local Crawl4AI Python installation, invoked only when needed; no cloud API, paid key, Docker service or second model.
- To set up locally: `py -m pip install crawl4ai` and `crawl4ai-setup`; confirm with `crawl4ai-doctor`. Crawl4AI 0.9.5 was confirmed installed and healthy on the owner's Windows machine on October 19, 2026.
- Node launches Python directly from the existing one-BAT startup when a research message is processed. You do not need a separate persistent crawler service. If the default `py` launcher uses a different Python, set `CRAWL4AI_PYTHON` in the local .env to the correct Python executable.
- Only public HTTPS documentation sites from the hard-coded allowlist are supported. Redirects and subrequests to other domains are blocked; localhost, private IPs, credentials and arbitrary sites are not allowed. This is **documentation reading**, not universal web search.
- External page content is untrusted and never overrides assistant instructions. Failed fetches are disclosed rather than presented as completed research. Responses can cite the documentation link.

## Smart memory (local SQLite FTS5)

- New text uploads are automatically split into overlapping passages and indexed in SQLite. Up to 70,000 saved characters per document are searchable, including passages near the end.
- Previously uploaded documents still within the seven-day retention window are indexed automatically in the background after Junior AI starts. No extra setup is needed.
- Chat searches related passages in documents owned by the current user. When text files are explicitly attached, their passages take precedence. Recent and related earlier user messages help with conversation continuity without a second AI call.
- Deleting an upload, conversation, or account also removes associated search entries; scheduled retention cleanup removes expired content. Other users' content is never searched.
- Search is keyword-based rather than semantic embeddings: it is light and free but may miss paraphrases. Scanned image-only PDFs still require separate offline OCR.
- Run `npm test` to test local search behavior, retention filtering, cross-user isolation, and deletion. Netlify builds also validate this module and run the same tests.

## Data

Local SQLite database: data/junior.sqlite
Private documents, images and extracted text: data/files/
These paths and .env are gitignored. Do not commit user data, credentials or secrets.

## License

This repository's original app code is distinct from licensed third-party dependencies. Check model and backend licenses before redistribution or resale.
