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

-- Renouvellement automatique d'un abonnement (appelé par l'application quand le navigateur change l'adresse d'envoi).
-- Il faut connaître l'ancienne adresse d'envoi, secrète et propre à l'appareil, pour la remplacer.
create or replace function public.rotate_push(old_endpoint text, new_endpoint text, new_p256dh text, new_auth text)
returns void language sql security definer set search_path = public as $$
  update public.push_subscriptions
     set endpoint = new_endpoint, p256dh = new_p256dh, auth = new_auth
   where endpoint = old_endpoint
     and not exists (select 1 from public.push_subscriptions where endpoint = new_endpoint);
$$;
revoke all on function public.rotate_push(text, text, text, text) from public;
grant execute on function public.rotate_push(text, text, text, text) to anon, authenticated;
