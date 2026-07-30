-- Backup / restore danych referencyjnych (routes, sorters, sorter_routes).
--
-- Prawdziwa transakcyjnosc importu wymaga funkcji SQL: klient Supabase
-- (REST/PostgREST) nie ma pojecia "transakcja obejmujaca wiele osobnych
-- zapytan z przegladarki" -- kazde .from(...) to osobna transakcja. Cale
-- cialo funkcji ponizej to JEDNA transakcja: blad w dowolnym miejscu
-- (np. grupa spoza P1/P2/P3, albo referencja do nieistniejacego
-- sortujacego) cofa WSZYSTKO, zgodnie z wymogiem "import jest
-- transakcyjny, blad = nie zapisuj czesci danych".
--
-- Funkcja NIE jest security definer -- dziala jako wywolujacy, wiec
-- istniejace polityki RLS (routes_admin_all, sorters_admin_all,
-- sorter_routes_admin_all) nadal obowiazuja bez duplikowania sprawdzania
-- roli admina wewnatrz funkcji.
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
    insert into public.sorters (name, active)
    values (sorter->>'name', (sorter->>'active')::boolean)
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

comment on function public.replace_reference_data(jsonb) is
  'Odtwarza routes/sorters/sorter_routes z backupu JSON w jednej transakcji (uzywane przez ReferenceBackupService). sorterRoutes referencjonuje sortujacych po id z chwili eksportu (sorterId), nie po nazwie -- nazwy nie sa unikalne (w realnych danych sa np. dwaj "Piotrek").';

grant execute on function public.replace_reference_data(jsonb) to authenticated;
