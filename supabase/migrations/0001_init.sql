-- Shipment Analyzer -- initial schema
-- Uruchom w Supabase SQL Editor (jednorazowo, na nowym projekcie Supabase Free).

-- ---------------------------------------------------------------------------
-- routes: dane referencyjne (Reference Data module).
-- Mapowanie Chute ID (z raportu Panorama) -> Trasa -> Grupa kafelka.
-- Grupa jest jawną kolumną (nie jest zgadywana z prefiksu trasy), zeby
-- przypisanie kafelka bylo w 100% jawne i edytowalne przez uzytkownika.
-- ---------------------------------------------------------------------------
create table if not exists public.routes (
  id bigint generated always as identity primary key,
  chute_id text not null unique,
  trasa text not null,
  grupa text not null check (grupa in ('P1', 'P2', 'P3')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.routes is
  'Dane referencyjne: Chute ID -> Trasa -> Grupa (P1/P2/P3). Edytowane recznie przez uzytkownika w module Reference Data. Chute ID = COY004 NIE korzysta z tej tabeli (obsluga specjalna w Mapperze).';

-- ---------------------------------------------------------------------------
-- imports: metadane historii importow (audyt), BEZ tresci oryginalnych raportow.
-- Tworzona PRZED shipments, bo shipments.import_id odwoluje sie do niej.
-- ---------------------------------------------------------------------------
create table if not exists public.imports (
  id bigint generated always as identity primary key,
  imported_at timestamptz not null default now(),
  panorama_filename text,
  sherloc_filename text,
  total_rows integer not null default 0,
  matched_rows integer not null default 0,
  unmatched_rows integer not null default 0,
  unmapped_rows integer not null default 0,
  today_rows integer not null default 0,
  group_counts jsonb not null default '{}'::jsonb
);

comment on table public.imports is
  'Metadane kazdego zaakceptowanego importu (liczniki, nazwy plikow). Nie zawiera tresci raportow -- tylko podsumowanie, do wgladu historycznego.';

-- ---------------------------------------------------------------------------
-- shipments: biezacy, zaakceptowany wynik analizy (jeden dzien).
-- Kazdy zaakceptowany import CALKOWICIE zastepuje poprzednia zawartosc
-- tej tabeli (patrz repository: replaceShipments -> delete all + insert).
-- Nie przechowujemy oryginalnych plikow/raportow, tylko wynik joina/mapowania.
-- ---------------------------------------------------------------------------
create table if not exists public.shipments (
  id bigint generated always as identity primary key,
  shipment_id text not null,
  remarks text,
  hwx text,
  last_phy_cp text,
  last_phy_cp_dt timestamptz,
  weight_dimension text,
  shp_calc_wgt numeric,
  consignee_name text,
  chute_id text,
  receiver_name text,
  rcvr_addr1 text,
  rcvr_postcode text,
  rcvr_city text,
  trasa text not null,
  grupa text not null check (grupa in ('P1', 'P2', 'P3', 'COY004')),
  sortujacy text not null,
  import_id bigint references public.imports (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shipments_grupa_idx on public.shipments (grupa);
create index if not exists shipments_sortujacy_idx on public.shipments (grupa, sortujacy);
create index if not exists shipments_shipment_id_idx on public.shipments (shipment_id);

comment on table public.shipments is
  'Wynik biezacego (dzisiejszego) importu po parsowaniu/joinie/mapowaniu. Nadpisywana w calosci przy kazdym zaakceptowanym imporcie. Zrodlo prawdy dla Dashboardu.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- MVP: brak systemu logowania (narzedzie wewnetrzne, jeden uzytkownik).
-- RLS jest wlaczone, a polityki pozwalaja na pelny dostep roli anon/authenticated.
-- Gdy pojawi sie potrzeba wielu uzytkownikow / roznych uprawnien, zastapic
-- ponizsze polityki wersjami opartymi o auth.uid().
-- ---------------------------------------------------------------------------
alter table public.routes enable row level security;
alter table public.shipments enable row level security;
alter table public.imports enable row level security;

drop policy if exists routes_all on public.routes;
create policy routes_all on public.routes
  for all
  using (true)
  with check (true);

drop policy if exists shipments_all on public.shipments;
create policy shipments_all on public.shipments
  for all
  using (true)
  with check (true);

drop policy if exists imports_all on public.imports;
create policy imports_all on public.imports
  for all
  using (true)
  with check (true);

-- updated_at trigger dla routes
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists routes_set_updated_at on public.routes;
create trigger routes_set_updated_at
  before update on public.routes
  for each row
  execute function public.set_updated_at();
