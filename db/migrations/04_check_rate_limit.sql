create table if not exists rate_limit_events (
  id bigserial primary key,
  user_id uuid not null,
  action text not null,
  ts timestamptz not null default now()
);

create index if not exists rate_limit_events_idx on rate_limit_events (user_id, action, ts);

create or replace function check_rate_limit(action text, max_count int, window_seconds int)
returns boolean
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
  cutoff timestamptz := now() - make_interval(secs => window_seconds);
  n int;
begin
  if uid is null then
    return false;
  end if;
  delete from rate_limit_events where ts < now() - interval '1 day';
  select count(*) into n
  from rate_limit_events
  where user_id = uid
    and action = check_rate_limit.action
    and ts >= cutoff;
  if n >= max_count then
    return false;
  end if;
  insert into rate_limit_events(user_id, action) values (uid, check_rate_limit.action);
  return true;
end;
$$;
