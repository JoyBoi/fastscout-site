create table if not exists missing_entries (
  fingerprint text primary key,
  type text not null check (type in ('brand','model')),
  make_id text,
  make_name text,
  model_name text,
  platform text,
  page_url text,
  last_seen_at timestamptz not null default now()
);

alter table missing_entries enable row level security;

create policy missing_entries_insert_authenticated on missing_entries
  for insert
  to authenticated
  with check (true);

create policy missing_entries_update_authenticated on missing_entries
  for update
  to authenticated
  using (true)
  with check (true);
