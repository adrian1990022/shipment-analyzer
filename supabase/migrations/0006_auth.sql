-- Krok 1/2 wdrozenia logowania: tabela profiles + funkcja is_admin().
-- CELOWO nie rusza RLS na routes/shipments/imports/sorters/sorter_routes
-- -- te zostaja "using (true)" do czasu migracji 0007, ktora idzie
-- DOPIERO po potwierdzeniu ze logowanie realnie dziala (patrz plan:
-- logowanie i panel uzytkownikow trzeba przetestowac zanim zamkniemy
-- anonimowy dostep, zeby nie zablokowac sobie calej apki).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profil uzytkownika (login + rola) powiazany 1:1 z auth.users. Kasowanie konta Auth kasuje profil (on delete cascade).';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- security definer + ustawiony search_path: funkcja dziala z
-- uprawnieniami wlasciciela (omija RLS przy wlasnym zapytaniu do
-- profiles), inaczej polityka na profiles sprawdzajaca role przez SELECT
-- z profiles rekurencyjnie wywolywalaby sama siebie.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select
  using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select
  using (public.is_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert
  with check (public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete
  using (public.is_admin());
