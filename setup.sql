-- UpDate — mise en place de la base Supabase (comptes, progression, thèmes).
-- À coller en entier dans Supabase › SQL Editor › New query, puis « Run ». Peut être relancé sans risque.

-- 1. Progression de chaque compte (fiches lues et apprises, série, révisions, voix).
create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Thèmes préférés de chaque compte.
create table if not exists public.themes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  liked      text[] not null default '{}',
  less       text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- 3. Sécurité : chaque personne ne voit et ne modifie QUE ses propres lignes.
alter table public.progress enable row level security;
alter table public.themes   enable row level security;

drop policy if exists "progress_select_own" on public.progress;
drop policy if exists "progress_insert_own" on public.progress;
drop policy if exists "progress_update_own" on public.progress;
create policy "progress_select_own" on public.progress for select to authenticated using (auth.uid() = user_id);
create policy "progress_insert_own" on public.progress for insert to authenticated with check (auth.uid() = user_id);
create policy "progress_update_own" on public.progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "themes_select_own" on public.themes;
drop policy if exists "themes_insert_own" on public.themes;
drop policy if exists "themes_update_own" on public.themes;
create policy "themes_select_own" on public.themes for select to authenticated using (auth.uid() = user_id);
create policy "themes_insert_own" on public.themes for insert to authenticated with check (auth.uid() = user_id);
create policy "themes_update_own" on public.themes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Totaux anonymes des thèmes, lus par la rédaction de nuit pour choisir les sujets.
--    Ne contient aucune donnée personnelle : seulement un nombre de « J'adore » et de « Moins souvent » par thème.
create or replace function public.theme_totals()
returns table (cat text, liked bigint, less bigint)
language sql stable security definer set search_path = public as $$
  select t.cat,
         count(*) filter (where t.kind = 'liked') as liked,
         count(*) filter (where t.kind = 'less')  as less
  from (
    select unnest(liked) as cat, 'liked' as kind from public.themes
    union all
    select unnest(less)  as cat, 'less'  as kind from public.themes
  ) t
  group by t.cat
  order by liked desc;
$$;
revoke all on function public.theme_totals() from public;
grant execute on function public.theme_totals() to anon, authenticated;

-- 5. Suppression de son propre compte depuis l'application (droit à l'effacement).
--    Supprime le compte et, en cascade, sa progression et ses thèmes.
create or replace function public.delete_my_account()
returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
