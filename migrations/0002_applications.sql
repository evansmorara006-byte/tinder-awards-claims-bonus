create table if not exists applications (
  id         serial primary key,
  user_id    text not null unique,
  country    text not null,
  email      text not null,
  phone      text not null,
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_status_idx on applications (status);

create table if not exists reviewers (
  user_id    text primary key,
  created_at timestamptz not null default now()
);
