# Mudivarthi Vishwak Sai — VLSI Engineer Portfolio

A responsive React + Vite portfolio served by an Express API. The same Node.js service serves the production website, content API, admin tools, resume, and profile photo.

## Run locally

Requirements: Node.js 20 or newer and npm.

1. In VS Code, open this project folder in a terminal.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Create `.env` if you do not already have one:

   ```powershell
   Copy-Item .env.example .env
   ```

   Edit `.env` and set `ADMIN_PASSWORD` to a unique password and `SESSION_SECRET` to a random value at least 32 characters long. `.env` is ignored by Git; do not commit it.

4. Start the frontend and API for development:

   ```powershell
   npm run dev
   ```

5. Open **http://localhost:5173**. Vite proxies `/api` requests to the local Express API at port 4000.

The shield icon in the header opens admin controls. Sign in with `ADMIN_PASSWORD` from `.env`. Admin supports editing the site JSON and uploading a PDF resume and JPG/JPEG/PNG/WebP photo (each limited to 5 MB).

## Production commands

```powershell
npm ci
npm run build
npm start
```

In production, Express serves the Vite build from `dist/` and handles the API on the same origin. Set `NODE_ENV=production`, `ADMIN_PASSWORD` (at least 16 characters), and `SESSION_SECRET` (at least 32 characters). Production cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` automatically; the server trusts the hosting proxy for HTTPS.

The production server exits on startup if the built frontend or required secrets are missing. Check **/api/health** for its health response.

## Deploy to Render (single service)

This repository includes `render.yaml` for one Render Node web service. The service builds the React site and serves it from Express, so no separate static-site service or frontend API URL is needed.

### 1. Push this project to GitHub

Create an empty repository on GitHub (do not initialize it with a README or license), then open the project directory in PowerShell. These commands apply to this current folder, including its latest VS Code AI edits:

```powershell
git init
git branch -M main
git status --short
```

Check that `.env`, `server/uploads/`, and any credentials are not listed for staging. The `.gitignore` excludes those private files. The edited public content in `server/site-content.json` is intentionally included.

```powershell
git add .
git status --short
git commit -m "Prepare VLSI portfolio for production"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace the remote URL with the repository you created. If `origin` already exists, use `git remote set-url origin <repository-url>` instead of `git remote add`.

### 2. Create the Render service

1. Sign in to Render and choose **New → Blueprint**.
2. Connect the GitHub repository you just pushed and select its `main` branch.
3. Review the `render.yaml` settings and create the service.
4. Render builds with `npm ci && npm run build`, starts with `npm start`, and checks `/api/health`.
5. In the service's **Environment** settings, set `ADMIN_PASSWORD` to a unique password of at least 16 characters. Render generates `SESSION_SECRET`; ensure it is at least 32 characters. Keep both secret and do not put them in the repository.
6. Wait for the first deploy to finish, then open the service URL shown by Render. No deployment URL is preconfigured in this project.

The Blueprint requests a **Starter** web service and a **1 GB persistent disk** mounted at `/var/data`. Render persistent disks require a paid web service; confirm the current Render plan and storage pricing before creating it. The disk is where edited content, uploaded files, and file-backed admin sessions are stored. Do not remove the disk or change `DATA_DIR` unless you have migrated/backed up that data.

### 3. Sign in and publish your initial media

1. Open the Render service URL, then use the shield icon in the header to open Admin.
2. Sign in with the `ADMIN_PASSWORD` you set in Render.
3. Upload your resume and profile photo. Uploads in `server/uploads/` are excluded from Git, so the existing local resume/photo are **not** pushed to GitHub or automatically transferred to Render.
4. Review the public portfolio, resume download, and profile photo.

### 4. Verify persistence after redeployment

1. Save a recognizable content change in the Admin JSON editor and upload/replace a photo or resume.
2. In Render, trigger a deploy of the same commit (or push a later change).
3. After the deploy becomes healthy, refresh the site and verify the edited text and uploaded files remain available. A redeploy that keeps the same persistent disk retains them.
4. Keep a separate backup of important content and uploads. The persistent disk is not a backup and can be lost if deleted or if the service/disk is removed.

On the first deployment, the app seeds `/var/data/site-content.json` from the checked-in `server/site-content.json`, preserving the current edited portfolio content. Upload the local resume/photo again through Admin. Session files are on the persistent disk; deployments may still require signing in again if the session expires or the session secret changes.

## Data, uploads, and security

- `DATA_DIR` controls persistence. Locally it defaults to `server/`; on Render the Blueprint sets it to `/var/data`.
- The app copies the checked-in content JSON into an empty data directory once, then admin edits are written atomically to the persistent content file.
- Resume and photo uploads are stored in `DATA_DIR/uploads/`. The server validates allowed MIME types, file signatures, and a 5 MB size limit. Admin endpoints require a signed-in session.
- Admin sessions are stored in `DATA_DIR/sessions/` and expire after four hours. Use a single running service instance with the configured disk; do not scale this file-backed setup to multiple instances.
- `.env`, upload folders, session data, and the optional `data/` directory are ignored by Git. Never commit secrets, private files, or credentials.
- The resume endpoint is public by design. Only use a resume you intend to share publicly.
- Keep backups of `server/site-content.json` and your uploaded files. Render persistent storage protects against redeploys, not accidental deletion or data loss.

## Personalize the portfolio

- `src/data.js` contains the starter content used when no saved content file exists.
- `server/site-content.json` contains the current public content and can also be edited in Admin.
- The admin content editor supports profile details, skills, featured projects (including editing/removal), additional projects, articles, and career objective.
- Add direct repository URLs and update project descriptions/statuses to match your actual work.

## Project structure

```text
src/
  App.jsx          # Portfolio UI, admin controls, and API client
  data.js          # Default portfolio content
  main.jsx
  styles.css
server/
  index.js         # Express API, admin auth, uploads, and production static hosting
  site-content.json
  uploads/         # Private local upload storage; excluded from Git
render.yaml        # Single-service Render Blueprint and persistent disk
.env.example      # Required local secret variable names only
```
