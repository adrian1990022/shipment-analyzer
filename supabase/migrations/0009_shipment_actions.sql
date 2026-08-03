-- Sprint UX 1.1: operacyjny stan "obsluzono" per przesylka+dzien.
--
-- Celowo NIE jest kolumna w shipments -- shipments jest nadpisywane w
-- calosci przy kazdym imporcie (patrz shipmentsRepository.replaceShipments),
-- a ten stan ma przetrwac reimport tego samego dnia. Powiazanie z shipments
-- jest logiczne (po shipment_id + shipment_date), nie kluczem obcym.
--
-- Brak historii: wpisy sprzed biezacego dnia sa usuwane przy pierwszym
-- zaakceptowanym imporcie nowego dnia (shipmentActionRepository.pruneShipmentActions,
-- wolane z ImportScreen po kazdym udanym imporcie -- pierwsze wywolanie danego
-- dnia realnie czysci, kolejne tego samego dnia sa no-opem).
create table if not exists public.shipment_actions (
  id bigint generated always as identity primary key,
  shipment_id text not null,
  shipment_date date not null,
  handled boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (shipment_id, shipment_date)
);

comment on table public.shipment_actions is
  'Operacyjny stan "ktos juz to obsluguje" per przesylka+dzien (Sprint UX 1.1). Powiazanie z shipments po shipment_id+shipment_date, nie FK-iem. Brak historii -- stare wpisy usuwane przy pierwszym imporcie nowego dnia.';

alter table public.shipment_actions enable row level security;

-- Least-privilege, spojne z 0007 (shipments_admin_all + shipments_user_select):
-- admin ma pelny dostep (w tym delete, potrzebny do pruningu), zwykly
-- zalogowany "user" (operator na hali) moze czytac/tworzyc/aktualizowac
-- (przelaczac Switch), ale NIE usuwac -- pruneShipmentActions jest wolane
-- wylacznie z ImportScreen, ktory i tak jest w <AdminRoute>.
create policy shipment_actions_admin_all on public.shipment_actions
  for all using (public.is_admin()) with check (public.is_admin());

create policy shipment_actions_user_select on public.shipment_actions
  for select using (auth.uid() is not null);

create policy shipment_actions_user_insert on public.shipment_actions
  for insert with check (auth.uid() is not null);

create policy shipment_actions_user_update on public.shipment_actions
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- set_updated_at() zdefiniowane juz w 0001_init.sql -- odpala sie tez przy
-- ON CONFLICT DO UPDATE z upsertu (setHandled).
create trigger shipment_actions_set_updated_at
  before update on public.shipment_actions
  for each row
  execute function public.set_updated_at();
