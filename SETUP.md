# FinTrack — Setup Guide

A free iPhone-compatible PWA that auto-captures Indian bank transactions from SMS (via iOS Shortcuts) and email (via Google Apps Script).

---

## 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a **free** project.
2. In **SQL Editor**, run the schema from `lib/schema.sql`:
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
   create index transactions_type_idx on transactions(type);
   create index transactions_at_idx on transactions(transaction_at desc);
   create index transactions_created_idx on transactions(created_at desc);
   ```
3. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY`

---

## 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
API_SECRET_KEY=pick-any-strong-random-string-32-chars
```

> `API_SECRET_KEY` is a shared secret between your iOS Shortcut / Google Apps Script and the app. Use a strong random value, e.g. output of `openssl rand -hex 16`.

---

## 3. Vercel Deployment

1. Push this repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Add all four environment variables in **Settings → Environment Variables**.
4. Deploy. Your live URL will be `https://your-project.vercel.app`.

---

## 4. iOS Shortcut — SMS Webhook

This shortcut fires whenever a bank SMS arrives and sends it to your app.

### Steps

1. Open the **Shortcuts** app on your iPhone.
2. Tap **Automation** → **+** → **Message**.
3. Set **Sender** to your bank's SMS sender (e.g. `SBI`, `GPAY`, `SBIINB`).
4. Enable "Run Immediately" (turn off "Ask Before Running").
5. Add the following actions:

**Action 1: Get Contents of URL**
- URL: `https://your-project.vercel.app/api/sms`
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body (JSON):
  ```json
  {
    "sms_text": "[Shortcut Input → Shortcut Input]",
    "api_key": "your-API_SECRET_KEY"
  }
  ```
  Use the **Shortcut Input** variable (the SMS message text) for `sms_text`.

6. Tap **Done**.

> Repeat for each bank sender you want to track.

---

## 5. Google Apps Script — Gmail Email Polling

Paste this script in [script.google.com](https://script.google.com) to poll your Gmail for bank alert emails.

```javascript
const WEBHOOK_URL = 'https://your-project.vercel.app/api/email';
const API_KEY = 'your-API_SECRET_KEY';

// Label we apply after processing
const PROCESSED_LABEL = 'FinTrack-Processed';

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function pollBankEmails() {
  const label = getOrCreateLabel(PROCESSED_LABEL);

  // Search for bank alert emails not yet processed
  const queries = [
    'from:(alerts@sbi.co.in OR alerts@hdfcbank.com OR noreply@icicibank.com) subject:(alert OR transaction OR debited OR credited) -label:' + PROCESSED_LABEL,
    'subject:(debited OR credited OR transaction alert) -label:' + PROCESSED_LABEL,
  ];

  const processedIds = new Set();

  for (const query of queries) {
    const threads = GmailApp.search(query, 0, 20);
    for (const thread of threads) {
      const messages = thread.getMessages();
      for (const msg of messages) {
        const id = msg.getId();
        if (processedIds.has(id)) continue;
        processedIds.add(id);

        try {
          const payload = {
            subject: msg.getSubject(),
            body: msg.getPlainBody(),
            api_key: API_KEY,
          };

          const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            muteHttpExceptions: true,
          };

          const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
          Logger.log('Email sent to FinTrack: ' + response.getContentText());
        } catch (e) {
          Logger.log('Error processing email: ' + e);
        }
      }
      thread.addLabel(label);
    }
  }
}

// Set up a time-driven trigger: run every 15 minutes
function createTrigger() {
  // Delete existing triggers first
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pollBankEmails')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('Trigger created — polling every 15 minutes.');
}
```

### Setup Steps

1. Open [script.google.com](https://script.google.com) and create a **New Project**.
2. Paste the code above.
3. Replace `WEBHOOK_URL` and `API_KEY` with your values.
4. Run `createTrigger()` once to install the 15-minute polling trigger.
5. Grant permissions when prompted (Gmail read access + URL fetch).

---

## 6. Local Development

```bash
npm install
cp .env.local.example .env.local
# Fill in .env.local with your Supabase + API key values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 7. Transaction Categories

| Category   | Use for                           |
|------------|-----------------------------------|
| Food       | Restaurants, groceries, Zomato    |
| Transport  | Uber, Ola, fuel, metro             |
| Shopping   | Amazon, Flipkart, retail          |
| Bills      | Electricity, phone, subscriptions |
| Salary     | Monthly salary credit             |
| Transfer   | NEFT/IMPS transfers               |
| Other      | Everything else                   |

---

## 8. API Reference

All endpoints are available at `https://your-app.vercel.app`.

| Method   | Path                        | Auth        | Description              |
|----------|-----------------------------|-------------|--------------------------|
| POST     | `/api/sms`                  | api_key     | Ingest bank SMS          |
| POST     | `/api/email`                | api_key     | Ingest bank email        |
| GET      | `/api/transactions`         | None        | List transactions        |
| POST     | `/api/transactions`         | None        | Add manual transaction   |
| DELETE   | `/api/transactions/[id]`    | None        | Delete transaction       |

### GET /api/transactions query params

| Param  | Example            | Description                  |
|--------|--------------------|------------------------------|
| type   | `income`/`expense` | Filter by type               |
| from   | `2026-05-01`       | Start date (inclusive)       |
| to     | `2026-05-31`       | End date (inclusive)         |
| limit  | `50`               | Max results (default 50)     |
