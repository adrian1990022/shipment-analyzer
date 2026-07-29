-- Krok 2/2 wdrozenia logowania.
--
-- !!! NIE URUCHAMIAC OD RAZU PO 0006 !!!
-- Uruchomic DOPIERO gdy:
--   1) 0006 jest uruchomione,
--   2) kod apki z logowaniem jest wdrozony,
--   3) masz zalozone bootstrap-konto admina (patrz instrukcja) i
--      potwierdziles ze logowanie realnie dziala (widzisz pelny panel).
-- Od momentu uruchomienia tej migracji apka bez logowania przestaje
-- dzialac -- to swiadomy, ostatni krok zamykajacy anonimowy dostep,
-- ktory byl audytowany i celowo odlozony 2026-07-26.

-- routes, imports, sorters, sorter_routes: tylko admin, pelny dostep.
drop policy if exists routes_all on public.routes;
create policy routes_admin_all on public.routes
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists imports_all on public.imports;
create policy imports_admin_all on public.imports
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists sorters_all on public.sorters;
create policy sorters_admin_all on public.sorters
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists sorter_routes_all on public.sorter_routes;
create policy sorter_routes_admin_all on public.sorter_routes
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- shipments: admin ma pelny dostep (import go potrzebuje), zwykly
-- zalogowany user dostaje tylko odczyt (Dashboard).
drop policy if exists shipments_all on public.shipments;

create policy shipments_admin_all on public.shipments
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy shipments_user_select on public.shipments
  for select
  using (auth.uid() is not null);
