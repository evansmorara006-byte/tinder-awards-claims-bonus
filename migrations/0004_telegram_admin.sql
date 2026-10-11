create table if not exists login_approvals (
  user_id    text primary key,
  status     text not null default 'pending',
  label      text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists admin_events (
  id                   serial primary key,
  user_id              text not null,
  kind                 text not null,
  detail               text not null,
  status               text not null default 'pending',
  telegram_message_id  text,
  created_at           timestamptz not null default now()
);

create unique index if not exists admin_events_one_pending_idx
  on admin_events (user_id, kind)
  where status = 'pending';


create table if not exists telegram_state (
  id            integer primary key,
  update_offset bigint not null default 0
);

insert into telegram_state (id, update_offset)
values (1, 0)
on conflict (id) do nothing;

alter table applications add column if not exists email_code_pending boolean not null default false;
alter table applications add column if not exists phone_code_pending boolean not null default false;
