# Deployment guide — Render (API) + Cloudflare Pages (UI)

```
Browser ──> Cloudflare Pages  (frontend/out, static)      https://formwise.pages.dev
   │
   └──fetch──> Render Web Service (FastAPI + SQLite)       https://formwise-api.onrender.com
                     └──> Hugging Face Inference router (optional, HF_TOKEN)
```

Deploy the backend first, because the frontend needs its URL at build time.

---

## 0. Push the code to GitHub

```bash
cd formwise
git init && git add . && git commit -m "Formwise: Typeform clone"
git branch -M main
git remote add origin https://github.com/ChinmayiR4/Formwise-Typeform-Clone
git push -u origin main
```
The repo must be **public** for the submission. It contains `frontend/`, `backend/`, `render.yaml` and the docs.

---

## 1. (Optional) Get a Hugging Face token

1. Sign in at https://huggingface.co → **Settings → Access Tokens → Create new token**.
2. Choose type **Read**. If you use a fine-grained token, enable **"Make calls to Inference Providers"**.
3. Copy the token (`hf_…`). You'll paste it into Render as `HF_TOKEN`.

The default model is `meta-llama/Llama-3.1-8B-Instruct`. Any chat model available through the HF router works. Set it with `HF_MODEL`, e.g. `Qwen/Qwen2.5-7B-Instruct` or `mistralai/Mistral-7B-Instruct-v0.3`. If the model needs a licence (Llama does), accept it on the model page first.

> Without a token, every AI feature still works using the built-in fallback. The UI labels those results "AI offline" or "Offline heuristic".

---

## 2. Backend on Render

### Option A — Blueprint (one click, uses `render.yaml`)
1. https://dashboard.render.com → **New → Blueprint** → connect your GitHub repo.
2. Render reads `render.yaml` and proposes the **formwise-api** web service (free plan).
3. Fill in the prompted secrets:
   - `CORS_ORIGINS` → `*` for now. You'll tighten this in step 4.
   - `HF_TOKEN` → your token, or leave it empty.
4. Click **Apply**. The first build takes about 2–3 minutes.

### Option B — Manual web service
**New → Web Service** → pick the repo, then set:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` |
| Instance type | Free |

Environment variables:

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.12.7` |
| `DATABASE_URL` | `sqlite:///./formwise.db` |
| `SEED_ON_STARTUP` | `true` |
| `CORS_ORIGINS` | `*` (then your Pages URL) |
| `HF_TOKEN` | `hf_…` (optional) |
| `HF_MODEL` | `meta-llama/Llama-3.1-8B-Instruct` (optional) |

### Verify
- `https://<your-service>.onrender.com/api/health` → `{"status":"ok"}`
- `https://<your-service>.onrender.com/docs` → Swagger UI
- `https://<your-service>.onrender.com/api/ai/status` → `{"enabled": true, ...}` if the token is set

Copy the service URL, e.g. `https://formwise-api.onrender.com`.

### About data persistence (important)
The free Render plan has an **ephemeral filesystem**. SQLite lives on that disk, so it resets whenever the service redeploys or restarts after sleeping. Because `SEED_ON_STARTUP=true`, the demo forms and responses come back on every boot, so the demo link always works. New forms and responses are lost on restart.

If you need durable data, either:
- **Render Disk** (paid Starter plan): add a disk mounted at `/var/data` and set `DATABASE_URL=sqlite:////var/data/formwise.db` (four slashes for an absolute path).
- **Postgres:** create a Render Postgres instance, add `psycopg[binary]` to `requirements.txt`, and set `DATABASE_URL=postgresql+psycopg://...`. The SQLAlchemy models are portable.

### Cold starts
Free services sleep after about 15 minutes idle, and the first request then takes 30–60 s. The frontend shows a "Waking up the server…" banner while it waits. To keep the service awake during your evaluation, add a free uptime monitor (e.g. UptimeRobot) that hits `/api/health` every 10 minutes.

---

## 3. Frontend on Cloudflare Pages

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. Build settings:

| Setting | Value |
|---|---|
| Framework preset | `Next.js (Static HTML Export)` (or *None*) |
| Root directory (advanced) | `frontend` |
| Build command | `npm run build` |
| Build output directory | `out` |

3. **Environment variables** (Production, and Preview too if you use preview branches):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://formwise-api.onrender.com` (your Render URL, no trailing slash) |
| `NODE_VERSION` | `22` |

4. **Save and Deploy.** You get a URL like `https://formwise.pages.dev`.

`NEXT_PUBLIC_API_URL` is baked into the JavaScript **at build time**. If you change it, trigger a new deployment (Deployments → Retry deployment).

**How routing works:** `next build` emits `out/workspace.html`, `out/form.html`, `out/to.html`, and so on. The file `frontend/public/_redirects` (copied into `out/`) tells Cloudflare:
```
/to/*   /to          200   # every public link /to/<slug> is served by the runner page
/       /workspace   302
```
The runner reads `<slug>` from the URL in the browser.

> **Alternative: Wrangler CLI (no Git integration)**
> ```bash
> cd frontend
> NEXT_PUBLIC_API_URL=https://formwise-api.onrender.com npm run build
> npx wrangler pages deploy out --project-name formwise
> ```

---

## 4. Lock down CORS

Back in Render, set `CORS_ORIGINS` to your Pages origin(s), comma-separated, with no trailing slash:
```
https://formwise.pages.dev,https://your-custom-domain.com
```
Save; Render redeploys automatically. Preview deployments use different subdomains (`https://<hash>.formwise.pages.dev`). Add those too, or keep `*` if you rely on previews. The API uses no cookies, so `*` is safe for this app.

---

## 5. Smoke test the live deployment

1. Open `https://formwise.pages.dev` → you should be redirected to **/workspace** with 3 seeded forms.
2. Open **Brew & Bean** → **Share** → **Copy link** → open it in a private window. The welcome screen appears; answer with the keyboard.
3. Back in **Results**, the new response shows up, along with views, starts and completion rate.
4. **Create a new form → Create with AI** → it generates a draft. The toast tells you whether HF or the fallback produced it.
5. **Results → Insights → Generate insights**.

---

## 6. Custom domain (optional)
- **Pages:** project → Custom domains → add `forms.example.com`. Cloudflare creates the DNS record for you.
- **Render:** service → Settings → Custom Domains → add `api.example.com` and create the CNAME it shows.
- Then update `NEXT_PUBLIC_API_URL` (and redeploy Pages) and `CORS_ORIGINS`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| UI says "Can't reach the server" | Check `NEXT_PUBLIC_API_URL` (https, no trailing slash) and redeploy Pages. Then check `/api/health` on Render. |
| Browser console shows a CORS error | Add the exact Pages origin to `CORS_ORIGINS` (scheme + host, no path). |
| `/to/<slug>` shows a 404 page | Make sure `out/_redirects` exists (it comes from `frontend/public/_redirects`) and the output directory is `out`. |
| Form link says "no longer accepting responses" | The form is a draft (publish it), or the free instance restarted and re-seeded (slugs change on re-seed). |
| AI results say "fallback" | `HF_TOKEN` is missing or invalid, you haven't accepted the model licence, or you hit rate limits. Try another `HF_MODEL`, and check the Render logs for `HF inference failed`. |
| Render build fails on Python version | Set `PYTHON_VERSION=3.12.7`. |
| First request takes ~1 minute | The free instance was asleep (cold start). See "Cold starts" above. |
