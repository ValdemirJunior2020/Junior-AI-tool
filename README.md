# Junior AI Tool

Private, local-first AI assistant with a Gemini-inspired but independently designed React UI. Uses local Ollama, SQLite, and optional local Fooocus-API. No paid AI API or third-party AI key required.

**Status: working development foundation, NOT security-audited for unrestricted public access.** Model instructions and regex filters cannot guarantee no profanity, no pornography or immunity to prompt injection. A public release still requires additional safeguards.

## Features

- Local Ollama coding/reasoning chat with installed model selection.
- Upload and analyze XLSX, CSV, PDF with selectable text, DOCX, source code, TXT, Markdown, JSON and images (image analysis needs a vision-enabled local model).
- Optional Fooocus image generation through a loopback-only Fooocus-API adapter.
- Signup with email confirmation, login, logout, password changes, password reset via SMTP, and account deletion.
- Super Admin dashboard with account, usage, content **metadata**, audit logs, and content/account deletion. Private message bodies are not shown.
- Seven-day deletion of conversations, documents, generated images and activity logs. Login/account data remains until account deletion.
- Minimalist loading animations and operation activity feed.
- Node backend bound to 127.0.0.1; data in local SQLite and local files.

## Install on your Windows computer

Requirements: Node.js 22+, Ollama running locally, model storage, working graphics drivers.

1. Clone this repository onto your computer.
2. Run SETUP-JUNIOR-AI.bat. It installs Node dependencies and creates your local .env.
3. Run npm run admin in PowerShell. Enter your chosen email and **a new password** at the hidden terminal prompt. Never reuse a password disclosed in a chat or put it into GitHub.
4. Install a local model using: ollama pull qwen2.5-coder:14b
5. Run START-JUNIOR-AI.bat, then browse http://127.0.0.1:3001
6. Check ollama ps during model use to verify GPU acceleration. AMD/Windows compatibility varies with runtimes and drivers.

Developer mode: npm run dev (Vite frontend 5173, API 3001). Production build: npm run build then npm start. Tests: npm test.

## Public signup and verification

Registration is **disabled until SMTP is configured**. Configure SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USER and SMTP_PASS as appropriate in your local .env. A self-hosted mail relay with domain, DNS records and tested deliverability can satisfy the no-third-party-API-key requirement. Do not expose the SMTP credentials. Email verification and password resets use one-time 20-minute links.

## Fooocus on AMD

This frontend expects a LOCAL instance of the community Fooocus-API adapter implementing POST /v1/generation/text-to-image with the require_base64 flag and PNG output. Original Fooocus and Fooocus-API are separate open-source projects. Set ENABLE_FOOOCUS=true only after manually validating the local adapter at http://127.0.0.1:8888. Never publish the Fooocus port. AMD Windows DirectML support is experimental, and RDNA4 support must be tested before relying on image generation.

Fooocus: https://github.com/lllyasviel/Fooocus
Fooocus-API: https://github.com/mrhan1993/Fooocus-API

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

This is not hacker-proof. Conduct independent penetration testing and verify account isolation, HTTPS, proxy trust, CSRF, quota enforcement, safe image/document moderation, credential stuffing, malware scanning, disk exhaustion, rate limiting, logging and GDPR/privacy obligations. Move document parsing into isolated workers with memory/CPU/zip-bomb limits. Add a robust **local** moderation model for prompts, AI responses, image uploads and generated images, plus human review. The current filters are preliminary. Public services operating on a single GPU also need fair scheduling and resource quotas.

Store local files on an encrypted drive. Prevent cloud sync and unexpired backups from defeating seven-day retention. Do not use this code to promise total deletion from external backups. The UI reports that user content is removed after seven days; profile information remains until account deletion. Email-address editing is not yet supported and requires re-verification.

## Data

Local SQLite database: data/junior.sqlite
Private documents, images and extracted text: data/files/
These paths and .env are gitignored. Do not commit user data, credentials or secrets.

## License

This repository's original app code is distinct from licensed third-party dependencies. Check model and backend licenses before redistribution or resale.
