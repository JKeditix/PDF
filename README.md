# PDFNova

**Free, browser-based PDF and document utility platform.**

All file processing happens locally in the browser. Files never leave your device. No account required for any tool.

---

## What PDFNova Does

| Tool | Category | Auth Required? |
|------|----------|---------------|
| **PDF Editor** | Editor | ❌ No |
| **Word (DOCX) Editor** | Editor | ❌ No |
| **PDF to Image** | PDF | ❌ No |
| **Image to PDF** | PDF | ❌ No |
| **JPG to PDF** | PDF | ❌ No |
| **Merge PDF** | PDF | ❌ No |
| **Compress PDF** | PDF | ❌ No |
| **Split PDF** | PDF | ❌ No |
| **Rotate PDF** | PDF | ❌ No |
| **Organize PDF** | PDF | ❌ No |
| **Delete PDF Pages** | PDF | ❌ No |
| **Extract PDF Pages** | PDF | ❌ No |
| **Watermark PDF** | PDF | ❌ No |
| **PDF Page Numbers** | PDF | ❌ No |
| **PDF Page Size** | PDF | ❌ No |
| **PDF to Text** | PDF | ❌ No |
| **PDF to Word** | PDF | ❌ No |
| **PDF to Excel** | PDF | ❌ No |
| **PDF to PowerPoint** | PDF | ❌ No |
| **Word to PDF** | PDF | ❌ No |
| **Excel to PDF** | PDF | ❌ No |
| **PowerPoint to PDF** | PDF | ❌ No |
| **Unlock PDF** | PDF | ❌ No |
| **Protect PDF** | PDF | ❌ No |
| **Sign PDF** | PDF | ❌ No |
| **Compare PDF** | PDF | ❌ No |
| **Repair PDF** | PDF | ❌ No |
| **Metadata Editor** | PDF | ❌ No |
| **Header & Footer** | PDF | ❌ No |
| **Bookmarks** | PDF | ❌ No |
| **Search & Replace** | PDF | ❌ No |
| **DOCX to PDF** | Document | ❌ No |
| **TXT to PDF** | Document | ❌ No |
| **HTML to PDF** | Document | ❌ No |
| **Markdown to PDF** | Document | ❌ No |
| **RTF to PDF** | Document | ❌ No |
| **Photo Quality Enhancer** | Image | ❌ No |
| **Image Converter** | Image | ❌ No |
| **Image Compressor** | Image | ❌ No |
| **Image Resize** | Image | ❌ No |
| **Image Crop** | Image | ❌ No |
| **Image Rotate** | Image | ❌ No |
| **Image Upscaler** | Image | ❌ No |
| **Background Remover** | Image | ❌ No |
| **OCR PDF** | Advanced | ❌ No |
| **Bates Numbering** | Advanced | ❌ No |
| **Page Labels** | Advanced | ❌ No |
| **File Information** | Advanced | ❌ No |

**Optional login** — Register/Sign In to save your account. Accounts are never required for tool use.

---

## Architecture

```
Public User
    │
    ▼
PDFNova Frontend (static HTML/CSS/JS)
    │
    ├── Client-side tools (PDF.js, jsPDF, JSZip, Mammoth.js)
    │   All processing runs in the browser — no upload needed
    │
    └── Optional Backend (Node.js)
        ├── GET  /api/health
        ├── POST /api/auth/register
        ├── POST /api/auth/login
        └── GET  /api/auth/me
```

---

## Local Development

### Prerequisites

- Node.js (any modern version)  
- Python 3 (for the dev frontend server — or any static file server)

### 1. Start the backend

```bash
cd d:\pdf\backend
node server.js
```

Backend runs on **http://localhost:5000**

> **Using Playwright Node binary:**
> ```powershell
> & 'C:\Users\welcome\AppData\Local\ms-playwright-go\1.57.0\node.exe' d:\pdf\backend\server.js
> ```

### 2. Serve the frontend

```bash
cd d:\pdf
python -m http.server 8000
```

Open **http://localhost:8000**

### 3. Verify backend

```
GET http://localhost:5000/api/health
```

Expected:
```json
{
  "status": "ok",
  "service": "PDFNova API",
  "environment": "development"
}
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Backend port (default: `5000`) |
| `NODE_ENV` | Yes | `development` or `production` |
| `JWT_SECRET` | Yes | Long random secret for JWT signing |
| `FRONTEND_URL` | Yes (prod) | Your public frontend URL, e.g. `https://pdfnova.yourdomain.com` |

> **Generate a strong JWT_SECRET:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### Loading .env in Node.js (no dependencies needed)

Add this at the top of `server.js` for local `.env` loading:

```js
// Simple .env loader — only needed in development
if (process.env.NODE_ENV !== 'production') {
  const fs = require('fs'), path = require('path');
  const envFile = path.join(__dirname, '../.env');
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length && !process.env[key]) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    });
  }
}
```

Or install `dotenv`:
```bash
npm install dotenv
```
Then add `require('dotenv').config()` at the top.

---

## Production Deployment

### Step 1 — Configure the API URL

Edit **`config.js`** in the frontend folder and update `PROD_API_URL`:

```js
PROD_API_URL: 'https://api.pdfnova.yourdomain.com',
API_BASE_URL: isLocalDev
  ? 'http://localhost:5000'
  : 'https://api.pdfnova.yourdomain.com'   // ← set your real backend URL here
```

This is the **only file** you need to change to point the frontend at a production backend.

### Step 2 — Deploy the Frontend

The frontend is a **static site** — just HTML, CSS, and JS files.

**Recommended free hosting options:**

| Provider | Command / Steps |
|----------|----------------|
| **Netlify** | Drag & drop the `d:\pdf` folder at netlify.com/drop |
| **Vercel** | `vercel` CLI in the `d:\pdf` directory |
| **GitHub Pages** | Push to a `gh-pages` branch |
| **Cloudflare Pages** | Connect your GitHub repo |

**Files to deploy** (everything in `d:\pdf` except `backend/` and `.env`):
```
index.html
app.js
config.js
style.css
assets/
```

### Step 3 — Deploy the Backend

The backend is a plain Node.js HTTP server. Deploy it to any Node.js host:

| Provider | Notes |
|----------|-------|
| **Railway** | `railway up` — auto-detects Node.js |
| **Render** | Connect GitHub, select Node service |
| **Fly.io** | `fly launch` then `fly deploy` |
| **VPS (Ubuntu)** | Use PM2 to keep it running |

**Set these environment variables on your hosting provider:**

```
PORT=5000
NODE_ENV=production
JWT_SECRET=<your-long-random-secret>
FRONTEND_URL=https://pdfnova.yourdomain.com
```

### Step 4 — CORS

The backend automatically allows **only** `FRONTEND_URL` in production mode.

In development, all `localhost` origins are allowed.

> If you see CORS errors in production, make sure:
> 1. `NODE_ENV=production` is set
> 2. `FRONTEND_URL` exactly matches your frontend's origin (including `https://`)

### Step 5 — HTTPS

Both the frontend and backend **must** use HTTPS in production.

- Frontend hosts (Netlify, Vercel, Cloudflare) provide HTTPS automatically.
- Backend hosts (Railway, Render, Fly.io) provide HTTPS automatically.
- If hosting on a VPS, use [Caddy](https://caddyserver.com/) or [Let's Encrypt with Nginx](https://certbot.eff.org/).

---

## Domain Configuration

### Recommended domain structure

```
https://pdfnova.yourdomain.com        ← Frontend (static)
https://api.pdfnova.yourdomain.com    ← Backend API
```

### DNS (if using a subdomain for the API)

Add a CNAME or A record pointing `api.pdfnova.yourdomain.com` to your backend host's IP or domain.

---

## Database

The current backend uses a local `data.json` file for user storage.

### For single-instance deployments

`data.json` works fine on Railway, Render, or a single VPS.

### For multi-instance / production-scale deployments

Migrate to **PostgreSQL**:

1. Provision a database (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway Postgres](https://railway.app))
2. Add `DATABASE_URL` to your environment variables
3. Replace `loadDB()`/`saveDB()` with `pg` queries in `server.js`

---

## Health Check

```
GET https://api.pdfnova.yourdomain.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "PDFNova API",
  "environment": "production",
  "timestamp": "2026-08-12T00:00:00.000Z"
}
```

The frontend polls this endpoint every 10 seconds and shows:
- 🟢 **Backend Connected** — API responded with `status: "ok"`
- 🔴 **Backend Offline** — API unreachable

---

## Public Testing Checklist

Test in **incognito mode** (logged out) before deploying:

### Public Tools (no login)
- [ ] Homepage loads without login prompt
- [ ] PDF to Image — upload PDF, download PNG
- [ ] Image to PDF — upload image, download PDF
- [ ] Merge PDF — upload 2+ PDFs, download merged PDF
- [ ] Compress PDF — upload PDF, download smaller PDF
- [ ] Split PDF — specify pages, download split PDF
- [ ] PDF Editor — open PDF, export PDF
- [ ] Word Editor — open DOCX, export PDF
- [ ] Image Converter — upload PNG, download JPG
- [ ] All other tools work without prompting login

### Backend
- [ ] `/api/health` returns `{ status: "ok" }`
- [ ] `/api/auth/register` creates a user
- [ ] `/api/auth/login` returns a JWT
- [ ] CORS headers correct for the frontend domain
- [ ] No `localhost` in production API calls

### Production
- [ ] Frontend loads on `https://`
- [ ] Backend accessible on `https://`
- [ ] No mixed-content warnings in browser console
- [ ] No secret keys visible in `config.js` or `app.js`
- [ ] `config.js` points to production backend URL

---

## Security Notes

| Item | Status |
|------|--------|
| Passwords hashed (HMAC-SHA256) | ✅ |
| JWT with expiry (7 days) | ✅ |
| CORS restricted in production | ✅ |
| No secrets in frontend code | ✅ |
| No stack traces in API errors | ✅ |
| Input validation on all routes | ✅ |
| Files never uploaded to backend | ✅ (client-side processing) |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | HTML5 + Vanilla CSS + Vanilla JS |
| PDF Rendering | PDF.js |
| PDF Generation | jsPDF |
| ZIP Export | JSZip |
| DOCX Parsing | Mammoth.js |
| Backend | Node.js (built-in modules only) |
| Auth | JWT (HMAC-SHA256, built-in crypto) |
| Database | JSON file (upgradable to PostgreSQL) |

---

## License

PDFNova — All rights reserved © 2026
