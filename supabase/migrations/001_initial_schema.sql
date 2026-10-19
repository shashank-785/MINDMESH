-- MindMesh initial Supabase/PostgreSQL schema.
--
-- This migration expects Supabase Auth's auth.users table. It is safe to run
-- again after a partial local reset: tables, indexes, triggers, and policies
-- are created idempotently where PostgreSQL supports it.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (username is null or char_length(trim(username)) between 2 and 40),
  constraint profiles_display_name_length check (display_name is null or char_length(trim(display_name)) between 1 and 120),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 2000),
  constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2000)
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'system',
  language text not null default 'en',
  timezone text not null default 'UTC',
  notifications_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_theme check (theme in ('light', 'dark', 'system')),
  constraint user_preferences_language_length check (char_length(trim(language)) between 2 and 20),
  constraint user_preferences_timezone_length check (char_length(trim(timezone)) between 1 and 80)
);

create table if not exists public.avatar_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  selected_avatar_id text not null default 'challenger',
  voice_enabled boolean not null default true,
  auto_match_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avatar_preferences_avatar_id_length check (char_length(trim(selected_avatar_id)) between 1 and 80)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  avatar_id text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint conversations_avatar_id_length check (char_length(trim(avatar_id)) between 1 and 80),
  constraint conversations_title_length check (title is null or char_length(title) <= 200)
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_role check (role in ('user', 'assistant', 'system')),
  constraint messages_content_length check (char_length(trim(content)) between 1 and 20000)
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create table if not exists public.thoughts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint thoughts_text_length check (char_length(trim(text)) between 1 and 2000)
);

create index if not exists thoughts_user_created_idx
  on public.thoughts (user_id, created_at desc);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text,
  target_count integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missions_slug_length check (char_length(trim(slug)) between 1 and 100),
  constraint missions_title_length check (char_length(trim(title)) between 1 and 200),
  constraint missions_description_length check (description is null or char_length(description) <= 4000),
  constraint missions_target_count_positive check (target_count > 0)
);

create index if not exists missions_active_idx
  on public.missions (is_active, created_at desc);

create table if not exists public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_on date not null default current_date,
  completed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_completions_unique_day unique (mission_id, user_id, completed_on)
);

create index if not exists mission_completions_user_completed_idx
  on public.mission_completions (user_id, completed_at desc);

create index if not exists mission_completions_mission_idx
  on public.mission_completions (mission_id, completed_on desc);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  icon text,
  criteria jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint achievements_slug_length check (char_length(trim(slug)) between 1 and 100),
  constraint achievements_title_length check (char_length(trim(title)) between 1 and 200),
  constraint achievements_description_length check (description is null or char_length(description) <= 4000),
  constraint achievements_icon_length check (icon is null or char_length(icon) <= 120)
);

create index if not exists achievements_active_idx
  on public.achievements (is_active, created_at desc);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_achievements_unique unique (user_id, achievement_id)
);

create index if not exists user_achievements_user_unlocked_idx
  on public.user_achievements (user_id, unlocked_at desc);

create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_history_type_length check (char_length(trim(activity_type)) between 1 and 120),
  constraint activity_history_entity_type_length check (entity_type is null or char_length(trim(entity_type)) between 1 and 120)
);

create index if not exists activity_history_user_occurred_idx
  on public.activity_history (user_id, occurred_at desc);

create index if not exists activity_history_entity_idx
  on public.activity_history (entity_type, entity_id)
  where entity_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_avatar_preferences_updated_at on public.avatar_preferences;
create trigger set_avatar_preferences_updated_at
before update on public.avatar_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists set_messages_updated_at on public.messages;
create trigger set_messages_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

drop trigger if exists set_thoughts_updated_at on public.thoughts;
create trigger set_thoughts_updated_at
before update on public.thoughts
for each row execute function public.set_updated_at();

drop trigger if exists set_missions_updated_at on public.missions;
create trigger set_missions_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

drop trigger if exists set_mission_completions_updated_at on public.mission_completions;
create trigger set_mission_completions_updated_at
before update on public.mission_completions
for each row execute function public.set_updated_at();

drop trigger if exists set_achievements_updated_at on public.achievements;
create trigger set_achievements_updated_at
before update on public.achievements
for each row execute function public.set_updated_at();

drop trigger if exists set_user_achievements_updated_at on public.user_achievements;
create trigger set_user_achievements_updated_at
before update on public.user_achievements
for each row execute function public.set_updated_at();

drop trigger if exists set_activity_history_updated_at on public.activity_history;
create trigger set_activity_history_updated_at
before update on public.activity_history
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
begin
  profile_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))), '');

  insert into public.profiles (id, display_name)
  values (new.id, profile_name)
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.avatar_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill the defaults for Auth users that already existed before this
-- migration was applied. New users are handled by the trigger above.
insert into public.profiles (id, display_name)
select
  users.id,
  nullif(trim(coalesce(users.raw_user_meta_data ->> 'display_name', split_part(coalesce(users.email, ''), '@', 1))), '')
from auth.users as users
on conflict (id) do nothing;

insert into public.user_preferences (user_id)
select profiles.id
from public.profiles
on conflict (user_id) do nothing;

insert into public.avatar_preferences (user_id)
select profiles.id
from public.profiles
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.avatar_preferences enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.thoughts enable row level security;
alter table public.missions enable row level security;
alter table public.mission_completions enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.activity_history enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select to authenticated
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
on public.profiles for delete to authenticated
using (auth.uid() = id);

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
on public.user_preferences for select to authenticated
using (auth.uid() = user_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
on public.user_preferences for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
on public.user_preferences for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_preferences_delete_own on public.user_preferences;
create policy user_preferences_delete_own
on public.user_preferences for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists avatar_preferences_select_own on public.avatar_preferences;
create policy avatar_preferences_select_own
on public.avatar_preferences for select to authenticated
using (auth.uid() = user_id);

drop policy if exists avatar_preferences_insert_own on public.avatar_preferences;
create policy avatar_preferences_insert_own
on public.avatar_preferences for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists avatar_preferences_update_own on public.avatar_preferences;
create policy avatar_preferences_update_own
on public.avatar_preferences for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists avatar_preferences_delete_own on public.avatar_preferences;
create policy avatar_preferences_delete_own
on public.avatar_preferences for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own
on public.conversations for select to authenticated
using (auth.uid() = user_id);

drop policy if exists conversations_insert_own on public.conversations;
create policy conversations_insert_own
on public.conversations for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists conversations_update_own on public.conversations;
create policy conversations_update_own
on public.conversations for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists conversations_delete_own on public.conversations;
create policy conversations_delete_own
on public.conversations for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own
on public.messages for select to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own
on public.messages for insert to authenticated
with check (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own
on public.messages for update to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own
on public.messages for delete to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);

drop policy if exists thoughts_select_own on public.thoughts;
create policy thoughts_select_own
on public.thoughts for select to authenticated
using (auth.uid() = user_id);

drop policy if exists thoughts_insert_own on public.thoughts;
create policy thoughts_insert_own
on public.thoughts for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists thoughts_update_own on public.thoughts;
create policy thoughts_update_own
on public.thoughts for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists thoughts_delete_own on public.thoughts;
create policy thoughts_delete_own
on public.thoughts for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists missions_select_active on public.missions;
create policy missions_select_active
on public.missions for select to authenticated
using (is_active = true);

drop policy if exists mission_completions_select_own on public.mission_completions;
create policy mission_completions_select_own
on public.mission_completions for select to authenticated
using (auth.uid() = user_id);

drop policy if exists mission_completions_insert_own on public.mission_completions;
create policy mission_completions_insert_own
on public.mission_completions for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists mission_completions_update_own on public.mission_completions;
create policy mission_completions_update_own
on public.mission_completions for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists mission_completions_delete_own on public.mission_completions;
create policy mission_completions_delete_own
on public.mission_completions for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists achievements_select_active on public.achievements;
create policy achievements_select_active
on public.achievements for select to authenticated
using (is_active = true);

drop policy if exists user_achievements_select_own on public.user_achievements;
create policy user_achievements_select_own
on public.user_achievements for select to authenticated
using (auth.uid() = user_id);

drop policy if exists user_achievements_insert_own on public.user_achievements;
create policy user_achievements_insert_own
on public.user_achievements for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_achievements_update_own on public.user_achievements;
create policy user_achievements_update_own
on public.user_achievements for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_achievements_delete_own on public.user_achievements;
create policy user_achievements_delete_own
on public.user_achievements for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists activity_history_select_own on public.activity_history;
create policy activity_history_select_own
on public.activity_history for select to authenticated
using (auth.uid() = user_id);

drop policy if exists activity_history_insert_own on public.activity_history;
create policy activity_history_insert_own
on public.activity_history for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists activity_history_update_own on public.activity_history;
create policy activity_history_update_own
on public.activity_history for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists activity_history_delete_own on public.activity_history;
create policy activity_history_delete_own
on public.activity_history for delete to authenticated
using (auth.uid() = user_id);
