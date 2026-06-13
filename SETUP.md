# FinTrack — Setup Guide

A multi-user PWA that auto-captures Indian bank transactions from SMS (via iOS Shortcuts) and email (via Google Apps Script), with Supabase Auth for login and an admin dashboard.

---

## 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a **free** project.
2. In **SQL Editor**, run the full contents of `lib/schema.sql`. This creates:
   - `transactions` — with RLS (each user sees only their own rows)
   - `balance_snapshots` — with RLS
   - `wealth_manual` — with RLS; also used as a key-value store for persisting OAuth tokens and manual wealth values
   - `user_profiles` — stores `role: user | admin`
   - A `prevent_role_escalation` trigger that blocks any authenticated client from changing their own role
   - A trigger that auto-creates a profile for every new signup
3. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY`
4. In **Authentication → URL Configuration**, set:
   - **Site URL**: `http://localhost:3000` (for local dev)
   - Add your production domain (e.g. `https://your-site.netlify.app`) to **Redirect URLs** before deploying

> Re-running `schema.sql` on an existing project is safe — all `CREATE` statements are idempotent and RLS policies use `DROP IF EXISTS` before re-creating.

---

## 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
API_SECRET_KEY=pick-any-strong-random-string   # openssl rand -hex 16

# Admin account — created via seed script below
# ADMIN_EMAIL is server-only and never in the client bundle
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=change-me-before-deploying

# Restrict which emails may trigger the SMS/email webhooks (comma-separated).
# If unset, the webhook endpoints return 503.
SMS_WEBHOOK_ALLOWED_EMAILS=you@example.com
EMAIL_WEBHOOK_ALLOWED_EMAILS=you@example.com

# Zerodha (optional)
ZERODHA_API_KEY=
ZERODHA_API_SECRET=

# CoinDCX (optional — credentials are single-tenant)
COINDCX_API_KEY=
COINDCX_API_SECRET=
# Only this email can access the CoinDCX endpoint.
# Falls back to NEXT_PUBLIC_WEALTH_USER_EMAILS if not set.
COINDCX_OWNER_EMAIL=
```

> **Never commit `.env.local` to git** — it's already in `.gitignore`.
>
> Remove any `NEXT_PUBLIC_ADMIN_EMAIL` from old setups — it is no longer used.

---

## 3. Create the Admin User

Run this once after filling in `.env.local`:

```bash
node scripts/seed-admin.mjs
```

This creates the admin account in Supabase Auth and sets `role: admin` in `user_profiles`. If the user already exists, it skips creation and just updates the role.

---

## 4. Netlify Deployment

See [NETLIFY_DEPLOY.md](NETLIFY_DEPLOY.md) for the full guide. Short version:

1. Push this repo to GitHub.
2. Import the project at [netlify.com](https://netlify.com).
3. Build command: `npm run build` | Publish directory: `.next`
4. Add all environment variables from `.env.local` (including webhook allowlists).
5. Deploy. Your live URL will be `https://your-project.netlify.app`.
6. Add your Netlify URL to **Supabase → Authentication → URL Configuration → Redirect URLs**.
7. Run `node scripts/seed-admin.mjs` once pointing at your production Supabase project.

---

## 5. iOS Shortcut — SMS Webhook

This shortcut fires whenever a bank SMS arrives and sends it to FinTrack.

1. Open the **Shortcuts** app on your iPhone.
2. Tap **Automation** → **+** → **Message**.
3. Set **Sender** to your bank's SMS ID (e.g. `HDFCBK`, `ICICIB`, `AXISBK`, `GPAY`).
4. Enable **Run Immediately** (turn off "Ask Before Running").
5. Add action: **Get Contents of URL**
   - URL: `https://your-project.netlify.app/api/sms`
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Body (JSON):
     ```json
     {
       "sms_text": "[Shortcut Input]",
       "api_key": "your-API_SECRET_KEY"
     }
     ```
6. Tap **Done**. Repeat for each bank sender.

> The endpoint only processes requests from emails listed in `SMS_WEBHOOK_ALLOWED_EMAILS`. If that variable is unset, it returns `503`.

---

## 6. Google Apps Script — Gmail Email Polling

1. Open [script.google.com](https://script.google.com) and create a **New Project**.
2. Paste the code below, replacing `WEBHOOK_URL` and `API_KEY` with your values.
3. Run `createTrigger()` once to install the 15-minute polling trigger.
4. Grant Gmail read access + URL fetch permissions when prompted.

```javascript
const WEBHOOK_URL = 'https://your-project.netlify.app/api/email';
const API_KEY = 'your-API_SECRET_KEY';
const PROCESSED_LABEL = 'FinTrack-Processed';

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function pollBankEmails() {
  const label = getOrCreateLabel(PROCESSED_LABEL);
  const queries = [
    'from:(alerts@hdfcbank.com OR noreply@icicibank.com OR alerts@axisbank.com) subject:(alert OR transaction OR debited OR credited) -label:' + PROCESSED_LABEL,
    'subject:(debited OR credited OR transaction alert) -label:' + PROCESSED_LABEL,
  ];
  const processedIds = new Set();
  for (const query of queries) {
    const threads = GmailApp.search(query, 0, 20);
    for (const thread of threads) {
      for (const msg of thread.getMessages()) {
        const id = msg.getId();
        if (processedIds.has(id)) continue;
        processedIds.add(id);
        try {
          UrlFetchApp.fetch(WEBHOOK_URL, {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify({ subject: msg.getSubject(), body: msg.getPlainBody(), api_key: API_KEY }),
            muteHttpExceptions: true,
          });
        } catch (e) { Logger.log('Error: ' + e); }
      }
      thread.addLabel(label);
    }
  }
}

function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pollBankEmails').timeBased().everyMinutes(15).create();
}
```

> The endpoint only processes requests from emails listed in `EMAIL_WEBHOOK_ALLOWED_EMAILS`. If that variable is unset, it returns `503`.

---

## 7. Local Development

```bash
npm install
cp .env.local.example .env.local
# Fill in .env.local
node scripts/seed-admin.mjs   # creates the admin user
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 8. Transaction Categories

| Category   | Use for                           |
|------------|-----------------------------------|
| Food       | Restaurants, groceries, Zomato    |
| Transport  | Uber, Ola, fuel, metro            |
| Shopping   | Amazon, Flipkart, retail          |
| Bills      | Electricity, phone, subscriptions |
| Salary     | Monthly salary credit             |
| Transfer   | NEFT/IMPS transfers               |
| Other      | Everything else                   |

---

## 9. API Reference

All data endpoints require an active session (cookie set by Supabase Auth). The SMS/email webhooks use `api_key` in the request body instead.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/sms` | `api_key` | Ingest bank SMS |
| `POST` | `/api/email` | `api_key` | Ingest bank email |
| `GET` | `/api/transactions` | Session | List transactions (scoped to user) |
| `POST` | `/api/transactions` | Session | Add manual transaction |
| `DELETE` | `/api/transactions/[id]` | Session | Delete transaction |
| `GET` | `/api/balance` | Session | Get balance snapshots |
| `GET` | `/api/auth/is-admin` | Session | Check if caller is admin (server-only `ADMIN_EMAIL`) |
| `GET` | `/api/admin/stats` | Admin session | Platform-wide stats |
| `GET` | `/api/admin/users` | Admin session | List all users |
| `GET` | `/api/wealth/zerodha` | Session | Zerodha equity/ETF holdings with bucket breakdown |
| `GET` | `/api/wealth/zerodha?type=mf` | Session | Zerodha MF holdings with bucket breakdown |
| `GET` | `/api/wealth/coindcx` | Session (`COINDCX_OWNER_EMAIL`) | CoinDCX crypto holdings |
| `GET` | `/api/wealth/indmoney` | Session | INDmoney US stock holdings |
| `GET` | `/api/wealth/manual` | Session | Manual wealth entries |

### GET /api/transactions query params

| Param | Example | Description |
|---|---|---|
| `type` | `income`/`expense` | Filter by type |
| `from` | `2026-05-01` | Start date (inclusive) |
| `to` | `2026-05-31` | End date (inclusive) |
| `limit` | `50` | Max results (default 50) |
