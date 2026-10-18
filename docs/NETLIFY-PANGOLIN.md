# Netlify + Pangolin worldwide access

Netlify project: https://app.netlify.com/projects/junior-ai-tool
Expected public site (after first successful deploy): https://junior-ai-tool.netlify.app

## Architecture

Browser -> HTTPS Netlify frontend -> same-origin /api/* proxy -> HTTPS Pangolin public backend -> outbound Newt tunnel -> localhost Node.js on Windows PC -> localhost Ollama and Fooocus.

Netlify hosts the public static UI. All app account data, chat bodies, documents, AI models and image output remain on the Windows PC. They still pass *in transit* through Netlify and Pangolin infrastructure, so do not promise that third parties never process network traffic or metadata.

## Steps

1. Link the newly created Netlify project junior-ai-tool to GitHub repository ValdemirJunior2020/Junior-AI-tool, branch main, in the Netlify dashboard under Continuous deployment. This needs the owner's GitHub authorization action. The repo includes netlify.toml; build command is npm run build:netlify; publish directory is dist.
2. Until Pangolin's public backend is ready, Netlify deliberately shows an offline-safe page and refuses login. Do not put a local network IP into Netlify settings.
3. Obtain a public Linux VPS and a domain you control. Standard self-hosted Pangolin CE normally needs those and both may cost money. Install Pangolin CE by following https://docs.pangolin.net/self-host/quick-install and set TLS, DNS and firewall correctly.
4. Install Newt on your Windows PC via the Pangolin dashboard and configure a public HTTP resource pointing to Junior AI's local Node server at http://127.0.0.1:3001. Do NOT publicly expose the Ollama port 11434, official Fooocus 7865, SQLite, or file directories. Do not allow public access to the Pangolin control dashboard.
5. Test the Pangolin backend URL from a phone cellular network; HTTPS must be valid and an /api/health request should return {"ok":true,"runtime":"local"}.
6. In Netlify project environment variables set JUNIOR_BACKEND_URL to your actual Pangolin public HTTPS hostname, for example https://backend.example.org (NO path). Scope: Builds. Do not put passwords or local .env content in Netlify.
7. Trigger a new Netlify deploy. Build script generates dist/_redirects so requests to /api/* are proxied to Pangolin over HTTPS, while all other routes load the React SPA.
8. In your Windows local .env set NODE_ENV=production and PUBLIC_URL=https://junior-ai-tool.netlify.app. Restart Node and Newt. PUBLIC_URL is used for HTTPS cookie flags, email links, and strict Origin validation.
9. Configure your own reliable SMTP server and test email verification and password reset. Registration is deliberately disabled until SMTP works.
10. Test signup, login, logout, password reset, multiuser privacy boundaries, storage quotas, chat, document uploads, anti-CSRF, cookies, proxy POST forwarding and account deletion from a remote device. Keep public signups limited until security review and robust local content moderation are completed.

## Important

- Local Windows computer must stay online, awake, with Node, Ollama and Newt running. Netlify cannot execute your AMD GPU models.
- Pangolin public VPS/domain are external infrastructure, even when Ollama and Fooocus need no third-party AI API key.
- Netlify Free may have usage/traffic limits; a busy GPU cannot serve unlimited concurrent users. Fair scheduling and quotas are still required before scale.
- Netlify redirects are generated at build time: changes to JUNIOR_BACKEND_URL require a rebuild/deploy.
- The Netlify proxy must be tested to ensure the Set-Cookie session header and POST bodies reach the browser/backend correctly. If that fails, put frontend and API under one Pangolin-served HTTPS domain rather than weaken cookie security.
- Network ingress and CDN/VPS logs, and external backups, are NOT deleted by local seven-day cleanup. Configure independent retention policies to honor public privacy promises.
- The browser UI is a public frontend; app user identities are stored in your LOCAL SQLite database, not in Netlify Identity.
- This code and its preliminary filters do not guarantee protection from hacking, denial-of-service, offensive prompts or inappropriate output. Perform an independent security review before open worldwide access.
