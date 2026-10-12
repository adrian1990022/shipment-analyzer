-- Lista obecnosci sortujacych (2026-10-13, decyzja Adriana).
-- Admin wkleja na ekranie Import kolumne z Excela ("Jan Kowalski_5" =
-- Jan Kowalski wpisal sie na liste 5. dnia miesiaca), aplikacja dopasowuje
-- imie i nazwisko do sorters.full_name i zapisuje tu (sortujacy, dzien).
-- Odczyt: kurier_appp (api/sortujacy.js, kluczem service_role) -- kafelek
-- "Sortujacy" pokazuje sortujacemu jego loopa, czy sie wpisal.
--
-- sorter_attendance_months: do ktorego dnia siegaja dane danego miesiaca
-- (najpozniejszy dzien we wklejce) -- kurier odroznia "brak wpisu" od
-- "jeszcze nie wgrane".
-- Retencja: biezacy + poprzedni miesiac (czyszczone przy kazdym zapisie).

begin;

create table if not exists public.sorter_attendance (
  id bigint generated always as identity primary key,
  sorter_id bigint not null references public.sorters (id) on delete cascade,
  day date not null,
  unique (sorter_id, day)
);

create index if not exists sorter_attendance_day_idx on public.sorter_attendance (day);

comment on table public.sorter_attendance is
  'Lista obecnosci: sortujacy wpisal sie danego dnia. Zapis wylacznie przez import_sorter_attendance (caly miesiac naraz). Retencja: biezacy + poprzedni miesiac.';

create table if not exists public.sorter_attendance_months (
  month date primary key check (month = date_trunc('month', month)::date),
  last_day date not null,
  imported_at timestamptz not null default now(),
  check (date_trunc('month', last_day)::date = month)
);

comment on table public.sorter_attendance_months is
  'Do ktorego dnia siegaja wgrane dane obecnosci w danym miesiacu (najpozniejszy dzien we wklejce).';

alter table public.sorter_attendance enable row level security;
alter table public.sorter_attendance_months enable row level security;

-- Tylko admin (jak sorters/sorter_routes w 0007). Kurier czyta kluczem
-- service_role po sprawdzeniu swojego loopa.
drop policy if exists sorter_attendance_admin_all on public.sorter_attendance;
create policy sorter_attendance_admin_all on public.sorter_attendance
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists sorter_attendance_months_admin_all on public.sorter_attendance_months;
create policy sorter_attendance_months_admin_all on public.sorter_attendance_months
  for all using (public.is_admin()) with check (public.is_admin());

-- Zapis CALEGO miesiaca naraz (wszystko albo nic): usuwa dotychczasowe
-- wpisy miesiaca, wstawia nowe, zapamietuje ostatni dzien danych i czysci
-- dane starsze niz poprzedni miesiac. p_entries: [{"sorterId": 1, "day": 5}].
-- SECURITY INVOKER (domyslne): RLS wyzej -- tylko admin.
create or replace function public.import_sorter_attendance(
  p_month date,
  p_last_day date,
  p_entries jsonb
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_count integer;
begin
  if p_month is null or p_month <> v_month then
    raise exception 'Miesiąc musi być pierwszym dniem miesiąca.';
  end if;
  if p_last_day is null or date_trunc('month', p_last_day)::date <> v_month then
    raise exception 'Ostatni dzień danych musi należeć do wybranego miesiąca.';
  end if;
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Nieprawidłowe dane obecności.';
  end if;

  delete from public.sorter_attendance
  where day >= v_month and day < (v_month + interval '1 month');

  insert into public.sorter_attendance (sorter_id, day)
  select distinct (e->>'sorterId')::bigint, v_month + ((e->>'day')::int - 1)
  from jsonb_array_elements(p_entries) e
  where (e->>'day')::int between 1 and extract(day from p_last_day)::int;
  get diagnostics v_count = row_count;

  insert into public.sorter_attendance_months (month, last_day, imported_at)
  values (v_month, p_last_day, now())
  on conflict (month) do update set last_day = excluded.last_day, imported_at = excluded.imported_at;

  -- Retencja: biezacy + poprzedni miesiac (wzgledem dzisiaj).
  delete from public.sorter_attendance
  where day < (date_trunc('month', current_date) - interval '1 month');
  delete from public.sorter_attendance_months
  where month < (date_trunc('month', current_date) - interval '1 month');

  return v_count;
end;
$$;

revoke execute on function public.import_sorter_attendance(date, date, jsonb) from public, anon;
grant execute on function public.import_sorter_attendance(date, date, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
