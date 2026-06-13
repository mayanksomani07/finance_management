# Netlify Deployment Guide — FinTrack

## Overview

This is a **Next.js** app connected to **Supabase** (database + auth). This guide covers:
- One-time setup to deploy to Netlify
- All required environment variables (including new auth and webhook variables)
- Supabase Auth configuration for production
- Auto-deploy on every GitHub push
- Troubleshooting common errors

---

## Prerequisites

- Code pushed to a GitHub repository
- A Netlify account (free tier is enough)

---

## Part 1 — Push Code to GitHub (one-time setup)

If your repo is already on GitHub, skip to Part 2.

### 1a. Create a GitHub repo

1. Go to https://github.com → click **New**
2. Name it: `finance-management`
3. Set visibility: **Private** (recommended)
4. Do **NOT** check "Add README" or ".gitignore" — the project already has them
5. Click **Create repository**

### 1b. Push your local project

```bash
cd /Users/msomani/Desktop/finance_management

git remote add origin https://github.com/YOUR_USERNAME/finance-management.git
git branch -M master
git push -u origin master
```

---

## Part 2 — Sign Up & Connect Netlify (one-time setup)

1. Go to https://netlify.com → **Sign up with GitHub**
2. In the dashboard, click **Add new site → Import an existing project → Deploy with GitHub**
3. Authorize Netlify, then select your `finance-management` repository

---

## Part 3 — Configure Build Settings

| Setting | Value |
|---------|-------|
| **Branch to deploy** | `master` |
| **Build command** | `npm run build` |
| **Publish directory** | `.next` |

> Netlify auto-detects Next.js and may pre-fill these. Double-check they match.

---

## Part 4 — Add Environment Variables (CRITICAL)

Your app will **crash at runtime** without these. Click **"Show advanced"** → **"New variable"** for each:

| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon/public key | |
| `SUPABASE_SERVICE_KEY` | your Supabase service role key | Server-only — never exposed to the browser |
| `API_SECRET_KEY` | your internal API secret | `openssl rand -hex 16` |
| `ADMIN_EMAIL` | email address for the admin account | Server-only — replaces the old `NEXT_PUBLIC_ADMIN_EMAIL` |
| `ADMIN_PASSWORD` | admin password | Use something strong, not the example default |
| `SMS_WEBHOOK_ALLOWED_EMAILS` | comma-separated emails allowed to use the SMS webhook | Endpoint returns 503 if unset |
| `EMAIL_WEBHOOK_ALLOWED_EMAILS` | comma-separated emails allowed to use the email webhook | Endpoint returns 503 if unset |
| `COINDCX_API_KEY` | your CoinDCX API key | Optional |
| `COINDCX_API_SECRET` | your CoinDCX API secret | Optional |
| `COINDCX_OWNER_EMAIL` | email of the user who owns the CoinDCX account | Optional; falls back to `NEXT_PUBLIC_WEALTH_USER_EMAILS` |
| `ZERODHA_API_KEY` | your Zerodha API key | Optional |
| `ZERODHA_API_SECRET` | your Zerodha API secret | Optional |
| `NEXT_PUBLIC_APP_ENV` | `prod` | |

> Find the current values in your local `.env.local` file. Never commit that file to GitHub.
>
> If you have `NEXT_PUBLIC_ADMIN_EMAIL` set from an older deployment, you can remove it — it is no longer read by the app.

### To add or update variables later:

1. Netlify dashboard → your site → **Site configuration → Environment variables**
2. Add or edit, then **Save**
3. Go to **Deploys → Trigger deploy** to apply the changes

---

## Part 5 — Supabase Auth Configuration (CRITICAL for login to work)

After deploying, you must tell Supabase which URLs are allowed to receive auth redirects.

1. Go to your Supabase project → **Authentication → URL Configuration**
2. Set **Site URL** to your Netlify URL, e.g. `https://your-site.netlify.app`
3. Under **Redirect URLs**, add:
   - `https://your-site.netlify.app/**`
   - `http://localhost:3000/**` (so local dev still works)
4. Save

Without this step, login redirects and password reset emails will fail in production.

---

## Part 6 — Run the Schema (if not already done)

If you haven't already run `lib/schema.sql` against your Supabase project:

1. Go to your Supabase project → **SQL Editor**
2. Paste the full contents of `lib/schema.sql` and run it

This creates all tables, RLS policies, and the `prevent_role_escalation` trigger. Re-running it on an existing database is safe — all statements are idempotent.

---

## Part 7 — Zerodha Kite Connect (if using)

Zerodha only allows OAuth callbacks to explicitly whitelisted URLs.

1. Go to [kite.trade/developers](https://kite.trade/developers) → log in → click your app
2. Under **Redirect URL**, add: `https://your-site.netlify.app/api/kite/callback`
3. Optionally also add `http://localhost:3000/api/kite/callback` for local dev
4. Save

---

## Part 8 — Deploy & Seed Admin

1. Click **Deploy site** — wait 2–4 minutes
2. When it says **Published**, your site is live
3. **Seed the admin user** — run this once from your local machine, pointing at your production Supabase project (the same `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env.local`):

```bash
node scripts/seed-admin.mjs
```

This creates the account set by `ADMIN_EMAIL` / `ADMIN_PASSWORD` and gives it `role: admin`. You can now log in at your Netlify URL and access `/admin`.

### Rename your site URL (optional):

Site configuration → **Site details → Change site name** → e.g. `fintrack-msomani` → saves as `fintrack-msomani.netlify.app`

---

## Part 9 — Auto-Deploy on Every Push

No extra setup needed. Every push to `master` triggers a Netlify rebuild automatically (~2 minutes).

```bash
# Your daily workflow:
git add .
git commit -m "describe what changed"
git push
```

To verify: Netlify dashboard → your site → **Deploys** — shows a log of every deploy with timestamps and status.

---

## Troubleshooting

### Build failed

1. Netlify dashboard → your site → **Deploys** → click the failed deploy → **View log**
2. Scroll to the bottom — errors are in red

### Common errors and fixes

**`Module not found`**
Run `npm install` locally and push again.

**TypeScript / type errors**
Run `npm run build` locally first, fix the errors, then push.

**Site loads but no data / blank page after login**
- Environment variables are missing or wrong. Check Part 4 — verify all keys are present.
- After fixing, trigger a redeploy.

**Login redirects to a blank page or error**
- Supabase Redirect URLs are not configured. See Part 5.

**SMS or email webhook returns 503**
- `SMS_WEBHOOK_ALLOWED_EMAILS` or `EMAIL_WEBHOOK_ALLOWED_EMAILS` is not set in your Netlify env vars. Add the comma-separated list of allowed emails and redeploy.

**"Connect Zerodha" fails on the live site**
- Zerodha redirect URL not whitelisted. See Part 7.

**Admin page shows "Forbidden" or redirects away**
- `ADMIN_EMAIL` env var is missing or doesn't match the logged-in user's email.
- Make sure you're using the server-only `ADMIN_EMAIL` key, not the old `NEXT_PUBLIC_ADMIN_EMAIL`.

**Build succeeds but site shows old version**
Hard refresh: `Cmd + Shift + R` (Mac)

**`NEXT_PHASE is not defined` or similar Next.js errors**
Install the Essential Next.js plugin:
Site configuration → **Plugins** → search "Next.js" → install → redeploy.

---

## Adding a Custom Domain (optional)

1. Buy a domain from any registrar
2. Netlify dashboard → your site → **Domain management → Add custom domain**
3. Follow Netlify's DNS instructions — free SSL certificate is provided automatically
4. After adding the custom domain, update **Supabase → Authentication → URL Configuration** with the new domain too

---

## Summary Cheatsheet

```
One-time setup:
  1. Push code to GitHub
  2. Sign up at netlify.com with GitHub
  3. Import repo → build: npm run build, publish: .next
  4. Add all env variables:
       NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
       SUPABASE_SERVICE_KEY, API_SECRET_KEY,
       ADMIN_EMAIL, ADMIN_PASSWORD,
       SMS_WEBHOOK_ALLOWED_EMAILS, EMAIL_WEBHOOK_ALLOWED_EMAILS
  5. Deploy
  6. Configure Supabase Auth → URL Configuration with your Netlify URL
  7. node scripts/seed-admin.mjs  ← creates the admin account

Every push:
  git add . && git commit -m "changes" && git push
  → Netlify auto-deploys in ~2 minutes
```
