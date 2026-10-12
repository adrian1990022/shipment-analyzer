-- Kolumna "Loop" sortujacego (2026-10-13, decyzja Adriana). Zwykle jedna
-- litera loopa kuriera (A, B, ...), ale wolny tekst do 20 znakow -- np.
-- "zastępca". Opcjonalna (null = nie ustawiono). Docelowo kurier_appp
-- pokaze sortujacego w loopie o tym kodzie (wielkosc liter bez znaczenia)
-- -- na razie tylko kolumna (etap 1). RLS bez zmian (tylko admin).

begin;

alter table public.sorters
  add column if not exists loop text
  check (loop is null or char_length(loop) <= 20);

comment on column public.sorters.loop is
  'Loop sortujacego: zwykle litera loopa kuriera (A, B, ...) albo np. "zastępca". null = nie ustawiono.';

-- Backup/restore: loop w pliku OPCJONALNY (jak fullName w 0013) -- starsze
-- pliki wgrywaja sie z pustym loopem. Reszta bez zmian.
create or replace function public.replace_reference_data(payload jsonb)
returns void
language plpgsql
as $$
declare
  route jsonb;
  sorter jsonb;
  sr jsonb;
  new_sorter_id bigint;
  -- Klucz to id sortujacego Z CHWILI EKSPORTU, nie nazwa -- w realnych
  -- danych imiona nie sa unikalne (np. dwoch "Piotrek", dwoch "Dima"),
  -- wiec mapowanie po nazwie laczyloby przypisania roznych osob.
  sorter_id_by_old_id jsonb := '{}'::jsonb;
begin
  -- "where id >= 0" jest wymagane -- ochrona przed przypadkowym DELETE
  -- bez WHERE odrzuca nawet "where true" (nie referencjonuje zadnej
  -- kolumny), ale akceptuje warunek na id -- ten sam sprawdzony wzorzec
  -- co w shipmentsRepository.replaceShipments (dziala tam od poczatku).
  -- Wszystkie id sa dodatnie (bigint identity), wiec dopasowuje kazdy wiersz.
  delete from public.sorter_routes where id >= 0;
  delete from public.sorters where id >= 0;
  delete from public.routes where id >= 0;

  for route in select * from jsonb_array_elements(payload->'routes')
  loop
    insert into public.routes (chute_id, trasa, grupa)
    values (route->>'chuteId', route->>'trasa', route->>'grupa');
  end loop;

  for sorter in select * from jsonb_array_elements(payload->'sorters')
  loop
    insert into public.sorters (name, active, full_name, loop)
    values (
      sorter->>'name',
      (sorter->>'active')::boolean,
      nullif(btrim(sorter->>'fullName'), ''),
      nullif(btrim(sorter->>'loop'), '')
    )
    returning id into new_sorter_id;
    sorter_id_by_old_id := jsonb_set(sorter_id_by_old_id, array[sorter->>'id'], to_jsonb(new_sorter_id));
  end loop;

  for sr in select * from jsonb_array_elements(payload->'sorterRoutes')
  loop
    insert into public.sorter_routes (sorter_id, route)
    values ((sorter_id_by_old_id->>(sr->>'sorterId'))::bigint, sr->>'route');
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
