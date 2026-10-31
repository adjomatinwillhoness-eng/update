-- UpDate — notifications du matin (à exécuter une fois dans Supabase › SQL Editor, après setup.sql).
-- Chaque appareil abonné est une ligne. Chaque personne ne voit et ne gère que ses propres appareils.
-- Le programme d'envoi (GitHub Actions) lit cette table avec la clé « service_role », gardée dans les secrets GitHub.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
drop policy if exists "push_insert_own" on public.push_subscriptions;
drop policy if exists "push_update_own" on public.push_subscriptions;
drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "push_insert_own" on public.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
create policy "push_update_own" on public.push_subscriptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_delete_own" on public.push_subscriptions for delete to authenticated using (auth.uid() = user_id);
