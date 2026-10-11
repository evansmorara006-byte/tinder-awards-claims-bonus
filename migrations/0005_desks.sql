alter table applications add column if not exists desk text not null default '1';
alter table admin_events add column if not exists desk text not null default '1';
