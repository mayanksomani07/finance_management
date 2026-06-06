create table transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  transaction_at timestamptz not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('income','expense')),
  category text,
  source text,  -- 'sbi', 'gpay', 'mobikwik', 'neft', 'manual', 'email', 'unknown'
  description text,
  raw_text text,
  account_last4 text,
  balance_after numeric(12,2)
);

-- Balance snapshots: user enters their real bank balance at a point in time
create table balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  snapshot_at timestamptz not null default now(),
  actual_balance numeric(12,2) not null,
  note text
);

-- Index for common queries
create index transactions_type_idx on transactions(type);
create index transactions_at_idx on transactions(transaction_at desc);
create index transactions_created_idx on transactions(created_at desc);

-- Wealth manual entries: one row per key (upserted on update)
create table wealth_manual (
  key text primary key,
  value numeric(14,2) not null,
  note text,
  updated_at timestamptz not null default now()
);
