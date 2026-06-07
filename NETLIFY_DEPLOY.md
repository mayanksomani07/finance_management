# Netlify Deployment Guide — Finance Management App

## Overview

This is a **Next.js** app connected to **Supabase**. This guide covers:
- One-time setup to deploy to Netlify
- How auto-deploy on every GitHub push works
- Environment variables to add
- Troubleshooting common errors

---

## Prerequisites

- Code pushed to a GitHub repository
- A Netlify account (free tier is enough)

---

## Part 1 — Push Code to GitHub (one-time setup)

If your repo is already on GitHub, skip to Part 2.

### 1a. Create a GitHub repo

1. Go to https://github.com → click **New** (top-left green button)
2. Name it: `finance-management`
3. Set visibility: **Private** (recommended) or Public
4. Do **NOT** check "Add README" or ".gitignore" — your project already has one
5. Click **Create repository**
6. GitHub will show you setup commands — copy the ones under **"…or push an existing repository from the command line"**

### 1b. Push your local project to GitHub

Open Terminal, navigate to your project, and run:

```bash
cd /Users/msomani/Desktop/finance_management

# Link to your new GitHub repo (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/finance-management.git

# Push all code
git branch -M master
git push -u origin master
```

You should see your files on GitHub now.

---

## Part 2 — Sign Up & Connect Netlify (one-time setup)

### 2a. Create a Netlify account

1. Go to https://netlify.com
2. Click **Sign up**
3. Choose **Sign up with GitHub** — this is the easiest option as it automatically links your repos
4. Authorize Netlify when prompted

### 2b. Create a new site

1. In the Netlify dashboard, click **"Add new site"**
2. Click **"Import an existing project"**
3. Click **"Deploy with GitHub"**
4. Netlify will ask for GitHub access — click **Authorize Netlify**
5. Search for and select your `finance-management` repository

---

## Part 3 — Configure Build Settings

On the build settings screen, fill in:

| Setting | Value |
|---------|-------|
| **Branch to deploy** | `master` |
| **Build command** | `npm run build` |
| **Publish directory** | `.next` |

> Netlify auto-detects Next.js projects and may pre-fill these. Double-check they match.

---

## Part 4 — Add Environment Variables (CRITICAL)

Your app will **crash at runtime** without these. Do this before deploying.

On the same settings page, click **"Show advanced"** → then **"New variable"** for each key below:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | your Supabase service role key |
| `API_SECRET_KEY` | your internal API secret |
| `COINDCX_API_KEY` | your CoinDCX API key |
| `COINDCX_API_SECRET` | your CoinDCX API secret |
| `ZERODHA_API_KEY` | your Zerodha API key |
| `ZERODHA_API_SECRET` | your Zerodha API secret |

> Find the actual values in your local `.env.local` file. Never commit that file to GitHub.

### To add variables later (if you forget now):

1. Netlify dashboard → your site → **Site configuration** → **Environment variables**
2. Click **Add a variable** → fill in key + value → Save
3. **Redeploy** the site for changes to take effect: go to **Deploys** → click **Trigger deploy**

---

## Part 5 — Deploy

1. After filling in all settings and variables, click **"Deploy site"**
2. Wait 2–4 minutes — you can watch the build log in real time
3. When it says **"Published"**, your site is live at a URL like:
   `https://amazing-name-123456.netlify.app`

### Rename your site URL (optional):

1. Site configuration → **Site details** → **Change site name**
2. Enter something like `msomani-finance` → saves as `msomani-finance.netlify.app`

---

## Part 6 — Auto-Deploy on Every GitHub Push

**This is automatic** — no extra setup needed. Once GitHub is connected, every push to `master` triggers a new Netlify deploy within 1–3 minutes.

### Your daily workflow going forward:

```bash
# Make your code changes, then:
git add .
git commit -m "describe what you changed"
git push
```

That's it. Netlify picks it up automatically.

### To verify a deploy happened:

1. Go to your Netlify dashboard → your site → **Deploys**
2. You'll see a log of every deploy with timestamps and status (success/failed)

---

## Troubleshooting

### Build failed — how to debug

1. Netlify dashboard → your site → **Deploys**
2. Click the failed deploy
3. Click **"View log"** — scroll to the bottom, errors are in red

### Common errors and fixes

**Error: `Module not found`**
- A package is missing. Run `npm install` locally and push again.

**Error: `Type error` or TypeScript errors**
- Run `npm run build` locally first — fix any errors, then push.

**Site loads but data doesn't show / blank page**
- Environment variables are missing or wrong. Check Part 4 above.
- Go to Netlify → Environment variables → verify all keys are there.
- After fixing, trigger a redeploy.

**Build succeeds but site shows old version**
- Hard refresh your browser: `Cmd + Shift + R` (Mac)

**`Error: NEXT_PHASE is not defined` or similar Next.js errors**
- Netlify needs the **Essential Next.js** plugin. Go to:
  Site configuration → **Plugins** → search "Next.js" → install it → redeploy.

---

## Adding a Custom Domain (optional, later)

1. Buy a domain from any registrar (Namecheap, GoDaddy, etc.)
2. Netlify dashboard → your site → **Domain management** → **Add custom domain**
3. Follow Netlify's DNS instructions — they walk you through it step by step
4. Netlify provides a **free SSL certificate** automatically

---

## Summary Cheatsheet

```
One-time setup:
  1. Push code to GitHub
  2. Sign up at netlify.com with GitHub
  3. Import repo → set build command: npm run build, publish: .next
  4. Add all env variables from .env.local
  5. Deploy → get your URL

Every day:
  git add . && git commit -m "changes" && git push
  → Netlify auto-deploys in ~2 minutes
```
