-- Zarzadzanie sortujacymi jako osobna relacja, niezalezna od routes.
-- Zastepuje docelowo routes.sortujacy (patrz migracja 0005, ktora usuwa
-- te kolumne PO zmigrowaniu danych przez aplikacje).

create table if not exists public.sorters (
  id bigint generated always as identity primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sorters is
  'Lista sortujacych (osoby). Nazwa jest tym, co widzi uzytkownik na Dashboardzie zamiast surowego numeru/litery.';

-- sorter_routes.route trzyma wartosc routes.trasa. Nie ma tu twardego FK
-- do routes.trasa, bo ta kolumna NIE jest unikalna w routes (kilka bram
-- moze dzielic ta sama trasa) -- Postgres nie pozwala na FK do kolumny
-- bez unique/PK. Spojnosc (route musi istniec w routes.trasa) jest
-- pilnowana w aplikacji: lista rozwijana w UI pokazuje wylacznie wartosci
-- pobrane z routes, nigdy wpisywane recznie.
create table if not exists public.sorter_routes (
  id bigint generated always as identity primary key,
  sorter_id bigint not null references public.sorters (id) on delete cascade,
  route text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.sorter_routes is
  'Przypisanie trasy (routes.trasa) do sortujacego. UNIQUE(route) wymusza regule "jedna trasa = jeden sortujacy".';

create index if not exists sorter_routes_sorter_id_idx on public.sorter_routes (sorter_id);

alter table public.sorters enable row level security;
alter table public.sorter_routes enable row level security;

-- Ta sama polityka co reszta schematu (patrz 0001_init.sql) -- brak
-- logowania w apce, wiec RLS jest otwarte dla klucza anon. Swiadoma,
-- odlozona decyzja (audyt bezpieczenstwa 2026-07-26), nie oversight.
drop policy if exists sorters_all on public.sorters;
create policy sorters_all on public.sorters
  for all
  using (true)
  with check (true);

drop policy if exists sorter_routes_all on public.sorter_routes;
create policy sorter_routes_all on public.sorter_routes
  for all
  using (true)
  with check (true);

drop trigger if exists sorters_set_updated_at on public.sorters;
create trigger sorters_set_updated_at
  before update on public.sorters
  for each row
  execute function public.set_updated_at();
