create table if not exists makes (
  id text primary key,
  name text not null unique
);

create table if not exists models (
  id text primary key,
  make_id text not null references makes(id) on delete cascade,
  name text not null
);

create index if not exists models_make_id_idx on models (make_id);
