# FinTrack

A mobile-first PWA for tracking Indian bank transactions. Auto-captures debits/credits from SMS (via iOS Shortcuts) and email (via Google Apps Script), with a clean dashboard showing monthly income, expenses, and savings.

Built with **Next.js 14**, **Supabase**, and **Tailwind CSS**.

---

## Features

- Auto-ingest bank SMS messages via iOS Shortcuts
- Auto-ingest bank alert emails via Google Apps Script (polls Gmail every 15 min)
- Manual transaction entry
- Monthly income / expense / savings summary
- Balance reconciliation against actual bank balance
- Filter transactions by type (all / income / expense)
- Installable as a PWA on iPhone
- Optional live portfolio data: Zerodha (equities + MF), CoinDCX (crypto), INDmoney (US stocks)

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
2. Open **SQL Editor** in your project and run the following schema:

```sql
create table transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  transaction_at timestamptz not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('income','expense')),
  category text,
  source text,
  description text,
  raw_text text,
  account_last4 text,
  balance_after numeric(12,2)
);

create table balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  snapshot_at timestamptz not null default now(),
  actual_balance numeric(12,2) not null,
  note text
);

create table wealth_manual (
  key text primary key,
  value numeric(14,2) not null,
  note text,
  updated_at timestamptz not null default now()
);

create index transactions_type_idx on transactions(type);
create index transactions_at_idx on transactions(transaction_at desc);
create index transactions_created_idx on transactions(created_at desc);
```

3. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY`

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

| Variable | Where to get it | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/public key | ✅ |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role key | ✅ |
| `API_SECRET_KEY` | Generate yourself (see below) | ✅ |
| `ZERODHA_API_KEY` | [kite.trade/developers](https://kite.trade/developers) | Optional |
| `ZERODHA_API_SECRET` | Same as above | Optional |
| `COINDCX_API_KEY` | [coindcx.com/api](https://coindcx.com/api) | Optional |
| `COINDCX_API_SECRET` | Same as above | Optional |

**Generate `API_SECRET_KEY`** — this is a shared secret between the app and your iOS Shortcut / Google Apps Script:

```bash
openssl rand -hex 16
```

Paste the output as the value.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel)

1. Push your repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add all four required environment variables in **Settings → Environment Variables**.
4. Deploy. Your live URL will be `https://your-project.vercel.app`.

---

## iOS Shortcut — Auto-capture bank SMS

Set this up to have bank SMS messages automatically sent to FinTrack.

1. Open **Shortcuts** app → **Automation** → **+** → **Message**
2. Set **Sender** to your bank's SMS sender ID (e.g. `SBI`, `SBIINB`, `GPAY`, `HDFCBK`)
3. Enable **Run Immediately** (disable "Ask Before Running")
4. Add action: **Get Contents of URL**
   - URL: `https://your-project.vercel.app/api/sms`
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Body (JSON):
     ```json
     {
       "sms_text": "<Shortcut Input>",
       "api_key": "your-API_SECRET_KEY"
     }
     ```
   Use the **Shortcut Input** variable for `sms_text`.
5. Tap **Done**.

Repeat for each bank sender you want to track.

---

## Google Apps Script — Auto-capture bank emails

This polls your Gmail every 15 minutes for bank alert emails.

1. Open [script.google.com](https://script.google.com) → **New Project**
2. Paste the following code:

```javascript
const WEBHOOK_URL = 'https://your-project.vercel.app/api/email';
const API_KEY = 'your-API_SECRET_KEY';
const PROCESSED_LABEL = 'FinTrack-Processed';

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function pollBankEmails() {
  const label = getOrCreateLabel(PROCESSED_LABEL);
  const queries = [
    'from:(alerts@sbi.co.in OR alerts@hdfcbank.com OR noreply@icicibank.com) subject:(alert OR transaction OR debited OR credited) -label:' + PROCESSED_LABEL,
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
        } catch (e) {
          Logger.log('Error: ' + e);
        }
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

3. Replace `WEBHOOK_URL` and `API_KEY` with your values.
4. Run `createTrigger()` once to install the polling trigger.
5. Grant Gmail read + URL fetch permissions when prompted.

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/sms` | `api_key` | Ingest a bank SMS |
| `POST` | `/api/email` | `api_key` | Ingest a bank email |
| `GET` | `/api/transactions` | None | List transactions |
| `POST` | `/api/transactions` | None | Add a manual transaction |
| `DELETE` | `/api/transactions/[id]` | None | Delete a transaction |

**GET /api/transactions query params**

| Param | Example | Description |
|---|---|---|
| `type` | `income` / `expense` | Filter by type |
| `from` | `2026-05-01` | Start date (inclusive) |
| `to` | `2026-05-31` | End date (inclusive) |
| `limit` | `50` | Max results (default 50) |

---

## Transaction Categories

| Category | Use for |
|---|---|
| Food | Restaurants, groceries, Zomato, Swiggy |
| Transport | Uber, Ola, fuel, metro |
| Shopping | Amazon, Flipkart, retail |
| Bills | Electricity, phone, subscriptions |
| Salary | Monthly salary credit |
| Transfer | NEFT / IMPS transfers |
| Other | Everything else |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (Postgres) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| PWA | next-pwa |
| Deployment | Vercel |
