# FinTrack

**FinTrack** is a personal finance tracker built for Indian bank accounts. It automatically captures every debit and credit — from SMS alerts on your phone and email notifications in your inbox — so you never have to enter transactions manually. Everything flows into a clean dashboard where you can see exactly where your money is going each month.

Beyond day-to-day spending, FinTrack also aggregates your investment portfolio across Zerodha (stocks & mutual funds), CoinDCX (crypto), and INDmoney (US stocks) into a single wealth view, giving you a complete picture of your net financial position.

The app is **multi-user** with full Supabase Auth — each user sees only their own data. An admin dashboard lets you manage users and view platform-wide stats.

The app is installable on iPhone as a PWA and works offline — local data is kept in sync with the cloud database whenever connectivity is restored.

---

## What it does

| | |
|---|---|
| **Auto-capture transactions** | Bank SMS messages (via iOS Shortcuts) and alert emails (via Gmail polling) are parsed and saved automatically — no manual entry needed. |
| **Spending dashboard** | Monthly breakdown of income, expenses, and savings with category-level filtering. |
| **Balance reconciliation** | Compare the app's running balance against your actual bank balance to catch discrepancies. |
| **Portfolio aggregation** | Live holdings from Zerodha, CoinDCX, and INDmoney in one place. |
| **Manual fallback** | Add, edit, or delete transactions yourself when auto-capture isn't available. |
| **Excel import/export** | Bulk-upload historical transactions or export your data for external analysis. |
| **Multi-user auth** | Each user logs in with email/password (Supabase Auth). Row-level security ensures complete data isolation. |
| **Admin dashboard** | Manage users, promote/demote roles, view platform stats at `/admin`. |

---

## Features

### Authentication

Login and registration use Supabase Auth (email + password). A password-reset flow is included. On first deploy, seed the admin account:

```bash
node scripts/seed-admin.mjs
```

`ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env.local` control which account gets the `admin` role. Once logged in as admin, visit `/admin`.

---

### Transactions

Every debit and credit from your bank appears here, grouped by date with "Today" / "Yesterday" labels. Each entry shows the category (with emoji), a note, and the INR amount — with a daily P&L line so you can see net cash flow at a glance. The list loads 20 at a time with a **Load more** button showing how many remain.

**Adding a transaction**
- Toggle between **Expense** and **Income**
- Enter an amount — a live INR preview formats it as you type
- Pick a category from grouped pills (Needs / Wants / Investments / Income)
- Add an optional note and set the date (defaults to today)

Duplicate detection warns before saving if the same date + amount + category already exists.

**Filtering**
| Filter | Options |
|---|---|
| **Type** | All · Expense · Income |
| **Category** | Group-level or individual sub-category pill |
| **Date range** | Today · This Week · This Month · This Year · Custom range · All Time |
| **Search** | Free-text across notes, sub-category, and category |

---

### Wealth

A portfolio aggregator that pulls live data from multiple sources:

| Source | What's shown |
|---|---|
| **Zerodha Kite** | Equity stocks, ETFs (gold / silver / foreign) |
| **Zerodha Coin** | Mutual funds (equity / gold / silver / debt) |
| **CoinDCX** | Crypto holdings |
| **INDmoney** | US stocks (via OAuth) |
| **Manual entries** | Bank balance, cash, FDs, PF, bonds, credit card due, liabilities |

The hero card shows **Net Worth** with Assets, Liabilities, and Invested as sub-stats, plus a donut chart and P&L bar chart per asset class.

---

### Admin Dashboard (`/admin`)

Accessible only to users with `role: admin` in `user_profiles`:
- Platform stats — total users, total transactions, recent signups
- User table — list all registered users with email, role, and join date
- Role management — promote or demote users

---

### Export to Excel

| Mode | Sheets generated |
|---|---|
| **Transactions** | Full ledger · Category breakdown · Monthly trend |
| **Wealth** | Net worth · P&L per asset · Asset allocation |
| **Both** | All six sheets combined |

Generated client-side — no server round-trip needed.

---

### Light / Dark Mode

Toggle in the top-right header. Preference saved to `localStorage`. CSS variables on the root element flip instantly — no page reload.

---

### Auto-capture & PWA

- **iOS Shortcuts** — bank SMS alerts forwarded automatically
- **Google Apps Script** — polls Gmail every 15 minutes
- **Installable PWA** — Add to Home Screen on iPhone
- **Offline support** — transactions cached in `localStorage`, sync to Supabase on reconnect

---

## Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) account
- npm or yarn

---

## Local Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd finance_management
npm install
```

### 2. Supabase — create the database

1. Go to [supabase.com](https://supabase.com) and create a **free** project.
2. Open **SQL Editor** and run the full contents of `lib/schema.sql`. This creates:
   - `transactions`, `balance_snapshots`, `wealth_manual` — all with RLS (each user sees only their own rows)
   - `user_profiles` — stores `role: user | admin`
   - A trigger that auto-creates a profile on every new signup
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY`
4. Go to **Authentication → URL Configuration** and set:
   - **Site URL**: `http://localhost:3000`
   - Add your production domain to **Redirect URLs** before deploying

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

| Variable | Where to get it | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | ✅ |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API | ✅ |
| `API_SECRET_KEY` | `openssl rand -hex 16` | ✅ |
| `ADMIN_EMAIL` | Email address for the admin account | ✅ |
| `ADMIN_PASSWORD` | Password for the admin account — change before deploying | ✅ |
| `SMS_WEBHOOK_ALLOWED_EMAILS` | Comma-separated emails that may trigger the SMS webhook | Optional |
| `EMAIL_WEBHOOK_ALLOWED_EMAILS` | Comma-separated emails that may trigger the email webhook | Optional |
| `ZERODHA_API_KEY` | [kite.trade/developers](https://kite.trade/developers) | Optional |
| `ZERODHA_API_SECRET` | Same as above | Optional |
| `COINDCX_API_KEY` | [coindcx.com/api](https://coindcx.com/api) | Optional |
| `COINDCX_API_SECRET` | Same as above | Optional |
| `COINDCX_OWNER_EMAIL` | Email of the user who owns the CoinDCX account | Optional |

### 4. Create the admin user

```bash
node scripts/seed-admin.mjs
```

Reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local` and creates the user in Supabase Auth with `role: admin`.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your admin credentials.

---

## Deployment (Netlify)

See [NETLIFY_DEPLOY.md](NETLIFY_DEPLOY.md) for the full step-by-step guide.

Quick summary:
1. Push to GitHub
2. Import at netlify.com → build command `npm run build`, publish dir `.next`
3. Add all env variables (including `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
4. Deploy
5. Run `node scripts/seed-admin.mjs` once pointing at your production Supabase project
6. In Supabase → Authentication → URL Configuration, add your Netlify URL to Redirect URLs

---

## iOS Shortcut — Auto-capture bank SMS

1. **Shortcuts** app → **Automation** → **+** → **Message**
2. Set **Sender** to your bank's SMS ID (e.g. `HDFCBK`, `ICICIB`, `AXISBK`, `GPAY`)
3. Enable **Run Immediately** (disable "Ask Before Running")
4. Add action: **Get Contents of URL**
   - URL: `https://your-project.netlify.app/api/sms`
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     { "sms_text": "<Shortcut Input>", "api_key": "your-API_SECRET_KEY" }
     ```
5. Tap **Done**. Repeat for each bank sender.

---

## Google Apps Script — Auto-capture bank emails

1. Open [script.google.com](https://script.google.com) → **New Project**
2. Paste:

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

3. Replace `WEBHOOK_URL` and `API_KEY`. Run `createTrigger()` once. Grant permissions.

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/sms` | `api_key` | Ingest a bank SMS |
| `POST` | `/api/email` | `api_key` | Ingest a bank email |
| `GET` | `/api/transactions` | Session | List transactions (scoped to user) |
| `POST` | `/api/transactions` | Session | Add a manual transaction |
| `DELETE` | `/api/transactions/[id]` | Session | Delete a transaction |
| `GET` | `/api/balance` | Session | Get balance snapshots |
| `GET` | `/api/auth/is-admin` | Session | Check if caller is admin |
| `GET` | `/api/admin/stats` | Admin session | Platform-wide stats |
| `GET` | `/api/admin/users` | Admin session | List all users |

**GET /api/transactions query params**

| Param | Example | Description |
|---|---|---|
| `type` | `income` / `expense` | Filter by type |
| `from` | `2026-05-01` | Start date (inclusive) |
| `to` | `2026-05-31` | End date (inclusive) |
| `limit` | `50` | Max results (default 50) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | Supabase Auth (email/password + sessions) |
| Database | Supabase (Postgres + Row Level Security) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| PWA | next-pwa |
| Deployment | Netlify |
