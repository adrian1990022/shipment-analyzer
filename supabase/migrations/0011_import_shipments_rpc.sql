-- Atomowy zapis importu (2026-09-28): JEDNA funkcja, ktora w jednej
-- transakcji
--   1) dopisuje wpis do imports (metadane importu),
--   2) podmienia CALA zawartosc shipments na nowy import,
--   3) czysci shipment_actions starsze niz p_prune_before.
-- Wczesniej robil to klient kilkoma osobnymi zapytaniami (insert imports ->
-- delete shipments -> insert partiami po 500 -> prune), wiec odswiezenie
-- ekranu w trakcie importu pokazywalo pusta/niepelna liste, a przerwany
-- import zostawial ja niepelna. Teraz: wszystko albo nic.
--
-- Uzywana przez OBIE aplikacje:
--   - shipment (ImportScreen -> shipmentsRepository.saveImport, jako
--     zalogowany admin -- RLS dziala, bo funkcja jest SECURITY INVOKER),
--   - kurier_appp (panel admina -> api/shipment-import.js, kluczem
--     service_role po sprawdzeniu, ze wywolujacy jest adminem kuriera).
-- Ksztalt argumentow buduje buildImportPayload
-- (src/modules/import/importPayload.ts) -- jedno miejsce dla obu aplikacji.
--
-- SECURITY INVOKER (domyslne) celowo: zwykly "user" shipment nie ma prawa
-- do insert/delete na shipments/imports (polityki *_admin_all z 0007/0009),
-- wiec nie zrobi importu takze przez te funkcje.

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
begin
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
    import_id
  )
  select
    x.shipment_id, x.remarks, x.hwx, x.last_phy_cp, x.last_phy_cp_dt, x.weight_dimension,
    x.shp_calc_wgt, x.shp_tot_pcs, x.consignee_name, x.chute_id, x.receiver_name,
    x.rcvr_addr1, x.rcvr_postcode, x.rcvr_city, x.trasa, x.grupa, x.sortujacy,
    coalesce(x.wystapilo, 1),
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
    wystapilo integer
  );

  -- Retencja "Obsluzono": tylko wpisy starsze niz najstarsza przesylka w
  -- tym imporcie (albo dzisiaj) -- patrz README, sekcja Retencja.
  delete from public.shipment_actions where shipment_date < p_prune_before;

  return v_import_id;
end;
$$;

comment on function public.import_shipments(jsonb, jsonb, date) is
  'Atomowy zapis importu: wpis w imports + podmiana shipments + czyszczenie shipment_actions starszych niz p_prune_before. Wszystko albo nic. Uzywana przez shipment (admin, RLS) i kurier_appp (service_role).';

revoke execute on function public.import_shipments(jsonb, jsonb, date) from public, anon;
grant execute on function public.import_shipments(jsonb, jsonb, date) to authenticated, service_role;
