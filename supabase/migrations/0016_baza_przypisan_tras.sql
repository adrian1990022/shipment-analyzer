-- Baza przypisan tras (2026-10-21, decyzja Adriana): trasa przesylki
-- pochodzi z pliku Excel "Route | AWB/BkgRef" (Shipment ID z Panoramy =
-- AWB/BkgRef), a NIE z Chute ID. Dotyczy wszystkich przesylek importu
-- (kazda przesylka z Panoramy to przesylka niezeskanowana) w obu
-- aplikacjach -- shipment i kurier_appp (wspolny pipeline, mapRoutes.ts).
--
--   route_assignments      -- aktywna baza: numer przesylki -> trasa,
--   route_assignment_meta  -- jeden wiersz: kiedy/skad/ile wgrano,
--   replace_route_assignments -- podmiana CALEJ bazy w jednej transakcji
--                              (wszystko albo nic -- blad = stara baza
--                              zostaje nietknieta, patrz nizej),
--   shipments.przypisanie  -- skad trasa przesylki: baza / brak_w_bazie /
--                             nieznana_trasa (NULL = import sprzed 0016),
--   grupa NIEPRZYPISANE    -- kafelek przesylek bez trasy z bazy albo z
--                             trasa spoza tabeli routes,
--   import_shipments       -- dodatkowo zapisuje przypisanie i BLOKUJE
--                             import bez bazy albo z baza nie z dzisiaj
--                             (czas polski) -- druga linia obrony, ta sama
--                             regula jest w analyzeImport.ts.
--
-- KOLEJNOSC WDROZENIA: ta migracja PRZED kodem. Od jej uruchomienia import
-- przesylek wymaga dzisiejszej bazy -- do wdrozenia nowego kodu (ktory
-- pozwala ja wgrac) import jest zablokowany. Stary kod nie wysyla
-- "przypisanie" -- kolumna przyjmuje wtedy NULL, wiec nic sie nie psuje.

begin;

-- ---------------------------------------------------------------------
-- Baza przypisan
-- ---------------------------------------------------------------------

create table if not exists public.route_assignments (
  awb text primary key check (awb <> '' and length(awb) <= 64),
  route text not null check (route <> '' and length(route) <= 16)
);

comment on table public.route_assignments is
  'Aktywna baza przypisan tras: numer przesylki (AWB/BkgRef = Panorama Shipment ID, znormalizowany jak normalizeJoinKey) -> trasa. Zapis wylacznie przez replace_route_assignments (cala baza naraz).';

create table if not exists public.route_assignment_meta (
  id boolean primary key default true check (id),
  uploaded_at timestamptz not null default now(),
  filename text,
  record_count integer not null,
  zrodlo text not null check (zrodlo in ('shipment', 'kurier'))
);

comment on table public.route_assignment_meta is
  'Jeden wiersz: kiedy, z jakiego pliku i z ktorej aplikacji wgrano aktywna baze przypisan tras oraz ile ma rekordow.';

alter table public.route_assignments enable row level security;
alter table public.route_assignment_meta enable row level security;

-- Tylko admin shipment (jak routes/sorters w 0007). kurier_appp czyta i
-- zapisuje kluczem service_role po sprawdzeniu, ze wywolujacy jest adminem
-- kuriera (api/baza-tras.js, api/shipment-import.js).
drop policy if exists route_assignments_admin_all on public.route_assignments;
create policy route_assignments_admin_all on public.route_assignments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists route_assignment_meta_admin_all on public.route_assignment_meta;
create policy route_assignment_meta_admin_all on public.route_assignment_meta
  for all using (public.is_admin()) with check (public.is_admin());

-- Anonimowy klient nie ma tu nic do roboty -- RLS i tak by go zatrzymal,
-- ale Supabase nadaje anon uprawnienia do nowych tabel domyslnie.
revoke all on public.route_assignments from anon;
revoke all on public.route_assignment_meta from anon;

-- Podmiana CALEJ bazy (decyzja Adriana: kazde poprawne wgranie zastepuje
-- poprzednia baze). Jedna funkcja = jedna transakcja: dopoki sie nie
-- zatwierdzi, wszyscy widza stara baze; KAZDY blad (walidacja, RLS,
-- ograniczenia) cofa calosc, wiec stara baza zostaje nietknieta.
--
-- p_rows: [{"awb": "...", "route": "..."}]. Walidacja tutaj NIEZALEZNIE od
-- przegladarki (parseRouteBase.ts) -- ta sama normalizacja:
--   awb   -- bez bialych znakow, wielkie litery (= normalizeJoinKey),
--   route -- bez bialych znakow na brzegach, wielkie litery.
-- Pusta wartosc = blad. Ten sam numer z ROZNYMI trasami = blad (konflikt,
-- nie wybieramy trasy arbitralnie). Identyczne pary scalane w jedna.
--
-- SECURITY INVOKER (domyslne): RLS wyzej -- zwykly uzytkownik shipment nie
-- podmieni bazy takze przez te funkcje.
create or replace function public.replace_route_assignments(
  p_filename text,
  p_rows jsonb,
  p_zrodlo text
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
  v_conflicts integer;
  v_empty integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Baza przypisań tras jest pusta — nic nie zapisano.';
  end if;
  if jsonb_array_length(p_rows) > 20000 then
    raise exception 'Baza przypisań tras ma za dużo wierszy (maks. 20 000).';
  end if;
  if p_zrodlo is null or p_zrodlo not in ('shipment', 'kurier') then
    raise exception 'Nieprawidłowe źródło wgrania bazy.';
  end if;

  select count(*) into v_empty
  from jsonb_to_recordset(p_rows) as x(awb text, route text)
  where coalesce(regexp_replace(x.awb, '\s', '', 'g'), '') = ''
     or coalesce(regexp_replace(x.route, '^\s+|\s+$', '', 'g'), '') = '';
  if v_empty > 0 then
    raise exception 'Baza przypisań tras: % wierszy z pustym numerem przesyłki lub trasą — nic nie zapisano.', v_empty;
  end if;

  select count(*) into v_conflicts
  from (
    select upper(regexp_replace(x.awb, '\s', '', 'g')) as awb
    from jsonb_to_recordset(p_rows) as x(awb text, route text)
    group by 1
    having count(distinct upper(regexp_replace(x.route, '^\s+|\s+$', '', 'g'))) > 1
  ) c;
  if v_conflicts > 0 then
    raise exception 'Baza przypisań tras: % numerów przesyłek ma przypisane różne trasy — nic nie zapisano.', v_conflicts;
  end if;

  -- "awb is not null" zamiast braku WHERE: Supabase (safeupdate) blokuje
  -- DELETE bez warunku -- patrz 0008.
  delete from public.route_assignments where awb is not null;

  insert into public.route_assignments (awb, route)
  select distinct
    upper(regexp_replace(x.awb, '\s', '', 'g')),
    upper(regexp_replace(x.route, '^\s+|\s+$', '', 'g'))
  from jsonb_to_recordset(p_rows) as x(awb text, route text);
  get diagnostics v_count = row_count;

  insert into public.route_assignment_meta (id, uploaded_at, filename, record_count, zrodlo)
  values (true, now(), p_filename, v_count, p_zrodlo)
  on conflict (id) do update set
    uploaded_at = excluded.uploaded_at,
    filename = excluded.filename,
    record_count = excluded.record_count,
    zrodlo = excluded.zrodlo;

  return v_count;
end;
$$;

comment on function public.replace_route_assignments(text, jsonb, text) is
  'Podmiana calej bazy przypisan tras w jednej transakcji (walidacja: puste wartosci, konflikty numer->rozne trasy). Wszystko albo nic. shipment (admin, RLS) i kurier_appp (service_role).';

revoke execute on function public.replace_route_assignments(text, jsonb, text) from public, anon;
grant execute on function public.replace_route_assignments(text, jsonb, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- shipments: skad trasa + grupa NIEPRZYPISANE
-- ---------------------------------------------------------------------

alter table public.shipments drop constraint if exists shipments_grupa_check;
alter table public.shipments
  add constraint shipments_grupa_check check (grupa in ('P1', 'P2', 'P3', 'COY004', 'NIEPRZYPISANE'));

alter table public.shipments
  add column if not exists przypisanie text
  check (przypisanie in ('baza', 'brak_w_bazie', 'nieznana_trasa'));

comment on column public.shipments.przypisanie is
  'Skad trasa (od 0016): baza = z bazy przypisan tras, brak_w_bazie = numeru nie ma w bazie (trasa pusta), nieznana_trasa = trasa z bazy spoza tabeli routes. NULL = import sprzed 0016 (Chute ID).';

-- ---------------------------------------------------------------------
-- import_shipments: + przypisanie, + blokada bez dzisiejszej bazy
-- ---------------------------------------------------------------------

create or replace function public.import_shipments(
  p_import jsonb,
  p_shipments jsonb,
  p_prune_before date
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_import_id bigint;
  v_baza_dzien date;
begin
  -- Ta sama regula co w analyzeImport.ts (decyzja Adriana 2026-10-21):
  -- bez bazy przypisan tras albo z baza nie z dzisiaj (czas polski) importu
  -- nie ma -- inaczej przesylki dostalyby nieaktualne trasy.
  select (uploaded_at at time zone 'Europe/Warsaw')::date into v_baza_dzien
  from public.route_assignment_meta;
  if v_baza_dzien is null then
    raise exception 'Baza przypisań tras nie została wgrana — wgraj ją przed importem przesyłek.';
  end if;
  if v_baza_dzien <> (now() at time zone 'Europe/Warsaw')::date then
    raise exception 'Baza przypisań tras jest z % — wgraj dzisiejszą bazę przed importem przesyłek.', to_char(v_baza_dzien, 'DD.MM.YYYY');
  end if;

  insert into public.imports (
    panorama_filename,
    sherloc_filename,
    total_rows,
    matched_rows,
    unmatched_rows,
    unmapped_rows,
    today_rows,
    group_counts
  )
  values (
    p_import->>'panorama_filename',
    p_import->>'sherloc_filename',
    coalesce((p_import->>'total_rows')::integer, 0),
    coalesce((p_import->>'matched_rows')::integer, 0),
    coalesce((p_import->>'unmatched_rows')::integer, 0),
    coalesce((p_import->>'unmapped_rows')::integer, 0),
    coalesce((p_import->>'today_rows')::integer, 0),
    coalesce(p_import->'group_counts', '{}'::jsonb)
  )
  returning id into v_import_id;

  -- "id >= 0" zamiast braku WHERE: Supabase (safeupdate) blokuje DELETE bez
  -- warunku, takze "where true" -- patrz 0008.
  delete from public.shipments where id >= 0;

  insert into public.shipments (
    shipment_id, remarks, hwx, last_phy_cp, last_phy_cp_dt, weight_dimension,
    shp_calc_wgt, shp_tot_pcs, consignee_name, chute_id, receiver_name,
    rcvr_addr1, rcvr_postcode, rcvr_city, trasa, grupa, sortujacy, wystapilo,
    przypisanie, import_id
  )
  select
    x.shipment_id, x.remarks, x.hwx, x.last_phy_cp, x.last_phy_cp_dt, x.weight_dimension,
    x.shp_calc_wgt, x.shp_tot_pcs, x.consignee_name, x.chute_id, x.receiver_name,
    x.rcvr_addr1, x.rcvr_postcode, x.rcvr_city, x.trasa, x.grupa, x.sortujacy,
    coalesce(x.wystapilo, 1),
    x.przypisanie,
    v_import_id
  from jsonb_to_recordset(coalesce(p_shipments, '[]'::jsonb)) as x(
    shipment_id text,
    remarks text,
    hwx text,
    last_phy_cp text,
    last_phy_cp_dt timestamptz,
    weight_dimension text,
    shp_calc_wgt numeric,
    shp_tot_pcs numeric,
    consignee_name text,
    chute_id text,
    receiver_name text,
    rcvr_addr1 text,
    rcvr_postcode text,
    rcvr_city text,
    trasa text,
    grupa text,
    sortujacy text,
    wystapilo integer,
    przypisanie text
  );

  -- Retencja "Obsluzono": tylko wpisy starsze niz najstarsza przesylka w
  -- tym imporcie (albo dzisiaj) -- patrz README, sekcja Retencja.
  delete from public.shipment_actions where shipment_date < p_prune_before;

  return v_import_id;
end;
$$;

comment on function public.import_shipments(jsonb, jsonb, date) is
  'Atomowy zapis importu: wpis w imports + podmiana shipments + czyszczenie shipment_actions starszych niz p_prune_before. Wszystko albo nic. Od 0016 wymaga dzisiejszej bazy przypisan tras. Uzywana przez shipment (admin, RLS) i kurier_appp (service_role).';

revoke execute on function public.import_shipments(jsonb, jsonb, date) from public, anon;
grant execute on function public.import_shipments(jsonb, jsonb, date) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
