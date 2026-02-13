---
name: "supabase-query"
description: "Executes SQL against Supabase Postgres via MCP. Invoke for ad-hoc SELECT/DDL/DML, seeding, verification, or counts without CLI."
---

# Supabase Query

This skill runs SQL directly against your Supabase Postgres using MCP. Use it when you want to:
- Inspect data quickly (counts, previews)
- Apply idempotent seeds/updates without the CLI
- Create/alter tables, policies, functions
- Verify migrations and dataset versions

## Setup
- Store your Supabase Postgres URL in MCP secrets (recommended)
  - Key suggestion: `SUPABASE_DB_URL`
  - Format: `postgresql://user:password@db.supabase.co:5432/postgres`
- Do NOT put secrets in the repo or .env files

## Usage Guidelines
- Prefer SELECT first to verify assumptions
- For DML/DDL, keep statements idempotent (use `on conflict`, `if not exists`)
- Chunk large inserts (<= 1000 rows per INSERT)
- Wrap multi-step writes in a transaction when appropriate
- Avoid locking heavy tables during peak loads

## Common Queries

Counts:
```sql
select count(*) from makes;
select count(*) from models;
select value from app_config where key='brand_data_version';
```

Upsert app_config version:
```sql
insert into app_config(key,value)
values ('brand_data_version', 12)
on conflict (key) do update set value=excluded.value;
```

Log missing entry (fingerprint should be generated in app code):
```sql
insert into missing_entries (fingerprint, type, make_id, make_name, model_name, platform, page_url, last_seen_at)
values ('<sha256>', 'model', '9', null, 'NewModelX', 'auto1', 'https://...', now())
on conflict (fingerprint) do update set last_seen_at=excluded.last_seen_at;
```

Create simple RLS policy (example):
```sql
alter table missing_entries enable row level security;
create policy missing_entries_insert_authenticated on missing_entries
for insert to authenticated with check (true);
create policy missing_entries_update_authenticated on missing_entries
for update to authenticated using (true) with check (true);
```

Rate limit RPC (reference):
```sql
create or replace function check_rate_limit(action text, max_count int, window_seconds int)
returns boolean language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
  cutoff timestamptz := now() - make_interval(secs => window_seconds);
  n int;
begin
  if uid is null then return false; end if;
  delete from rate_limit_events where ts < now() - interval '1 day';
  select count(*) into n from rate_limit_events
  where user_id = uid and action = check_rate_limit.action and ts >= cutoff;
  if n >= max_count then return false; end if;
  insert into rate_limit_events(user_id, action) values (uid, check_rate_limit.action);
  return true;
end $$;
```

## When to Invoke
- You need quick DB reads/writes without spinning up CLI
- You want to verify migration results or seed integrity
- You want to make scoped schema updates safely with idempotent SQL
