create table if not exists public.avatar_personalizations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  avatar_id text not null,
  display_name text not null,
  role text not null,
  image_key text not null,
  voice_enabled boolean not null default true,
  voice_mode text not null default 'push-to-talk',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, avatar_id),
  constraint avatar_personalizations_name_length check (char_length(trim(display_name)) between 1 and 40),
  constraint avatar_personalizations_voice_mode check (voice_mode in ('push-to-talk', 'listening'))
);

create index if not exists avatar_personalizations_user_idx
  on public.avatar_personalizations (user_id, updated_at desc);

drop trigger if exists set_avatar_personalizations_updated_at on public.avatar_personalizations;
create trigger set_avatar_personalizations_updated_at
before update on public.avatar_personalizations
for each row execute function public.set_updated_at();

alter table public.avatar_personalizations enable row level security;

drop policy if exists avatar_personalizations_select_own on public.avatar_personalizations;
create policy avatar_personalizations_select_own
on public.avatar_personalizations for select to authenticated
using (auth.uid() = user_id);

drop policy if exists avatar_personalizations_insert_own on public.avatar_personalizations;
create policy avatar_personalizations_insert_own
on public.avatar_personalizations for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists avatar_personalizations_update_own on public.avatar_personalizations;
create policy avatar_personalizations_update_own
on public.avatar_personalizations for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists avatar_personalizations_delete_own on public.avatar_personalizations;
create policy avatar_personalizations_delete_own
on public.avatar_personalizations for delete to authenticated
using (auth.uid() = user_id);
