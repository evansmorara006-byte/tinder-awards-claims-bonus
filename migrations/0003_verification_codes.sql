alter table applications add column if not exists email_verified boolean not null default false;
alter table applications add column if not exists phone_verified boolean not null default false;
alter table applications add column if not exists email_code text;
alter table applications add column if not exists phone_code text;
